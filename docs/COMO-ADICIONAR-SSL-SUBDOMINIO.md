# Como Adicionar SSL em Novos Subdomínios

## ⚠️ IMPORTANTE: Leia isto TODA VEZ que criar uma empresa nova

Quando você cria uma nova empresa no painel admin, o subdomínio **NÃO fica seguro automaticamente**.

Você precisa executar um script no servidor para configurar o SSL.

---

## 🚀 Configuração Inicial (Fazer UMA VEZ)

### 1. Enviar script para o servidor

No seu computador local:

```bash
cd /Users/arthurxavier/assiny/Assiny
scp scripts/add-ssl-subdomain.sh root@31.97.84.130:/root/
```

### 2. Tornar o script executável no servidor

Conectar ao servidor e dar permissão:

```bash
ssh root@31.97.84.130
chmod +x /root/add-ssl-subdomain.sh
```

✅ **Pronto! Você só precisa fazer isso UMA VEZ.**

---

## 📋 Como Usar (TODA VEZ que criar empresa nova)

### Cenário: Você acabou de criar empresa "Mazola EPI" com subdomínio `mazolaepi`

**Passo 1:** Conectar ao servidor

```bash
ssh root@31.97.84.130
```

**Passo 2:** Executar o script

```bash
sudo bash /root/add-ssl-subdomain.sh mazolaepi
```

⚠️ **ATENÇÃO:** Use apenas o nome do subdomínio (SEM `.ramppy.site`)

**Exemplos:**
```bash
# ✅ CORRETO
sudo bash /root/add-ssl-subdomain.sh mazolaepi
sudo bash /root/add-ssl-subdomain.sh porschecenterbh
sudo bash /root/add-ssl-subdomain.sh kampoenergia

# ❌ ERRADO
sudo bash /root/add-ssl-subdomain.sh mazolaepi.ramppy.site
```

**Passo 3:** Aguardar conclusão

O script vai:
1. ✅ Verificar DNS
2. ✅ Obter certificado SSL
3. ✅ Adicionar configuração HTTPS no Nginx
4. ✅ Testar e reiniciar Nginx

**Passo 4:** Acessar o site

```bash
https://mazolaepi.ramppy.site
```

🎉 **Pronto! O site está seguro.**

---

## 🔧 O que o Script Faz

1. **Obtém certificado SSL** via Let's Encrypt (Certbot)
2. **Adiciona configuração HTTPS completa** no Nginx
3. **Configura redirect HTTP → HTTPS** automaticamente
4. **Testa a configuração** antes de aplicar
5. **Cria backup** da configuração antiga

---

## 🆘 Troubleshooting

### Erro: "DNS não configurado"

**Problema:** O DNS do subdomínio não aponta para o servidor

**Solução:**
1. Acesse o painel DNS (Hostinger, Cloudflare, etc.)
2. Adicione registro A: `mazolaepi.ramppy.site` → `31.97.84.130`
3. Aguarde propagação (pode levar até 24h)
4. Verifique: `nslookup mazolaepi.ramppy.site`

### Erro: "Certificado já existe"

**Problema:** Você já tentou obter o certificado antes

**Solução:** O script detecta e pula essa etapa automaticamente

### Erro: "Configuração já existe"

**Problema:** A configuração do Nginx já tem esse subdomínio

**Solução:** O script pergunta se você quer substituir. Digite `y` para sim.

### Erro: "Nginx test failed"

**Problema:** Erro de sintaxe na configuração do Nginx

**Solução:**
1. O script restaura o backup automaticamente
2. Verifique logs: `sudo tail -f /var/log/nginx/error.log`
3. Contate suporte se necessário

### Site ainda mostra 404

**Problema:** Nginx configurado, mas aplicação Next.js não está rodando

**Solução:**
```bash
# Verificar status da aplicação
pm2 status

# Se não estiver rodando, reiniciar
pm2 restart assiny

# Ver logs
pm2 logs assiny
```

---

## 📚 Comandos Úteis

### Ver todos os certificados SSL

```bash
sudo certbot certificates
```

### Ver configuração do Nginx

```bash
cat /etc/nginx/sites-available/assiny
```

### Testar configuração do Nginx

```bash
sudo nginx -t
```

### Reiniciar Nginx

```bash
sudo systemctl restart nginx
```

### Ver logs do Nginx

```bash
# Logs de erro
sudo tail -f /var/log/nginx/error.log

# Logs de acesso
sudo tail -f /var/log/nginx/access.log
```

### Renovar certificados SSL

```bash
# Teste (sem renovar)
sudo certbot renew --dry-run

# Renovar de verdade
sudo certbot renew
```

---

## 🎯 Checklist Completo

Quando criar uma nova empresa:

- [ ] Criar empresa no painel admin (`https://ramppy.site/admin/companies`)
- [ ] Verificar DNS configurado (`nslookup subdominio.ramppy.site`)
- [ ] Conectar ao servidor (`ssh root@31.97.84.130`)
- [ ] Executar script (`sudo bash /root/add-ssl-subdomain.sh subdominio`)
- [ ] Aguardar mensagem de sucesso
- [ ] Acessar site (`https://subdominio.ramppy.site`)
- [ ] Verificar cadeado SSL no navegador 🔒

---

## 💡 Por que isso é necessário?

O Certbot **consegue criar certificados SSL**, mas **não consegue configurar o Nginx automaticamente** quando já existe uma configuração customizada complexa.

Por isso, o script:
1. Usa o Certbot apenas para obter o certificado
2. Adiciona manualmente a configuração HTTPS completa no Nginx
3. Garante que tudo funcione perfeitamente

---

## 🔄 Automação Futura (Opcional)

Se quiser automatizar 100%, você pode:
1. Modificar o painel admin para chamar o script via API
2. Usar GitHub Actions para executar o script remotamente
3. Criar um webhook que executa o script quando nova empresa é criada

**Mas por enquanto, o processo manual é mais seguro e controlado.**

---

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs do Nginx
2. Verifique se o DNS está configurado
3. Verifique se o PM2 está rodando
4. Consulte este documento novamente

**Dica:** Salve este documento nos favoritos! 🔖
