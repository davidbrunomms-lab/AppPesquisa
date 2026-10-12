import type { TrainerProfile } from '@personalpro/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Badge, Card, Divider, ListItem, QueryState, Row, Screen, Section, StatCard, T } from '@/components/ui';
import { AccountSection } from '@/features/account/AccountSection';
import { AvatarPicker } from '@/features/account/AvatarPicker';
import { useApi, useRefresh } from '@/features/hooks';
import { api } from '@/lib/api';
import { fmtNumber, WEEKDAYS_SHORT } from '@/lib/format';
import { useTheme } from '@/theme';

export default function TrainerProfileScreen() {
  const { colors } = useTheme();
  const q = useApi<TrainerProfile>(['trainer', 'me'], '/trainers/me');
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  const t = q.data;
  return (
    <Screen title="Perfil" refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <QueryState query={q}>
        {t ? (
          <>
            <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
              <AvatarPicker onUploaded={async (url) => void (await api.patch('/trainers/me', { avatarUrl: url }))} />
              <T variant="h2">{t.user.name}</T>
              <T tone="secondary">{t.cref ? `CREF ${t.cref}` : 'CREF não informado'}</T>
              <Row gap={6} wrap justify="center">
                {t.specialties.map((s) => (
                  <Badge key={s} label={s} tone="accent" />
                ))}
              </Row>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
              <StatCard label="Alunos ativos" value={t.activeStudents ?? 0} icon="users" />
              <StatCard label="Inativos" value={t.inactiveStudents ?? 0} hint={t.pendingStudents ? `${t.pendingStudents} pendentes` : undefined} icon="user" />
              <StatCard label="Avaliação média" value={t.ratingCount ? `${fmtNumber(t.ratingAvg)} ★` : '—'} hint={`${t.ratingCount} avaliações`} icon="star" tone="warning" />
            </View>

            {t.inviteCode ? (
              <Card style={{ marginTop: 16, borderColor: colors.accent, borderWidth: 1 }} onPress={() => router.push('/professor/aluno/novo')}>
                <Row gap={12}>
                  <Icon name="qr" color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <T variant="small" tone="secondary">
                      Seu código de convite
                    </T>
                    <T variant="h2" tone="accent" style={{ letterSpacing: 3 }}>
                      {t.inviteCode}
                    </T>
                  </View>
                  <T variant="small" tone="accent" style={{ fontWeight: '700' }}>
                    Convidar
                  </T>
                </Row>
              </Card>
            ) : null}

            {t.bio ? (
              <Section title="Sobre">
                <Card>
                  <T tone="secondary">{t.bio}</T>
                  {t.experienceYears ? (
                    <T variant="small" tone="muted" style={{ marginTop: 8 }}>
                      {t.experienceYears} anos de experiência
                    </T>
                  ) : null}
                </Card>
              </Section>
            ) : null}

            <Section title="Atendimento">
              <Card padding={12}>
                {t.gyms.map((g) => (
                  <ListItem key={g.id} icon="map-pin" title={g.name} subtitle={[g.city, g.state].filter(Boolean).join(' · ')} chevron={false} />
                ))}
                {t.gyms.length ? <Divider /> : null}
                <ListItem
                  icon="clock"
                  title="Horários disponíveis"
                  subtitle={
                    t.availability.length
                      ? [...new Set(t.availability.map((a) => a.weekday))]
                          .sort()
                          .map((d) => `${WEEKDAYS_SHORT[d]} ${t.availability.filter((a) => a.weekday === d).map((a) => `${a.startTime}–${a.endTime}`).join(', ')}`)
                          .join(' · ')
                      : 'Não informado'
                  }
                  chevron={false}
                />
              </Card>
            </Section>

            <Section title="Gestão">
              <Card padding={8}>
                <ListItem icon="edit" title="Editar perfil profissional" onPress={() => router.push('/professor/editar-perfil')} />
                <Divider />
                <ListItem icon="card" title="Assinatura e planos" onPress={() => router.push('/professor/assinatura')} />
                <Divider />
                <ListItem icon="message" title="Conversas" onPress={() => router.push('/professor/conversas')} />
                <Divider />
                <ListItem icon="sparkles" title="Sugestões da IA" onPress={() => router.push('/professor/ia')} />
              </Card>
            </Section>
          </>
        ) : null}
      </QueryState>
      <AccountSection />
    </Screen>
  );
}
