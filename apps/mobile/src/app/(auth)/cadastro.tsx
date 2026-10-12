import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform } from 'react-native';
import { Avatar, Button, Card, Checkbox, Chips, Input, Row, Screen, Spacer, T } from '@/components/ui';
import { pendingInvite, useAuth } from '@/features/auth/AuthContext';
import { notify } from '@/lib/alert';
import { api, errorMessage } from '@/lib/api';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';

type Role = 'STUDENT' | 'TRAINER';
type Errors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirm' | 'cref' | 'terms', string>>;

interface InvitePreview {
  code: string;
  trainer: { id: string; name: string; avatarUrl: string | null; cref: string | null; specialties: string[] };
  invitedName: string | null;
}

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ invite?: string }>();
  const { register } = useAuth();
  const [role, setRole] = useState<Role>('STUDENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cref, setCref] = useState('');
  const [inviteCode, setInviteCode] = useState(params.invite?.toUpperCase() ?? '');
  const [accept, setAccept] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);

  useEffect(() => {
    if (!params.invite) pendingInvite.get().then((c) => c && setInviteCode(c));
  }, [params.invite]);

  // Mostra o professor dono do código (GET /invites/:code/preview).
  useEffect(() => {
    const code = inviteCode.trim();
    if (code.length < 4) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<InvitePreview>(`/invites/${encodeURIComponent(code)}/preview`, undefined, { auth: false })
        .then((p) => {
          setPreview(p);
          if (p.invitedName && !name) setName(p.invitedName);
        })
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = 'Informe seu nome completo.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'E-mail inválido.';
    if (phone.replace(/\D/g, '').length < 10) e.phone = 'Informe o celular com DDD.';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      e.password = 'A senha deve ter ao menos 8 caracteres, com letras e números.';
    if (confirm !== password) e.confirm = 'As senhas não conferem.';
    if (role === 'TRAINER' && cref.trim().length < 4) e.cref = 'Informe seu CREF.';
    if (!accept) e.terms = 'É necessário aceitar os termos e a política de privacidade.';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, '');
      const res = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        phone: digits.startsWith('55') ? `+${digits}` : `+55${digits}`,
        cref: role === 'TRAINER' ? cref.trim() : undefined,
        inviteCode: role === 'STUDENT' && inviteCode.trim() ? inviteCode.trim().toUpperCase() : undefined,
        acceptTerms: true,
        marketingOptIn: marketing,
      });
      await pendingInvite.clear();
      if (res.linkError) notify('Conta criada!', `Mas não foi possível vincular ao professor: ${res.linkError}`);
      router.replace('/');
    } catch (err) {
      notify('Não foi possível criar a conta', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Criar conta" subtitle="Primeiro acesso" back>
        <Chips
          label="Eu sou"
          options={[
            { value: 'STUDENT', label: 'Aluno' },
            { value: 'TRAINER', label: 'Professor' },
          ]}
          value={role}
          onChange={(v) => v && setRole(v)}
        />
        <Input label="Nome completo" icon="user" value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
        <Input
          label="E-mail"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Input
          label="Celular (WhatsApp)"
          icon="phone"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          keyboardType="phone-pad"
          placeholder="(11) 99999-0000"
          autoComplete="tel"
        />
        <Input
          label="Senha"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={errors.password}
          hint="Mínimo de 8 caracteres, com letras e números."
          autoComplete="new-password"
        />
        <Input label="Confirmar senha" icon="lock" value={confirm} onChangeText={setConfirm} secureTextEntry error={errors.confirm} />
        {role === 'TRAINER' ? (
          <Input label="CREF" icon="award" value={cref} onChangeText={setCref} error={errors.cref} placeholder="000000-G/SP" autoCapitalize="characters" />
        ) : (
          <>
            <Input
              label="Código do professor (opcional)"
              icon="qr"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder="Ex.: DEMO01"
              hint="Recebeu um convite? Informe o código para vincular sua conta."
            />
            {preview ? (
              <Card style={{ marginBottom: 14 }}>
                <Row gap={12}>
                  <Avatar name={preview.trainer.name} url={preview.trainer.avatarUrl} />
                  <T variant="small" tone="secondary" style={{ flex: 1 }}>
                    Você será vinculado a{'\n'}
                    <T variant="bodyStrong">{preview.trainer.name}</T>
                    {preview.trainer.cref ? ` · CREF ${preview.trainer.cref}` : ''}
                  </T>
                </Row>
              </Card>
            ) : null}
          </>
        )}
        <Checkbox checked={accept} onChange={setAccept}>
          <T variant="small" tone="secondary">
            Li e aceito os{' '}
            <T variant="small" tone="accent" onPress={() => Linking.openURL(TERMS_URL)}>
              Termos de Uso
            </T>{' '}
            e a{' '}
            <T variant="small" tone="accent" onPress={() => Linking.openURL(PRIVACY_URL)}>
              Política de Privacidade
            </T>{' '}
            (LGPD).
          </T>
          {errors.terms ? (
            <T variant="small" tone="danger">
              {errors.terms}
            </T>
          ) : null}
        </Checkbox>
        <Checkbox checked={marketing} onChange={setMarketing}>
          <T variant="small" tone="secondary">
            Quero receber novidades e dicas por e-mail (opcional).
          </T>
        </Checkbox>
        <Spacer size={8} />
        <Button title="CRIAR CONTA" size="lg" onPress={submit} loading={loading} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
