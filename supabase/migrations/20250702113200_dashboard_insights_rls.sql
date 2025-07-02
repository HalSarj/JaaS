-- Create dashboard_insights table with optimized RLS policies
-- This table is referenced in the dashboard-insights edge function but not yet in schema

CREATE TABLE IF NOT EXISTS dashboard_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_user_id ON dashboard_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_generated_at ON dashboard_insights(generated_at);

-- Enable RLS
ALTER TABLE dashboard_insights ENABLE ROW LEVEL SECURITY;

-- Create optimized RLS policy with cached auth calls
CREATE POLICY "Dashboard insights access policy" ON dashboard_insights
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR 
    (select auth.uid()) = user_id
  );

-- Add performance index for RLS
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_user_id_rls ON dashboard_insights(user_id) WHERE user_id IS NOT NULL;