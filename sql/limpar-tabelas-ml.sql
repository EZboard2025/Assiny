-- Limpar todas as tabelas ML para refazer o backfill
TRUNCATE TABLE meeting_patterns CASCADE;
TRUNCATE TABLE real_objection_bank CASCADE;
TRUNCATE TABLE conversation_flow_templates CASCADE;
