-- Add is_autopilot column to seller_message_tracking
-- Allows distinguishing autopilot-sent messages from manual seller messages
-- Used by the ML pipeline to tag autopilot examples in RAG tables
ALTER TABLE seller_message_tracking
  ADD COLUMN IF NOT EXISTS is_autopilot BOOLEAN DEFAULT false;
