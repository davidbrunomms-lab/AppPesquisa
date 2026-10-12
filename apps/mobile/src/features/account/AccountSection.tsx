import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Divider, Input, ListItem, Section, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';

/** Exporta os dados do usuário (LGPD) e abre o compartilhamento do sistema. */
async function exportData() {
  const data = await api.get<unknown>('/account/export');
  const json = JSON.stringify(data, null, 2);
  const fileName = `personalpro-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: fileName, message: json });
}

/** Seções comuns de conta/privacidade (aluno e professor). */
export function AccountSection() {
  const { user, logout, clearLocalSession } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      await exportData();
    } catch (e) {
      notifyError(e, 'Não foi possível exportar');
    } finally {
      setExporting(false);
    }
  };

  const doDelete = async () => {
    if (user?.hasPassword && !password) {
      notify('Confirme sua senha');
      return;
    }
    if (!(await confirm('Excluir conta definitivamente?', 'Todos os seus dados serão apagados. Esta ação não pode ser desfeita.', { confirmText: 'Excluir', destructive: true })))
      return;
    setBusy(true);
    try {
      await api.delete('/account', user?.hasPassword ? { password } : {});
      setDeleteOpen(false);
      await clearLocalSession();
      notify('Conta excluída', 'Seus dados foram removidos.');
      router.replace('/login');
    } catch (e) {
      notifyError(e, 'Não foi possível excluir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Conta">
        <Card padding={8}>
          <ListItem icon="lock" title={user?.hasPassword ? 'Alterar senha' : 'Criar senha'} onPress={() => router.push('/alterar-senha')} />
          <Divider />
          <ListItem icon="bell" title="Notificações" onPress={() => router.push('/notificacoes')} />
        </Card>
      </Section>
      <Section title="Privacidade (LGPD)">
        <Card padding={8}>
          <ListItem icon="download" title="Exportar meus dados" subtitle="Arquivo JSON com todas as suas informações" onPress={doExport} right={exporting ? <T tone="muted">…</T> : undefined} />
          <Divider />
          <ListItem icon="shield" title="Política de privacidade" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Divider />
          <ListItem icon="file" title="Termos de uso" onPress={() => Linking.openURL(TERMS_URL)} />
          <Divider />
          <ListItem icon="trash" title="Excluir minha conta" danger onPress={() => setDeleteOpen(true)} />
        </Card>
      </Section>
      <View style={{ marginTop: 24 }}>
        <Button
          title="Sair"
          icon="logout"
          variant="secondary"
          onPress={async () => {
            if (await confirm('Sair', 'Deseja sair da sua conta?', { confirmText: 'Sair' })) await logout();
          }}
        />
      </View>
      <T variant="small" tone="muted" center style={{ marginTop: 16 }}>
        PersonalPro · {user?.email}
      </T>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir conta">
        <T tone="secondary" style={{ marginBottom: 16 }}>
          Ao excluir sua conta, seus treinos, avaliações, fotos e mensagens serão apagados permanentemente, conforme a LGPD.
        </T>
        {user?.hasPassword ? <Input label="Confirme sua senha" value={password} onChangeText={setPassword} secureTextEntry /> : null}
        <Button title="Excluir minha conta" variant="danger" icon="trash" onPress={doDelete} loading={busy} />
      </Sheet>
    </>
  );
}
