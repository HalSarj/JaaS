-- Enable Row Level Security on all tables
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_motifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_tags ENABLE ROW LEVEL SECURITY;

-- Dreams table policies
CREATE POLICY "Users can view their own dreams" ON dreams
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dreams" ON dreams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dreams" ON dreams
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dreams" ON dreams
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all dreams (for processing functions)
CREATE POLICY "Service role can access all dreams" ON dreams
  FOR ALL USING (auth.role() = 'service_role');

-- Recurring motifs table policies
CREATE POLICY "Users can view their own motifs" ON recurring_motifs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own motifs" ON recurring_motifs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own motifs" ON recurring_motifs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own motifs" ON recurring_motifs
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all motifs
CREATE POLICY "Service role can access all motifs" ON recurring_motifs
  FOR ALL USING (auth.role() = 'service_role');

-- Weekly digests table policies
CREATE POLICY "Users can view their own digests" ON weekly_digests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own digests" ON weekly_digests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own digests" ON weekly_digests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own digests" ON weekly_digests
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all digests
CREATE POLICY "Service role can access all digests" ON weekly_digests
  FOR ALL USING (auth.role() = 'service_role');

-- Dream tags table policies
CREATE POLICY "Users can view their own dream tags" ON dream_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dreams 
      WHERE dreams.id = dream_tags.dream_id 
      AND dreams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tags for their own dreams" ON dream_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dreams 
      WHERE dreams.id = dream_tags.dream_id 
      AND dreams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own dream tags" ON dream_tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dreams 
      WHERE dreams.id = dream_tags.dream_id 
      AND dreams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own dream tags" ON dream_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM dreams 
      WHERE dreams.id = dream_tags.dream_id 
      AND dreams.user_id = auth.uid()
    )
  );

-- Service role can access all dream tags
CREATE POLICY "Service role can access all dream tags" ON dream_tags
  FOR ALL USING (auth.role() = 'service_role');