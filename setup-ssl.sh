#!/bin/bash

# Script para configurar SSL para todos os subdomínios
# Execute este script no servidor como root

echo "🔐 Configurando SSL para todos os subdomínios..."

# Verificar se Certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Lista de subdomínios
SUBDOMAINS=(
    "assiny.ramppy.site"
    "maniafoods.ramppy.site"
    "ramppyteste.ramppy.site"
    "behonestmvp.ramppy.site"
)

# Email para o Let's Encrypt (altere se necessário)
EMAIL="admin@ramppy.site"

echo "📝 Subdomínios a configurar:"
for subdomain in "${SUBDOMAINS[@]}"; do
    echo "   - $subdomain"
done

# Parar Nginx temporariamente para usar standalone
echo "⏸️  Parando Nginx temporariamente..."
systemctl stop nginx

# Obter certificados para cada subdomínio
for subdomain in "${SUBDOMAINS[@]}"; do
    echo ""
    echo "🔐 Obtendo certificado SSL para $subdomain..."

    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        --domains $subdomain \
        --expand

    if [ $? -eq 0 ]; then
        echo "✅ Certificado obtido para $subdomain"
    else
        echo "❌ Erro ao obter certificado para $subdomain"
    fi
done

# Criar configuração Nginx unificada
echo ""
echo "📝 Criando configuração Nginx..."

cat > /etc/nginx/sites-available/assiny << 'EOF'
# Configuração para redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name assiny.ramppy.site maniafoods.ramppy.site ramppyteste.ramppy.site behonestmvp.ramppy.site;

    # Redirecionar todo tráfego HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

# Configuração HTTPS para assiny.ramppy.site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name assiny.ramppy.site;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/assiny.ramppy.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assiny.ramppy.site/privkey.pem;

    # Configurações SSL otimizadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy para aplicação Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Configuração HTTPS para maniafoods.ramppy.site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name maniafoods.ramppy.site;

    ssl_certificate /etc/letsencrypt/live/maniafoods.ramppy.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maniafoods.ramppy.site/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Configuração HTTPS para ramppyteste.ramppy.site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ramppyteste.ramppy.site;

    ssl_certificate /etc/letsencrypt/live/ramppyteste.ramppy.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ramppyteste.ramppy.site/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Configuração HTTPS para behonestmvp.ramppy.site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name behonestmvp.ramppy.site;

    ssl_certificate /etc/letsencrypt/live/behonestmvp.ramppy.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/behonestmvp.ramppy.site/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Habilitar o site
ln -sf /etc/nginx/sites-available/assiny /etc/nginx/sites-enabled/

# Iniciar Nginx
echo "▶️  Iniciando Nginx..."
systemctl start nginx

# Testar configuração
echo ""
echo "🔍 Testando configuração Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida"

    # Recarregar Nginx
    systemctl reload nginx

    echo ""
    echo "🎉 SSL configurado com sucesso!"
    echo ""
    echo "📝 Sites disponíveis com HTTPS:"
    for subdomain in "${SUBDOMAINS[@]}"; do
        echo "   ✅ https://$subdomain"
    done

    echo ""
    echo "🔄 Configurando renovação automática..."

    # Adicionar ao crontab para renovação automática
    (crontab -l 2>/dev/null; echo "0 2 * * * certbot renew --nginx --quiet") | crontab -

    echo "✅ Renovação automática configurada (executa diariamente às 2h)"

else
    echo "❌ Erro na configuração Nginx. Verifique o arquivo de configuração."
fi

echo ""
echo "📊 Status dos certificados:"
certbot certificates