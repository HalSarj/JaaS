-- Tables for Dropbox OAuth 2 implementation

-- Store OAuth state for CSRF protection
CREATE TABLE oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);

-- Automatically clean up expired states
CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Store Dropbox OAuth tokens
CREATE TABLE dropbox_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  account_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for efficient token lookup
CREATE INDEX idx_dropbox_tokens_user_id ON dropbox_tokens(user_id);
CREATE INDEX idx_dropbox_tokens_expires_at ON dropbox_tokens(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS on the new tables
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropbox_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for oauth_states
CREATE POLICY "Users can manage their own OAuth states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all OAuth states" ON oauth_states
  FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for dropbox_tokens
CREATE POLICY "Users can view their own tokens" ON dropbox_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" ON dropbox_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" ON dropbox_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" ON dropbox_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tokens" ON dropbox_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Function to check if a user's token is valid/expired
CREATE OR REPLACE FUNCTION is_dropbox_token_valid(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  token_expires_at timestamptz;
BEGIN
  SELECT expires_at INTO token_expires_at
  FROM public.dropbox_tokens
  WHERE user_id = p_user_id;
  
  -- If no token found, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- If no expiration time set, assume token is valid
  IF token_expires_at IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if token is still valid (with 5-minute buffer)
  RETURN token_expires_at > (now() + interval '5 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''; 