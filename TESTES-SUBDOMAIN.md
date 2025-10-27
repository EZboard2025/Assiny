# Guia de Testes - Sistema de Subdomínios

## 1. Configurar /etc/hosts

Execute no terminal:

```bash
sudo nano /etc/hosts
```

Adicione estas linhas no final do arquivo:

```
127.0.0.1 ramppy.local
127.0.0.1 assiny.ramppy.local
127.0.0.1 cliente2.ramppy.local
```

Salve com `Ctrl+O`, Enter, e saia com `Ctrl+X`.

## 2. Rodar a migration da empresa Assiny

```bash
# Conectar ao Supabase e rodar a migration
psql $NEXT_PUBLIC_SUPABASE_URL -c "INSERT INTO public.companies (name, subdomain) VALUES ('Assiny', 'assiny') ON CONFLICT (subdomain) DO NOTHING;"
```

Ou rode via Supabase Dashboard → SQL Editor:

```sql
INSERT INTO public.companies (name, subdomain)
VALUES ('Assiny', 'assiny')
ON CONFLICT (subdomain) DO NOTHING;
```

## 3. Iniciar o servidor Next.js

```bash
npm run dev
```

## 4. Fluxo de Testes

### Teste 1: Acesso ao domínio principal
1. Acesse: `http://ramppy.local:3000`
2. **Esperado**: Redireciona automaticamente para `/select-company`
3. **Deve mostrar**: Página de seleção com card da empresa "Assiny"

### Teste 2: Seleção de empresa
1. Na página `/select-company`, clique em "Assiny"
2. Clique em "Continuar"
3. **Esperado**: Redireciona para `http://assiny.ramppy.local:3000/login`

### Teste 3: Login no subdomínio
1. Em `http://assiny.ramppy.local:3000/login`
2. **Deve mostrar**: "Bem-vindo à Assiny!" (nome da empresa no título)
3. Faça login com credenciais válidas
4. **Esperado**: Dashboard carrega com dados filtrados por `company_id` da Assiny

### Teste 4: Verificar isolamento de dados
1. Abra o console do navegador
2. Procure por logs: `[CompanyContext] Empresa encontrada: {id: "...", name: "Assiny", subdomain: "assiny"}`
3. Verifique que todas as queries estão usando o `company_id` correto

## 5. Criar empresa de teste (opcional)

```sql
INSERT INTO public.companies (name, subdomain)
VALUES ('Empresa Teste', 'cliente2')
ON CONFLICT (subdomain) DO NOTHING;
```

Depois acesse: `http://cliente2.ramppy.local:3000`

## 6. Troubleshooting

### Problema: Middleware não redireciona
- Verifique se o arquivo `middleware.ts` está na raiz do projeto
- Confirme que Next.js reiniciou após criar o middleware

### Problema: Empresa não encontrada
- Rode a migration no passo 2
- Verifique no Supabase se a tabela `companies` tem dados:
  ```sql
  SELECT * FROM public.companies;
  ```

### Problema: /etc/hosts não funciona
- macOS/Linux: Execute `sudo dscacheutil -flushcache` para limpar cache DNS
- Teste com `ping ramppy.local` - deve retornar `127.0.0.1`

### Problema: RLS bloqueia acesso
- A policy "Qualquer um pode ver empresas" permite SELECT sem autenticação
- Se tiver erro, verifique as policies da tabela `companies`

## 7. Logs para debugar

Abra o Console do Navegador e procure por:

```
[CompanyContext] Hostname: assiny.ramppy.local
[CompanyContext] Buscando empresa com subdomain: assiny
[CompanyContext] Empresa encontrada: {id: "...", name: "Assiny", subdomain: "assiny"}
```

Se ver "Empresa não encontrada", rode a migration do passo 2.
