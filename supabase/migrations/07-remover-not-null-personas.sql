-- Remover constraints NOT NULL das colunas PT-BR para permitir uso das colunas EN

ALTER TABLE personas ALTER COLUMN cargo DROP NOT NULL;
ALTER TABLE personas ALTER COLUMN contexto DROP NOT NULL;
ALTER TABLE personas ALTER COLUMN busca DROP NOT NULL;
ALTER TABLE personas ALTER COLUMN dores DROP NOT NULL;
ALTER TABLE personas ALTER COLUMN tipo_empresa_faturamento DROP NOT NULL;

-- Agora o código pode usar tanto as colunas PT-BR quanto EN