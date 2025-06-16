-- Add Dropbox-specific metadata columns to dreams table
ALTER TABLE dreams 
ADD COLUMN dropbox_path text,
ADD COLUMN dropbox_modified_time timestamptz,
ADD COLUMN source text DEFAULT 'dropbox' CHECK (source IN ('dropbox', 'manual'));

-- Create index for efficient duplicate detection
CREATE INDEX idx_dreams_dropbox_path ON dreams(dropbox_path) WHERE dropbox_path IS NOT NULL;
CREATE INDEX idx_dreams_source ON dreams(source);

-- Update existing records to have 'manual' source for backward compatibility
UPDATE dreams SET source = 'manual' WHERE source IS NULL;