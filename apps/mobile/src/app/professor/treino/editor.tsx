import { MUSCLE_GROUP_LABELS, TECHNIQUE_LABELS, type Exercise, type TrainingTechnique, type Workout } from '@personalpro/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, Checkbox, Chips, EmptyState, Input, Loading, MultiChips, Row, Screen, Section, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { ExerciseLibrary } from '@/features/trainer/ExerciseLibrary';
import { WEEKDAY_OPTIONS } from '@/features/trainer/StudentWorkoutsTab';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { numToText, parseNum } from '@/lib/format';
import { useTheme } from '@/theme';

interface Item {
  key: string;
  id?: string;
  exerciseId: string;
  name: string;
  muscleGroup: Exercise['muscleGroup'];
  sets: string;
  reps: string;
  load: string;
  rest: string;
  technique: TrainingTechnique;
  groupKey: string;
  notes: string;
}

const LABELS = ['A', 'B', 'C', 'D', 'E'];
const TECHNIQUES = (Object.keys(TECHNIQUE_LABELS) as TrainingTechnique[]).map((k) => ({ value: k, label: TECHNIQUE_LABELS[k] }));

let seq = 0;
const newKey = () => `k${Date.now()}${seq++}`;

/** Montagem/edição de treino: exercícios da biblioteca, séries, reps, carga, descanso, técnica, agrupamento e ordem. */
export default function WorkoutEditor() {
  const { id, studentId } = useLocalSearchParams<{ id?: string; studentId?: string }>();
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const existing = useApi<Workout>(['workout', id], id ? `/workouts/${id}` : null);
  const [name, setName] = useState('');
  const [label, setLabel] = useState<string | null>('A');
  const [customLabel, setCustomLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(!id);

  useEffect(() => {
    if (!id || !existing.data || hydrated) return;
    const w = existing.data;
    setName(w.name);
    if (w.label && LABELS.includes(w.label)) setLabel(w.label);
    else {
      setLabel(null);
      setCustomLabel(w.label ?? '');
    }
    setDescription(w.description ?? '');
    setIsTemplate(w.isTemplate);
    setItems(
      [...w.exercises]
        .sort((a, b) => a.order - b.order)
        .map((e) => ({
          key: newKey(),
          id: e.id,
          exerciseId: e.exerciseId,
          name: e.exercise.name,
          muscleGroup: e.exercise.muscleGroup,
          sets: String(e.sets),
          reps: e.reps,
          load: numToText(e.suggestedLoadKg),
          rest: String(e.restSeconds),
          technique: e.technique,
          groupKey: e.groupKey ?? '',
          notes: e.notes ?? '',
        })),
    );
    setHydrated(true);
  }, [id, existing.data, hydrated]);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addExercise = (e: Exercise) => {
    const key = newKey();
    setItems((list) => [
      ...list,
      { key, exerciseId: e.id, name: e.name, muscleGroup: e.muscleGroup, sets: '3', reps: '10-12', load: '', rest: '60', technique: 'NORMAL', groupKey: '', notes: '' },
    ]);
    setExpanded(key);
    setPickerOpen(false);
  };

  const save = async () => {
    if (name.trim().length < 2) return notify('Informe o nome do treino');
    if (!items.length) return notify('Adicione ao menos um exercício');
    for (const i of items) {
      const sets = Number(i.sets);
      if (!Number.isInteger(sets) || sets < 1) return notify('Séries inválidas', `Verifique "${i.name}".`);
      if (!i.reps.trim()) return notify('Repetições obrigatórias', `Verifique "${i.name}".`);
    }
    const body = {
      name: name.trim(),
      label: (label ?? customLabel.trim()) || undefined,
      description: description.trim() || undefined,
      isTemplate,
      exercises: items.map((i) => ({
        id: i.id,
        exerciseId: i.exerciseId,
        sets: Number(i.sets),
        reps: i.reps.trim(),
        suggestedLoadKg: parseNum(i.load),
        restSeconds: Math.round(parseNum(i.rest) ?? 60),
        technique: i.technique,
        groupKey: i.groupKey.trim() || undefined,
        notes: i.notes.trim() || undefined,
      })),
    };
    setSaving(true);
    try {
      const saved = id ? await api.put<Workout>(`/workouts/${id}`, body) : await api.post<Workout>('/workouts', body);
      if (!id && studentId) await api.post(`/workouts/${saved.id}/assign`, { studentId, weekdays });
      await invalidate(['workouts'], ['workout', id], ['dashboard']);
      notify(id ? 'Treino atualizado' : 'Treino criado', id ? 'Os alunos com esta ficha foram notificados.' : studentId ? 'Treino atribuído ao aluno.' : undefined);
      router.back();
    } catch (e) {
      notifyError(e, 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  };

  if (id && !hydrated) {
    return (
      <Screen title="Editar treino" back>
        <Loading />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title={id ? 'Editar treino' : 'Novo treino'} back footer={<Button title="Salvar treino" icon="check" size="lg" onPress={save} loading={saving} />}>
        <Input label="Nome do treino" value={name} onChangeText={setName} placeholder="Ex.: Treino A — Peito e tríceps" />
        <Chips
          label="Divisão"
          options={[...LABELS.map((l) => ({ value: l, label: `Treino ${l}` })), { value: '__custom', label: 'Personalizado' }]}
          value={label ?? '__custom'}
          onChange={(v) => setLabel(v === '__custom' || v === null ? null : v)}
        />
        {label === null ? <Input label="Rótulo personalizado" value={customLabel} onChangeText={setCustomLabel} placeholder="Ex.: Superiores, Full body" maxLength={20} /> : null}
        <Input label="Descrição (opcional)" value={description} onChangeText={setDescription} multiline />
        <Checkbox checked={isTemplate} onChange={setIsTemplate}>
          <T>Salvar como modelo reutilizável</T>
        </Checkbox>
        {!id && studentId ? <MultiChips label="Dias da semana para o aluno" options={WEEKDAY_OPTIONS} values={weekdays} onChange={setWeekdays} /> : null}

        <Section title={`Exercícios (${items.length})`} action="+ Adicionar" onAction={() => setPickerOpen(true)}>
          {items.length ? (
            <View style={{ gap: 10 }}>
              {items.map((i, idx) => {
                const open = expanded === i.key;
                return (
                  <Card key={i.key} style={i.groupKey ? { borderLeftWidth: 3, borderLeftColor: colors.accent } : undefined}>
                    <Pressable onPress={() => setExpanded(open ? null : i.key)}>
                      <Row gap={10}>
                        <T variant="h3" tone="muted" style={{ width: 22 }}>
                          {idx + 1}
                        </T>
                        <View style={{ flex: 1 }}>
                          <T variant="bodyStrong" numberOfLines={1}>
                            {i.name}
                          </T>
                          <T variant="small" tone="secondary">
                            {i.sets} × {i.reps}
                            {i.load ? ` · ${i.load} kg` : ''} · {i.rest}s · {MUSCLE_GROUP_LABELS[i.muscleGroup]}
                          </T>
                          <Row gap={6} style={{ marginTop: 4 }}>
                            {i.technique !== 'NORMAL' ? <Badge label={TECHNIQUE_LABELS[i.technique]} tone="warning" /> : null}
                            {i.groupKey ? <Badge label={`Grupo ${i.groupKey}`} tone="accent" icon="repeat" /> : null}
                          </Row>
                        </View>
                        <Row gap={4}>
                          <Pressable onPress={() => move(idx, -1)} hitSlop={6} accessibilityLabel="Mover para cima" style={{ padding: 4, opacity: idx === 0 ? 0.3 : 1 }}>
                            <Icon name="arrow-up" size={18} color={colors.textSecondary} />
                          </Pressable>
                          <Pressable onPress={() => move(idx, 1)} hitSlop={6} accessibilityLabel="Mover para baixo" style={{ padding: 4, opacity: idx === items.length - 1 ? 0.3 : 1 }}>
                            <Icon name="arrow-down" size={18} color={colors.textSecondary} />
                          </Pressable>
                          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                        </Row>
                      </Row>
                    </Pressable>
                    {open ? (
                      <View style={{ marginTop: 14 }}>
                        <Row gap={10} align="flex-start">
                          <View style={{ flex: 1 }}>
                            <Input label="Séries" value={i.sets} onChangeText={(t) => update(i.key, { sets: t.replace(/\D/g, '') })} keyboardType="number-pad" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Input label="Repetições" value={i.reps} onChangeText={(t) => update(i.key, { reps: t })} placeholder="8-12" />
                          </View>
                        </Row>
                        <Row gap={10} align="flex-start">
                          <View style={{ flex: 1 }}>
                            <Input label="Carga sugerida" value={i.load} onChangeText={(t) => update(i.key, { load: t })} keyboardType="decimal-pad" suffix="kg" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Input label="Descanso" value={i.rest} onChangeText={(t) => update(i.key, { rest: t.replace(/\D/g, '') })} keyboardType="number-pad" suffix="s" />
                          </View>
                        </Row>
                        <Chips label="Técnica" scroll options={TECHNIQUES} value={i.technique} onChange={(v) => v && update(i.key, { technique: v })} />
                        <Input
                          label="Agrupamento (bi-set / tri-set)"
                          value={i.groupKey}
                          onChangeText={(t) => update(i.key, { groupKey: t.toUpperCase().slice(0, 4) })}
                          placeholder="Ex.: A1 — use a mesma letra nos exercícios consecutivos"
                          autoCapitalize="characters"
                        />
                        <Input label="Observações" value={i.notes} onChangeText={(t) => update(i.key, { notes: t })} multiline />
                        <Button
                          title="Remover exercício"
                          icon="trash"
                          variant="danger"
                          size="sm"
                          onPress={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                        />
                      </View>
                    ) : null}
                  </Card>
                );
              })}
              <Button title="Adicionar exercício" icon="plus" variant="secondary" onPress={() => setPickerOpen(true)} />
            </View>
          ) : (
            <EmptyState icon="dumbbell" title="Nenhum exercício" message="Adicione exercícios da biblioteca." action="Adicionar exercício" onAction={() => setPickerOpen(true)} />
          )}
        </Section>
      </Screen>
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Biblioteca de exercícios">
        <ExerciseLibrary onPick={addExercise} picked={items.map((i) => i.exerciseId)} />
        <Button
          title="Criar exercício personalizado"
          icon="plus"
          variant="ghost"
          onPress={() => {
            setPickerOpen(false);
            router.push('/professor/exercicio-form');
          }}
        />
      </Sheet>
    </KeyboardAvoidingView>
  );
}
