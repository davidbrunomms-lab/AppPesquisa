import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Política de Privacidade' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="12 de outubro de 2026">
      <p>
        Esta Política explica como o <strong>PersonalPro</strong> coleta, usa, compartilha e protege dados pessoais de professores (personal trainers),
        alunos e visitantes, em conformidade com a Lei Geral de Proteção de Dados Pessoais (<strong>LGPD — Lei nº 13.709/2018</strong>).
      </p>

      <h2>1. Controlador e encarregado (DPO)</h2>
      <p>
        O controlador dos dados tratados na plataforma é o PersonalPro. Para dúvidas ou solicitações sobre seus dados, fale com nosso
        Encarregado pelo Tratamento de Dados Pessoais (DPO) pelo e-mail <a href="mailto:privacidade@personalpro.app">privacidade@personalpro.app</a>.
      </p>
      <p>
        Em relação aos dados de treino e avaliação que o professor registra sobre seus alunos, o professor também atua como agente de tratamento,
        sendo responsável pelo uso profissional dessas informações.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro e conta:</strong> nome, e-mail, telefone, foto de perfil, senha (armazenada apenas como hash), perfil (aluno ou professor), CREF e dados profissionais do professor.</li>
        <li><strong>Perfil do aluno:</strong> data de nascimento, sexo, altura, objetivo, nível de treino, frequência semanal e academia.</li>
        <li>
          <strong>Dados de saúde (dados pessoais sensíveis):</strong> peso, percentual de gordura, massa muscular, massa magra, gordura visceral,
          medidas corporais, fotos de evolução, cargas, repetições, percepção de esforço e observações de treino.
        </li>
        <li><strong>Uso da plataforma:</strong> treinos realizados, agendamentos, mensagens e anexos do chat, notificações e preferências.</li>
        <li><strong>Pagamentos (professores):</strong> plano contratado e status de cobrança. Dados de cartão são tratados exclusivamente pelo gateway de pagamento e não ficam armazenados no PersonalPro.</li>
        <li><strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo, token de notificações push e registros de acesso (logs), exigidos pelo Marco Civil da Internet.</li>
      </ul>

      <h2>3. Finalidades e bases legais</h2>
      <table>
        <thead>
          <tr>
            <th>Finalidade</th>
            <th>Base legal (LGPD)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Criar e manter sua conta, autenticar o acesso e prestar o serviço contratado</td>
            <td>Execução de contrato (art. 7º, V)</td>
          </tr>
          <tr>
            <td>Registrar avaliações físicas, fotos, medidas e evolução de treinos</td>
            <td>Consentimento específico e destacado para dados sensíveis (art. 11, I), coletado no cadastro</td>
          </tr>
          <tr>
            <td>Compartilhar seus dados com o professor vinculado para prescrição e acompanhamento</td>
            <td>Consentimento (art. 11, I) e execução de contrato</td>
          </tr>
          <tr>
            <td>Enviar lembretes de treino, avisos de agenda e notificações do app</td>
            <td>Execução de contrato e legítimo interesse (art. 7º, IX)</td>
          </tr>
          <tr>
            <td>Sugestões automáticas da IA ao professor (nunca aplicadas sem aprovação humana)</td>
            <td>Consentimento e legítimo interesse, com revisão humana</td>
          </tr>
          <tr>
            <td>Cobrança de assinaturas de professores e emissão de documentos fiscais</td>
            <td>Execução de contrato e cumprimento de obrigação legal (art. 7º, II)</td>
          </tr>
          <tr>
            <td>Guarda de registros de acesso e prevenção a fraudes</td>
            <td>Obrigação legal (Marco Civil, art. 15) e legítimo interesse</td>
          </tr>
          <tr>
            <td>Comunicações de marketing</td>
            <td>Consentimento (opcional, revogável a qualquer momento)</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Compartilhamento</h2>
      <ul>
        <li><strong>Com o seu professor:</strong> alunos compartilham perfil, treinos, avaliações, fotos, metas e mensagens apenas com o(s) professor(es) com quem possuem vínculo ativo. Anotações privadas do professor não são exibidas ao aluno.</li>
        <li><strong>Operadores:</strong> provedores de hospedagem, armazenamento de arquivos, envio de e-mails, notificações push e pagamentos, contratados com cláusulas de confidencialidade e segurança.</li>
        <li><strong>Autoridades:</strong> quando exigido por lei ou ordem judicial.</li>
      </ul>
      <p>Não vendemos dados pessoais. Quando há transferência internacional (por exemplo, serviços em nuvem), adotamos as salvaguardas previstas no art. 33 da LGPD.</p>

      <h2>5. Retenção</h2>
      <p>
        Mantemos os dados enquanto sua conta estiver ativa. Ao excluir a conta, os dados pessoais são eliminados ou anonimizados, e os arquivos
        (fotos, anexos e avatar) são removidos do armazenamento. Mantemos apenas o que a lei exige, como registros de acesso por 6 meses (Marco Civil)
        e documentos fiscais pelo prazo legal.
      </p>

      <h2>6. Seus direitos (art. 18 da LGPD)</h2>
      <ul>
        <li><strong>Confirmação e acesso</strong> aos seus dados;</li>
        <li><strong>Portabilidade/exportação:</strong> em <em>Perfil → Privacidade → Exportar meus dados</em> você baixa um arquivo JSON com todos os seus dados;</li>
        <li><strong>Correção</strong> de dados incompletos ou desatualizados diretamente no seu perfil;</li>
        <li><strong>Eliminação:</strong> em <em>Perfil → Privacidade → Excluir conta</em> você exclui sua conta e seus dados;</li>
        <li><strong>Revogação do consentimento</strong> e informação sobre as consequências da revogação;</li>
        <li>Anonimização, bloqueio, informação sobre compartilhamentos e oposição a tratamentos irregulares;</li>
        <li>Revisão de decisões automatizadas — as sugestões da IA são sempre revisadas pelo professor.</li>
      </ul>
      <p>
        Você também pode exercer seus direitos pelo e-mail <a href="mailto:privacidade@personalpro.app">privacidade@personalpro.app</a> e apresentar
        reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>7. Segurança</h2>
      <ul>
        <li>Comunicação criptografada (HTTPS/TLS) e senhas armazenadas com hash forte (bcrypt);</li>
        <li>Tokens de acesso de curta duração com rotação de refresh token e revogação de sessões;</li>
        <li>Isolamento entre professores: cada professor acessa apenas os alunos vinculados a ele;</li>
        <li>Criptografia (AES-256-GCM) de informações confidenciais em repouso, como as anotações privadas do professor, além de controle de acesso por perfil e limitação de tentativas de login;</li>
        <li>Registros de auditoria e backups.</li>
      </ul>

      <h2>8. Crianças e adolescentes</h2>
      <p>O uso por menores de 18 anos depende de consentimento de pelo menos um dos pais ou responsável legal, nos termos do art. 14 da LGPD.</p>

      <h2>9. Cookies e armazenamento local</h2>
      <p>A versão web usa armazenamento local do navegador apenas para manter sua sessão autenticada. Não utilizamos cookies de publicidade.</p>

      <h2>10. Alterações</h2>
      <p>Podemos atualizar esta Política. Mudanças relevantes serão comunicadas no app ou por e-mail com antecedência razoável.</p>
    </LegalPage>
  );
}
