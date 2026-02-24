import Link from 'next/link'
import Image from 'next/image'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/images/logo-preta.png" alt="Ramppy" width={160} height={45} className="object-contain" />
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/privacy" className="text-gray-500 hover:text-gray-900 transition-colors">
              Privacidade
            </Link>
            <span className="text-green-600 font-medium">Termos de Uso</span>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
        <p className="text-gray-500 text-sm mb-10">&Uacute;ltima atualiza&ccedil;&atilde;o: 23 de fevereiro de 2026</p>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">&Iacute;ndice</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <li><a href="#aceitacao" className="text-green-600 hover:underline">1. Aceita&ccedil;&atilde;o dos Termos</a></li>
            <li><a href="#descricao" className="text-green-600 hover:underline">2. Descri&ccedil;&atilde;o do Servi&ccedil;o</a></li>
            <li><a href="#cadastro" className="text-green-600 hover:underline">3. Cadastro e Conta</a></li>
            <li><a href="#planos" className="text-green-600 hover:underline">4. Planos e Uso</a></li>
            <li><a href="#uso-aceitavel" className="text-green-600 hover:underline">5. Uso Aceit&aacute;vel</a></li>
            <li><a href="#integracoes" className="text-green-600 hover:underline">6. Integra&ccedil;&otilde;es com Terceiros</a></li>
            <li><a href="#propriedade" className="text-green-600 hover:underline">7. Propriedade Intelectual</a></li>
            <li><a href="#responsabilidade" className="text-green-600 hover:underline">8. Limita&ccedil;&atilde;o de Responsabilidade</a></li>
            <li><a href="#disponibilidade" className="text-green-600 hover:underline">9. Disponibilidade do Servi&ccedil;o</a></li>
            <li><a href="#cancelamento" className="text-green-600 hover:underline">10. Cancelamento e Rescis&atilde;o</a></li>
            <li><a href="#alteracoes" className="text-green-600 hover:underline">11. Altera&ccedil;&otilde;es nos Termos</a></li>
            <li><a href="#legislacao" className="text-green-600 hover:underline">12. Legisla&ccedil;&atilde;o Aplic&aacute;vel</a></li>
          </ol>
        </nav>

        <div className="space-y-10 text-gray-700 text-base leading-relaxed">
          {/* 1. Aceitação dos Termos */}
          <section id="aceitacao">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceita&ccedil;&atilde;o dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma <strong>Ramppy</strong>, operada pela <strong>Ramppy</strong>,
              voc&ecirc; concorda integralmente com estes Termos de Uso e com nossa{' '}
              <Link href="/privacy" className="text-green-600 hover:underline font-medium">Pol&iacute;tica de Privacidade</Link>.
              Se voc&ecirc; n&atilde;o concordar com qualquer disposi&ccedil;&atilde;o destes termos, n&atilde;o dever&aacute; acessar ou utilizar a plataforma.
            </p>
            <p className="mt-3">
              Estes termos constituem um acordo legal vinculante entre voc&ecirc; (&ldquo;Usu&aacute;rio&rdquo;) e a Ramppy
              (&ldquo;n&oacute;s&rdquo;, &ldquo;nosso&rdquo;, &ldquo;nossa&rdquo;).
            </p>
          </section>

          {/* 2. Descrição do Serviço */}
          <section id="descricao">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descri&ccedil;&atilde;o do Servi&ccedil;o</h2>
            <p className="mb-3">
              O Ramppy &eacute; uma plataforma SaaS (Software as a Service) de treinamento em vendas com intelig&ecirc;ncia artificial,
              que oferece as seguintes funcionalidades:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Roleplay com IA:</strong> simula&ccedil;&otilde;es de vendas com clientes virtuais controlados por intelig&ecirc;ncia artificial, com avalia&ccedil;&atilde;o baseada na metodologia SPIN Selling</li>
              <li><strong>Avalia&ccedil;&otilde;es de Desempenho:</strong> an&aacute;lise detalhada de sess&otilde;es de roleplay com m&eacute;tricas SPIN (Situa&ccedil;&atilde;o, Problema, Implica&ccedil;&atilde;o, Necessidade)</li>
              <li><strong>PDI (Plano de Desenvolvimento Individual):</strong> planos personalizados de 7 dias gerados por IA com base no desempenho</li>
              <li><strong>Copiloto de Vendas com IA:</strong> assist&ecirc;ncia em tempo real para conversas de follow-up via WhatsApp</li>
              <li><strong>An&aacute;lise de Reuni&otilde;es:</strong> avalia&ccedil;&atilde;o de reuni&otilde;es Google Meet com transcri&ccedil;&atilde;o e feedback SPIN</li>
              <li><strong>Gest&atilde;o de Follow-up:</strong> organiza&ccedil;&atilde;o e an&aacute;lise de conversas de acompanhamento de vendas</li>
              <li><strong>Assistente de IA (Chat IA):</strong> assistente conversacional para d&uacute;vidas sobre vendas e metodologias</li>
              <li><strong>Desafios Di&aacute;rios:</strong> exerc&iacute;cios personalizados para desenvolvimento cont&iacute;nuo</li>
            </ul>
          </section>

          {/* 3. Cadastro e Conta */}
          <section id="cadastro">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cadastro e Conta</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>As contas s&atilde;o criadas pelo administrador da empresa contratante (ambiente multi-tenant)</li>
              <li>Voc&ecirc; deve fornecer informa&ccedil;&otilde;es precisas e mant&ecirc;-las atualizadas</li>
              <li>Voc&ecirc; &eacute; respons&aacute;vel pela seguran&ccedil;a da sua senha e por todas as atividades realizadas com sua conta</li>
              <li>Cada conta &eacute; de uso pessoal e intransfer&iacute;vel</li>
              <li>Voc&ecirc; deve notificar imediatamente qualquer uso n&atilde;o autorizado da sua conta</li>
              <li>O administrador da empresa pode criar, gerenciar e excluir contas de colaboradores</li>
            </ul>
          </section>

          {/* 4. Planos e Créditos */}
          <section id="planos">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Planos e Uso</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O Ramppy oferece diferentes planos de assinatura, com funcionalidades e limites de uso vari&aacute;veis conforme o plano contratado</li>
              <li>Os detalhes de cada plano est&atilde;o dispon&iacute;veis na p&aacute;gina comercial ou mediante contato com nossa equipe</li>
              <li>Altera&ccedil;&otilde;es de plano s&atilde;o feitas conforme pol&iacute;tica comercial vigente</li>
              <li>Reservamo-nos o direito de ajustar os planos e seus recursos com aviso pr&eacute;vio</li>
            </ul>
          </section>

          {/* 5. Uso Aceitável */}
          <section id="uso-aceitavel">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Uso Aceit&aacute;vel</h2>
            <p className="mb-3">Ao utilizar o Ramppy, voc&ecirc; concorda em:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Usar a plataforma apenas para fins de treinamento comercial leg&iacute;timo</li>
              <li>N&atilde;o tentar acessar dados de outras empresas ou usu&aacute;rios</li>
              <li>N&atilde;o realizar engenharia reversa, descompilar ou copiar funcionalidades da plataforma</li>
              <li>N&atilde;o utilizar as integra&ccedil;&otilde;es (WhatsApp, Gmail) para enviar spam, mensagens n&atilde;o solicitadas ou conte&uacute;do il&iacute;cito</li>
              <li>N&atilde;o sobrecarregar intencionalmente os servidores ou sistemas da plataforma</li>
              <li>N&atilde;o compartilhar credenciais de acesso com terceiros</li>
              <li>Respeitar a propriedade intelectual de terceiros no conte&uacute;do utilizado na plataforma</li>
            </ul>
            <p className="mt-3">
              O descumprimento destas regras poder&aacute; resultar na suspens&atilde;o ou encerramento da sua conta,
              sem preju&iacute;zo de outras medidas cab&iacute;veis.
            </p>
          </section>

          {/* 6. Integrações com Terceiros */}
          <section id="integracoes">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Integra&ccedil;&otilde;es com Terceiros</h2>
            <p className="mb-3">
              O Ramppy oferece integra&ccedil;&otilde;es com servi&ccedil;os de terceiros para aprimorar a experi&ecirc;ncia do usu&aacute;rio.
              Ao utilizar estas integra&ccedil;&otilde;es, voc&ecirc; reconhece e concorda que:
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">6.1 Google (Calendar, Gmail, Meet)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>A integra&ccedil;&atilde;o com servi&ccedil;os Google est&aacute; sujeita aos{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  Termos de Servi&ccedil;o do Google
                </a>
              </li>
              <li>Os dados acessados via APIs do Google s&atilde;o tratados conforme nossa{' '}
                <Link href="/privacy#google" className="text-green-600 hover:underline">Pol&iacute;tica de Privacidade (Se&ccedil;&atilde;o 4)</Link>
              </li>
              <li>Voc&ecirc; pode conectar e desconectar sua conta Google a qualquer momento</li>
              <li>A desconex&atilde;o remove imediatamente os tokens de acesso armazenados</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">6.2 WhatsApp</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>A integra&ccedil;&atilde;o com WhatsApp est&aacute; sujeita aos{' '}
                <a href="https://www.whatsapp.com/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  Termos de Servi&ccedil;o do WhatsApp/Meta
                </a>
              </li>
              <li>Voc&ecirc; &eacute; respons&aacute;vel pelo conte&uacute;do das mensagens enviadas atrav&eacute;s da plataforma</li>
              <li>Voc&ecirc; pode desconectar o WhatsApp a qualquer momento</li>
            </ul>

            <p className="mt-4">
              O Ramppy n&atilde;o se responsabiliza por indisponibilidade, altera&ccedil;&otilde;es ou interrup&ccedil;&otilde;es nos servi&ccedil;os de terceiros.
            </p>
          </section>

          {/* 7. Propriedade Intelectual */}
          <section id="propriedade">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Propriedade Intelectual</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>A plataforma Ramppy, incluindo seu c&oacute;digo-fonte, design, funcionalidades, marcas e conte&uacute;do original, &eacute; propriedade da Ramppy</li>
              <li>Conte&uacute;do gerado pelo usu&aacute;rio durante sess&otilde;es de roleplay (respostas, estrat&eacute;gias) pertence ao usu&aacute;rio</li>
              <li>Avalia&ccedil;&otilde;es, feedbacks e planos de desenvolvimento gerados por IA s&atilde;o licenciados para uso do usu&aacute;rio dentro da plataforma</li>
              <li>Personas, obje&ccedil;&otilde;es e dados da empresa configurados pela organiza&ccedil;&atilde;o s&atilde;o de propriedade da organiza&ccedil;&atilde;o</li>
              <li>&Eacute; vedada a reprodu&ccedil;&atilde;o, distribui&ccedil;&atilde;o ou modifica&ccedil;&atilde;o n&atilde;o autorizada de qualquer conte&uacute;do propriet&aacute;rio da plataforma</li>
            </ul>
          </section>

          {/* 8. Limitação de Responsabilidade */}
          <section id="responsabilidade">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limita&ccedil;&atilde;o de Responsabilidade</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O servi&ccedil;o &eacute; fornecido &ldquo;como est&aacute;&rdquo; (<em>as is</em>), sem garantias expl&iacute;citas ou impl&iacute;citas de adequa&ccedil;&atilde;o a fins espec&iacute;ficos</li>
              <li>Avalia&ccedil;&otilde;es e feedbacks gerados por intelig&ecirc;ncia artificial s&atilde;o <strong>sugest&otilde;es</strong> e n&atilde;o substituem julgamento profissional humano</li>
              <li>N&atilde;o nos responsabilizamos por decis&otilde;es de neg&oacute;cio tomadas com base nas an&aacute;lises e recomenda&ccedil;&otilde;es da plataforma</li>
              <li>N&atilde;o garantimos resultados espec&iacute;ficos de vendas ou desempenho profissional</li>
              <li>Nossa responsabilidade total est&aacute; limitada ao valor pago pelo usu&aacute;rio nos &uacute;ltimos 12 meses</li>
            </ul>
          </section>

          {/* 9. Disponibilidade do Serviço */}
          <section id="disponibilidade">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disponibilidade do Servi&ccedil;o</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Empregamos nosso melhor esfor&ccedil;o para manter a plataforma dispon&iacute;vel e funcional</li>
              <li>Manuten&ccedil;&otilde;es programadas ser&atilde;o comunicadas com anteced&ecirc;ncia quando poss&iacute;vel</li>
              <li>N&atilde;o nos responsabilizamos por interrup&ccedil;&otilde;es causadas por servi&ccedil;os de terceiros (Supabase, OpenAI, Google, Meta/WhatsApp)</li>
              <li>Em caso de interrup&ccedil;&otilde;es prolongadas, trabalharemos para restabelecer o servi&ccedil;o o mais r&aacute;pido poss&iacute;vel</li>
              <li>Funcionalidades que dependem de integra&ccedil;&otilde;es com terceiros podem ficar indispon&iacute;veis independentemente da disponibilidade do Ramppy</li>
            </ul>
          </section>

          {/* 10. Cancelamento e Rescisão */}
          <section id="cancelamento">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cancelamento e Rescis&atilde;o</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O usu&aacute;rio pode solicitar o cancelamento da sua conta a qualquer momento</li>
              <li>O administrador da empresa pode gerenciar (criar, suspender, excluir) contas de colaboradores</li>
              <li>Ap&oacute;s o cancelamento, os dados ser&atilde;o retidos por 30 dias e ent&atilde;o permanentemente removidos</li>
              <li>Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos de Uso, com notifica&ccedil;&atilde;o pr&eacute;via quando poss&iacute;vel</li>
              <li>Em caso de encerramento por viola&ccedil;&atilde;o, n&atilde;o haver&aacute; reembolso de cr&eacute;ditos n&atilde;o utilizados</li>
            </ul>
          </section>

          {/* 11. Alterações nos Termos */}
          <section id="alteracoes">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Altera&ccedil;&otilde;es nos Termos</h2>
            <p>
              Podemos modificar estes Termos de Uso periodicamente. Altera&ccedil;&otilde;es significativas ser&atilde;o comunicadas
              com anteced&ecirc;ncia m&iacute;nima de 15 dias, por e-mail ou notifica&ccedil;&atilde;o na plataforma.
              O uso continuado da plataforma ap&oacute;s o per&iacute;odo de aviso constitui aceita&ccedil;&atilde;o das altera&ccedil;&otilde;es.
              A data da &uacute;ltima atualiza&ccedil;&atilde;o ser&aacute; sempre exibida no topo desta p&aacute;gina.
            </p>
          </section>

          {/* 12. Legislação Aplicável */}
          <section id="legislacao">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Legisla&ccedil;&atilde;o Aplic&aacute;vel</h2>
            <p>
              Estes Termos de Uso s&atilde;o regidos e interpretados de acordo com as leis da Rep&uacute;blica Federativa do Brasil.
              Para a resolu&ccedil;&atilde;o de quaisquer controv&eacute;rsias decorrentes destes termos, fica eleito o foro da comarca
              da sede da Ramppy, com ren&uacute;ncia express&atilde;a a qualquer outro, por mais privilegiado que seja.
            </p>
            <p className="mt-3">
              Em caso de invalidez de qualquer disposi&ccedil;&atilde;o destes termos, as demais disposi&ccedil;&otilde;es permanecer&atilde;o
              em pleno vigor e efeito.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 Ramppy. Todos os direitos reservados.</p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Pol&iacute;tica de Privacidade
            </Link>
            <span className="text-green-600 font-medium">Termos de Uso</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
