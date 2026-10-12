import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Termos de uso' };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso" updated="12 de outubro de 2026">
      <p>
        Ao criar uma conta ou usar o <strong>PersonalPro</strong> (aplicativos iOS/Android e versão web), você concorda com estes Termos e com a{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
      <h2>1. O serviço</h2>
      <p>
        O PersonalPro é uma plataforma que conecta personal trainers e alunos para prescrição e registro de treinos, avaliações físicas, metas,
        agenda e comunicação. A plataforma não substitui avaliação médica.
      </p>
      <h2>2. Contas</h2>
      <ul>
        <li>Você deve fornecer informações verdadeiras e manter sua senha em sigilo.</li>
        <li>Professores declaram possuir habilitação profissional válida (CREF) para prescrever exercícios.</li>
        <li>Alunos devem procurar liberação médica antes de iniciar atividades físicas quando necessário.</li>
      </ul>
      <h2>3. Responsabilidades do professor</h2>
      <p>
        O professor é responsável pelos treinos prescritos, pelas orientações dadas aos alunos e pelo uso adequado dos dados dos alunos vinculados.
        Sugestões geradas pela IA são apenas apoio e só têm efeito após aprovação do professor.
      </p>
      <h2>4. Assinaturas e pagamentos</h2>
      <ul>
        <li>Professores podem contratar planos com limite de alunos (ex.: Starter, Pro e Unlimited), cobrados de forma recorrente.</li>
        <li>O cancelamento pode ser feito a qualquer momento no perfil e vale ao fim do período já pago.</li>
        <li>O uso pelo aluno é gratuito.</li>
      </ul>
      <h2>5. Conteúdo</h2>
      <p>
        Você mantém os direitos sobre fotos, vídeos e textos que enviar e nos concede licença limitada para armazená-los e exibi-los às pessoas
        autorizadas, apenas para a prestação do serviço. É proibido enviar conteúdo ilícito, ofensivo ou que viole direitos de terceiros.
      </p>
      <h2>6. Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento em Perfil → Privacidade. Podemos suspender contas que violem estes Termos.
      </p>
      <h2>7. Limitação de responsabilidade</h2>
      <p>
        O PersonalPro é fornecido &ldquo;no estado em que se encontra&rdquo;. Não nos responsabilizamos por lesões decorrentes da execução de exercícios,
        que devem ser realizados sob orientação profissional.
      </p>
      <h2>8. Contato e foro</h2>
      <p>
        Dúvidas: <a href="mailto:privacidade@personalpro.app">privacidade@personalpro.app</a>. Fica eleito o foro do domicílio do consumidor, nos termos do
        Código de Defesa do Consumidor.
      </p>
    </LegalPage>
  );
}
