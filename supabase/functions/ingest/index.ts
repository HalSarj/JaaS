// functions/ingest/index.ts - Dropbox Webhook Handler (FIXED)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dropbox-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`Webhook received: ${req.method} ${req.url}`);
    
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET');
    const dropboxAccessToken = Deno.env.get('DROPBOX_ACCESS_TOKEN');

    if (!supabaseUrl || !supabaseServiceKey || !dropboxAccessToken) {
      console.error('Missing required environment variables');
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
      
      return new Response('Webhook handler ready', {
        status: 200,
        headers: corsHeaders
      });
    }

    // For POST requests - process Dropbox webhooks
    if (req.method === 'POST') {
      const requestBody = await req.text();
      console.log('POST webhook received, body length:', requestBody.length);
      console.log('Raw request body:', requestBody);

      // Verify webhook signature
      const signature = req.headers.get('x-dropbox-signature');
      if (dropboxAppSecret && signature) {
        const expectedSignature = await generateHMAC(dropboxAppSecret, requestBody);
        const receivedSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
        
        if (receivedSignature !== expectedSignature) {
          console.error('Invalid Dropbox signature');
          return new Response('Invalid signature', {
            status: 401,
            headers: corsHeaders
          });
        }
      }

      try {
        const webhookData = JSON.parse(requestBody);
        console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Process the webhook notification
        // Note: Dropbox just tells us "something changed" - we need to check what
        const result = await processDropboxChanges(supabase, dropboxAccessToken);

        return new Response(JSON.stringify({
          success: true,
          message: 'Webhook processed successfully',
          processed_files: result.processed,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Failed to process webhook:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Webhook processing failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Unhandled error in webhook handler:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to generate HMAC-SHA256 signature
async function generateHMAC(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Process Dropbox changes using cursor tracking
async function processDropboxChanges(supabase: any, accessToken: string) {
  console.log('Processing Dropbox changes...');

  // Get stored cursor
  let { data: cursorData } = await supabase
    .from('dropbox_cursor')
    .select('cursor')
    .eq('id', 1)
    .single();

  let cursor = cursorData?.cursor;
  let processedCount = 0;

  // If no cursor exists, get initial cursor
  if (!cursor) {
    console.log('No cursor found, initializing...');
    
    const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: "", // Root of app folder
        recursive: true
      })
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to get initial folder listing: ${await listResponse.text()}`);
    }

    const listData = await listResponse.json();
    cursor = listData.cursor;
    
    console.log('Initial cursor obtained:', cursor);
    
    // Store initial cursor
    await supabase
      .from('dropbox_cursor')
      .upsert({ 
        id: 1, 
        cursor, 
        updated_at: new Date().toISOString() 
      });

    // Process initial files if any
    for (const entry of listData.entries || []) {
      if (entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.m4a')) {
        console.log('Processing initial file:', entry.name);
        await processAudioFile(entry, supabase, accessToken);
        processedCount++;
      }
    }
  }

  // Get changes since last cursor
  console.log('Checking for changes with cursor:', cursor);
  
  const changesResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cursor })
  });

  if (!changesResponse.ok) {
    throw new Error(`Failed to get changes: ${await changesResponse.text()}`);
  }

  const changes = await changesResponse.json();
  console.log('Changes received:', JSON.stringify(changes, null, 2));

  // Process new/changed files
  for (const entry of changes.entries || []) {
    if (entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.m4a')) {
      console.log('Processing changed file:', entry.name);
      await processAudioFile(entry, supabase, accessToken);
      processedCount++;
    }
  }

  // Update cursor
  await supabase
    .from('dropbox_cursor')
    .upsert({ 
      id: 1, 
      cursor: changes.cursor, 
      updated_at: new Date().toISOString() 
    });

  console.log(`Processed ${processedCount} files`);
  return { processed: processedCount };
}

// Process individual audio file
async function processAudioFile(fileEntry: any, supabase: any, accessToken: string) {
  console.log('Processing audio file:', fileEntry.name);
  
  try {
    // Check if file already processed (use path_lower for consistency)
    const { data: existingDream } = await supabase
      .from('dreams')
      .select('id')
      .eq('dropbox_path', fileEntry.path_lower)
      .single();

    if (existingDream) {
      console.log('File already processed, skipping:', fileEntry.name);
      return;
    }

    // Download file from Dropbox
    const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: fileEntry.path_lower
        })
      }
    });

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file: ${downloadResponse.status} ${await downloadResponse.text()}`);
    }

    const audioBuffer = await downloadResponse.arrayBuffer();
    
    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}-${fileEntry.name}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('dreams-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/m4a'
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    console.log('File uploaded to storage:', fileName);

    // Create dream record
    const { data: dreamData, error: dreamError } = await supabase
      .from('dreams')
      .insert({
        user_id: null, // Keep consistent with existing dreams
        audio_path: fileName,
        status: 'uploaded',
        source: 'dropbox',
        dropbox_path: fileEntry.path_lower,
        dropbox_modified_time: fileEntry.server_modified,
        processing_attempts: 0
      })
      .select()
      .single();

    if (dreamError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from('dreams-audio')
        .remove([fileName]);
      throw new Error(`Failed to create dream record: ${dreamError.message}`);
    }

    console.log('Dream record created:', dreamData.id);

    // Trigger analysis
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/analyze`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dream_id: dreamData.id,
            trigger: 'ingest'
          })
        });

        if (analysisResponse.ok) {
          console.log('Analysis triggered for dream:', dreamData.id);
        } else {
          console.error('Failed to trigger analysis:', await analysisResponse.text());
        }
      } catch (error) {
        console.warn('Failed to trigger analysis (non-fatal):', error);
      }
    }

  } catch (error) {
    console.error('Error processing audio file:', fileEntry.name, error);
    throw error;
  }
}