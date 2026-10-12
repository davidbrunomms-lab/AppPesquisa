import {
  SEX_LABELS,
  TRAINING_GOAL_LABELS,
  TRAINING_LEVEL_LABELS,
  type StudentDetail,
} from '@personalpro/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Avatar, Badge, Button, Card, Divider, IconButton, Input, KeyValue, QueryState, Row, Screen, Section, Segmented, StatCard, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useInvalidate, useRefresh } from '@/features/hooks';
import { AssessmentsSection, BodyCharts, ExerciseLoadSection, FrequencyChart } from '@/features/progress/EvolutionSections';
import { StudentProfileForm } from '@/features/student/StudentProfileForm';
import { GoalsTab } from '@/features/trainer/GoalsTab';
import { NotesTab } from '@/features/trainer/NotesTab';
import { ReportsTab } from '@/features/trainer/ReportsTab';
import { StudentWorkoutsTab } from '@/features/trainer/StudentWorkoutsTab';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { combineLocal, fmtDate, fmtKg, fmtNumber, parseBrDate } from '@/lib/format';
import { formatDuration } from '@personalpro/shared';

type Tab = 'perfil' | 'treinos' | 'evolucao' | 'avaliacoes' | 'metas' | 'notas' | 'relatorios';

export default function TrainerStudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [tab, setTab] = useState<Tab>('perfil');
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const q = useApi<StudentDetail>(['student', id], id ? `/students/${id}` : null);
  const { refreshing, onRefresh } = useRefresh(() => invalidate(['student', id], ['workouts'], ['progress'], ['goals'], ['assessments'], ['notes'], ['reports'], ['sessions']));
  const s = q.data;
  const link = s?.trainers.find((t) => t.trainerId === user?.trainerId);

  const toggleStatus = async () => {
    if (!s || !link) return;
    const next = link.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    if (!(await confirm(next === 'ACTIVE' ? 'Reativar aluno' : 'Inativar aluno', next === 'ACTIVE' ? 'O aluno volta a contar no seu plano.' : 'O aluno deixa de aparecer como ativo e libera uma vaga do plano.', { confirmText: next === 'ACTIVE' ? 'Reativar' : 'Inativar', destructive: next === 'INACTIVE' })))
      return;
    try {
      await api.patch(`/students/${s.id}/link`, { status: next });
      await invalidate(['student', id], ['students'], ['dashboard']);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Screen
      title={s?.name ?? 'Aluno'}
      back
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={link ? <IconButton icon="message" label="Conversar" onPress={() => router.push(`/chat/${link.linkId}`)} /> : null}
    >
      <QueryState query={q}>
        {s ? (
          <>
            <Row gap={14} style={{ marginBottom: 16 }}>
              <Avatar name={s.name} url={s.avatarUrl} size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <T tone="secondary" numberOfLines={1}>
                  {s.email}
                </T>
                <Row gap={6} wrap>
                  {link ? (
                    <Badge label={link.status === 'ACTIVE' ? 'Ativo' : link.status === 'PENDING' ? 'Pendente' : 'Inativo'} tone={link.status === 'ACTIVE' ? 'success' : link.status === 'PENDING' ? 'warning' : 'neutral'} />
                  ) : null}
                  {s.goal ? <Badge label={TRAINING_GOAL_LABELS[s.goal]} tone="accent" /> : null}
                  <Badge label={TRAINING_LEVEL_LABELS[s.level]} />
                </Row>
              </View>
            </Row>
            <Segmented
              options={[
                { value: 'perfil', label: 'Perfil' },
                { value: 'treinos', label: 'Treinos' },
                { value: 'evolucao', label: 'Evolução' },
                { value: 'avaliacoes', label: 'Avaliações' },
                { value: 'metas', label: 'Metas' },
                { value: 'notas', label: 'Anotações' },
                { value: 'relatorios', label: 'Relatórios' },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'perfil' ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <StatCard label="Treinos" value={s.totalWorkouts} hint={s.lastWorkoutAt ? `último ${fmtDate(s.lastWorkoutAt)}` : 'nenhum ainda'} icon="dumbbell" />
                  <StatCard label="Frequência" value={`${fmtNumber(s.stats.weeklyAverage)}x`} hint={`meta ${s.weeklyFrequency}x/semana`} icon="activity" />
                  <StatCard label="Duração média" value={s.stats.averageDurationSeconds ? formatDuration(s.stats.averageDurationSeconds) : '—'} icon="clock" />
                  <StatCard label="Metas ativas" value={s.activeGoals} hint={s.lastAssessmentAt ? `avaliado ${fmtDate(s.lastAssessmentAt)}` : 'sem avaliação'} icon="target" />
                </View>
                <Section title="Dados do aluno" action="Editar" onAction={() => setEditOpen(true)}>
                  <Card padding={12}>
                    <KeyValue label="Telefone" value={s.phone ?? '—'} />
                    <Divider />
                    <KeyValue label="Nascimento" value={fmtDate(s.birthDate)} />
                    <Divider />
                    <KeyValue label="Sexo" value={s.sex ? SEX_LABELS[s.sex] : '—'} />
                    <Divider />
                    <KeyValue label="Altura" value={s.heightCm ? `${fmtNumber(s.heightCm, 0)} cm` : '—'} />
                    <Divider />
                    <KeyValue label="Peso inicial → atual" value={`${fmtKg(s.initialWeightKg)} → ${fmtKg(s.currentWeightKg)}`} />
                    <Divider />
                    <KeyValue label="Frequência planejada" value={`${s.weeklyFrequency}x por semana`} />
                    <Divider />
                    <KeyValue label="Academia" value={s.gym?.name ?? '—'} />
                    <Divider />
                    <KeyValue label="Aluno desde" value={fmtDate(link?.startedAt)} />
                  </Card>
                </Section>
                <View style={{ marginTop: 20, gap: 10 }}>
                  {link ? <Button title="Abrir chat" icon="message" onPress={() => router.push(`/chat/${link.linkId}`)} /> : null}
                  <Button
                    title={link?.status === 'INACTIVE' ? 'Reativar aluno' : 'Inativar aluno'}
                    icon={link?.status === 'INACTIVE' ? 'check' : 'x'}
                    variant={link?.status === 'INACTIVE' ? 'secondary' : 'danger'}
                    onPress={toggleStatus}
                  />
                </View>
              </>
            ) : null}

            {tab === 'treinos' ? <StudentWorkoutsTab studentId={s.id} /> : null}

            {tab === 'evolucao' ? (
              <>
                <Section title="Composição corporal" style={{ marginTop: 0 }}>
                  <BodyCharts studentId={s.id} />
                </Section>
                <Section title="Frequência">
                  <FrequencyChart studentId={s.id} />
                </Section>
                <Section title="Carga por exercício">
                  <ExerciseLoadSection studentId={s.id} />
                </Section>
              </>
            ) : null}

            {tab === 'avaliacoes' ? (
              <>
                <Button title="Agendar avaliação" icon="calendar" variant="secondary" size="sm" onPress={() => setScheduleOpen(true)} />
                <View style={{ height: 10 }} />
                <AssessmentsSection
                  studentId={s.id}
                  mode="trainer"
                  onOpen={(a) => router.push({ pathname: '/professor/avaliacao', params: { studentId: s.id, ...(a ? { id: a.id } : {}) } })}
                />
              </>
            ) : null}

            {tab === 'metas' ? <GoalsTab studentId={s.id} /> : null}
            {tab === 'notas' ? <NotesTab studentId={s.id} /> : null}
            {tab === 'relatorios' ? <ReportsTab studentId={s.id} /> : null}

            <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Editar aluno">
              <StudentProfileForm
                initial={s}
                onSubmit={async (data) => {
                  try {
                    await api.patch(`/students/${s.id}`, data);
                    await invalidate(['student', id], ['students']);
                    setEditOpen(false);
                  } catch (e) {
                    notifyError(e);
                  }
                }}
              />
            </Sheet>
            <ScheduleAssessmentSheet visible={scheduleOpen} onClose={() => setScheduleOpen(false)} studentId={s.id} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

function ScheduleAssessmentSheet({ visible, onClose, studentId }: { visible: boolean; onClose: () => void; studentId: string }) {
  const invalidate = useInvalidate();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('08:00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    const dk = parseBrDate(date);
    const when = dk ? combineLocal(dk, time) : null;
    if (!when) return notify('Data inválida', 'Use dd/mm/aaaa e HH:mm.');
    setLoading(true);
    try {
      await api.post('/assessments/schedule', { studentId, scheduledFor: when.toISOString(), notes: notes.trim() || undefined });
      await invalidate(['assessments'], ['dashboard']);
      notify('Avaliação agendada');
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Agendar avaliação">
      <Row gap={10} align="flex-start">
        <View style={{ flex: 2 }}>
          <Input label="Data" value={date} onChangeText={setDate} placeholder="dd/mm/aaaa" icon="calendar" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Hora" value={time} onChangeText={setTime} placeholder="HH:mm" />
        </View>
      </Row>
      <Input label="Observações" value={notes} onChangeText={setNotes} multiline />
      <Button title="Agendar" icon="check" onPress={submit} loading={loading} />
    </Sheet>
  );
}
