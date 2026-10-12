import { SEX_LABELS, TRAINING_GOAL_LABELS, TRAINING_LEVEL_LABELS, type StudentDetail } from '@personalpro/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Badge, Button, Card, Divider, KeyValue, QueryState, Row, Screen, Section, T } from '@/components/ui';
import { AccountSection } from '@/features/account/AccountSection';
import { AvatarPicker } from '@/features/account/AvatarPicker';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useRefresh } from '@/features/hooks';
import { LinkTrainerCard } from '@/features/student/LinkTrainerCard';
import { fmtDate, fmtKg, fmtNumber } from '@/lib/format';

export default function StudentProfile() {
  const { user } = useAuth();
  const q = useApi<StudentDetail>(['me'], '/students/me');
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  const s = q.data;
  const activeTrainers = s?.trainers.filter((t) => t.status !== 'INACTIVE') ?? [];

  return (
    <Screen title="Perfil" refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
        <AvatarPicker />
        <T variant="h2">{user?.name}</T>
        <T tone="secondary">{user?.email}</T>
      </View>

      <QueryState query={q}>
        {s ? (
          <>
            <Section title="Meu professor">
              {activeTrainers.length ? (
                activeTrainers.map((t) => (
                  <Card key={t.linkId} style={{ marginBottom: 10 }}>
                    <Row gap={12}>
                      <Avatar name={t.name} url={t.avatarUrl} />
                      <View style={{ flex: 1 }}>
                        <T variant="bodyStrong">{t.name}</T>
                        <T variant="small" tone="secondary">
                          Desde {fmtDate(t.startedAt)}
                        </T>
                      </View>
                      {t.status === 'PENDING' ? <Badge label="Pendente" tone="warning" /> : null}
                      <Button title="Chat" icon="message" size="sm" full={false} onPress={() => router.push(`/chat/${t.linkId}`)} />
                    </Row>
                  </Card>
                ))
              ) : (
                <LinkTrainerCard />
              )}
            </Section>

            <Section title="Meus dados" action="Editar" onAction={() => router.push('/aluno/editar-perfil')}>
              <Card padding={12}>
                <KeyValue label="Nascimento" value={fmtDate(s.birthDate)} />
                <Divider />
                <KeyValue label="Sexo" value={s.sex ? SEX_LABELS[s.sex] : '—'} />
                <Divider />
                <KeyValue label="Altura" value={s.heightCm ? `${fmtNumber(s.heightCm, 0)} cm` : '—'} />
                <Divider />
                <KeyValue label="Peso inicial" value={fmtKg(s.initialWeightKg)} />
                <Divider />
                <KeyValue label="Peso atual" value={fmtKg(s.currentWeightKg)} />
                <Divider />
                <KeyValue label="Objetivo" value={s.goal ? TRAINING_GOAL_LABELS[s.goal] : '—'} />
                <Divider />
                <KeyValue label="Nível" value={TRAINING_LEVEL_LABELS[s.level]} />
                <Divider />
                <KeyValue label="Frequência" value={`${s.weeklyFrequency}x por semana`} />
                <Divider />
                <KeyValue label="Academia" value={s.gym ? `${s.gym.name}${s.gym.city ? ` · ${s.gym.city}` : ''}` : '—'} />
              </Card>
            </Section>
          </>
        ) : null}
      </QueryState>

      <AccountSection />
    </Screen>
  );
}
