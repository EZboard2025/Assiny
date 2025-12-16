-- Create roleplay_objectives table
CREATE TABLE IF NOT EXISTS roleplay_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE roleplay_objectives ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage objectives for their company"
ON roleplay_objectives FOR ALL TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_roleplay_objectives_company_id ON roleplay_objectives(company_id);
