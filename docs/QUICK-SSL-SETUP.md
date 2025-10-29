# Guia Rápido: SSL para Subdomínios

## 🚀 Opção 1: Script Automatizado (Recomendado)

### No seu computador local:

```bash
# 1. Fazer upload do script para o servidor
scp scripts/setup-ssl-subdomains.sh root@31.97.84.130:/root/
```

### No servidor VPS:

```bash
# 2. Conectar ao servidor
ssh root@31.97.84.130

# 3. Executar o script
sudo bash /root/setup-ssl-subdomains.sh
```

O script vai:
- ✅ Verificar DNS dos subdomínios
- ✅ Criar configurações Nginx
- ✅ Obter certificados SSL automaticamente
- ✅ Configurar HTTPS redirect

---

## 🛠 Opção 2: Manual (Comandos Diretos)

### 1. Conectar ao servidor

```bash
ssh root@31.97.84.130
```

### 2. Obter certificados SSL

```bash
# Para assiny.ramppy.site
sudo certbot --nginx -d assiny.ramppy.site

# Para maniafoods.ramppy.site
sudo certbot --nginx -d maniafoods.ramppy.site
```

**Pronto!** O Certbot vai:
- Criar certificados
- Configurar Nginx automaticamente
- Habilitar HTTPS

### 3. Verificar

```bash
# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

## 📝 Pré-requisitos

Antes de executar, certifique-se que:

1. **DNS está configurado** (aponta para 31.97.84.130):
   - `assiny.ramppy.site`
   - `maniafoods.ramppy.site`

2. **Nginx está rodando** no servidor

3. **Porta 80 e 443 abertas** no firewall

---

## 🔍 Verificar se DNS está OK

```bash
# No seu computador ou no servidor
nslookup assiny.ramppy.site
nslookup maniafoods.ramppy.site
```

Deve retornar: `31.97.84.130`

---

## ✅ Testar após configuração

```bash
# Via curl
curl -I https://assiny.ramppy.site
curl -I https://maniafoods.ramppy.site

# Via navegador
# https://assiny.ramppy.site
# https://maniafoods.ramppy.site
```

---

## 🔄 Renovação Automática

Certbot configura renovação automática. Para testar:

```bash
sudo certbot renew --dry-run
```

---

## 🆕 Adicionar Novos Subdomínios no Futuro

Quando criar uma nova empresa pelo painel admin:

```bash
# 1. Configurar DNS (novo-subdomain.ramppy.site → 31.97.84.130)

# 2. No servidor, obter certificado
ssh root@31.97.84.130
sudo certbot --nginx -d novosubdominio.ramppy.site
```

Pronto! ✨

---

## 🆘 Problemas Comuns

### "DNS problem: NXDOMAIN"
- DNS não está configurado ou ainda propagando
- Aguarde até 48h para propagação

### "Port 80 not accessible"
- Firewall bloqueando porta 80
- Verifique: `sudo ufw status`

### "Too many certificates"
- Rate limit do Let's Encrypt atingido
- Aguarde 7 dias ou use certificado wildcard

### Ver logs de erro
```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## 📚 Documentação Completa

Para detalhes avançados, configuração wildcard, e troubleshooting:
- Ver: `docs/ssl-subdomain-setup.md`
