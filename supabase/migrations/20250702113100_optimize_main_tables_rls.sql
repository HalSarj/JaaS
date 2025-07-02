-- Optimize RLS policies for main dream analysis tables
-- Fix auth.uid() and auth.role() calls for better performance

-- Dreams table policies optimization
DROP POLICY IF EXISTS "Users can view their own dreams" ON dreams;
DROP POLICY IF EXISTS "Users can insert their own dreams" ON dreams;
DROP POLICY IF EXISTS "Users can update their own dreams" ON dreams;
DROP POLICY IF EXISTS "Users can delete their own dreams" ON dreams;
DROP POLICY IF EXISTS "Service role can access all dreams" ON dreams;

-- Create optimized dreams policies with cached auth calls
CREATE POLICY "Dreams access policy" ON dreams
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- Recurring motifs table policies optimization
DROP POLICY IF EXISTS "Users can view their own motifs" ON recurring_motifs;
DROP POLICY IF EXISTS "Users can insert their own motifs" ON recurring_motifs;
DROP POLICY IF EXISTS "Users can update their own motifs" ON recurring_motifs;
DROP POLICY IF EXISTS "Users can delete their own motifs" ON recurring_motifs;
DROP POLICY IF EXISTS "Service role can access all motifs" ON recurring_motifs;

CREATE POLICY "Recurring motifs access policy" ON recurring_motifs
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- Weekly digests table policies optimization
DROP POLICY IF EXISTS "Users can view their own digests" ON weekly_digests;
DROP POLICY IF EXISTS "Users can insert their own digests" ON weekly_digests;
DROP POLICY IF EXISTS "Users can update their own digests" ON weekly_digests;
DROP POLICY IF EXISTS "Users can delete their own digests" ON weekly_digests;
DROP POLICY IF EXISTS "Service role can access all digests" ON weekly_digests;

CREATE POLICY "Weekly digests access policy" ON weekly_digests
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- Dream tags table policies optimization
-- Note: This table has a more complex policy that joins to dreams table
DROP POLICY IF EXISTS "Users can view their own dream tags" ON dream_tags;
DROP POLICY IF EXISTS "Users can insert tags for their own dreams" ON dream_tags;
DROP POLICY IF EXISTS "Users can update their own dream tags" ON dream_tags;
DROP POLICY IF EXISTS "Users can delete their own dream tags" ON dream_tags;
DROP POLICY IF EXISTS "Service role can access all dream tags" ON dream_tags;

-- Create optimized dream tags policy with cached auth calls and optimized join
CREATE POLICY "Dream tags access policy" ON dream_tags
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    dream_id IN (
      SELECT id FROM dreams 
      WHERE user_id = (select auth.uid())
    )
  );

-- Add performance indexes for the main tables
CREATE INDEX IF NOT EXISTS idx_dreams_user_id_rls ON dreams(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_motifs_user_id_rls ON recurring_motifs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_id_rls ON weekly_digests(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dream_tags_dream_id_rls ON dream_tags(dream_id);

-- Add compound index for dream_tags to support the optimized join
CREATE INDEX IF NOT EXISTS idx_dreams_id_user_id_rls ON dreams(id, user_id) WHERE user_id IS NOT NULL;