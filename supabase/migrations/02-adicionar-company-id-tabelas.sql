-- Adicionar company_id a todas as tabelas principais

ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE company_data ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE objections ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE roleplay_sessions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE pdis ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE user_performance_summaries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE company_type ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_company_data_company_id ON company_data(company_id);
CREATE INDEX IF NOT EXISTS idx_personas_company_id ON personas(company_id);
CREATE INDEX IF NOT EXISTS idx_objections_company_id ON objections(company_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_company_id ON roleplay_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_id ON chat_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_pdis_company_id ON pdis(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_user_performance_summaries_company_id ON user_performance_summaries(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_company_id ON knowledge_base(company_id);
CREATE INDEX IF NOT EXISTS idx_company_type_company_id ON company_type(company_id);