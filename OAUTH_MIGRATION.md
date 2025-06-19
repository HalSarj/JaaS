# Dropbox OAuth 2 Migration Guide

This guide explains how to migrate from static Dropbox access tokens to a secure OAuth 2 implementation.

## 🚨 Why Migrate?

Your current implementation using static `DROPBOX_ACCESS_TOKEN` has several critical issues:

1. **Security Risk**: Tokens stored in environment variables can be compromised
2. **Token Expiration**: Static tokens expire without warning, breaking your app
3. **Limited Scalability**: Hard to support multiple users
4. **No Refresh Capability**: When tokens expire, manual regeneration is required
5. **Scope Management**: Difficult to manage permissions dynamically

## 🔄 OAuth 2 Benefits

The new OAuth 2 implementation provides:

- ✅ **Automatic Token Refresh**: Tokens are refreshed automatically before expiration
- ✅ **Secure Storage**: Tokens stored securely in database with RLS policies
- ✅ **Multi-User Support**: Each user has their own tokens
- ✅ **Better Error Handling**: Clear error messages and recovery flows
- ✅ **Audit Trail**: Track token usage and refresh events
- ✅ **Proper Scopes**: Request only necessary permissions

## 📋 Migration Steps

### 1. Deploy the OAuth System

```bash
# Make the deployment script executable
chmod +x deploy-oauth.sh

# Run the deployment
./deploy-oauth.sh
```

### 2. Update Dropbox App Configuration

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your existing app
3. **Permissions Tab**:
   - Enable `files.metadata.read`
   - Enable `files.content.read`
4. **Settings Tab**:
   - Add redirect URI: `https://YOUR-PROJECT.supabase.co/functions/v1/dropbox-oauth/callback`
   - Note your App Key and App Secret

### 3. Update Environment Variables

Remove the old token and add OAuth credentials:

```bash
# Remove old variable
supabase secrets unset DROPBOX_ACCESS_TOKEN

# Set new OAuth variables
supabase secrets set DROPBOX_APP_KEY=your_app_key_here
supabase secrets set DROPBOX_APP_SECRET=your_app_secret_here
```

### 4. Update Your Frontend

Replace any hardcoded token usage with the new `DropboxConnect` component:

```tsx
import { DropboxConnect } from './components/DropboxConnect';

function SettingsPage() {
  const userId = getCurrentUser().id;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div>
      <DropboxConnect userId={userId} supabaseUrl={supabaseUrl} />
    </div>
  );
}
```

### 5. User Re-authorization

All existing users will need to re-authorize:

1. Direct users to the settings page
2. They'll see a "Connect Dropbox" button
3. Clicking it starts the OAuth flow
4. After authorization, automatic processing resumes

## 🔧 API Endpoints

### OAuth Flow

- **Start Auth**: `GET /functions/v1/dropbox-oauth/auth?user_id={userId}`
- **Handle Callback**: `GET /functions/v1/dropbox-oauth/callback`
- **Check Status**: `GET /functions/v1/dropbox-oauth/status?user_id={userId}`
- **Refresh Token**: `POST /functions/v1/dropbox-oauth/refresh`

### Using the DropboxAuth Library

```typescript
import { DropboxAuth } from '../_shared/dropbox-auth.ts';

const dropboxAuth = new DropboxAuth();

// Check if user is authorized
const isAuthorized = await dropboxAuth.isAuthorized(userId);

// Make API calls (handles token refresh automatically)
const files = await dropboxAuth.listFolder(userId, '');

// Download files
const audioData = await dropboxAuth.downloadFile(userId, '/path/to/file.m4a');
```

## 🗄️ Database Schema

The migration adds these new tables:

```sql
-- OAuth state tracking (CSRF protection)
CREATE TABLE oauth_states (
  id uuid PRIMARY KEY,
  state text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

-- Token storage
CREATE TABLE dropbox_tokens (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  account_id text
);

-- Cursor tracking for webhooks
CREATE TABLE dropbox_cursor (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id),
  cursor text NOT NULL
);
```

## 🔒 Security Features

### Row Level Security (RLS)
- Users can only access their own tokens
- Service role can manage all tokens for processing
- Automatic cleanup of expired OAuth states

### Token Refresh Logic
```typescript
// Automatic refresh with 5-minute buffer
if (tokenExpiresAt <= now() + 5 minutes) {
  await refreshToken();
}
```

### Webhook Signature Verification
```typescript
// Verify webhook authenticity using HMAC-SHA256 and base64 encoding
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

const expectedSignature = btoa(
  String.fromCharCode(...new Uint8Array(signatureBytes))
);
```

## 🐛 Troubleshooting

### Common Issues

1. **"No Dropbox token found"**
   - User needs to complete OAuth flow
   - Check if user_id is correct

2. **"Token expired and no refresh token"**
   - User needs to re-authorize
   - Check Dropbox app configuration

3. **"Invalid signature"**
   - Verify `DROPBOX_APP_SECRET` is set correctly
   - Check webhook URL in Dropbox app settings

4. **"Missing scope"**
   - Update Dropbox app permissions
   - User needs to re-authorize to get new scopes

### Debug Endpoints

```bash
# Check token status
curl "https://YOUR-PROJECT.supabase.co/functions/v1/dropbox-oauth/status?user_id=USER_ID"

# Check environment variables
curl "https://YOUR-PROJECT.supabase.co/functions/v1/debug-env"
```

## 📊 Monitoring

Monitor your OAuth implementation:

```sql
-- Check token health
SELECT 
  user_id,
  expires_at,
  CASE 
    WHEN expires_at IS NULL THEN 'No expiration'
    WHEN expires_at > now() + interval '1 day' THEN 'Healthy'
    WHEN expires_at > now() THEN 'Expires soon'
    ELSE 'Expired'
  END as status
FROM dropbox_tokens;

-- Check recent OAuth activity
SELECT state, user_id, created_at 
FROM oauth_states 
ORDER BY created_at DESC 
LIMIT 10;
```

## 🚀 Next Steps

After migration:

1. **Remove Legacy Code**:
   - Delete `setup-dropbox-monitoring.js`
   - Remove `DROPBOX_ACCESS_TOKEN` references
   - Update documentation

2. **Test Thoroughly**:
   - Complete OAuth flow for test user
   - Upload test .m4a file
   - Verify processing works end-to-end

3. **Monitor Logs**:
   - Watch Supabase function logs
   - Check for token refresh events
   - Monitor webhook processing

4. **User Communication**:
   - Notify users about re-authorization requirement
   - Provide clear instructions
   - Set up support for OAuth issues

## 🔗 Resources

- [Dropbox OAuth 2 Guide](https://developers.dropbox.com/oauth-guide)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

**Migration Complete! 🎉**

Your Dropbox integration is now secure, scalable, and ready for production use. 