import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, secureHeaders, errorHeaders, successHeaders } from "../_shared/security-headers.ts";

interface DropboxTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
  account_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const dropboxAppKey = Deno.env.get('DROPBOX_APP_KEY')!;
    const dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET')!;
    const redirectUri = Deno.env.get('DROPBOX_REDIRECT_URI') || `${supabaseUrl}/functions/v1/dropbox-oauth/callback`;

    if (!dropboxAppKey || !dropboxAppSecret) {
      throw new Error('Missing Dropbox app credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route: Start OAuth flow
    if (pathname.endsWith('/auth') && req.method === 'GET') {
      const state = crypto.randomUUID();
      const userId = url.searchParams.get('user_id');

      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store state in database for verification (using service role)
      const { error: stateError } = await supabase
        .from('oauth_states')
        .insert({ state, user_id: userId, created_at: new Date().toISOString() });
      
      if (stateError) {
        console.error('Failed to store OAuth state:', stateError);
        return new Response(JSON.stringify({ error: 'Failed to initiate OAuth' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
      authUrl.searchParams.set('client_id', dropboxAppKey);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('scope', 'files.metadata.read files.content.read');
      authUrl.searchParams.set('token_access_type', 'offline'); // Request refresh token

      return Response.redirect(authUrl.toString(), 302);
    }

    // Route: Handle OAuth callback
    if (pathname.endsWith('/callback') && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        throw new Error(`Dropbox OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state');
      }

      // Verify state
      const { data: stateRecord } = await supabase
        .from('oauth_states')
        .select('user_id')
        .eq('state', state)
        .single();

      if (!stateRecord) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for tokens
      const tokenResponse = await exchangeCodeForTokens(code, dropboxAppKey, dropboxAppSecret, redirectUri);

      // Store tokens in database
      const expiresAt = tokenResponse.expires_in 
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : null;

      await supabase
        .from('dropbox_tokens')
        .upsert({
          user_id: stateRecord.user_id,
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          expires_at: expiresAt,
          scope: tokenResponse.scope,
          account_id: tokenResponse.account_id,
          updated_at: new Date().toISOString()
        });

      // Clean up state
      await supabase
        .from('oauth_states')
        .delete()
        .eq('state', state);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Dropbox connected successfully!' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route: Refresh token
    if (pathname.endsWith('/refresh') && req.method === 'POST') {
      const { user_id } = await req.json();

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: tokenRecord } = await supabase
        .from('dropbox_tokens')
        .select('refresh_token')
        .eq('user_id', user_id)
        .single();

      if (!tokenRecord?.refresh_token) {
        return new Response(JSON.stringify({ error: 'No refresh token available' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenResponse = await refreshAccessToken(tokenRecord.refresh_token, dropboxAppKey, dropboxAppSecret);

      const expiresAt = tokenResponse.expires_in 
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : null;

      await supabase
        .from('dropbox_tokens')
        .update({
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token || tokenRecord.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id);

      return new Response(JSON.stringify({ 
        success: true, 
        access_token: tokenResponse.access_token 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route: Get current token status
    if (pathname.endsWith('/status') && req.method === 'GET') {
      const userId = url.searchParams.get('user_id');

      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: tokenRecord } = await supabase
        .from('dropbox_tokens')
        .select('expires_at, scope, account_id, updated_at')
        .eq('user_id', userId)
        .single();

      if (!tokenRecord) {
        return new Response(JSON.stringify({ 
          connected: false, 
          message: 'No Dropbox connection found' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const isExpired = tokenRecord.expires_at 
        ? new Date(tokenRecord.expires_at) <= new Date()
        : false;

      return new Response(JSON.stringify({ 
        connected: true,
        expired: isExpired,
        expires_at: tokenRecord.expires_at,
        scope: tokenRecord.scope,
        account_id: tokenRecord.account_id,
        last_updated: tokenRecord.updated_at
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function exchangeCodeForTokens(
  code: string, 
  clientId: string, 
  clientSecret: string, 
  redirectUri: string
): Promise<DropboxTokenResponse> {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

async function refreshAccessToken(
  refreshToken: string, 
  clientId: string, 
  clientSecret: string
): Promise<DropboxTokenResponse> {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
} 