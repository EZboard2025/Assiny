#!/bin/bash

# Script para configurar SSL nos subdomínios da Ramppy
# Uso: bash setup-ssl-subdomains.sh

set -e

echo "🔐 Configuração de SSL para Subdomínios Ramppy"
echo "================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}❌ Este script precisa ser executado como root${NC}"
   echo "Execute: sudo bash setup-ssl-subdomains.sh"
   exit 1
fi

# Subdomínios existentes
SUBDOMAINS=("assiny.ramppy.site" "maniafoods.ramppy.site")
MAIN_DOMAIN="ramppy.site"

echo "📋 Subdomínios a serem configurados:"
for subdomain in "${SUBDOMAINS[@]}"; do
    echo "   - $subdomain"
done
echo ""

# Passo 1: Verificar DNS
echo "🔍 Passo 1: Verificando DNS..."
for subdomain in "${SUBDOMAINS[@]}"; do
    echo -n "   Verificando $subdomain... "
    if nslookup $subdomain > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ DNS não configurado ou ainda propagando${NC}"
    fi
done
echo ""

# Passo 2: Verificar Nginx
echo "🔍 Passo 2: Verificando Nginx..."
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}❌ Nginx não instalado${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓ Nginx instalado${NC}"
echo ""

# Passo 3: Verificar Certbot
echo "🔍 Passo 3: Verificando Certbot..."
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}⚠ Certbot não instalado. Instalando...${NC}"
    apt update
    apt install -y certbot python3-certbot-nginx
fi
echo -e "   ${GREEN}✓ Certbot instalado${NC}"
echo ""

# Passo 4: Escolher tipo de certificado
echo "📝 Passo 4: Escolha o tipo de certificado:"
echo "   1) Certificados individuais (recomendado para começar)"
echo "   2) Certificado wildcard (requer DNS API)"
echo ""
read -p "Escolha (1 ou 2): " cert_choice

if [ "$cert_choice" == "2" ]; then
    echo -e "${YELLOW}⚠ Certificado wildcard requer configuração DNS API${NC}"
    echo "Este script não suporta wildcard automaticamente."
    echo "Consulte a documentação em docs/ssl-subdomain-setup.md"
    exit 0
fi

# Passo 5: Criar configurações Nginx
echo ""
echo "📄 Passo 5: Criando configurações Nginx..."

for subdomain in "${SUBDOMAINS[@]}"; do
    config_file="/etc/nginx/sites-available/$subdomain"

    if [ -f "$config_file" ]; then
        echo -e "   ${YELLOW}⚠ $subdomain já existe. Pulando...${NC}"
        continue
    fi

    echo "   Criando config para $subdomain..."

    cat > $config_file <<EOF
server {
    listen 80;
    server_name $subdomain;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Criar link simbólico
    ln -sf $config_file /etc/nginx/sites-enabled/
    echo -e "   ${GREEN}✓ Config criada para $subdomain${NC}"
done
echo ""

# Passo 6: Testar configuração Nginx
echo "🧪 Passo 6: Testando configuração Nginx..."
if nginx -t; then
    echo -e "   ${GREEN}✓ Configuração OK${NC}"
else
    echo -e "   ${RED}❌ Erro na configuração${NC}"
    exit 1
fi
echo ""

# Passo 7: Recarregar Nginx
echo "🔄 Passo 7: Recarregando Nginx..."
systemctl reload nginx
echo -e "   ${GREEN}✓ Nginx recarregado${NC}"
echo ""

# Passo 8: Obter certificados SSL
echo "🔐 Passo 8: Obtendo certificados SSL..."
echo ""

# Obter certificado para domínio principal primeiro
echo "   Obtendo certificado para $MAIN_DOMAIN..."
certbot --nginx -d $MAIN_DOMAIN --non-interactive --agree-tos --email admin@ramppy.site --redirect || true

# Obter certificados para subdomínios
for subdomain in "${SUBDOMAINS[@]}"; do
    echo ""
    echo "   Obtendo certificado para $subdomain..."
    certbot --nginx -d $subdomain --non-interactive --agree-tos --email admin@ramppy.site --redirect

    if [ $? -eq 0 ]; then
        echo -e "   ${GREEN}✓ Certificado obtido para $subdomain${NC}"
    else
        echo -e "   ${RED}❌ Erro ao obter certificado para $subdomain${NC}"
    fi
done

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Teste os subdomínios no navegador:"
for subdomain in "${SUBDOMAINS[@]}"; do
    echo "      - https://$subdomain"
done
echo ""
echo "   2. Verificar renovação automática:"
echo "      sudo certbot renew --dry-run"
echo ""
echo "   3. Ver certificados instalados:"
echo "      sudo certbot certificates"
echo ""
echo "🎉 Pronto! Seus subdomínios agora têm SSL configurado."
