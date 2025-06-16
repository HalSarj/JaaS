// functions/ingest/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing required environment variables');
      return new Response('Server configuration error', {
        status: 500,
        headers: corsHeaders
      });
    }

    // Only allow POST method
    if (req.method !== 'POST') {
      return new Response("Method not allowed", { 
        status: 405,
        headers: corsHeaders 
      });
    }

    // Initialize Supabase client with the request headers (includes auth)
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') || '' },
        },
      }
    );

    // Use service role client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1 · read the raw request body (single file)
    const audioBuffer = await req.arrayBuffer();
    
    // Validate file size
    if (!audioBuffer.byteLength) {
      return new Response("No audio file provided", {
        status: 400,
        headers: corsHeaders
      });
    }

    if (audioBuffer.byteLength > MAX_FILE_SIZE) {
      return new Response(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, {
        status: 413,
        headers: corsHeaders
      });
    }

    // 2 · create meaningful filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `dream-${timestamp}.m4a`;

    // 3 · upload into the private bucket using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("dreams-audio")
      .upload(fileName, audioBuffer, {
        contentType: "audio/m4a",
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      
      // Handle specific storage errors
      if (uploadError.message.includes('Bucket not found')) {
        return new Response('Storage bucket not configured. Please create "dreams-audio" bucket.', {
          status: 500,
          headers: corsHeaders
        });
      }
      
      return new Response(`Storage error: ${uploadError.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }

    // 4 · create dream record in database
    // Use null for user_id to avoid foreign key constraint (user_id is nullable)
    const { data: dreamRecord, error: dbError } = await supabaseAdmin
      .from('dreams')
      .insert({
        user_id: null, // Use null instead of UUID to avoid foreign key constraint
        audio_path: uploadData.path,
        status: 'uploaded',
        processing_attempts: 0
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      
      // Try to clean up uploaded file
      await supabaseAdmin.storage
        .from('dreams-audio')
        .remove([uploadData.path]);

      return new Response(`Database error: ${dbError.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }

    // 5 · trigger analysis function (with timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dream_id: dreamRecord.id,
          trigger: 'ingest'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        console.warn('Failed to trigger analysis:', errorText);
        // Don't fail the ingest - analysis can be retried later
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Analysis trigger timed out');
      } else {
        console.warn('Failed to trigger analysis:', error);
      }
      // Don't fail the ingest - analysis can be retried later
    }

    return new Response(JSON.stringify({
      success: true,
      dream_id: dreamRecord.id,
      audio_path: uploadData.path,
      file_size: audioBuffer.byteLength,
      message: 'Dream uploaded successfully and queued for analysis'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unhandled error in ingest function:', error);
    
    // Handle specific error types
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
      statusCode = 408;
    } else if (error.message.includes('JWT')) {
      errorMessage = 'Authentication error';
      statusCode = 401;
    }
    
    return new Response(errorMessage, {
      status: statusCode,
      headers: corsHeaders
    });
  }
});