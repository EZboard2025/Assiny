export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Politica de Privacidade</h1>
        <p className="text-gray-400 text-sm mb-8">Ultima atualizacao: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">1. Introducao</h2>
            <p>
              A Ramppy (&quot;nos&quot;, &quot;nosso&quot;) opera a plataforma Assiny, uma ferramenta de treinamento em vendas com inteligencia artificial.
              Esta politica descreve como coletamos, usamos e protegemos suas informacoes pessoais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">2. Informacoes que Coletamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Dados de cadastro: nome, email, empresa</li>
              <li>Dados de uso da plataforma: sessoes de roleplay, avaliacoes, mensagens</li>
              <li>Dados de integracao WhatsApp Business: numero de telefone comercial, mensagens recebidas e enviadas para fins de analise de follow-up</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">3. Como Usamos suas Informacoes</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fornecer e melhorar nossos servicos de treinamento</li>
              <li>Gerar avaliacoes e feedbacks personalizados</li>
              <li>Analisar conversas de follow-up para sugerir melhorias</li>
              <li>Comunicacao sobre atualizacoes do servico</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">4. Compartilhamento de Dados</h2>
            <p>
              Nao vendemos ou compartilhamos suas informacoes pessoais com terceiros, exceto quando necessario para
              operar nossos servicos (provedores de infraestrutura como Supabase, OpenAI, Meta WhatsApp Business API).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">5. Seguranca</h2>
            <p>
              Utilizamos medidas de seguranca adequadas para proteger suas informacoes, incluindo criptografia,
              autenticacao segura e controle de acesso por empresa (multi-tenant).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">6. Seus Direitos</h2>
            <p>
              Voce pode solicitar acesso, correcao ou exclusao dos seus dados a qualquer momento
              entrando em contato conosco pelo email abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">7. Exclusao de Dados</h2>
            <p>
              Para solicitar a exclusao dos seus dados, entre em contato pelo email:
              <a href="mailto:axp0082.0@gmail.com" className="text-purple-400 hover:underline ml-1">axp0082.0@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">8. Contato</h2>
            <p>
              Para duvidas sobre esta politica, entre em contato:
              <a href="mailto:axp0082.0@gmail.com" className="text-purple-400 hover:underline ml-1">axp0082.0@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
