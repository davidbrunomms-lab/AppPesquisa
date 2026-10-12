import type { TrainerProfile } from '@personalpro/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, Chips, Input, Loading, Row, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useInvalidate } from '@/features/hooks';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { WEEKDAYS_SHORT } from '@/lib/format';
import { useTheme } from '@/theme';

interface GymRow {
  name: string;
  city: string;
  state: string;
}
interface SlotRow {
  weekday: number;
  startTime: string;
  endTime: string;
}

const SOCIAL = [
  { key: 'instagram', label: 'Instagram', placeholder: '@seuperfil' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@canal' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@seuperfil' },
  { key: 'site', label: 'Site', placeholder: 'https://' },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function EditTrainerProfile() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const { refreshUser } = useAuth();
  const q = useApi<TrainerProfile>(['trainer', 'me'], '/trainers/me');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cref, setCref] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = q.data;
    if (!t || hydrated) return;
    setName(t.user.name);
    setPhone(t.user.phone ?? '');
    setCref(t.cref ?? '');
    setSpecialties(t.specialties.join(', '));
    setBio(t.bio ?? '');
    setExperience(t.experienceYears ? String(t.experienceYears) : '');
    setGyms(t.gyms.map((g) => ({ name: g.name, city: g.city ?? '', state: g.state ?? '' })));
    setSlots(t.availability.map((a) => ({ weekday: a.weekday, startTime: a.startTime, endTime: a.endTime })));
    setSocial(t.socialLinks ?? {});
    setHydrated(true);
  }, [q.data, hydrated]);

  const save = async () => {
    for (const s of slots) {
      if (!TIME.test(s.startTime) || !TIME.test(s.endTime) || s.endTime <= s.startTime)
        return notify('Horário inválido', `Verifique ${WEEKDAYS_SHORT[s.weekday]} ${s.startTime}–${s.endTime} (formato HH:mm).`);
    }
    setSaving(true);
    try {
      await api.patch('/trainers/me', {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        cref: cref.trim() || undefined,
        specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean),
        bio: bio.trim() || undefined,
        experienceYears: experience ? Number(experience) : undefined,
        socialLinks: Object.fromEntries(Object.entries(social).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
        gyms: gyms.filter((g) => g.name.trim()).map((g) => ({ name: g.name.trim(), city: g.city.trim() || undefined, state: g.state.trim() || undefined })),
        availability: slots,
      });
      await invalidate(['trainer'], ['dashboard']);
      await refreshUser().catch(() => undefined);
      notify('Perfil atualizado');
      router.back();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated)
    return (
      <Screen title="Editar perfil" back>
        <Loading />
      </Screen>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Editar perfil" back footer={<Button title="Salvar" icon="check" size="lg" onPress={save} loading={saving} />}>
        <Input label="Nome" value={name} onChangeText={setName} icon="user" />
        <Input label="Telefone" value={phone} onChangeText={setPhone} icon="phone" keyboardType="phone-pad" />
        <Input label="CREF" value={cref} onChangeText={setCref} icon="award" autoCapitalize="characters" />
        <Input label="Especialidades (separadas por vírgula)" value={specialties} onChangeText={setSpecialties} placeholder="Hipertrofia, Emagrecimento" />
        <Input label="Anos de experiência" value={experience} onChangeText={(t) => setExperience(t.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Input label="Bio" value={bio} onChangeText={setBio} multiline placeholder="Conte sobre sua formação e metodologia" />

        <Section title="Academias" action="+ Adicionar" onAction={() => setGyms((g) => [...g, { name: '', city: '', state: '' }])}>
          {gyms.map((g, i) => (
            <Card key={i} style={{ marginBottom: 10 }}>
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <T variant="caption" tone="muted">
                  Academia {i + 1}
                </T>
                <Pressable onPress={() => setGyms((list) => list.filter((_, idx) => idx !== i))} hitSlop={8} accessibilityLabel="Remover academia">
                  <Icon name="trash" size={18} color={colors.textMuted} />
                </Pressable>
              </Row>
              <Input label="Nome" value={g.name} onChangeText={(t) => setGyms((list) => list.map((x, idx) => (idx === i ? { ...x, name: t } : x)))} />
              <Row gap={10} align="flex-start">
                <View style={{ flex: 2 }}>
                  <Input label="Cidade" value={g.city} onChangeText={(t) => setGyms((list) => list.map((x, idx) => (idx === i ? { ...x, city: t } : x)))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="UF" value={g.state} maxLength={2} autoCapitalize="characters" onChangeText={(t) => setGyms((list) => list.map((x, idx) => (idx === i ? { ...x, state: t } : x)))} />
                </View>
              </Row>
            </Card>
          ))}
          {!gyms.length ? <T tone="muted">Nenhuma academia cadastrada.</T> : null}
        </Section>

        <Section title="Horários disponíveis" action="+ Adicionar" onAction={() => setSlots((s) => [...s, { weekday: 1, startTime: '06:00', endTime: '12:00' }])}>
          {slots.map((s, i) => (
            <Card key={i} style={{ marginBottom: 10 }}>
              <Chips
                scroll
                options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }))}
                value={s.weekday}
                onChange={(v) => v !== null && setSlots((list) => list.map((x, idx) => (idx === i ? { ...x, weekday: v } : x)))}
              />
              <Row gap={10} align="flex-start">
                <View style={{ flex: 1 }}>
                  <Input label="Início" value={s.startTime} placeholder="HH:mm" onChangeText={(t) => setSlots((list) => list.map((x, idx) => (idx === i ? { ...x, startTime: t } : x)))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Fim" value={s.endTime} placeholder="HH:mm" onChangeText={(t) => setSlots((list) => list.map((x, idx) => (idx === i ? { ...x, endTime: t } : x)))} />
                </View>
                <Pressable onPress={() => setSlots((list) => list.filter((_, idx) => idx !== i))} hitSlop={8} style={{ paddingTop: 38 }} accessibilityLabel="Remover horário">
                  <Icon name="trash" size={18} color={colors.textMuted} />
                </Pressable>
              </Row>
            </Card>
          ))}
          {!slots.length ? <T tone="muted">Nenhum horário cadastrado.</T> : null}
        </Section>

        <Section title="Redes sociais">
          {SOCIAL.map((s) => (
            <Input key={s.key} label={s.label} value={social[s.key] ?? ''} placeholder={s.placeholder} autoCapitalize="none" onChangeText={(t) => setSocial((m) => ({ ...m, [s.key]: t }))} />
          ))}
        </Section>
      </Screen>
    </KeyboardAvoidingView>
  );
}
