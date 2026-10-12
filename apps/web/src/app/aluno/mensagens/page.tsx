'use client';

import { ChatView } from '@/components/chat-view';
import { PageHeader } from '@/components/ui';

export default function StudentMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensagens" subtitle="Fale com seu personal — fotos, vídeos e áudios também" />
      <ChatView />
    </div>
  );
}
