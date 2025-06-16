-- Table for tracking Dropbox folder cursors per user
CREATE TABLE dropbox_cursor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  cursor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for efficient cursor lookup
CREATE INDEX idx_dropbox_cursor_user_id ON dropbox_cursor(user_id);

-- Enable RLS
ALTER TABLE dropbox_cursor ENABLE ROW LEVEL SECURITY;

-- RLS policies for dropbox_cursor
CREATE POLICY "Users can view their own cursor" ON dropbox_cursor
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cursor" ON dropbox_cursor
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cursor" ON dropbox_cursor
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cursor" ON dropbox_cursor
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all cursors" ON dropbox_cursor
  FOR ALL USING (auth.role() = 'service_role'); 