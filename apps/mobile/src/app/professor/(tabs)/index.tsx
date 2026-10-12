import { formatDuration, type TrainerDashboard } from '@personalpro/shared';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar, Badge, Card, Divider, EmptyState, IconButton, ListItem, ProgressBar, QueryState, Row, Screen, Section, StatCard, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useRefresh } from '@/features/hooks';
import { fmtDate, fmtNumber, fmtTime, greeting, relativeDays } from '@/lib/format';
import { useTheme } from '@/theme';

export default function TrainerDashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const q = useApi<TrainerDashboard>(['dashboard', 'trainer'], '/dashboard/trainer');
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  useFocusEffect(
    useCallback(() => {
      void q.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const d = q.data;
  const openStudent = (id: string) => router.push(`/professor/aluno/${id}`);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <Row justify="space-between" style={{ paddingTop: 8 }}>
        <View style={{ flex: 1 }}>
          <T variant="small" tone="secondary">
            {greeting()},
          </T>
          <T variant="h1" numberOfLines={1}>
            {user?.name?.split(' ')[0]}
          </T>
        </View>
        <Row gap={10}>
          <IconButton icon="message" label="Conversas" badge={d?.unreadMessages} onPress={() => router.push('/professor/conversas')} />
          <IconButton icon="bell" label="Notificações" onPress={() => router.push('/notificacoes')} />
        </Row>
      </Row>

      <QueryState query={q}>
        {d ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              <StatCard label="Alunos ativos" value={d.activeStudents} hint={d.inactiveLinks ? `${d.inactiveLinks} inativos` : undefined} icon="users" onPress={() => router.push('/professor/alunos')} />
              <StatCard label="Novos alunos (30d)" value={d.newStudents.length} icon="user-plus" tone="success" />
              <StatCard label="Treinos hoje" value={d.workoutsToday.count} icon="dumbbell" />
              <StatCard label="Taxa de frequência" value={`${fmtNumber(d.attendanceRate, 0)}%`} icon="activity" tone={d.attendanceRate < 50 ? 'warning' : 'success'} />
              <StatCard
                label="Avaliações pendentes"
                value={d.pendingAssessments.overdueScheduled.length + d.pendingAssessments.studentsDue.length}
                icon="clipboard"
                tone="warning"
              />
              <StatCard label="Sugestões da IA" value={d.pendingAiSuggestions} icon="sparkles" onPress={() => router.push('/professor/ia')} />
              <StatCard label="Mensagens não lidas" value={d.unreadMessages} icon="message" tone={d.unreadMessages ? 'danger' : 'default'} onPress={() => router.push('/professor/conversas')} />
            </View>

            <Card style={{ marginTop: 16, borderColor: colors.accent, borderWidth: 1 }} onPress={() => router.push('/professor/ia')}>
              <Row gap={12}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="sparkles" color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">Assistente de IA</T>
                  <T variant="small" tone="secondary">
                    {d.pendingAiSuggestions
                      ? `${d.pendingAiSuggestions} sugestão(ões) aguardando sua aprovação`
                      : 'Analise a evolução dos alunos e receba sugestões'}
                  </T>
                </View>
                <Icon name="chevron-right" color={colors.textMuted} />
              </Row>
            </Card>

            <Section title="Agenda de hoje" action="Ver agenda" onAction={() => router.push('/professor/agenda')}>
              {d.agendaToday.length ? (
                <Card padding={10}>
                  {d.agendaToday.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 ? <Divider /> : null}
                      <Row gap={12} style={{ paddingVertical: 10 }}>
                        <T variant="h3" style={{ width: 54 }}>
                          {fmtTime(a.startsAt)}
                        </T>
                        <T style={{ flex: 1 }} tone={a.student ? 'default' : 'accent'}>
                          {a.student?.name ?? 'Horário disponível'}
                        </T>
                        <Badge label={a.status === 'CONFIRMED' ? 'Confirmado' : a.status === 'REQUESTED' ? 'Solicitado' : a.status === 'AVAILABLE' ? 'Livre' : a.status === 'COMPLETED' ? 'Concluído' : 'Cancelado'} tone={a.status === 'CONFIRMED' ? 'success' : a.status === 'REQUESTED' ? 'warning' : 'neutral'} />
                      </Row>
                    </View>
                  ))}
                </Card>
              ) : (
                <Card>
                  <T tone="secondary">Nenhum compromisso hoje.</T>
                </Card>
              )}
            </Section>

            {d.workoutsToday.items.length ? (
              <Section title="Treinos realizados hoje">
                <Card padding={10}>
                  {d.workoutsToday.items.map((w) => (
                    <ListItem
                      key={w.sessionId}
                      left={<Avatar name={w.student.name} url={w.student.avatarUrl} size={36} />}
                      title={w.student.name}
                      subtitle={`${w.workout ?? 'Treino'} · ${fmtTime(w.startedAt)}${w.durationSeconds ? ` · ${formatDuration(w.durationSeconds)}` : ''}`}
                      onPress={() => openStudent(w.student.id)}
                    />
                  ))}
                </Card>
              </Section>
            ) : null}

            <Section title="Sem treinar recentemente">
              {d.studentsWithoutTraining.length ? (
                <Card padding={10}>
                  {d.studentsWithoutTraining.map((s, i) => (
                    <View key={s.id}>
                      {i > 0 ? <Divider /> : null}
                      <ListItem
                        left={<Avatar name={s.name} url={s.avatarUrl} size={36} />}
                        title={s.name}
                        subtitle={s.daysWithoutTraining === null ? 'Ainda não treinou' : `${relativeDays(s.daysWithoutTraining)} sem treinar`}
                        right={<Badge label={s.daysWithoutTraining === null ? 'Novo' : `${s.daysWithoutTraining}d`} tone={(s.daysWithoutTraining ?? 99) >= 7 ? 'danger' : 'warning'} />}
                        onPress={() => openStudent(s.id)}
                      />
                    </View>
                  ))}
                </Card>
              ) : (
                <EmptyState icon="check-circle" title="Todos os alunos treinando" />
              )}
            </Section>

            <Section title="Próximas avaliações">
              <Card padding={10}>
                {d.pendingAssessments.overdueScheduled.map((a) => (
                  <ListItem
                    key={a.id}
                    icon="alert"
                    danger
                    title={a.student.name}
                    subtitle={`Avaliação atrasada · ${fmtDate(a.scheduledFor)}`}
                    onPress={() => openStudent(a.student.id)}
                  />
                ))}
                {d.upcomingAssessments.map((a) => (
                  <ListItem key={a.id} icon="calendar" title={a.student.name} subtitle={`Agendada para ${fmtDate(a.scheduledFor)}`} onPress={() => openStudent(a.student.id)} />
                ))}
                {d.pendingAssessments.studentsDue.map((s) => (
                  <ListItem key={s.id} icon="clipboard" title={s.name} subtitle="Avaliação pendente (sem avaliação recente)" onPress={() => openStudent(s.id)} />
                ))}
                {!d.upcomingAssessments.length && !d.pendingAssessments.overdueScheduled.length && !d.pendingAssessments.studentsDue.length ? (
                  <T tone="secondary" style={{ padding: 6 }}>
                    Nenhuma avaliação pendente.
                  </T>
                ) : null}
              </Card>
            </Section>

            <Section title="Evolução geral">
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <StatCard
                  label="Variação média de peso"
                  value={d.overallEvolution.averageWeightDeltaKg !== null ? `${d.overallEvolution.averageWeightDeltaKg > 0 ? '+' : ''}${fmtNumber(d.overallEvolution.averageWeightDeltaKg)} kg` : '—'}
                  hint={`${d.overallEvolution.studentsWithWeightData} alunos com dados`}
                  icon="trending-down"
                />
                <StatCard label="Treinos no mês" value={d.overallEvolution.workoutsThisMonth} icon="bar-chart" />
              </View>
            </Section>

            <Section title="Metas próximas de serem alcançadas">
              {d.goalsNearCompletion.length ? (
                <View style={{ gap: 10 }}>
                  {d.goalsNearCompletion.map((g) => (
                    <Card key={g.id} onPress={() => openStudent(g.student.id)}>
                      <Row justify="space-between" style={{ marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <T variant="bodyStrong">{g.title}</T>
                          <T variant="small" tone="secondary">
                            {g.student.name}
                          </T>
                        </View>
                        <T variant="h3" tone="success">
                          {fmtNumber(g.progressPct, 0)}%
                        </T>
                      </Row>
                      <ProgressBar value={g.progressPct} color={colors.success} />
                    </Card>
                  ))}
                </View>
              ) : (
                <Card>
                  <T tone="secondary">Nenhuma meta acima de 80% no momento.</T>
                </Card>
              )}
            </Section>

            {d.subscription ? (
              <Section title="Assinatura" action="Gerenciar" onAction={() => router.push('/professor/assinatura')}>
                <Card>
                  <Row justify="space-between" style={{ marginBottom: 8 }}>
                    <T variant="bodyStrong">{d.subscription.plan}</T>
                    <Badge label={d.subscription.status === 'ACTIVE' ? 'Ativa' : d.subscription.status === 'TRIALING' ? 'Teste' : d.subscription.status === 'PAST_DUE' ? 'Pagamento pendente' : 'Cancelada'} tone={d.subscription.status === 'ACTIVE' || d.subscription.status === 'TRIALING' ? 'success' : 'danger'} />
                  </Row>
                  <ProgressBar value={d.subscription.maxStudents ? (d.subscription.usedSeats / d.subscription.maxStudents) * 100 : 10} />
                  <T variant="small" tone="secondary" style={{ marginTop: 8 }}>
                    {d.subscription.usedSeats} de {d.subscription.maxStudents ?? '∞'} alunos · renova em {fmtDate(d.subscription.currentPeriodEnd)}
                  </T>
                </Card>
              </Section>
            ) : (
              <Section title="Assinatura">
                <Card onPress={() => router.push('/professor/assinatura')} style={{ borderColor: colors.warning, borderWidth: 1 }}>
                  <T variant="bodyStrong">Você ainda não tem um plano ativo</T>
                  <T tone="secondary">Escolha um plano para cadastrar alunos.</T>
                </Card>
              </Section>
            )}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
