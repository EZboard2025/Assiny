// Script para testar a criação de empresa via API
// Execute com: node test-company-creation.js

async function testCompanyCreation() {
  console.log('🧪 Testando criação de nova empresa...\n');

  const testData = {
    companyName: 'Empresa Teste ' + Date.now(),
    subdomain: 'teste' + Date.now(),
    adminName: 'Admin Teste',
    adminEmail: `admin${Date.now()}@teste.com`,
    adminPassword: 'Teste123!',
    businessType: 'B2B'
  };

  console.log('📋 Dados de teste:');
  console.log('   Nome:', testData.companyName);
  console.log('   Subdomínio:', testData.subdomain);
  console.log('   Admin:', testData.adminName);
  console.log('   Email:', testData.adminEmail);
  console.log('   Senha:', testData.adminPassword);
  console.log('   Tipo:', testData.businessType);
  console.log('');

  try {
    console.log('🚀 Enviando requisição para API...');

    const response = await fetch('http://localhost:3000/api/admin/companies/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erro na resposta:', response.status);
      console.error('   Mensagem:', result.error || 'Erro desconhecido');
      return;
    }

    console.log('\n✅ EMPRESA CRIADA COM SUCESSO!\n');
    console.log('📊 Resultado:');
    console.log(JSON.stringify(result, null, 2));

    if (result.company) {
      console.log('\n🏢 Empresa:');
      console.log('   ID:', result.company.id);
      console.log('   Nome:', result.company.name);
      console.log('   Subdomínio:', result.company.subdomain);
    }

    if (result.admin) {
      console.log('\n👤 Administrador:');
      console.log('   ID:', result.admin.id);
      console.log('   Email:', result.admin.email);
      console.log('   Nome:', result.admin.name);
    }

    if (result.urls) {
      console.log('\n🌐 URLs de acesso:');
      console.log('   Local:', result.urls.local);
      console.log('   Produção:', result.urls.production);
    }

    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('1. Acesse o Supabase SQL Editor');
    console.log('2. Execute o script: supabase/scripts/test-create-company.sql');
    console.log('3. Verifique se todos os dados foram criados');
    console.log(`4. Tente fazer login em: ${result.urls?.local || 'http://' + testData.subdomain + '.ramppy.local:3000'}`);
    console.log(`   Email: ${testData.adminEmail}`);
    console.log(`   Senha: ${testData.adminPassword}`);

  } catch (error) {
    console.error('❌ Erro ao testar criação:', error.message);
    console.error(error);
  }
}

// Executar o teste
testCompanyCreation();