-- Adiciona coluna para armazenar múltiplas formas de quebrar cada objeção
ALTER TABLE public.objections
ADD COLUMN IF NOT EXISTS rebuttals JSONB DEFAULT '[]'::jsonb;

-- Comentário explicativo da estrutura esperada:
-- rebuttals é um array de strings com diferentes formas de quebrar a objeção
-- Exemplo: ["Forma 1 de quebrar", "Forma 2 de quebrar", "Forma 3 de quebrar"]
