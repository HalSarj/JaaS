// functions/ingest/index.ts - Dropbox Webhook Handler
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dropbox-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET');
    const dropboxAccessToken = Deno.env.get('DROPBOX_ACCESS_TOKEN');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required Supabase environment variables');
      return new Response('Server configuration error', {
        status: 500,
        headers: corsHeaders
      });
    }

    // Handle Dropbox webhook verification (GET request)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const challenge = url.searchParams.get('challenge');
      
      if (challenge) {
        console.log('Dropbox webhook verification challenge received:', challenge);
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      return new Response('Webhook endpoint ready', {
        status: 200,
        headers: corsHeaders
      });
    }

    // For POST requests, we need Dropbox credentials
    if (!dropboxAppSecret || !dropboxAccessToken) {
      console.error('Missing Dropbox credentials - please set DROPBOX_APP_SECRET and DROPBOX_ACCESS_TOKEN');
      return new Response('Dropbox credentials not configured', {
        status: 500,
        headers: corsHeaders
      });
    }

    // Only allow POST method for webhook notifications
    if (req.method !== 'POST') {
      return new Response("Method not allowed", { 
        status: 405,
        headers: corsHeaders 
      });
    }

    // Verify Dropbox webhook signature
    const signature = req.headers.get('X-Dropbox-Signature');
    const requestBody = await req.text();
    
    if (!signature) {
      console.error('Missing Dropbox signature header');
      return new Response('Missing signature', {
        status: 401,
        headers: corsHeaders
      });
    }

    // Verify webhook signature
    const expectedSignature = createHmac("sha256", new TextEncoder().encode(dropboxAppSecret))
      .update(new TextEncoder().encode(requestBody))
      .digest("hex");
    
    if (signature !== expectedSignature) {
      console.error('Invalid Dropbox signature');
      return new Response('Invalid signature', {
        status: 401,
        headers: corsHeaders
      });
    }

    // Parse webhook payload
    let webhookData;
    try {
      webhookData = JSON.parse(requestBody);
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return new Response('Invalid JSON', {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('Dropbox webhook received:', JSON.stringify(webhookData, null, 2));

    // Initialize Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process webhook notifications
    const results: any[] = [];
    
    for (const account of webhookData.list_folder?.accounts || []) {
      console.log(`Processing account: ${account}`);
      
      // Get list of changes for this account
      const changesResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cursor: account
        })
      });

      if (!changesResponse.ok) {
        console.error(`Failed to get changes for account ${account}:`, await changesResponse.text());
        continue;
      }

      const changes = await changesResponse.json();
      
      // Process each file change
      for (const entry of changes.entries || []) {
        // Only process .m4a files that were added or modified
        if (entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.m4a')) {
          console.log(`Processing .m4a file: ${entry.path_display}`);
          
          try {
            const result = await processDropboxFile(entry, supabase, dropboxAccessToken);
            results.push(result);
          } catch (error) {
            console.error(`Failed to process file ${entry.path_display}:`, error);
            results.push({ 
              file: entry.path_display, 
              success: false, 
              error: error.message 
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed_files: results.length,
      results: results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unhandled error in webhook handler:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processDropboxFile(fileEntry: any, supabase: any, accessToken: string) {
  console.log(`Processing file: ${fileEntry.path_display}`);
  
  // Check if file already exists in database
  const { data: existingDream } = await supabase
    .from('dreams')
    .select('id')
    .eq('dropbox_path', fileEntry.path_display)
    .single();

  if (existingDream) {
    console.log(`File already processed: ${fileEntry.path_display}`);
    return {
      file: fileEntry.path_display,
      success: true,
      action: 'skipped',
      reason: 'already_processed'
    };
  }

  // Download file from Dropbox
  const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: fileEntry.path_display
      })
    }
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download file: ${await downloadResponse.text()}`);
  }

  const audioBuffer = await downloadResponse.arrayBuffer();
  
  // Validate file size
  if (audioBuffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${audioBuffer.byteLength} bytes. Max size: ${MAX_FILE_SIZE} bytes`);
  }

  // Create filename from Dropbox path
  const fileName = fileEntry.name || `dropbox-${Date.now()}.m4a`;
  
  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("dreams-audio")
    .upload(fileName, audioBuffer, {
      contentType: "audio/m4a",
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Create dream record in database
  const { data: dreamRecord, error: dbError } = await supabase
    .from('dreams')
    .insert({
      user_id: null,
      audio_path: uploadData.path,
      dropbox_path: fileEntry.path_display,
      dropbox_modified_time: fileEntry.server_modified || new Date().toISOString(),
      source: 'dropbox',
      status: 'uploaded',
      processing_attempts: 0
    })
    .select()
    .single();

  if (dbError) {
    // Clean up uploaded file
    await supabase.storage
      .from('dreams-audio')
      .remove([uploadData.path]);
    
    throw new Error(`Database insert failed: ${dbError.message}`);
  }

  // Trigger analysis function
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const analyzeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dream_id: dreamRecord.id,
        trigger: 'dropbox_webhook'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!analyzeResponse.ok) {
      console.warn('Failed to trigger analysis:', await analyzeResponse.text());
    }
  } catch (error) {
    console.warn('Failed to trigger analysis:', error);
    // Don't fail the ingest - analysis can be retried later
  }

  console.log(`Successfully processed: ${fileEntry.path_display} -> ${dreamRecord.id}`);
  
  return {
    file: fileEntry.path_display,
    success: true,
    action: 'processed',
    dream_id: dreamRecord.id,
    audio_path: uploadData.path,
    file_size: audioBuffer.byteLength
  };
}