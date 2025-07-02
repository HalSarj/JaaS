-- RLS Performance Optimization
-- Phase 1: Fix auth function calls to use subqueries for better performance
-- Phase 2: Consolidate multiple permissive policies
-- Phase 3: Add performance indexes

-- Phase 1: Fix auth.uid() and auth.role() calls in existing policies
-- This wraps function calls in SELECT statements to cache results per query

-- Drop existing policies that need to be updated
-- oauth_states table
DROP POLICY IF EXISTS "Users can manage their own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Service role can manage all OAuth states" ON oauth_states;

-- dropbox_tokens table  
DROP POLICY IF EXISTS "Users can view their own tokens" ON dropbox_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON dropbox_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON dropbox_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON dropbox_tokens;
DROP POLICY IF EXISTS "Service role can manage all tokens" ON dropbox_tokens;

-- dropbox_cursor table
DROP POLICY IF EXISTS "Users can view their own cursor" ON dropbox_cursor;
DROP POLICY IF EXISTS "Users can insert their own cursor" ON dropbox_cursor;
DROP POLICY IF EXISTS "Users can update their own cursor" ON dropbox_cursor;
DROP POLICY IF EXISTS "Users can delete their own cursor" ON dropbox_cursor;
DROP POLICY IF EXISTS "Service role can manage all cursors" ON dropbox_cursor;

-- Phase 2: Create consolidated, optimized policies
-- oauth_states table - Consolidated policy with optimized auth calls
CREATE POLICY "OAuth states access policy" ON oauth_states
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- dropbox_tokens table - Separate policies by operation for better control
CREATE POLICY "Dropbox tokens select policy" ON dropbox_tokens
  FOR SELECT USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

CREATE POLICY "Dropbox tokens insert policy" ON dropbox_tokens
  FOR INSERT WITH CHECK (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

CREATE POLICY "Dropbox tokens update policy" ON dropbox_tokens
  FOR UPDATE USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

CREATE POLICY "Dropbox tokens delete policy" ON dropbox_tokens
  FOR DELETE USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- dropbox_cursor table - Consolidated policy
CREATE POLICY "Dropbox cursor access policy" ON dropbox_cursor
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- Phase 3: Add performance indexes for RLS policies
-- These indexes will speed up the user_id lookups in RLS policies
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id_rls ON oauth_states(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dropbox_tokens_user_id_rls ON dropbox_tokens(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dropbox_cursor_user_id_rls ON dropbox_cursor(user_id) WHERE user_id IS NOT NULL;

-- Note: dashboard_insights table doesn't exist in migrations yet, 
-- will handle when that table is formally defined in schema