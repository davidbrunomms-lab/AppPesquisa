import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Input, Screen, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { notify } from '@/lib/alert';
import { api, errorMessage } from '@/lib/api';

export default function ChangePasswordScreen() {
  const { user, refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setError('A nova senha deve ter ao menos 8 caracteres, com letras e números.');
      return;
    }
    if (next !== confirmPw) {
      setError('As senhas não conferem.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: user?.hasPassword ? current : undefined, newPassword: next });
      await refreshUser().catch(() => undefined);
      notify('Senha alterada', 'Use a nova senha no próximo acesso.');
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={user?.hasPassword ? 'Alterar senha' : 'Criar senha'} back>
      {user?.hasPassword ? <Input label="Senha atual" icon="lock" value={current} onChangeText={setCurrent} secureTextEntry /> : null}
      <Input label="Nova senha" icon="lock" value={next} onChangeText={setNext} secureTextEntry hint="Mínimo de 8 caracteres, com letras e números." />
      <Input label="Confirmar nova senha" icon="lock" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
      {error ? (
        <T tone="danger" style={{ marginBottom: 12 }}>
          {error}
        </T>
      ) : null}
      <Button title="Salvar" onPress={submit} loading={loading} />
    </Screen>
  );
}
