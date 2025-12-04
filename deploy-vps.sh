#!/bin/bash

echo "🚀 Iniciando deploy no VPS..."
echo "Digite a senha quando solicitado:"

ssh root@31.97.84.130 << 'EOF'
cd /var/www/assiny
echo "📂 Navegando para /var/www/assiny"

echo "🔄 Fazendo fetch do repositório..."
git fetch origin

echo "🔧 Resetando para origin/main..."
git reset --hard origin/main

echo "📦 Instalando dependências..."
npm install

echo "🏗️ Fazendo build da aplicação..."
npm run build

echo "🔄 Reiniciando aplicação com PM2..."
pm2 restart assiny

echo "✅ Status do PM2:"
pm2 status

echo "✨ Deploy concluído com sucesso!"
EOF