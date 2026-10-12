'use client';

import { ChatView } from '@/components/chat-view';
import { PageHeader } from '@/components/ui';

export default function TrainerMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensagens" subtitle="Converse com seus alunos em tempo real" />
      <ChatView />
    </div>
  );
}
