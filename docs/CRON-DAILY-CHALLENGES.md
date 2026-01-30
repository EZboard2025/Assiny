# Configuração do Cron Job - Desafios Diários

## Visão Geral

O sistema de desafios diários gera automaticamente desafios personalizados para todos os vendedores das empresas que têm essa funcionalidade habilitada. A geração acontece todos os dias às **10:00 da manhã**.

## Endpoint

```
POST /api/challenges/generate-all
Authorization: Bearer {CRON_SECRET}
```

## Variáveis de Ambiente

Adicione ao `.env.local` (e no servidor de produção):

```bash
CRON_SECRET=sua-chave-secreta-aqui
```

**Importante:** Use uma chave forte e única. Exemplo:
```bash
CRON_SECRET=$(openssl rand -hex 32)
```

## Configuração no Servidor (Hostinger VPS)

### 1. Acesse o servidor

```bash
ssh root@31.97.84.130
```

### 2. Configure a variável de ambiente

```bash
nano /var/www/assiny/.env.local
```

Adicione:
```
CRON_SECRET=sua-chave-secreta-forte
```

### 3. Crie o script de execução

```bash
nano /var/www/assiny/scripts/generate-daily-challenges.sh
```

Conteúdo:
```bash
#!/bin/bash
CRON_SECRET="sua-chave-secreta-forte"
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://ramppy.site/api/challenges/generate-all \
  >> /var/log/assiny/daily-challenges.log 2>&1
```

### 4. Torne o script executável

```bash
chmod +x /var/www/assiny/scripts/generate-daily-challenges.sh
```

### 5. Crie o diretório de logs

```bash
mkdir -p /var/log/assiny
```

### 6. Configure o cron job

```bash
crontab -e
```

Adicione a linha:
```
0 10 * * * /var/www/assiny/scripts/generate-daily-challenges.sh
```

Isso executa todos os dias às 10:00 (horário do servidor).

### 7. Verifique o cron

```bash
crontab -l
```

## Monitoramento

### Ver logs da última execução
```bash
tail -100 /var/log/assiny/daily-challenges.log
```

### Testar manualmente
```bash
/var/www/assiny/scripts/generate-daily-challenges.sh
```

## Informações Retornadas

O endpoint retorna:
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:00:00.000Z",
  "summary": {
    "generated": 15,
    "skipped": 3,
    "errors": 0,
    "creditsUsed": 15
  },
  "results": [
    {
      "userId": "uuid",
      "userName": "João Silva",
      "companyId": "uuid",
      "companyName": "Empresa X",
      "status": "success",
      "challengeId": "uuid"
    }
  ]
}
```

## Razões para Skip

Um vendedor pode ser pulado por:
- Já possui desafio hoje
- Empresa sem créditos suficientes
- Dados insuficientes para análise
- Empresa sem personas configuradas
- Nenhuma fraqueza detectada (boa performance)

## SQL Necessário

Execute em ordem no Supabase:

1. `sql/criar-tabela-daily-challenges.sql` - Cria tabelas de desafios
2. `sql/criar-tabela-system-settings.sql` - Cria tabela de configurações do sistema

## Painel Admin

O painel em `/admin/companies` mostra:
- Contagem regressiva para próxima geração
- Número de empresas com desafios habilitados
- Número total de vendedores afetados
- Informações da última geração (quando disponível)
