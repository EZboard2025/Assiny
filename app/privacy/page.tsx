import Link from 'next/link'
import Image from 'next/image'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/images/logo-preta.png" alt="Ramppy" width={160} height={45} className="object-contain" />
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <span className="text-green-600 font-medium">Privacidade</span>
            <Link href="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">
              Termos de Uso
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pol&iacute;tica de Privacidade</h1>
        <p className="text-gray-500 text-sm mb-10">&Uacute;ltima atualiza&ccedil;&atilde;o: 23 de fevereiro de 2026</p>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">&Iacute;ndice</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <li><a href="#introducao" className="text-green-600 hover:underline">1. Introdu&ccedil;&atilde;o</a></li>
            <li><a href="#informacoes" className="text-green-600 hover:underline">2. Informa&ccedil;&otilde;es que Coletamos</a></li>
            <li><a href="#uso" className="text-green-600 hover:underline">3. Como Usamos suas Informa&ccedil;&otilde;es</a></li>
            <li><a href="#google" className="text-green-600 hover:underline">4. Integra&ccedil;&atilde;o com Servi&ccedil;os Google</a></li>
            <li><a href="#whatsapp" className="text-green-600 hover:underline">5. Integra&ccedil;&atilde;o com WhatsApp</a></li>
            <li><a href="#compartilhamento" className="text-green-600 hover:underline">6. Compartilhamento de Dados</a></li>
            <li><a href="#seguranca" className="text-green-600 hover:underline">7. Armazenamento e Seguran&ccedil;a</a></li>
            <li><a href="#retencao" className="text-green-600 hover:underline">8. Reten&ccedil;&atilde;o de Dados</a></li>
            <li><a href="#lgpd" className="text-green-600 hover:underline">9. Seus Direitos (LGPD)</a></li>
            <li><a href="#cookies" className="text-green-600 hover:underline">10. Cookies e Rastreamento</a></li>
            <li><a href="#menores" className="text-green-600 hover:underline">11. Menores de Idade</a></li>
            <li><a href="#alteracoes" className="text-green-600 hover:underline">12. Altera&ccedil;&otilde;es nesta Pol&iacute;tica</a></li>
            <li><a href="#exclusao" className="text-green-600 hover:underline">13. Exclus&atilde;o de Dados</a></li>
            <li><a href="#contato" className="text-green-600 hover:underline">14. Contato</a></li>
          </ol>
        </nav>

        <div className="space-y-10 text-gray-700 text-base leading-relaxed">
          {/* 1. Introdução */}
          <section id="introducao">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introdu&ccedil;&atilde;o</h2>
            <p>
              A <strong>Ramppy</strong> (&ldquo;n&oacute;s&rdquo;, &ldquo;nosso&rdquo;, &ldquo;nossa&rdquo;) opera a plataforma <strong>Ramppy</strong>,
              uma ferramenta SaaS de treinamento em vendas com intelig&ecirc;ncia artificial, acess&iacute;vel atrav&eacute;s do dom&iacute;nio{' '}
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">ramppy.site</code> e seus subdom&iacute;nios{' '}
              (<code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">*.ramppy.site</code>).
            </p>
            <p className="mt-3">
              Esta Pol&iacute;tica de Privacidade descreve como coletamos, usamos, armazenamos, compartilhamos e protegemos suas
              informa&ccedil;&otilde;es pessoais quando voc&ecirc; utiliza nossa plataforma. Ao acessar ou usar o Ramppy, voc&ecirc; concorda com as
              pr&aacute;ticas descritas neste documento.
            </p>
          </section>

          {/* 2. Informações que Coletamos */}
          <section id="informacoes">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Informa&ccedil;&otilde;es que Coletamos</h2>
            <p className="mb-3">Coletamos as seguintes categorias de informa&ccedil;&otilde;es:</p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.1 Dados de Cadastro</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo</li>
              <li>Endere&ccedil;o de e-mail</li>
              <li>Empresa e cargo</li>
              <li>Senha (armazenada de forma criptografada)</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.2 Dados de Uso da Plataforma</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Sess&otilde;es de roleplay (transcri&ccedil;&otilde;es, configura&ccedil;&otilde;es, dura&ccedil;&atilde;o)</li>
              <li>Avalia&ccedil;&otilde;es de desempenho SPIN Selling</li>
              <li>M&eacute;tricas de performance e resum&oacute;s</li>
              <li>Planos de Desenvolvimento Individual (PDIs)</li>
              <li>Conversas com o assistente de IA (Chat IA)</li>
              <li>Desafios di&aacute;rios e resultados</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.3 Dados de Integra&ccedil;&atilde;o WhatsApp</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>N&uacute;mero de telefone comercial conectado</li>
              <li>Mensagens enviadas e recebidas (para an&aacute;lise de follow-up e copiloto de IA)</li>
              <li>Transcri&ccedil;&otilde;es de &aacute;udios de voz</li>
              <li>M&iacute;dias compartilhadas (imagens, documentos, &aacute;udios)</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.4 Dados de Integra&ccedil;&atilde;o Google</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Eventos do Google Calendar (t&iacute;tulo, hor&aacute;rio, participantes, links de reuni&atilde;o)</li>
              <li>Endere&ccedil;o de e-mail da conta Google conectada</li>
              <li>Transcri&ccedil;&otilde;es de reuni&otilde;es Google Meet (via servi&ccedil;os de transcri&ccedil;&atilde;o)</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.5 Dados T&eacute;cnicos</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Endere&ccedil;o IP</li>
              <li>Tipo de navegador e sistema operacional</li>
              <li>Cookies de sess&atilde;o (para autentica&ccedil;&atilde;o)</li>
            </ul>
          </section>

          {/* 3. Como Usamos suas Informações */}
          <section id="uso">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Como Usamos suas Informa&ccedil;&otilde;es</h2>
            <p className="mb-3">Utilizamos suas informa&ccedil;&otilde;es para os seguintes fins:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Treinamento de vendas com IA:</strong> fornecer sess&otilde;es de roleplay, avalia&ccedil;&otilde;es SPIN Selling e feedbacks personalizados</li>
              <li><strong>Planos de Desenvolvimento:</strong> gerar PDIs (Planos de Desenvolvimento Individual) baseados no seu desempenho</li>
              <li><strong>Copiloto de Vendas:</strong> analisar conversas de follow-up e sugerir melhorias em tempo real via intelig&ecirc;ncia artificial</li>
              <li><strong>Gest&atilde;o de Agenda:</strong> criar, editar e visualizar eventos no Google Calendar via assistente de IA</li>
              <li><strong>Envio de E-mails:</strong> enviar convites de reuni&atilde;o e compartilhar avalia&ccedil;&otilde;es por e-mail atrav&eacute;s da conta Gmail do usu&aacute;rio</li>
              <li><strong>An&aacute;lise de Reuni&otilde;es:</strong> analisar transcri&ccedil;&otilde;es de reuni&otilde;es Google Meet para avalia&ccedil;&atilde;o de desempenho</li>
              <li><strong>Comunica&ccedil;&atilde;o:</strong> enviar notifica&ccedil;&otilde;es sobre atualiza&ccedil;&otilde;es do servi&ccedil;o</li>
              <li><strong>Melhoria do Servi&ccedil;o:</strong> analisar padr&otilde;es de uso para aprimorar funcionalidades da plataforma</li>
            </ul>
          </section>

          {/* 4. Integração com Serviços Google */}
          <section id="google">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Integra&ccedil;&atilde;o com Servi&ccedil;os Google</h2>
            <p className="mb-4">
              O Ramppy oferece integra&ccedil;&atilde;o opcional com servi&ccedil;os do Google para aprimorar a experi&ecirc;ncia de treinamento.
              Essa integra&ccedil;&atilde;o &eacute; iniciada exclusivamente pelo usu&aacute;rio e pode ser revogada a qualquer momento.
            </p>

            <h3 className="font-semibold text-gray-800 mt-6 mb-3">4.1 Escopos de Acesso e Uso Espec&iacute;fico</h3>
            <p className="mb-3">Quando voc&ecirc; conecta sua conta Google, solicitamos acesso aos seguintes escopos:</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Permiss&atilde;o</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold">O que Acessamos</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Por que Precisamos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium">Google Calendar (leitura e escrita)</td>
                    <td className="border border-gray-200 px-4 py-3">Eventos do seu calend&aacute;rio</td>
                    <td className="border border-gray-200 px-4 py-3">
                      O assistente de IA cria, edita e remove eventos no seu calend&aacute;rio.
                      Tamb&eacute;m lista reuni&otilde;es com Google Meet para an&aacute;lise de transcri&ccedil;&atilde;o.
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3 font-medium">Google Calendar (somente leitura)</td>
                    <td className="border border-gray-200 px-4 py-3">Lista de eventos</td>
                    <td className="border border-gray-200 px-4 py-3">
                      Exibir reuni&otilde;es com Google Meet dispon&iacute;veis para an&aacute;lise de transcri&ccedil;&atilde;o e desempenho.
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium">Informa&ccedil;&otilde;es do Perfil (e-mail)</td>
                    <td className="border border-gray-200 px-4 py-3">Endere&ccedil;o de e-mail</td>
                    <td className="border border-gray-200 px-4 py-3">
                      Identificar qual conta Google est&aacute; conectada e exibir o e-mail na interface do usu&aacute;rio.
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3 font-medium">Gmail (envio de e-mails)</td>
                    <td className="border border-gray-200 px-4 py-3">Capacidade de enviar e-mails</td>
                    <td className="border border-gray-200 px-4 py-3">
                      Enviar convites de reuni&atilde;o e compartilhar avalia&ccedil;&otilde;es de desempenho por e-mail em nome do usu&aacute;rio.
                      N&atilde;o lemos, acessamos ou armazenamos e-mails da caixa de entrada.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-gray-800 mt-6 mb-3">4.2 Conformidade com a Pol&iacute;tica de Dados de Usu&aacute;rio do Google</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
              <p>
                O uso e a transfer&ecirc;ncia para qualquer outro aplicativo de informa&ccedil;&otilde;es recebidas das APIs do Google
                estar&atilde;o em conformidade com a{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 font-medium underline"
                >
                  Pol&iacute;tica de Dados de Usu&aacute;rio dos Servi&ccedil;os de API do Google
                </a>
                , incluindo os requisitos de Uso Limitado.
              </p>
            </div>

            <h3 className="font-semibold text-gray-800 mt-6 mb-3">4.3 Uso Limitado (Limited Use Disclosure)</h3>
            <p className="mb-3">Em rela&ccedil;&atilde;o aos dados obtidos atrav&eacute;s das APIs do Google, declaramos que:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Acessamos dados do Google <strong>exclusivamente</strong> para fornecer as funcionalidades descritas na se&ccedil;&atilde;o 4.1 acima,
                que s&atilde;o vis&iacute;veis e relevantes para o usu&aacute;rio na interface do Ramppy.
              </li>
              <li>
                <strong>N&atilde;o vendemos</strong> dados obtidos do Google para terceiros, em nenhuma circunst&acirc;ncia.
              </li>
              <li>
                <strong>N&atilde;o utilizamos</strong> dados do Google para publicidade, segmenta&ccedil;&atilde;o de an&uacute;ncios,
                pesquisa de mercado ou qualquer finalidade n&atilde;o relacionada &agrave;s funcionalidades da plataforma.
              </li>
              <li>
                <strong>N&atilde;o compartilhamos</strong> dados do Google com terceiros, exceto:
                <ul className="list-[circle] pl-6 mt-1 space-y-1">
                  <li>Com o consentimento expl&iacute;cito do usu&aacute;rio</li>
                  <li>Quando necess&aacute;rio para cumprir obriga&ccedil;&otilde;es legais</li>
                  <li>Para prestadores de servi&ccedil;o que operam em nosso nome, sob obriga&ccedil;&otilde;es de confidencialidade (ex.: infraestrutura de servidores)</li>
                </ul>
              </li>
              <li>
                Os tokens de acesso OAuth do Google s&atilde;o armazenados com <strong>criptografia</strong> no servidor
                e acess&iacute;veis apenas pela aplica&ccedil;&atilde;o backend, nunca expostos ao navegador do usu&aacute;rio.
              </li>
              <li>
                O usu&aacute;rio pode <strong>revogar o acesso</strong> a qualquer momento desconectando sua conta Google
                nas configura&ccedil;&otilde;es da plataforma, o que remove imediatamente todos os tokens armazenados.
              </li>
            </ul>
          </section>

          {/* 5. Integração com WhatsApp */}
          <section id="whatsapp">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Integra&ccedil;&atilde;o com WhatsApp</h2>
            <p className="mb-3">
              O Ramppy oferece integra&ccedil;&atilde;o opcional com WhatsApp para gest&atilde;o de follow-up e assist&ecirc;ncia de vendas com IA.
              Esta integra&ccedil;&atilde;o utiliza automa&ccedil;&atilde;o de navegador para conectar &agrave; sess&atilde;o do WhatsApp Web do usu&aacute;rio.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>A conex&atilde;o &eacute; iniciada exclusivamente pelo usu&aacute;rio, via leitura de c&oacute;digo QR</li>
              <li>Mensagens s&atilde;o armazenadas para an&aacute;lise de follow-up e sugest&otilde;es do copiloto de IA</li>
              <li>Dados de conversa&ccedil;&atilde;o n&atilde;o s&atilde;o compartilhados com terceiros</li>
              <li>Transcri&ccedil;&atilde;o autom&aacute;tica de mensagens de voz &eacute; realizada via tecnologia de reconhecimento de fala</li>
              <li>O usu&aacute;rio pode desconectar o WhatsApp a qualquer momento atrav&eacute;s da interface da plataforma</li>
            </ul>
          </section>

          {/* 6. Compartilhamento de Dados */}
          <section id="compartilhamento">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Compartilhamento de Dados com Terceiros</h2>
            <p className="mb-3">
              <strong>N&atilde;o vendemos</strong> informa&ccedil;&otilde;es pessoais a terceiros em nenhuma circunst&acirc;ncia.
              Compartilhamos dados apenas com os seguintes prestadores de servi&ccedil;o, estritamente necess&aacute;rios para
              a opera&ccedil;&atilde;o da plataforma:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Prestador</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Finalidade</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Dados Compartilhados</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium">Supabase</td>
                    <td className="border border-gray-200 px-4 py-3">Infraestrutura de banco de dados e autentica&ccedil;&atilde;o</td>
                    <td className="border border-gray-200 px-4 py-3">Dados de cadastro, sess&otilde;es, avalia&ccedil;&otilde;es</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3 font-medium">OpenAI</td>
                    <td className="border border-gray-200 px-4 py-3">Processamento de IA (roleplay, avalia&ccedil;&otilde;es, transcri&ccedil;&otilde;es)</td>
                    <td className="border border-gray-200 px-4 py-3">Textos de conversa&ccedil;&atilde;o e &aacute;udios para transcri&ccedil;&atilde;o</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium">N8N</td>
                    <td className="border border-gray-200 px-4 py-3">Automa&ccedil;&atilde;o de workflows (TTS, avalia&ccedil;&atilde;o, PDI)</td>
                    <td className="border border-gray-200 px-4 py-3">Transcri&ccedil;&otilde;es e contexto de sess&otilde;es</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3 font-medium">Google APIs</td>
                    <td className="border border-gray-200 px-4 py-3">Calendar, Gmail, Meet (conforme autoriza&ccedil;&atilde;o)</td>
                    <td className="border border-gray-200 px-4 py-3">Dados de eventos e e-mail (via OAuth do usu&aacute;rio)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 font-medium">Recall.ai / Deepgram</td>
                    <td className="border border-gray-200 px-4 py-3">Transcri&ccedil;&atilde;o de reuni&otilde;es Google Meet</td>
                    <td className="border border-gray-200 px-4 py-3">&Aacute;udio de reuni&otilde;es para transcri&ccedil;&atilde;o</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 7. Armazenamento e Segurança */}
          <section id="seguranca">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Armazenamento e Seguran&ccedil;a</h2>
            <p className="mb-3">Adotamos medidas t&eacute;cnicas e organizacionais para proteger suas informa&ccedil;&otilde;es:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Criptografia:</strong> dados armazenados em servidores com criptografia em repouso e em tr&acirc;nsito (HTTPS/TLS)</li>
              <li><strong>Autentica&ccedil;&atilde;o:</strong> sistema de autentica&ccedil;&atilde;o segura com tokens JWT e sess&otilde;es criptografadas</li>
              <li><strong>Isolamento Multi-Tenant:</strong> cada empresa acessa exclusivamente seus pr&oacute;prios dados, com pol&iacute;ticas de seguran&ccedil;a em n&iacute;vel de linha no banco de dados (Row Level Security)</li>
              <li><strong>Tokens OAuth:</strong> tokens de acesso do Google s&atilde;o armazenados com criptografia, acess&iacute;veis apenas pelo servidor backend</li>
              <li><strong>Backups:</strong> backups autom&aacute;ticos di&aacute;rios dos dados</li>
              <li><strong>Controle de Acesso:</strong> acesso restrito a funcion&aacute;rios autorizados, com princ&iacute;pio de menor privil&eacute;gio</li>
            </ul>
          </section>

          {/* 8. Retenção de Dados */}
          <section id="retencao">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Reten&ccedil;&atilde;o de Dados</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Dados de conta:</strong> mantidos enquanto a conta estiver ativa na plataforma</li>
              <li><strong>Sess&otilde;es de roleplay e avalia&ccedil;&otilde;es:</strong> mantidas enquanto a conta existir, para hist&oacute;rico e an&aacute;lise de evolu&ccedil;&atilde;o</li>
              <li><strong>Dados de WhatsApp:</strong> mantidos enquanto a conex&atilde;o WhatsApp estiver ativa</li>
              <li><strong>Tokens OAuth do Google:</strong> mantidos at&eacute; o usu&aacute;rio desconectar sua conta Google</li>
              <li><strong>Ap&oacute;s exclus&atilde;o de conta:</strong> todos os dados pessoais s&atilde;o removidos em at&eacute; 30 dias</li>
              <li><strong>Logs de sistema:</strong> retidos por at&eacute; 90 dias para diagn&oacute;stico de problemas t&eacute;cnicos</li>
            </ul>
          </section>

          {/* 9. LGPD */}
          <section id="lgpd">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Seus Direitos (LGPD &mdash; Lei 13.709/2018)</h2>
            <p className="mb-3">
              Em conformidade com a Lei Geral de Prote&ccedil;&atilde;o de Dados (LGPD), voc&ecirc; possui os seguintes direitos
              em rela&ccedil;&atilde;o aos seus dados pessoais:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Acesso:</strong> solicitar uma c&oacute;pia dos seus dados pessoais que armazenamos</li>
              <li><strong>Corre&ccedil;&atilde;o:</strong> corrigir dados pessoais incompletos, inexatos ou desatualizados</li>
              <li><strong>Exclus&atilde;o:</strong> solicitar a remo&ccedil;&atilde;o dos seus dados pessoais</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado e interoper&aacute;vel</li>
              <li><strong>Revoga&ccedil;&atilde;o:</strong> retirar seu consentimento para tratamento de dados a qualquer momento</li>
              <li><strong>Informa&ccedil;&atilde;o:</strong> saber com quem seus dados s&atilde;o compartilhados e para quais finalidades</li>
              <li><strong>Oposi&ccedil;&atilde;o:</strong> se opor ao tratamento de dados quando baseado em interesses leg&iacute;timos</li>
            </ul>
            <p className="mt-3">
              Para exercer qualquer um desses direitos, entre em contato conosco atrav&eacute;s do e-mail:{' '}
              <a href="mailto:axp0082.0@gmail.com" className="text-green-600 hover:underline font-medium">axp0082.0@gmail.com</a>
            </p>
            <p className="mt-2">
              Responderemos &agrave; sua solicita&ccedil;&atilde;o em at&eacute; 15 dias &uacute;teis, conforme previsto na legisla&ccedil;&atilde;o.
            </p>
          </section>

          {/* 10. Cookies */}
          <section id="cookies">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cookies e Tecnologias de Rastreamento</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Cookies de sess&atilde;o:</strong> utilizados exclusivamente para autentica&ccedil;&atilde;o e manuten&ccedil;&atilde;o da sess&atilde;o do usu&aacute;rio (essenciais)</li>
              <li><strong>Armazenamento local (localStorage):</strong> utilizado para salvar prefer&ecirc;ncias de interface, como layout do dashboard e configura&ccedil;&otilde;es visuais</li>
              <li><strong>Sem cookies de publicidade:</strong> n&atilde;o utilizamos cookies de publicidade, retargeting ou rastreamento de terceiros</li>
              <li><strong>Sem an&aacute;lises de terceiros:</strong> n&atilde;o utilizamos Google Analytics ou ferramentas similares de rastreamento comportamental</li>
            </ul>
          </section>

          {/* 11. Menores */}
          <section id="menores">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Menores de Idade</h2>
            <p>
              O Ramppy &eacute; destinado a profissionais de vendas e n&atilde;o se destina a menores de 18 anos.
              N&atilde;o coletamos intencionalmente dados pessoais de menores de idade. Caso identifiquemos que dados
              de um menor foram coletados inadvertidamente, procederemos com a exclus&atilde;o imediata.
            </p>
          </section>

          {/* 12. Alterações */}
          <section id="alteracoes">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Altera&ccedil;&otilde;es nesta Pol&iacute;tica</h2>
            <p>
              Podemos atualizar esta Pol&iacute;tica de Privacidade periodicamente para refletir mudan&ccedil;as em nossas pr&aacute;ticas ou
              na legisla&ccedil;&atilde;o aplic&aacute;vel. Altera&ccedil;&otilde;es significativas ser&atilde;o comunicadas por e-mail ou por meio de
              notifica&ccedil;&atilde;o na plataforma. A data da &uacute;ltima atualiza&ccedil;&atilde;o ser&aacute; sempre exibida no topo desta p&aacute;gina.
            </p>
          </section>

          {/* 13. Exclusão */}
          <section id="exclusao">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Exclus&atilde;o de Dados</h2>
            <p>Para solicitar a exclus&atilde;o completa dos seus dados pessoais:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Envie uma solicita&ccedil;&atilde;o para:{' '}
                <a href="mailto:axp0082.0@gmail.com" className="text-green-600 hover:underline font-medium">axp0082.0@gmail.com</a>
              </li>
              <li>Prazo de processamento: at&eacute; 30 dias &uacute;teis</li>
              <li>Dados de integra&ccedil;&otilde;es (Google, WhatsApp) s&atilde;o revogados automaticamente ao desconectar o servi&ccedil;o</li>
              <li>Ap&oacute;s a exclus&atilde;o, os dados n&atilde;o poder&atilde;o ser recuperados</li>
            </ul>
          </section>

          {/* 14. Contato */}
          <section id="contato">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contato</h2>
            <p>Para d&uacute;vidas, solicita&ccedil;&otilde;es ou reclama&ccedil;&otilde;es sobre esta Pol&iacute;tica de Privacidade:</p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p><strong>Ramppy</strong></p>
              <p className="mt-1">
                E-mail:{' '}
                <a href="mailto:axp0082.0@gmail.com" className="text-green-600 hover:underline">axp0082.0@gmail.com</a>
              </p>
              <p className="mt-1">
                Plataforma:{' '}
                <a href="https://ramppy.site" className="text-green-600 hover:underline" target="_blank" rel="noopener noreferrer">
                  https://ramppy.site
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 Ramppy. Todos os direitos reservados.</p>
          <nav className="flex items-center gap-6">
            <span className="text-green-600 font-medium">Pol&iacute;tica de Privacidade</span>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              Termos de Uso
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
