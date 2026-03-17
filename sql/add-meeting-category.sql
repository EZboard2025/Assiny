-- Adiciona colunas de categoria de reunião
-- meeting_category: "sales" ou "non_sales"
-- meeting_category_detail: subcategoria (prospeccao, discovery, alinhamento, etc.)

ALTER TABLE meet_evaluations ADD COLUMN IF NOT EXISTS meeting_category TEXT;
ALTER TABLE meet_evaluations ADD COLUMN IF NOT EXISTS meeting_category_detail TEXT;
