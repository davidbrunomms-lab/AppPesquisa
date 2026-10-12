import {
  formatDuration,
  MUSCLE_GROUP_LABELS,
  parseTargetReps,
  TECHNIQUE_LABELS,
  type ExecutionView,
  type FinishSessionResponse,
  type LogSetResponse,
} from '@personalpro/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { ExerciseMedia } from '@/components/Media';
import { haptic, RestTimer } from '@/components/RestTimer';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, Chips, Divider, ErrorState, Input, Loading, ProgressBar, Row, Screen, T } from '@/components/ui';
import { activeSession } from '@/features/activeSession';
import { useInvalidate } from '@/features/hooks';
import { groupLabel } from '@/features/workouts/WorkoutExercises';
import { confirm, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { fmtDayMonth, fmtNumber, numToText, parseNum } from '@/lib/format';
import { queryClient } from '@/lib/query';
import { useTheme } from '@/theme';

type ExerciseView = ExecutionView['exercises'][number];

const RPE_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

function useElapsed(startedAt?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export default function ExecuteWorkout() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [view, setView] = useState<ExecutionView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [index, setIndex] = useState(0);
  const [rest, setRest] = useState<{ seconds: number; key: number } | null>(null);
  const [record, setRecord] = useState<{ name: string; loadKg: number; reps: number } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  // Formulário da série atual
  const [load, setLoad] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    try {
      // Cria ou retoma (a API devolve a sessão em andamento do mesmo treino).
      const v = await api.post<ExecutionView>('/sessions', { workoutId });
      setView(v);
      await activeSession.set({ sessionId: v.id, workoutId: workoutId!, workoutName: v.workout?.name ?? 'Treino', startedAt: v.startedAt });
      // Retomada: posiciona no primeiro exercício incompleto.
      const firstPending = v.exercises.findIndex((e) => e.today.length < e.sets);
      setIndex(firstPending >= 0 ? firstPending : 0);
    } catch (e) {
      setError(e);
    }
  }, [workoutId]);

  useEffect(() => {
    void start();
  }, [start]);

  const exercises = useMemo(() => [...(view?.exercises ?? [])].sort((a, b) => a.order - b.order), [view]);
  const current: ExerciseView | undefined = exercises[index];
  const nextSetNumber = useMemo(() => {
    if (!current) return 1;
    const used = new Set(current.today.map((s) => s.setNumber));
    let n = 1;
    while (used.has(n)) n += 1;
    return n;
  }, [current]);
  const exerciseDone = current ? current.today.length >= current.sets : false;
  const totalSets = exercises.reduce((a, e) => a + e.sets, 0);
  const doneSets = exercises.reduce((a, e) => a + Math.min(e.today.length, e.sets), 0);
  const elapsed = useElapsed(view?.startedAt);

  // Pré-preenche carga/repetições: série de hoje > mesma série da última vez > carga recomendada.
  useEffect(() => {
    if (!current) return;
    const lastToday = current.today[current.today.length - 1];
    const prevSame = current.previous?.sets.find((s) => s.setNumber === nextSetNumber) ?? current.previous?.sets[current.previous.sets.length - 1];
    const suggested = lastToday?.loadKg ?? prevSame?.loadKg ?? current.suggestedLoadKg ?? null;
    setLoad(suggested !== null && suggested !== undefined ? numToText(suggested) : '');
    const target = lastToday?.reps ?? parseTargetReps(current.reps);
    setReps(target ? String(target) : '');
    setRpe(null);
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.workoutExerciseId, current?.today.length]);

  const groupMembers = useMemo(() => {
    if (!current?.groupKey) return [] as number[];
    return exercises.map((e, i) => (e.groupKey === current.groupKey ? i : -1)).filter((i) => i >= 0);
  }, [exercises, current]);

  const logSet = async () => {
    if (!view || !current) return;
    const loadKg = parseNum(load) ?? 0;
    const repsN = Math.round(parseNum(reps) ?? 0);
    if (repsN <= 0) {
      notifyError(new Error('Informe as repetições realizadas.'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<LogSetResponse>(`/sessions/${view.id}/sets`, {
        exerciseId: current.exerciseId,
        workoutExerciseId: current.workoutExerciseId,
        setNumber: nextSetNumber,
        loadKg,
        reps: repsN,
        rpe: rpe ?? undefined,
        notes: notes.trim() || undefined,
      });
      const updated: ExecutionView = {
        ...view,
        exercises: view.exercises.map((e) =>
          e.workoutExerciseId === current.workoutExerciseId
            ? { ...e, today: [...e.today.filter((s) => s.setNumber !== res.set.setNumber), res.set].sort((a, b) => a.setNumber - b.setNumber) }
            : e,
        ),
      };
      setView(updated);
      if (res.isPersonalRecord) {
        haptic('success');
        setRecord({ name: current.name, loadKg: res.set.loadKg, reps: res.set.reps });
      } else haptic('light');

      // Bi-set/tri-set: alterna para o próximo exercício do grupo sem descanso.
      const pos = groupMembers.indexOf(index);
      if (groupMembers.length > 1 && pos >= 0 && pos < groupMembers.length - 1) {
        setIndex(groupMembers[pos + 1]);
        return;
      }
      const allDone = updated.exercises.every((e) => e.today.length >= e.sets);
      if (!allDone) setRest({ seconds: res.restSeconds || current.restSeconds || 60, key: Date.now() });
    } catch (e) {
      notifyError(e, 'Não foi possível salvar a série');
    } finally {
      setSaving(false);
    }
  };

  const afterRest = useCallback(() => {
    setRest(null);
    if (!view) return;
    const ex = [...view.exercises].sort((a, b) => a.order - b.order);
    const cur = ex[index];
    if (!cur) return;
    // Volta ao início do grupo se ainda há séries; senão avança para o próximo exercício pendente.
    if (cur.groupKey) {
      const members = ex.map((e, i) => (e.groupKey === cur.groupKey ? i : -1)).filter((i) => i >= 0);
      const pending = members.find((i) => ex[i].today.length < ex[i].sets);
      if (pending !== undefined) {
        setIndex(pending);
        return;
      }
    }
    if (cur.today.length >= cur.sets) {
      const next = ex.findIndex((e, i) => i > index && e.today.length < e.sets);
      const anyPending = next >= 0 ? next : ex.findIndex((e) => e.today.length < e.sets);
      if (anyPending >= 0) setIndex(anyPending);
    }
  }, [view, index]);

  const deleteSet = async (setId: string) => {
    if (!view) return;
    if (!(await confirm('Remover série', 'Deseja remover esta série registrada?', { confirmText: 'Remover', destructive: true }))) return;
    try {
      await api.delete(`/sessions/${view.id}/sets/${setId}`);
      setView({ ...view, exercises: view.exercises.map((e) => ({ ...e, today: e.today.filter((s) => s.id !== setId) })) });
    } catch (e) {
      notifyError(e);
    }
  };

  const abandon = async () => {
    if (!view) return;
    if (!(await confirm('Abandonar treino', 'O treino será encerrado sem contar na sua frequência.', { confirmText: 'Abandonar', destructive: true }))) return;
    try {
      await api.post(`/sessions/${view.id}/abandon`);
      await activeSession.clear();
      await invalidate(['dashboard']);
      router.back();
    } catch (e) {
      notifyError(e);
    }
  };

  const leave = async () => {
    if (await confirm('Sair do treino', 'Seu treino continua em andamento. Você pode retomá-lo pela tela inicial.', { confirmText: 'Sair' }))
      router.back();
  };

  if (error) {
    return (
      <Screen title="Treino" back>
        <ErrorState error={error} onRetry={start} />
      </Screen>
    );
  }
  if (!view || !current) {
    return (
      <Screen title="Treino" back>
        <Loading label="Preparando seu treino…" />
      </Screen>
    );
  }

  const groupPos = groupMembers.indexOf(index);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        title={view.workout?.name ?? 'Treino'}
        subtitle={`⏱ ${formatDuration(elapsed)} · ${doneSets}/${totalSets} séries`}
        back
        onBack={leave}
        right={
          <Pressable onPress={abandon} hitSlop={10} accessibilityLabel="Abandonar treino">
            <Icon name="more" color={colors.textSecondary} />
          </Pressable>
        }
        footer={
          <Button
            title="FINALIZAR TREINO"
            icon="check-circle"
            variant={doneSets >= totalSets ? 'primary' : 'secondary'}
            size="lg"
            onPress={() => setFinishOpen(true)}
          />
        }
      >
        <ProgressBar value={totalSets ? (doneSets / totalSets) * 100 : 0} height={6} />

        {/* Navegação entre exercícios */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          {exercises.map((e, i) => {
            const done = e.today.length >= e.sets;
            const active = i === index;
            return (
              <Pressable
                key={e.workoutExerciseId}
                onPress={() => setIndex(i)}
                style={{
                  paddingHorizontal: 12,
                  height: 34,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: active ? colors.accent : done ? colors.successSoft : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                }}
              >
                {done && !active ? <Icon name="check" size={14} color={colors.success} /> : null}
                <T variant="small" style={{ fontWeight: '700', color: active ? colors.onAccent : done ? colors.success : colors.textSecondary }}>
                  {i + 1}. {e.name.length > 16 ? `${e.name.slice(0, 15)}…` : e.name}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>


        <ExerciseMedia imageUrl={current.imageUrl} videoUrl={current.videoUrl} height={210} />

        <Row justify="space-between" align="flex-start" style={{ marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <T variant="caption" tone="muted">
              Exercício {index + 1} de {exercises.length} · {MUSCLE_GROUP_LABELS[current.muscleGroup]}
            </T>
            <T variant="h1" style={{ marginTop: 2 }}>
              {current.name}
            </T>
          </View>
          <Pressable onPress={() => router.push(`/exercicio/${current.exerciseId}`)} hitSlop={8} accessibilityLabel="Ver instruções">
            <Icon name="info" color={colors.textSecondary} />
          </Pressable>
        </Row>
        <Row gap={6} wrap style={{ marginTop: 8 }}>
          {current.technique !== 'NORMAL' ? <Badge label={TECHNIQUE_LABELS[current.technique]} tone="warning" /> : null}
          {groupMembers.length > 1 ? (
            <Badge label={`${groupLabel(groupMembers.length)} ${current.groupKey} · ${groupPos + 1}/${groupMembers.length}`} tone="accent" icon="repeat" />
          ) : null}
        </Row>
        {current.notes ? (
          <T tone="secondary" style={{ marginTop: 8 }}>
            Obs. do professor: {current.notes}
          </T>
        ) : null}

        {/* Prescrição */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Metric label="Séries × reps" value={`${current.sets} × ${current.reps}`} />
          <Metric label="Carga recomendada" value={current.suggestedLoadKg ? `${fmtNumber(current.suggestedLoadKg)} kg` : '—'} />
          <Metric label="Descanso" value={`${current.restSeconds}s`} />
        </View>

        <Card style={{ marginTop: 12 }}>
          <Row justify="space-between">
            <T variant="caption" tone="muted">
              Carga utilizada anteriormente
            </T>
            {current.previous ? (
              <T variant="small" tone="muted">
                {fmtDayMonth(current.previous.date)}
              </T>
            ) : null}
          </Row>
          {current.previous?.sets.length ? (
            <Row gap={8} wrap style={{ marginTop: 8 }}>
              {current.previous.sets.map((s) => (
                <Badge key={s.setNumber} label={`S${s.setNumber}: ${fmtNumber(s.loadKg)} kg × ${s.reps}`} />
              ))}
            </Row>
          ) : (
            <T tone="secondary" style={{ marginTop: 6 }}>
              Primeira vez neste exercício
            </T>
          )}
          {current.personalBest ? (
            <Row gap={6} style={{ marginTop: 10 }}>
              <Icon name="award" size={16} color={colors.warning} />
              <T variant="small" tone="secondary">
                Seu recorde: {fmtNumber(current.personalBest.loadKg)} kg × {current.personalBest.reps}
              </T>
            </Row>
          ) : null}
        </Card>

        {/* Hoje */}
        <Card style={{ marginTop: 12 }}>
          <T variant="caption" tone="muted">
            Carga de hoje
          </T>
          {current.today.length ? (
            <View style={{ marginTop: 6 }}>
              {current.today.map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row justify="space-between" style={{ paddingVertical: 8 }}>
                    <Row gap={10}>
                      <Icon name="check-circle" size={18} color={colors.success} />
                      <T variant="bodyStrong">
                        Série {s.setNumber}: {fmtNumber(s.loadKg)} kg × {s.reps}
                      </T>
                      {s.isPersonalRecord ? <Badge label="RECORDE" tone="warning" icon="award" /> : null}
                    </Row>
                    <Row gap={10}>
                      {s.rpe ? (
                        <T variant="small" tone="muted">
                          RPE {s.rpe}
                        </T>
                      ) : null}
                      <Pressable onPress={() => deleteSet(s.id)} hitSlop={8} accessibilityLabel="Remover série">
                        <Icon name="trash" size={16} color={colors.textMuted} />
                      </Pressable>
                    </Row>
                  </Row>
                </View>
              ))}
            </View>
          ) : (
            <T tone="secondary" style={{ marginTop: 6 }}>
              Nenhuma série registrada ainda
            </T>
          )}
        </Card>

        {/* Registro da série */}
        <Card elevated style={{ marginTop: 12, borderColor: exerciseDone ? colors.border : colors.accent, borderWidth: 1 }}>
          <T variant="h3" style={{ marginBottom: 12 }}>
            {exerciseDone ? `Série extra (${nextSetNumber})` : `Série ${nextSetNumber} de ${current.sets}`}
          </T>
          <Row gap={10} align="flex-start">
            <View style={{ flex: 1 }}>
              <Input label="Carga (kg)" value={load} onChangeText={setLoad} keyboardType="decimal-pad" suffix="kg" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Repetições" value={reps} onChangeText={setReps} keyboardType="number-pad" suffix="reps" />
            </View>
          </Row>
          <Chips label="Percepção de esforço (RPE 1–10)" options={RPE_OPTIONS} value={rpe} onChange={setRpe} scroll allowClear />
          <Input label="Observações" value={notes} onChangeText={setNotes} placeholder="Opcional" />
          <Button
            title={exerciseDone ? 'REGISTRAR SÉRIE EXTRA' : 'CONCLUIR SÉRIE'}
            icon="check"
            size="lg"
            onPress={logSet}
            loading={saving}
            variant={exerciseDone ? 'secondary' : 'primary'}
          />
        </Card>

        <Row gap={10} style={{ marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Button title="Anterior" icon="chevron-left" variant="outline" disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Próximo"
              icon="chevron-right"
              variant={exerciseDone ? 'primary' : 'outline'}
              disabled={index >= exercises.length - 1}
              onPress={() => setIndex((i) => Math.min(exercises.length - 1, i + 1))}
            />
          </View>
        </Row>
      </Screen>

      <Modal visible={!!rest && !record} transparent animationType="fade" onRequestClose={afterRest}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 420 }}>
            {rest ? <RestTimer key={rest.key} seconds={rest.seconds} onFinish={afterRest} /> : null}
            {current ? (
              <T tone="secondary" center style={{ marginTop: 12 }}>
                {exerciseDone ? 'Próximo: ' + (exercises.find((e, i) => i > index && e.today.length < e.sets)?.name ?? 'finalizar treino') : `A seguir: ${current.name} · série ${nextSetNumber}`}
              </T>
            ) : null}
          </View>
        </View>
      </Modal>
      <RecordModal record={record} onClose={() => setRecord(null)} />
      <FinishSheet
        visible={finishOpen}
        onClose={() => setFinishOpen(false)}
        sessionId={view.id}
        pendingSets={totalSets - doneSets}
        onFinished={async (res) => {
          setFinishOpen(false);
          await activeSession.clear();
          queryClient.setQueryData(['session-summary', res.id], res);
          await invalidate(['dashboard'], ['progress'], ['sessions'], ['goals']);
          router.replace(`/aluno/resumo/${res.id}`);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }} padding={12}>
      <T variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </T>
      <T variant="h3" style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </Card>
  );
}

function RecordModal({ record, onClose }: { record: { name: string; loadKg: number; reps: number } | null; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal visible={!!record} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Card elevated style={{ alignItems: 'center', gap: 12, padding: 28, maxWidth: 420, width: '100%', borderColor: colors.warning, borderWidth: 1 }}>
          <T style={{ fontSize: 56 }}>🏆</T>
          <T variant="h1" center tone="warning">
            NOVO RECORDE!
          </T>
          <T variant="h3" center>
            {record?.name}
          </T>
          <T variant="display" center>
            {fmtNumber(record?.loadKg)} kg × {record?.reps}
          </T>
          <T tone="secondary" center>
            Você superou sua melhor marca. Continue assim! 💪
          </T>
          <Button title="Continuar" onPress={onClose} />
        </Card>
      </Pressable>
    </Modal>
  );
}

function FinishSheet({
  visible,
  onClose,
  sessionId,
  pendingSets,
  onFinished,
}: {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  pendingSets: number;
  onFinished: (res: FinishSessionResponse) => void;
}) {
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const finish = async () => {
    setLoading(true);
    try {
      const res = await api.post<FinishSessionResponse>(`/sessions/${sessionId}/finish`, {
        perceivedEffort: effort ?? undefined,
        notes: notes.trim() || undefined,
      });
      haptic('success');
      onFinished(res);
    } catch (e) {
      notifyError(e, 'Não foi possível finalizar');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Finalizar treino">
      {pendingSets > 0 ? (
        <Card style={{ marginBottom: 16 }}>
          <T tone="warning">Ainda há {pendingSets} série(s) não registradas. Você pode finalizar mesmo assim.</T>
        </Card>
      ) : null}
      <Chips label="Como foi o esforço geral? (1 = muito leve · 10 = máximo)" options={RPE_OPTIONS} value={effort} onChange={setEffort} allowClear />
      <Input label="Observações para o professor" value={notes} onChangeText={setNotes} multiline placeholder="Ex.: senti o ombro no supino" />
      <Button title="FINALIZAR TREINO" size="lg" icon="check-circle" onPress={finish} loading={loading} />
    </Sheet>
  );
}
