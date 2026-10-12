import type { Exercise, ExerciseProgressItem, Goal, GoalStatus, GoalType } from '@personalpro/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button, Chips, Input, QueryState, Row } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { GoalsList } from '@/features/progress/EvolutionSections';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { isoDateOnly, isoToBrDate, numToText, parseBrDate, parseNum } from '@/lib/format';

const TYPES: { value: GoalType; label: string; unit: string }[] = [
  { value: 'BODY_WEIGHT', label: 'Peso corporal', unit: 'kg' },
  { value: 'BODY_FAT', label: '% de gordura', unit: '%' },
  { value: 'WEEKLY_FREQUENCY', label: 'Frequência semanal', unit: 'treinos/semana' },
  { value: 'EXERCISE_LOAD', label: 'Carga em exercício', unit: 'kg' },
  { value: 'CUSTOM', label: 'Personalizada', unit: '' },
];

export function GoalsTab({ studentId }: { studentId: string }) {
  const [form, setForm] = useState<{ goal: Goal | null } | null>(null);
  return (
    <View>
      <Button title="Nova meta" icon="plus" onPress={() => setForm({ goal: null })} />
      <View style={{ height: 14 }} />
      <GoalsList studentId={studentId} onEdit={(g) => setForm({ goal: g })} />
      {form ? <GoalForm studentId={studentId} goal={form.goal} onClose={() => setForm(null)} /> : null}
    </View>
  );
}

function GoalForm({ studentId, goal, onClose }: { studentId: string; goal: Goal | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [type, setType] = useState<GoalType>(goal?.type ?? 'BODY_WEIGHT');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [unit, setUnit] = useState(goal?.unit ?? '');
  const [start, setStart] = useState(numToText(goal?.startValue));
  const [current, setCurrent] = useState(numToText(goal?.currentValue));
  const [target, setTarget] = useState(numToText(goal?.targetValue));
  const [deadline, setDeadline] = useState(isoToBrDate(isoDateOnly(goal?.deadline ?? null)));
  const [exerciseId, setExerciseId] = useState<string | null>(goal?.exerciseId ?? null);
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'ACTIVE');
  const [loading, setLoading] = useState(false);
  const trained = useApi<ExerciseProgressItem[]>(['progress', 'exercises', studentId], !goal && type === 'EXERCISE_LOAD' ? '/progress/exercises' : null, { studentId });
  const library = useApi<Exercise[]>(['exercises', 'all'], !goal && type === 'EXERCISE_LOAD' ? '/exercises' : null);
  const exerciseOptions = trained.data?.length
    ? trained.data.map((e) => ({ value: e.exerciseId, label: e.name }))
    : (library.data ?? []).map((e) => ({ value: e.id, label: e.name }));

  const submit = async () => {
    const targetValue = parseNum(target);
    if (targetValue === undefined) return notify('Informe o valor da meta');
    const dl = deadline.trim() ? parseBrDate(deadline) : null;
    if (deadline.trim() && !dl) return notify('Prazo inválido', 'Use dd/mm/aaaa.');
    setLoading(true);
    try {
      if (goal) {
        await api.patch(`/goals/${goal.id}`, {
          title: title.trim() || undefined,
          targetValue,
          currentValue: parseNum(current),
          deadline: dl ?? undefined,
          status,
        });
      } else {
        if (type === 'EXERCISE_LOAD' && !exerciseId) {
          setLoading(false);
          return notify('Selecione o exercício');
        }
        await api.post('/goals', {
          studentId,
          type,
          targetValue,
          startValue: parseNum(start),
          exerciseId: type === 'EXERCISE_LOAD' ? exerciseId : undefined,
          title: title.trim() || undefined,
          unit: type === 'CUSTOM' ? unit.trim() || undefined : undefined,
          deadline: dl ?? undefined,
        });
      }
      await invalidate(['goals'], ['dashboard']);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!goal || !(await confirm('Excluir meta', `Excluir "${goal.title}"?`, { confirmText: 'Excluir', destructive: true }))) return;
    try {
      await api.delete(`/goals/${goal.id}`);
      await invalidate(['goals'], ['dashboard']);
      onClose();
    } catch (e) {
      notifyError(e);
    }
  };

  const typeUnit = TYPES.find((t) => t.value === type)?.unit ?? '';

  return (
    <Sheet visible onClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'}>
      {!goal ? <Chips label="Tipo" options={TYPES} value={type} onChange={(v) => v && setType(v)} /> : null}
      {!goal && type === 'EXERCISE_LOAD' ? (
        <QueryState query={trained.data?.length ? trained : library}>
          <Chips label="Exercício" scroll options={exerciseOptions} value={exerciseId} onChange={setExerciseId} />
        </QueryState>
      ) : null}
      <Input label="Título (opcional)" value={title} onChangeText={setTitle} placeholder="Gerado automaticamente se vazio" />
      {!goal && type === 'CUSTOM' ? <Input label="Unidade" value={unit} onChangeText={setUnit} placeholder="Ex.: km, cm, min" /> : null}
      <Row gap={10} align="flex-start">
        {!goal ? (
          <View style={{ flex: 1 }}>
            <Input label="Valor inicial" value={start} onChangeText={setStart} keyboardType="decimal-pad" suffix={typeUnit || unit} hint="Vazio = valor atual" />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Input label="Valor atual" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" suffix={goal.unit} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Input label="Meta" value={target} onChangeText={setTarget} keyboardType="decimal-pad" suffix={goal?.unit ?? (typeUnit || unit)} />
        </View>
      </Row>
      <Input label="Prazo (opcional)" value={deadline} onChangeText={setDeadline} placeholder="dd/mm/aaaa" icon="calendar" />
      {goal ? (
        <Chips
          label="Status"
          options={[
            { value: 'ACTIVE', label: 'Ativa' },
            { value: 'ACHIEVED', label: 'Alcançada' },
            { value: 'CANCELED', label: 'Cancelada' },
          ]}
          value={status}
          onChange={(v) => v && setStatus(v)}
        />
      ) : null}
      <Button title="Salvar meta" icon="check" onPress={submit} loading={loading} />
      {goal ? <Button title="Excluir meta" variant="ghost" icon="trash" onPress={remove} style={{ marginTop: 8 }} /> : null}
    </Sheet>
  );
}
