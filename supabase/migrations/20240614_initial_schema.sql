-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Main dreams table
CREATE TABLE dreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Audio and transcription
  audio_path text NOT NULL,
  transcript text,
  transcript_confidence real,
  
  -- Analysis data
  analysis jsonb,
  embedding vector(1536),
  
  -- Processing status
  status text DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'transcribing', 'analyzing', 'complete', 'failed')),
  error_message text,
  processing_attempts integer DEFAULT 0,
  
  -- Metadata
  audio_duration_seconds real,
  
  CONSTRAINT valid_processing_attempts CHECK (processing_attempts >= 0 AND processing_attempts <= 5)
);

-- Recurring motifs tracking
CREATE TABLE recurring_motifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  motif text NOT NULL,
  category text, -- 'person', 'place', 'object', 'emotion', 'action', 'symbol'
  first_seen date NOT NULL,
  last_seen date NOT NULL,
  count integer DEFAULT 1 CHECK (count > 0),
  confidence_score real DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, motif)
);

-- Weekly digests
CREATE TABLE weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  
  -- Content
  summary text,
  key_themes text[],
  emotional_patterns jsonb,
  recurring_motifs_summary jsonb,
  insights text[],
  
  -- Metadata
  dreams_analyzed integer DEFAULT 0,
  token_cost numeric(10,4),
  processing_time_seconds real,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, week_start),
  CONSTRAINT valid_week_dates CHECK (week_end > week_start),
  CONSTRAINT valid_dreams_count CHECK (dreams_analyzed >= 0)
);

-- Dream tags for flexible categorization
CREATE TABLE dream_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id uuid REFERENCES dreams(id) ON DELETE CASCADE,
  tag text NOT NULL,
  confidence real DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  source text DEFAULT 'user' CHECK (source IN ('user', 'ai', 'pattern_detection')),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(dream_id, tag)
);

-- Create indexes for performance
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_status ON dreams(status);
-- CREATE INDEX idx_dreams_recording_date ON dreams(recording_date); -- Removed generated column
CREATE INDEX idx_dreams_created_at ON dreams(created_at);
CREATE INDEX idx_dreams_embedding ON dreams USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_recurring_motifs_user_id ON recurring_motifs(user_id);
CREATE INDEX idx_recurring_motifs_category ON recurring_motifs(category);
CREATE INDEX idx_recurring_motifs_last_seen ON recurring_motifs(last_seen);

CREATE INDEX idx_weekly_digests_user_id ON weekly_digests(user_id);
CREATE INDEX idx_weekly_digests_week_start ON weekly_digests(week_start);

CREATE INDEX idx_dream_tags_dream_id ON dream_tags(dream_id);
CREATE INDEX idx_dream_tags_tag ON dream_tags(tag);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_dreams_updated_at 
    BEFORE UPDATE ON dreams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_motifs_updated_at 
    BEFORE UPDATE ON recurring_motifs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();