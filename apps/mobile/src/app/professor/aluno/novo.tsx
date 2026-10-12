import type { InviteResponse, StudentProfile, TrainerProfile } from '@personalpro/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Badge, Button, Card, Divider, Input, ListItem, QueryState, Row, Screen, Section, Segmented, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { StudentProfileForm } from '@/features/student/StudentProfileForm';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { fmtDate } from '@/lib/format';
import { useTheme } from '@/theme';

interface InviteRow {
  id: string;
  code: string;
  channel: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  expiresAt: string;
  acceptedAt: string | null;
}

/** Normaliza para o formato internacional exigido pelo wa.me (Brasil = 55). */
function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') && digits.length >= 12 ? `+${digits}` : `+55${digits}`;
}

export default function AddStudentScreen() {
  const [tab, setTab] = useState<'convite' | 'manual'>('convite');
  const invalidate = useInvalidate();
  return (
    <Screen title="Adicionar aluno" back>
      <Segmented
        options={[
          { value: 'convite', label: 'Convidar' },
          { value: 'manual', label: 'Cadastro manual' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'convite' ? (
        <InviteTab />
      ) : (
        <>
          <T tone="secondary" style={{ marginBottom: 16 }}>
            O aluno receberá um e-mail para criar a senha de acesso. Se o e-mail já tiver conta de aluno, enviaremos um convite para ele aceitar.
          </T>
          <StudentProfileForm
            withEmail
            submitLabel="Cadastrar aluno"
            onSubmit={async (data) => {
              if (!data.name || data.name.length < 2) {
                notify('Informe o nome do aluno');
                return;
              }
              try {
                const res = await api.post<{ invited: boolean; student: StudentProfile | null }>('/students', data);
                await invalidate(['students'], ['dashboard']);
                if (res.invited || !res.student) {
                  notify('Convite enviado', 'Este e-mail já possui conta. O aluno receberá um convite para se vincular a você.');
                  router.back();
                } else {
                  notify('Aluno cadastrado', 'Enviamos um e-mail para ele criar a senha.');
                  router.replace(`/professor/aluno/${res.student.id}`);
                }
              } catch (e) {
                notifyError(e, 'Não foi possível cadastrar');
              }
            }}
          />
        </>
      )}
    </Screen>
  );
}

function InviteTab() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const me = useApi<TrainerProfile>(['trainer', 'me'], '/trainers/me');
  const invites = useApi<InviteRow[]>(['invites'], '/invites');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [qrInvite, setQrInvite] = useState<InviteResponse | null>(null);

  const code = me.data?.inviteCode;

  const create = async (channel: 'WHATSAPP' | 'EMAIL' | 'QR_CODE') => {
    if (channel === 'WHATSAPP' && phone.replace(/\D/g, '').length < 10) return notify('Informe o celular com DDD');
    if (channel === 'EMAIL' && !/^\S+@\S+\.\S+$/.test(email.trim())) return notify('Informe um e-mail válido');
    setBusy(channel);
    try {
      const res = await api.post<InviteResponse>('/invites', {
        channel,
        name: name.trim() || undefined,
        phone: channel === 'WHATSAPP' ? normalizePhone(phone) : undefined,
        email: channel === 'EMAIL' ? email.trim().toLowerCase() : undefined,
      });
      await invalidate(['invites']);
      if (channel === 'WHATSAPP') {
        if (res.whatsappUrl) await Linking.openURL(res.whatsappUrl);
        else await Share.share({ message: res.message });
      } else if (channel === 'EMAIL') {
        notify('Convite enviado', `Enviamos o convite para ${email.trim()}.`);
        setEmail('');
      } else setQrInvite(res);
    } catch (e) {
      notifyError(e, 'Não foi possível criar o convite');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (inv: InviteRow) => {
    if (!(await confirm('Cancelar convite', `Cancelar o convite ${inv.code}?`, { confirmText: 'Cancelar convite', destructive: true }))) return;
    try {
      await api.delete(`/invites/${inv.id}`);
      await invalidate(['invites']);
    } catch (e) {
      notifyError(e);
    }
  };

  const qrUrl = qrInvite?.qrCodeUrl ?? (code ? `${API_URL}/invites/${code}/qrcode.png` : null);

  return (
    <View>
      <Card style={{ alignItems: 'center', gap: 10 }}>
        <T variant="caption" tone="muted">
          {qrInvite ? 'QR Code de convite (uso único)' : 'Seu código de professor'}
        </T>
        <QueryState query={me}>
          <T variant="display" tone="accent" style={{ letterSpacing: 4 }}>
            {qrInvite?.invite.code ?? code ?? '—'}
          </T>
          {qrUrl ? (
            <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 16 }}>
              <Image source={{ uri: qrUrl }} style={{ width: 200, height: 200 }} contentFit="contain" />
            </View>
          ) : null}
          <T variant="small" tone="secondary" center>
            O aluno escaneia o QR Code no app (Início → Escanear QR) ou digita o código no cadastro.
          </T>
          <Row gap={10}>
            <Button
              title="Compartilhar"
              icon="share"
              size="sm"
              variant="secondary"
              full={false}
              onPress={() =>
                Share.share({
                  message: qrInvite?.message ?? `Use meu código ${code} no app PersonalPro para receber seus treinos: personalpro://convite/${code}`,
                })
              }
            />
            <Button title="Novo QR único" icon="qr" size="sm" full={false} onPress={() => create('QR_CODE')} loading={busy === 'QR_CODE'} />
          </Row>
        </QueryState>
      </Card>

      <Section title="Convidar por WhatsApp ou e-mail">
        <Card>
          <Input label="Nome do aluno (opcional)" value={name} onChangeText={setName} icon="user" />
          <Input label="Celular (WhatsApp)" value={phone} onChangeText={setPhone} icon="phone" keyboardType="phone-pad" placeholder="(11) 99999-0000" />
          <Button title="Enviar pelo WhatsApp" icon="message-square" onPress={() => create('WHATSAPP')} loading={busy === 'WHATSAPP'} />
          <Divider style={{ marginVertical: 16 }} />
          <Input label="E-mail" value={email} onChangeText={setEmail} icon="mail" keyboardType="email-address" autoCapitalize="none" />
          <Button title="Enviar por e-mail" icon="mail" variant="secondary" onPress={() => create('EMAIL')} loading={busy === 'EMAIL'} />
        </Card>
      </Section>

      <Section title="Convites enviados">
        <QueryState query={invites}>
          {invites.data?.length ? (
            <Card padding={10}>
              {invites.data.map((inv, i) => (
                <View key={inv.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    icon={inv.channel === 'WHATSAPP' ? 'message-square' : inv.channel === 'EMAIL' ? 'mail' : 'qr'}
                    title={`${inv.name ?? inv.email ?? inv.phone ?? 'Convite'} · ${inv.code}`}
                    subtitle={inv.acceptedAt ? `Aceito em ${fmtDate(inv.acceptedAt)}` : `Expira em ${fmtDate(inv.expiresAt)}`}
                    right={
                      inv.acceptedAt ? (
                        <Badge label="Aceito" tone="success" />
                      ) : (
                        <Icon name="trash" size={18} color={colors.textMuted} />
                      )
                    }
                    onPress={inv.acceptedAt ? undefined : () => revoke(inv)}
                    chevron={false}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <T tone="secondary">Nenhum convite enviado.</T>
          )}
        </QueryState>
      </Section>
    </View>
  );
}
