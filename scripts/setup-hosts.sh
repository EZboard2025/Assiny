#!/bin/bash

# Script para adicionar subdomínios Ramppy ao /etc/hosts

echo "Adicionando subdomínios Ramppy ao /etc/hosts..."

# Verificar se já existe
if grep -q "ramppy.local" /etc/hosts; then
    echo "⚠️  Subdomínios Ramppy já existem no /etc/hosts"
    exit 0
fi

# Adicionar entradas
sudo bash -c 'cat >> /etc/hosts << EOF

# Ramppy Subdomains
127.0.0.1 ramppy.local
127.0.0.1 assiny.ramppy.local
127.0.0.1 cliente2.ramppy.local
EOF'

echo "✅ Subdomínios adicionados com sucesso!"
echo ""
echo "Testando resolução DNS:"
ping -c 1 ramppy.local
ping -c 1 assiny.ramppy.local

echo ""
echo "✅ Pronto! Agora você pode acessar:"
echo "   http://ramppy.local:3000"
echo "   http://assiny.ramppy.local:3000"
