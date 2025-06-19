// functions/ingest/index.ts - Dropbox Webhook Handler with OAuth 2
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DropboxAuth } from "../_shared/dropbox-auth.ts";

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
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET');

    const envCheck = {
      supabaseUrl: !!supabaseUrl,
      supabaseServiceKey: !!supabaseServiceKey,
      dropboxAppSecret: !!dropboxAppSecret,
      supabaseUrlLength: supabaseUrl ? supabaseUrl.length : 0,
      serviceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
    };

    console.log('Environment check:', envCheck);

    // Handle Dropbox webhook verification (GET request)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const challenge = url.searchParams.get('challenge');
      
      if (challenge) {
        console.log('Challenge received:', challenge);
        
        // Check if we have required env vars
        if (!supabaseUrl || !supabaseServiceKey || !dropboxAppSecret) {
          console.error('Missing env vars:', envCheck);
          return new Response(JSON.stringify({
            error: 'Missing environment variables',
            envCheck
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      return new Response(JSON.stringify({
        message: 'Webhook handler ready',
        envCheck
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle POST webhook notifications
    if (req.method === 'POST') {
      const body = await req.text();
      console.log('Webhook body:', body);

      // Verify webhook signature
      const signature = req.headers.get('x-dropbox-signature');
      if (!signature) {
        console.error('Missing Dropbox signature');
        return new Response('Missing signature', { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Verify signature using HMAC-SHA256 (Dropbox standard)
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(dropboxAppSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(body)
      );

      // Dropbox sends the signature as base64, so convert the bytes accordingly
      const expectedSignature = btoa(
        String.fromCharCode(...new Uint8Array(signatureBytes))
      );

      console.log('Signature verification:', {
        received: signature,
        expected: expectedSignature,
        bodyLength: body.length,
        secretLength: dropboxAppSecret?.length || 0
      });

      if (signature !== expectedSignature) {
        console.error('Invalid signature');
        return new Response('Invalid signature', {
          status: 403,
          headers: corsHeaders
        });
      }

      console.log('Webhook signature verified');

      // Initialize Supabase client
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const dropboxAuth = new DropboxAuth();

      // Get all users with Dropbox tokens
      const { data: users } = await supabase
        .from('dropbox_tokens')
        .select('user_id')
        .not('access_token', 'is', null);

      if (!users || users.length === 0) {
        console.log('No users with Dropbox tokens found');
        return new Response('OK', { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      // Process changes for each user
      for (const user of users) {
        try {
          await processDropboxChanges(user.user_id, supabase, dropboxAuth);
        } catch (error) {
          console.error(`Error processing changes for user ${user.user_id}:`, error);
        }
      }

      return new Response('OK', { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({
      message: 'Method not allowed',
      envCheck
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Process Dropbox changes for a specific user
async function processDropboxChanges(userId: string, supabase: any, dropboxAuth: DropboxAuth) {
  console.log(`Processing Dropbox changes for user: ${userId}`);

  try {
    // Check if user is authorized
    const isAuthorized = await dropboxAuth.isAuthorized(userId);
    if (!isAuthorized) {
      console.log(`User ${userId} not authorized for Dropbox`);
      return;
    }

    // Get current cursor from database or initialize it
    let { data: cursorRecord } = await supabase
      .from('dropbox_cursor')
      .select('cursor')
      .eq('user_id', userId)
      .single();

    let cursor = cursorRecord?.cursor;

    if (!cursor) {
      // Initialize cursor for this user
      console.log(`Initializing cursor for user ${userId}`);
      cursor = await dropboxAuth.getLatestCursor(userId);
      
      await supabase
        .from('dropbox_cursor')
        .upsert({
          user_id: userId,
          cursor,
          updated_at: new Date().toISOString()
        });
      
      console.log(`Cursor initialized: ${cursor}`);
      return; // Don't process files on initial setup
    }

    // Check for changes since last cursor
    console.log(`Checking for changes since cursor: ${cursor}`);
    const changes = await dropboxAuth.listFolderContinue(userId, cursor);

    console.log(`Raw changes response:`, JSON.stringify(changes, null, 2));

    if (changes.entries.length === 0) {
      console.log('No changes found');
      return;
    }

    console.log(`Found ${changes.entries.length} changes`);

    // Process new .m4a files
    console.log(`Processing ${changes.entries.length} entries for user ${userId}`);
    for (const entry of changes.entries) {
      console.log(`Entry: ${entry['.tag']}, name: ${entry.name}, path: ${entry.path_lower || 'no path'}`);
      if (entry['.tag'] === 'file' && entry.name.endsWith('.m4a')) {
        console.log(`Found .m4a file: ${entry.name}, processing...`);
        await processNewAudioFile(userId, entry, supabase, dropboxAuth);
      } else {
        console.log(`Skipping entry: ${entry['.tag']} - ${entry.name}`);
      }
    }

    // Update cursor
    await supabase
      .from('dropbox_cursor')
      .update({
        cursor: changes.cursor,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    console.log(`Cursor updated to: ${changes.cursor}`);

  } catch (error) {
    console.error(`Error processing changes for user ${userId}:`, error);
  }
}

// Process a new audio file
async function processNewAudioFile(userId: string, file: any, supabase: any, dropboxAuth: DropboxAuth) {
  console.log(`Processing new audio file: ${file.name}`);

  try {
    // Check if file already exists in database
    const { data: existing } = await supabase
      .from('dreams')
      .select('id')
      .eq('user_id', userId)
      .eq('dropbox_path', file.path_lower)
      .single();

    if (existing) {
      console.log(`File ${file.name} already processed`);
      return;
    }

    // Download the file
    console.log(`Downloading file: ${file.name}`);
    const audioData = await dropboxAuth.downloadFile(userId, file.path_lower);

    // Store audio file in Supabase Storage with clean naming
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `dream-${timestamp}-${crypto.randomUUID().slice(0, 8)}.m4a`;
    const { error: uploadError } = await supabase.storage
      .from('dreams-audio')
      .upload(fileName, audioData, {
        contentType: 'audio/m4a'
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Create dream record (using NULL user_id for frontend compatibility)
    const { data: dream, error: insertError } = await supabase
      .from('dreams')
      .insert({
        user_id: null, // Use NULL for anonymous frontend access
        audio_path: fileName,
        dropbox_path: file.path_lower,
        dropbox_modified_time: file.server_modified,
        source: 'dropbox',
        status: 'uploaded'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create dream record: ${insertError.message}`);
    }

    console.log(`Created dream record: ${dream.id}`);

    // Trigger analysis
    const analyzeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze`;
    await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        dream_id: dream.id,
        trigger: 'ingest'
      })
    });

    console.log(`Analysis triggered for dream: ${dream.id}`);

  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
  }
}