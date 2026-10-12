import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Input, Screen, Spacer, T } from '@/components/ui';
import { useInvalidate } from '@/features/hooks';
import { acceptInvite } from '@/features/student/LinkTrainerCard';
import { haptic } from '@/components/RestTimer';
import { notify, notifyError } from '@/lib/alert';
import { extractInviteCode } from '@/lib/format';
import { useTheme } from '@/theme';

/** Lê o QR Code do professor (URL/deep link com o código) e vincula a conta. */
export default function ScanInviteScreen() {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);
  const invalidate = useInvalidate();

  const link = async (raw: string) => {
    if (handled.current || busy) return;
    const code = extractInviteCode(raw);
    if (!code) return;
    handled.current = true;
    setBusy(true);
    haptic('success');
    try {
      await acceptInvite(code);
      await invalidate(['dashboard'], ['me'], ['workouts'], ['conversations']);
      notify('Pronto!', 'Você foi vinculado ao seu professor.');
      router.back();
    } catch (e) {
      notifyError(e, 'Não foi possível vincular');
      handled.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Escanear QR Code" back>
      <T tone="secondary" style={{ marginBottom: 16 }}>
        Aponte a câmera para o QR Code do seu professor.
      </T>
      {!permission ? null : permission.granted ? (
        <View style={{ borderRadius: 20, overflow: 'hidden', aspectRatio: 1, backgroundColor: '#000', borderWidth: 2, borderColor: colors.accent }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={busy ? undefined : (r) => void link(r.data)}
          />
        </View>
      ) : (
        <Card style={{ alignItems: 'center', gap: 12 }}>
          <T center tone="secondary">
            Precisamos de acesso à câmera para ler o QR Code.
          </T>
          <Button title="Permitir câmera" icon="camera" onPress={requestPermission} />
        </Card>
      )}
      <Spacer size={24} />
      <T variant="h3" style={{ marginBottom: 8 }}>
        Ou digite o código
      </T>
      <Input value={manual} onChangeText={setManual} placeholder="Ex.: DEMO01" autoCapitalize="characters" icon="qr" />
      <Button title="Vincular" onPress={() => link(manual)} loading={busy} disabled={!manual.trim()} />
    </Screen>
  );
}
