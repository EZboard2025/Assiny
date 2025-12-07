# 🔒 SSL Rápido - Guia de 2 Minutos

## Primeira vez? (Configuração inicial)

```bash
# 1. No seu computador
cd /Users/arthurxavier/assiny/Assiny
scp scripts/add-ssl-subdomain.sh root@31.97.84.130:/root/

# 2. No servidor
ssh root@31.97.84.130
chmod +x /root/add-ssl-subdomain.sh
```

✅ Pronto! Só fazer isso UMA VEZ.

---

## Criou empresa nova? Execute isto:

```bash
# 1. Conectar
ssh root@31.97.84.130

# 2. Rodar script
sudo bash /root/add-ssl-subdomain.sh NOME_DO_SUBDOMINIO

# Exemplo:
sudo bash /root/add-ssl-subdomain.sh mazolaepi
```

⏱️ Leva ~30 segundos.

---

## Exemplos:

```bash
# Empresa: Mazola EPI | Subdomínio: mazolaepi
sudo bash /root/add-ssl-subdomain.sh mazolaepi

# Empresa: Porsche Center BH | Subdomínio: porschecenterbh
sudo bash /root/add-ssl-subdomain.sh porschecenterbh

# Empresa: Kampo Energia | Subdomínio: kampoenergia
sudo bash /root/add-ssl-subdomain.sh kampoenergia
```

---

## ⚠️ Importante:

- Use **APENAS** o nome do subdomínio (sem `.ramppy.site`)
- Aguarde a mensagem de sucesso
- Acesse `https://subdominio.ramppy.site` e verifique o cadeado 🔒

---

## 🆘 Deu erro?

Leia: `docs/COMO-ADICIONAR-SSL-SUBDOMINIO.md`
