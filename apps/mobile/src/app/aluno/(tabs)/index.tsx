import type { StudentDashboard } from '@personalpro/shared';
import { formatDelta } from '@personalpro/shared';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { ProgressRing } from '@/components/ProgressRing';
import { Avatar, Badge, Button, Card, IconButton, ProgressBar, QueryState, Row, Screen, Section, T } from '@/components/ui';
import { activeSession, type ActiveSessionRef } from '@/features/activeSession';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useRefresh } from '@/features/hooks';
import { LinkTrainerCard } from '@/features/student/LinkTrainerCard';
import { QuestionCard } from '@/features/student/QuestionCard';
import { fmtDateTime, fmtKg, fmtNumber, greeting } from '@/lib/format';
import { useTheme } from '@/theme';

export default function StudentHome() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const q = useApi<StudentDashboard>(['dashboard', 'student'], '/dashboard/student');
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  const [active, setActive] = useState<ActiveSessionRef | null>(null);

  useFocusEffect(
    useCallback(() => {
      activeSession.get().then(setActive);
      void q.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const d = q.data;
  const startWorkout = () => d?.todayWorkout && router.push(`/aluno/executar/${d.todayWorkout.id}`);
  const chatHref = d?.trainer ? (`/chat/${d.trainer.conversationId}` as Href) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <Row justify="space-between" style={{ paddingTop: 8 }}>
        <Row gap={12} style={{ flex: 1 }}>
          <Avatar name={user?.name} url={user?.avatarUrl} size={46} />
          <View style={{ flex: 1 }}>
            <T variant="small" tone="secondary">
              {greeting()},
            </T>
            <T variant="h2" numberOfLines={1}>
              {d?.greetingName ?? user?.name?.split(' ')[0]} 👋
            </T>
          </View>
        </Row>
        <IconButton icon="bell" label="Notificações" badge={d?.unreadNotifications} onPress={() => router.push('/notificacoes')} />
      </Row>

      <QueryState query={q}>
        {d ? (
          <>
            {active ? (
              <Card style={{ marginTop: 16, borderColor: colors.warning, borderWidth: 1 }} onPress={() => router.push(`/aluno/executar/${active.workoutId}`)}>
                <Row gap={12}>
                  <Icon name="activity" color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">Treino em andamento</T>
                    <T variant="small" tone="secondary" numberOfLines={1}>
                      {active.workoutName} · toque para retomar
                    </T>
                  </View>
                  <Icon name="chevron-right" color={colors.textMuted} />
                </Row>
              </Card>
            ) : null}

            {!d.trainer ? (
              <View style={{ marginTop: 16 }}>
                <LinkTrainerCard />
              </View>
            ) : null}

            {/* Treino do dia */}
            <Card accent style={{ marginTop: 16 }} padding={20}>
              <Row justify="space-between" align="flex-start">
                <T variant="caption" tone="onAccent" style={{ opacity: 0.7 }}>
                  Treino do dia
                </T>
                {d.todayWorkout?.completedToday ? (
                  <View style={{ backgroundColor: colors.onAccent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <T variant="caption" style={{ color: colors.accent }}>
                      Concluído ✓
                    </T>
                  </View>
                ) : null}
              </Row>
              {d.todayWorkout ? (
                <>
                  <Row gap={12} style={{ marginTop: 10 }}>
                    {d.todayWorkout.label ? (
                      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.onAccent, alignItems: 'center', justifyContent: 'center' }}>
                        <T variant="h1" style={{ color: colors.accent }}>
                          {d.todayWorkout.label}
                        </T>
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <T variant="h2" tone="onAccent" numberOfLines={2}>
                        {d.todayWorkout.name}
                      </T>
                      <T tone="onAccent" style={{ opacity: 0.75 }}>
                        {d.todayWorkout.exercisesCount} exercícios
                        {d.todayWorkout.scheduledForToday ? ' · programado para hoje' : ' · próximo da sequência'}
                      </T>
                    </View>
                  </Row>
                  <Pressable
                    onPress={startWorkout}
                    style={({ pressed }) => ({
                      marginTop: 18,
                      height: 56,
                      borderRadius: 14,
                      backgroundColor: colors.onAccent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 10,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Icon name="play" color={colors.accent} filled />
                    <T variant="h3" style={{ color: colors.accent, letterSpacing: 1 }}>
                      {active?.workoutId === d.todayWorkout.id ? 'RETOMAR TREINO' : 'INICIAR TREINO'}
                    </T>
                  </Pressable>
                </>
              ) : (
                <T tone="onAccent" style={{ marginTop: 10 }}>
                  {d.trainer ? 'Seu professor ainda não atribuiu um treino.' : 'Vincule-se a um professor para receber seu treino.'}
                </T>
              )}
            </Card>

            {/* Atalhos */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <Shortcut icon="dumbbell" label="MEU TREINO" onPress={() => router.push('/aluno/treinos')} />
              <Shortcut icon="trending-up" label="MINHA EVOLUÇÃO" onPress={() => router.push('/aluno/evolucao')} />
              <Shortcut icon="calendar" label="AGENDA" onPress={() => router.push('/aluno/agenda')} />
              <Shortcut
                icon="message"
                label="FALAR COM PERSONAL"
                onPress={() => (chatHref ? router.push(chatHref) : router.push('/aluno/perfil'))}
                disabled={!chatHref}
              />
            </View>

            {/* Próxima sessão */}
            {d.nextAppointment ? (
              <Section title="Próxima sessão">
                <Card onPress={() => router.push('/aluno/agenda')}>
                  <Row gap={12}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="clock" color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="bodyStrong">{fmtDateTime(d.nextAppointment.startsAt)}</T>
                      <T variant="small" tone="secondary">
                        com {d.nextAppointment.trainerName}
                      </T>
                    </View>
                    <Badge label={d.nextAppointment.status === 'CONFIRMED' ? 'Confirmado' : 'Solicitado'} tone={d.nextAppointment.status === 'CONFIRMED' ? 'success' : 'warning'} />
                  </Row>
                </Card>
              </Section>
            ) : null}

            {/* Semana + peso */}
            <Section title="Seu progresso">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <Card style={{ flex: 1, minWidth: 150, alignItems: 'center', gap: 8 }}>
                  <T variant="caption" tone="muted">
                    Progresso semanal
                  </T>
                  <ProgressRing value={d.weekProgress.pct} size={104}>
                    <T variant="h2">
                      {d.weekProgress.done}/{d.weekProgress.planned}
                    </T>
                    <T variant="small" tone="muted">
                      treinos
                    </T>
                  </ProgressRing>
                  <T variant="small" tone="secondary">
                    {fmtNumber(d.weekProgress.pct, 0)}% da meta da semana
                  </T>
                </Card>
                <Card style={{ flex: 1, minWidth: 150, gap: 6 }}>
                  <Row justify="space-between">
                    <T variant="caption" tone="muted">
                      Peso atual
                    </T>
                    <Icon name="scale" size={18} color={colors.accent} />
                  </Row>
                  <T variant="display">{d.weight.currentKg !== null ? fmtNumber(d.weight.currentKg) : '—'}</T>
                  <T tone="muted">kg</T>
                  {d.weight.evolution ? (
                    <>
                      <T variant="small" tone="secondary">
                        Peso inicial {fmtKg(d.weight.evolution.initial)} · Atual {fmtKg(d.weight.evolution.current)}
                      </T>
                      <Badge
                        label={formatDelta(d.weight.evolution.delta)}
                        tone={d.weight.evolution.delta <= 0 ? 'success' : 'warning'}
                        icon={d.weight.evolution.delta <= 0 ? 'trending-down' : 'trending-up'}
                      />
                    </>
                  ) : (
                    <T variant="small" tone="muted">
                      Registre seu peso em Evolução
                    </T>
                  )}
                </Card>
              </View>
            </Section>

            {d.mainGoal ? (
              <Section title="Meta principal" action={d.goalsCount > 1 ? `Ver ${d.goalsCount} metas` : undefined} onAction={() => router.push('/aluno/evolucao')}>
                <Card>
                  <Row justify="space-between" style={{ marginBottom: 10 }}>
                    <Row gap={8} style={{ flex: 1 }}>
                      <Icon name="target" color={colors.accent} size={20} />
                      <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                        {d.mainGoal.title}
                      </T>
                    </Row>
                    <T variant="h3" tone="accent">
                      {fmtNumber(d.mainGoal.progressPct, 0)}%
                    </T>
                  </Row>
                  <ProgressBar value={d.mainGoal.progressPct} height={10} />
                  <Row justify="space-between" style={{ marginTop: 8 }}>
                    <T variant="small" tone="muted">
                      Início {fmtNumber(d.mainGoal.startValue)} {d.mainGoal.unit}
                    </T>
                    <T variant="small" tone="secondary">
                      Atual {fmtNumber(d.mainGoal.currentValue)} {d.mainGoal.unit}
                    </T>
                    <T variant="small" tone="muted">
                      Meta {fmtNumber(d.mainGoal.targetValue)} {d.mainGoal.unit}
                    </T>
                  </Row>
                </Card>
              </Section>
            ) : null}

            <Section title="Treinos realizados">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <MiniStat label="Total" value={d.totalWorkouts} />
                <MiniStat label="No mês" value={d.stats.monthCount} />
                <MiniStat label="Sequência" value={`${d.stats.currentStreakDays}d`} />
              </View>
              {d.lastWorkout ? (
                <T variant="small" tone="muted" style={{ marginTop: 8 }}>
                  Último treino: {d.lastWorkout.name ?? 'Treino'} · {fmtDateTime(d.lastWorkout.startedAt)}
                </T>
              ) : null}
            </Section>

            {d.trainer ? (
              <Section title="Seu personal">
                <Card>
                  <Row gap={12}>
                    <Avatar name={d.trainer.name} url={d.trainer.avatarUrl} />
                    <View style={{ flex: 1 }}>
                      <T variant="bodyStrong">{d.trainer.name}</T>
                      <T variant="small" tone="secondary">
                        Seu professor
                      </T>
                    </View>
                    <Button title="Chat" icon="message" size="sm" full={false} onPress={() => chatHref && router.push(chatHref)} />
                  </Row>
                </Card>
                <View style={{ height: 12 }} />
                <QuestionCard />
              </Section>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

function Shortcut({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 10,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={colors.accent} size={20} />
      </View>
      <T variant="small" style={{ fontWeight: '800', letterSpacing: 0.4 }}>
        {label}
      </T>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center' }} padding={12}>
      <T variant="h2">{value}</T>
      <T variant="caption" tone="muted">
        {label}
      </T>
    </Card>
  );
}
