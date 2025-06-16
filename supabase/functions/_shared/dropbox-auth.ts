import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DropboxToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  account_id?: string;
}

export class DropboxAuth {
  private supabase: SupabaseClient;
  private dropboxAppKey: string;
  private dropboxAppSecret: string;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.dropboxAppKey = Deno.env.get('DROPBOX_APP_KEY')!;
    this.dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET')!;

    if (!this.dropboxAppKey || !this.dropboxAppSecret) {
      throw new Error('Missing Dropbox app credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Get a valid access token for a user, refreshing if necessary
   */
  async getValidAccessToken(userId: string): Promise<string> {
    // First check if we have a valid token
    const { data: tokenRecord } = await this.supabase
      .from('dropbox_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!tokenRecord) {
      throw new Error('No Dropbox token found. User needs to reauthorize.');
    }

    // Check if token is expired
    const isExpired = tokenRecord.expires_at 
      ? new Date(tokenRecord.expires_at) <= new Date(Date.now() + 5 * 60 * 1000) // 5 minute buffer
      : false;

    if (!isExpired) {
      return tokenRecord.access_token;
    }

    // Token is expired, try to refresh
    if (!tokenRecord.refresh_token) {
      throw new Error('Token expired and no refresh token available. User needs to reauthorize.');
    }

    console.log(`Refreshing expired Dropbox token for user ${userId}`);
    
    try {
      const newToken = await this.refreshToken(tokenRecord.refresh_token);
      
      // Update the token in database
      const expiresAt = newToken.expires_in 
        ? new Date(Date.now() + newToken.expires_in * 1000).toISOString()
        : null;

      await this.supabase
        .from('dropbox_tokens')
        .update({
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token || tokenRecord.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      return newToken.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error('Failed to refresh token. User needs to reauthorize.');
    }
  }

  /**
   * Make an authenticated request to Dropbox API
   */
  async makeDropboxRequest(userId: string, endpoint: string, data: any = {}, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getValidAccessToken(userId);

    const url = `https://api.dropboxapi.com/2/${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(userId: string, path: string): Promise<ArrayBuffer> {
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox download error (${response.status}): ${errorText}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Check if user has valid Dropbox authorization
   */
  async isAuthorized(userId: string): Promise<boolean> {
    try {
      await this.getValidAccessToken(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's Dropbox account info
   */
  async getAccountInfo(userId: string): Promise<any> {
    return await this.makeDropboxRequest(userId, 'users/get_current_account');
  }

  /**
   * List files in a folder
   */
  async listFolder(userId: string, path: string = '', recursive: boolean = false): Promise<any> {
    return await this.makeDropboxRequest(userId, 'files/list_folder', {
      path,
      recursive,
      include_media_info: true,
      include_deleted: false,
      include_has_explicit_shared_members: false,
    });
  }

  /**
   * Get latest cursor for a folder (for webhook monitoring)
   */
  async getLatestCursor(userId: string, path: string = ''): Promise<string> {
    const response = await this.makeDropboxRequest(userId, 'files/list_folder/get_latest_cursor', {
      path,
      recursive: false,
    });
    return response.cursor;
  }

  /**
   * Check for changes since last cursor
   */
  async listFolderContinue(userId: string, cursor: string): Promise<any> {
    return await this.makeDropboxRequest(userId, 'files/list_folder/continue', {
      cursor,
    });
  }

  private async refreshToken(refreshToken: string): Promise<any> {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.dropboxAppKey,
        client_secret: this.dropboxAppSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Revoke user's access token
   */
  async revokeToken(userId: string): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      
      await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error revoking token:', error);
    }

    // Remove token from database regardless of API call result
    await this.supabase
      .from('dropbox_tokens')
      .delete()
      .eq('user_id', userId);
  }
} 