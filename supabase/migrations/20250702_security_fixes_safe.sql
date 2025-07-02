-- Security fixes for Supabase security recommendations
-- Addresses: function_search_path_mutable

-- Fix cleanup_expired_oauth_states function with proper search_path security
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix is_dropbox_token_valid function with proper search_path security
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

-- =====================================================
-- VECTOR EXTENSION MIGRATION NOTES
-- =====================================================
--
-- The vector extension is currently installed in the public schema
-- but should be moved to the extensions schema for security best practices.
-- However, this requires special handling due to existing dependencies:
--
-- Dependencies found:
-- - Column `dreams.embedding` of type vector(1536)
-- - Function `search_dreams(vector, uuid, double precision, integer)`
-- - IVFFlat index on dreams.embedding
--
-- To safely migrate the vector extension:
-- 1. This should be done during a maintenance window
-- 2. The migration would require dropping and recreating dependencies
-- 3. Consider updating search_path to include extensions schema
--
-- For now, we're leaving the vector extension in public schema
-- to avoid breaking the application. This can be addressed in a
-- separate maintenance migration.

-- =====================================================
-- MANUAL CONFIGURATION REQUIRED IN SUPABASE DASHBOARD
-- =====================================================
--
-- The following security recommendations must be configured
-- manually in the Supabase dashboard:
--
-- 1. LEAKED PASSWORD PROTECTION:
--    - Go to: Dashboard > Authentication > Settings
--    - Enable "Check passwords against HaveIBeenPwned"
--    - Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
--
-- 2. MULTI-FACTOR AUTHENTICATION (MFA):
--    - Go to: Dashboard > Authentication > Settings
--    - Enable additional MFA methods (TOTP, SMS, etc.)
--    - Reference: https://supabase.com/docs/guides/auth/auth-mfa
--
-- 3. VECTOR EXTENSION IN PUBLIC SCHEMA:
--    - The vector extension should be moved to extensions schema
--    - This requires a maintenance window and careful migration
--    - Current dependencies: dreams.embedding column, search_dreams function
--
-- Items 1 and 2 cannot be configured via SQL migrations and require
-- dashboard access with appropriate permissions.