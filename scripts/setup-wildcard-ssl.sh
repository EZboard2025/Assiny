#!/bin/bash

# Script para configurar SSL wildcard para *.ramppy.site
# Execute este script no servidor VPS como root

echo "==========================================="
echo "Configuração SSL Wildcard para *.ramppy.site"
echo "==========================================="

# 1. Verificar certificados existentes
echo -e "\n📋 Certificados SSL existentes:"
certbot certificates

# 2. Criar certificado wildcard
echo -e "\n🔐 Criando certificado wildcard para *.ramppy.site e ramppy.site..."
echo "NOTA: Você precisará adicionar registros DNS TXT para validação"

certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.ramppy.site" \
  -d "ramppy.site" \
  --agree-tos \
  --manual-public-ip-logging-ok \
  --email seu-email@example.com

# 3. Criar configuração Nginx para SSL
echo -e "\n📝 Criando configuração Nginx com SSL..."

cat > /etc/nginx/sites-available/assiny-ssl << 'EOF'
# Redirecionar HTTP para HTTPS para todos os subdomínios
server {
    listen 80;
    server_name *.ramppy.site ramppy.site;
    return 301 https://$host$request_uri;
}

# Configuração HTTPS para domínio principal
server {
    listen 443 ssl http2;
    server_name ramppy.site;

    ssl_certificate /etc/letsencrypt/live/ramppy.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ramppy.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

# Configuração HTTPS para todos os subdomínios (wildcard)
server {
    listen 443 ssl http2;
    server_name *.ramppy.site;

    ssl_certificate /etc/letsencrypt/live/ramppy.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ramppy.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de segurança
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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
        proxy_set_header X-Subdomain $subdomain;
    }
}
EOF

# 4. Ativar a configuração SSL
echo -e "\n🔄 Ativando configuração SSL..."
ln -sf /etc/nginx/sites-available/assiny-ssl /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/assiny  # Remove configuração antiga sem SSL

# 5. Testar configuração Nginx
echo -e "\n✅ Testando configuração Nginx..."
nginx -t

# 6. Recarregar Nginx
echo -e "\n🔄 Recarregando Nginx..."
systemctl reload nginx

# 7. Configurar renovação automática
echo -e "\n⏰ Configurando renovação automática do certificado..."
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo -e "\n✅ Configuração concluída!"
echo "==========================================="
echo "Próximos passos:"
echo "1. Verifique se o certificado foi criado: certbot certificates"
echo "2. Teste HTTPS em: https://assiny.ramppy.site"
echo "3. Teste HTTPS em: https://maniafoods.ramppy.site"
echo "4. Teste renovação: certbot renew --dry-run"
echo "==========================================="