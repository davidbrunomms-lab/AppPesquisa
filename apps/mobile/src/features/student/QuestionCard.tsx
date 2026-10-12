import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Button, Card, Input, Row, T } from '@/components/ui';
import { useInvalidate } from '@/features/hooks';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

/** "Enviar dúvida ao professor" — POST /conversations/question. */
export function QuestionCard() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await api.post('/conversations/question', { content: text.trim() });
      setText('');
      notify('Dúvida enviada', 'Seu professor vai responder pelo chat.');
      await invalidate(['conversations']);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <Row gap={10} style={{ marginBottom: 10 }}>
        <Icon name="help" color={colors.accent} />
        <T variant="h3">Enviar dúvida ao professor</T>
      </Row>
      <Input value={text} onChangeText={setText} placeholder="Ex.: Posso trocar o leg press pelo agachamento?" multiline />
      <Button title="Enviar dúvida" icon="send" variant="secondary" onPress={send} loading={loading} disabled={!text.trim()} />
    </Card>
  );
}
