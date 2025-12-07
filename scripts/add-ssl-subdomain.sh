#!/bin/bash

# Script para adicionar SSL completo a novos subdomínios
# Uso: sudo bash add-ssl-subdomain.sh nomedosubdominio
# Exemplo: sudo bash add-ssl-subdomain.sh mazolaepi

set -e

if [ -z "$1" ]; then
    echo "❌ Erro: Nome do subdomínio não fornecido"
    echo "Uso: sudo bash add-ssl-subdomain.sh nomedosubdominio"
    echo "Exemplo: sudo bash add-ssl-subdomain.sh mazolaepi"
    exit 1
fi

SUBDOMAIN="$1"
FULL_DOMAIN="${SUBDOMAIN}.ramppy.site"
NGINX_CONFIG="/etc/nginx/sites-available/assiny"

echo "========================================"
echo "🔒 Configurando SSL para: $FULL_DOMAIN"
echo "========================================"

# Verificar se DNS está configurado
echo ""
echo "📡 Verificando DNS..."
if ! nslookup $FULL_DOMAIN > /dev/null 2>&1; then
    echo "⚠️  Aviso: DNS pode não estar configurado corretamente"
    echo "Certifique-se que $FULL_DOMAIN aponta para 31.97.84.130"
    read -p "Continuar mesmo assim? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Passo 1: Obter certificado SSL
echo ""
echo "📜 Passo 1/4: Obtendo certificado SSL..."
if [ -d "/etc/letsencrypt/live/$FULL_DOMAIN" ]; then
    echo "✅ Certificado já existe para $FULL_DOMAIN"
else
    certbot certonly --nginx -d $FULL_DOMAIN --non-interactive --agree-tos --email contato@ramppy.site
    echo "✅ Certificado obtido com sucesso"
fi

# Passo 2: Verificar se configuração já existe
echo ""
echo "🔍 Passo 2/4: Verificando configuração existente..."
if grep -q "server_name $FULL_DOMAIN;" $NGINX_CONFIG; then
    echo "⚠️  Configuração para $FULL_DOMAIN já existe no Nginx"
    read -p "Deseja substituir? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remover configuração antiga
        sed -i "/# HTTPS - $FULL_DOMAIN/,/^server {/d" $NGINX_CONFIG
        echo "🗑️  Configuração antiga removida"
    else
        echo "❌ Operação cancelada"
        exit 1
    fi
fi

# Passo 3: Adicionar configuração HTTPS completa
echo ""
echo "⚙️  Passo 3/4: Adicionando configuração HTTPS..."

# Criar backup
cp $NGINX_CONFIG "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Backup criado: ${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Adicionar bloco de configuração
cat >> $NGINX_CONFIG << EOF

# HTTPS - $FULL_DOMAIN
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $FULL_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$FULL_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FULL_DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

server {
    listen 80;
    server_name $FULL_DOMAIN;
    return 301 https://\$host\$request_uri;
}
EOF

echo "✅ Configuração HTTPS adicionada"

# Passo 4: Testar e reiniciar Nginx
echo ""
echo "🔄 Passo 4/4: Testando e reiniciando Nginx..."
if nginx -t 2>&1; then
    systemctl restart nginx
    echo "✅ Nginx reiniciado com sucesso"
else
    echo "❌ Erro na configuração do Nginx"
    echo "Restaurando backup..."
    mv "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)" $NGINX_CONFIG
    exit 1
fi

# Verificação final
echo ""
echo "========================================"
echo "✅ SSL configurado com sucesso!"
echo "========================================"
echo ""
echo "🌐 Acesse: https://$FULL_DOMAIN"
echo ""
echo "📊 Verificar status:"
echo "   curl -I https://$FULL_DOMAIN"
echo ""
echo "🔍 Ver certificado:"
echo "   sudo certbot certificates | grep $FULL_DOMAIN"
echo ""
echo "========================================"
