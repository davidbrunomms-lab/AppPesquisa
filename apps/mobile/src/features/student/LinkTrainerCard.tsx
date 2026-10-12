import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, Input, Row, T } from '@/components/ui';
import { useInvalidate } from '@/features/hooks';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { extractInviteCode } from '@/lib/format';
import { useTheme } from '@/theme';

/** Aceita o convite/código do professor: POST /invites/accept { code }. */
export async function acceptInvite(raw: string) {
  const code = extractInviteCode(raw);
  if (!code) throw new Error('Código inválido. Confira e tente novamente.');
  return api.post<unknown>('/invites/accept', { code });
}

export function LinkTrainerCard() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await acceptInvite(code);
      setCode('');
      notify('Pronto!', 'Você foi vinculado ao seu professor.');
      await invalidate(['dashboard'], ['me'], ['workouts'], ['conversations']);
    } catch (e) {
      notifyError(e, 'Não foi possível vincular');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ borderColor: colors.accent, borderWidth: 1 }}>
      <Row gap={10} style={{ marginBottom: 8 }}>
        <Icon name="link" color={colors.accent} />
        <T variant="h3">Vincule seu professor</T>
      </Row>
      <T tone="secondary" style={{ marginBottom: 14 }}>
        Informe o código que seu personal enviou ou escaneie o QR Code para receber seus treinos.
      </T>
      <Input value={code} onChangeText={setCode} placeholder="Código do professor (ex.: DEMO01)" autoCapitalize="characters" icon="qr" />
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Button title="Vincular" onPress={submit} loading={loading} disabled={!code.trim()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Escanear QR" icon="camera" variant="secondary" onPress={() => router.push('/aluno/escanear')} />
        </View>
      </Row>
    </Card>
  );
}
