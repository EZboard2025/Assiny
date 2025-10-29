# Configuração de SSL para Subdomínios Multi-Tenant

Este guia mostra como configurar certificados SSL (Let's Encrypt) para os subdomínios da plataforma Ramppy.

## Pré-requisitos

1. DNS configurado para apontar os subdomínios para o servidor:
   - `assiny.ramppy.site` → `31.97.84.130`
   - `maniafoods.ramppy.site` → `31.97.84.130`
   - `*.ramppy.site` → `31.97.84.130` (wildcard, se disponível)

2. Nginx instalado e configurado
3. Certbot instalado no servidor

## Passo 1: Conectar ao Servidor

```bash
ssh root@31.97.84.130
```

## Passo 2: Verificar DNS (Opcional)

```bash
# Verificar se os subdomínios apontam para o servidor
nslookup assiny.ramppy.site
nslookup maniafoods.ramppy.site
```

O resultado deve mostrar o IP: `31.97.84.130`

## Passo 3: Criar Configuração Nginx para Subdomínios

### Opção A: Configuração Individual por Subdomínio

```bash
# Criar config para Assiny
sudo nano /etc/nginx/sites-available/assiny.ramppy.site
```

**Conteúdo do arquivo:**
```nginx
server {
    listen 80;
    server_name assiny.ramppy.site;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Criar config para Mania Foods
sudo nano /etc/nginx/sites-available/maniafoods.ramppy.site
```

**Conteúdo do arquivo:**
```nginx
server {
    listen 80;
    server_name maniafoods.ramppy.site;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Habilitar sites
sudo ln -s /etc/nginx/sites-available/assiny.ramppy.site /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/maniafoods.ramppy.site /etc/nginx/sites-enabled/
```

### Opção B: Configuração Wildcard (Recomendado)

```bash
# Editar ou criar config wildcard
sudo nano /etc/nginx/sites-available/ramppy-multitenancy
```

**Conteúdo do arquivo:**
```nginx
# Wildcard para todos os subdomínios *.ramppy.site
server {
    listen 80;
    server_name *.ramppy.site ramppy.site;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Habilitar site
sudo ln -s /etc/nginx/sites-available/ramppy-multitenancy /etc/nginx/sites-enabled/
```

## Passo 4: Testar e Recarregar Nginx

```bash
# Testar configuração
sudo nginx -t

# Se OK, recarregar
sudo systemctl reload nginx
```

## Passo 5: Obter Certificados SSL

### Opção A: Certificado Wildcard (Recomendado para Multi-Tenant)

**Vantagem:** Um único certificado para todos os subdomínios (atual e futuros)

```bash
# Instalar plugin DNS do Certbot (exemplo: Cloudflare)
sudo apt install python3-certbot-dns-cloudflare

# Obter certificado wildcard
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d ramppy.site \
  -d *.ramppy.site
```

**Nota:** Wildcard requer validação DNS. Você precisará:
1. Criar API token no seu provedor DNS (Cloudflare, etc.)
2. Configurar credenciais no arquivo `.ini`

### Opção B: Certificados Individuais (Mais Simples)

```bash
# Obter certificado para domínio principal
sudo certbot --nginx -d ramppy.site

# Obter certificado para Assiny
sudo certbot --nginx -d assiny.ramppy.site

# Obter certificado para Mania Foods
sudo certbot --nginx -d maniafoods.ramppy.site
```

**Observação:** Certbot irá automaticamente:
- Obter o certificado
- Modificar a configuração do Nginx
- Configurar redirecionamento HTTPS

## Passo 6: Verificar Configuração Final

Após o Certbot, o Nginx será configurado automaticamente com SSL. Verifique:

```bash
# Ver configuração atualizada
sudo cat /etc/nginx/sites-available/assiny.ramppy.site

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

## Passo 7: Testar HTTPS

```bash
# Via curl
curl -I https://assiny.ramppy.site
curl -I https://maniafoods.ramppy.site

# Via navegador
# Acesse: https://assiny.ramppy.site
```

## Renovação Automática

Certbot configura renovação automática via cron. Verifique:

```bash
# Testar renovação (dry-run)
sudo certbot renew --dry-run

# Ver timer de renovação automática
sudo systemctl status certbot.timer
```

## Adicionar Novos Subdomínios (Futuro)

### Se usar Wildcard:
✅ Nenhuma ação necessária! O certificado wildcard já cobre.

### Se usar Certificados Individuais:

```bash
# 1. Configurar DNS (apontar novo subdomínio para 31.97.84.130)

# 2. Criar config Nginx (ou usar wildcard existente)
sudo nano /etc/nginx/sites-available/novaempresa.ramppy.site

# 3. Habilitar site
sudo ln -s /etc/nginx/sites-available/novaempresa.ramppy.site /etc/nginx/sites-enabled/

# 4. Obter certificado
sudo certbot --nginx -d novaempresa.ramppy.site

# 5. Reload Nginx
sudo systemctl reload nginx
```

## Troubleshooting

### Erro: "DNS problem: NXDOMAIN looking up A for subdomain"
- Verifique se o DNS está configurado corretamente
- Aguarde propagação DNS (pode levar até 48h)

### Erro: "Invalid response from http://subdomain/.well-known/"
- Certifique-se que Nginx está rodando
- Verifique se a porta 80 está acessível externamente

### Erro: "Too many certificates already issued"
- Let's Encrypt tem limite de rate limit
- Use `--dry-run` para testar antes
- Aguarde 7 dias ou use certificado wildcard

## Comandos Úteis

```bash
# Listar certificados instalados
sudo certbot certificates

# Renovar certificados manualmente
sudo certbot renew

# Revogar certificado
sudo certbot revoke --cert-path /etc/letsencrypt/live/subdomain/cert.pem

# Ver logs do Certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

## Estrutura de Arquivos SSL

```
/etc/letsencrypt/
├── live/
│   ├── ramppy.site/
│   │   ├── fullchain.pem
│   │   ├── privkey.pem
│   │   └── cert.pem
│   ├── assiny.ramppy.site/
│   └── maniafoods.ramppy.site/
└── renewal/
    ├── ramppy.site.conf
    ├── assiny.ramppy.site.conf
    └── maniafoods.ramppy.site.conf
```

## Recomendação Final

**Para ambiente multi-tenant com múltiplas empresas:**
- ✅ Use certificado **wildcard** (`*.ramppy.site`)
- ✅ Configuração Nginx **wildcard** também
- ✅ Menos manutenção ao adicionar novas empresas
- ✅ Um único certificado para renovar

**Para apenas 2-3 subdomínios fixos:**
- ✅ Certificados individuais são suficientes
- ✅ Mais simples de configurar (não precisa DNS API)
