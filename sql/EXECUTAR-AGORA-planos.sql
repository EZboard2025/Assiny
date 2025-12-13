-- ⚠️ EXECUTAR ESTE SQL NO SUPABASE SQL EDITOR ⚠️
-- Este SQL resolve o problema dos planos

-- Passo 1: Adicionar as novas colunas de planos
ALTER TABLE companies ADD COLUMN IF NOT EXISTS training_plan TEXT DEFAULT 'og';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan TEXT DEFAULT NULL;

-- Passo 2: Adicionar colunas de controle
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_reset_at TIMESTAMP DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_candidates_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan_expires_at TIMESTAMP;

-- Passo 3: Definir valores padrão
UPDATE companies SET training_plan = 'og' WHERE training_plan IS NULL;