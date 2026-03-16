-- ============================================================================
-- ML Pipeline fixes: missing columns + pgvector extension
-- ============================================================================

-- Ensure pgvector extension exists (required for ML tables)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add missing columns to meet_evaluations
ALTER TABLE meet_evaluations ADD COLUMN IF NOT EXISTS smart_notes JSONB;
ALTER TABLE meet_evaluations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'vexa';
