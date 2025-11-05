#!/bin/bash

# Script de Deploy para o servidor Hostinger
# Executa no servidor via SSH

echo "🚀 Iniciando deploy da aplicação Assiny..."

# 1. Deletar processo antigo com erro
echo "📦 Parando aplicação antiga..."
pm2 delete assiny 2>/dev/null || true

# 2. Navegar até o diretório
cd /var/www/assiny

# 3. Fazer backup do .env.local
echo "💾 Fazendo backup das configurações..."
cp .env.local .env.local.backup 2>/dev/null || true

# 4. Atualizar código do GitHub
echo "📥 Baixando última versão do código..."
git fetch origin
git reset --hard origin/main

# 5. Restaurar .env.local
cp .env.local.backup .env.local 2>/dev/null || true

# 6. Instalar dependências
echo "📦 Instalando dependências..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install

# 7. Fazer build de produção
echo "🔨 Compilando aplicação..."
npm run build

# 8. Iniciar com PM2
echo "🚀 Iniciando aplicação..."
pm2 start npm --name "assiny" -- start

# 9. Salvar configuração do PM2
pm2 save
pm2 startup systemd -u root --hp /root

# 10. Verificar status
echo "✅ Verificando status..."
pm2 status

echo "🎉 Deploy concluído!"
echo ""
echo "📊 Status da aplicação:"
pm2 show assiny

# Testar se está respondendo
echo ""
echo "🔍 Testando resposta local..."
sleep 5
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000

echo ""
echo "✨ Deploy finalizado com sucesso!"
echo "🌐 Domínios disponíveis:"
echo "   - https://assiny.ramppy.site"
echo "   - https://maniafoods.ramppy.site"
echo "   - https://ramppyteste.ramppy.site"
echo "   - https://behonestmvp.ramppy.site"