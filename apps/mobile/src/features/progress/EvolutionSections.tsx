import {
  BODY_MEASUREMENT_KEYS,
  BODY_MEASUREMENT_LABELS,
  formatDelta,
  GOAL_NEAR_THRESHOLD,
  MUSCLE_GROUP_LABELS,
  PHOTO_ANGLE_LABELS,
  type Assessment,
  type BodyMeasurementKey,
  type BodyProgress,
  type ExerciseProgress,
  type ExerciseProgressItem,
  type Goal,
  type PhotoAngle,
  type ProgressStats,
} from '@personalpro/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BarChart, LineChart } from '@/components/Charts';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, Chips, Divider, EmptyState, Input, ListItem, ProgressBar, QueryState, Row, Section, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api, buildFileForm } from '@/lib/api';
import { absoluteUrl } from '@/lib/config';
import { fmtDate, fmtDayMonth, fmtNumber, parseNum } from '@/lib/format';
import { pickFromLibrary, takePhoto } from '@/lib/media';
import { useTheme } from '@/theme';

type Metric = 'weight' | 'bodyFat' | 'muscle' | 'measure';

/** Gráficos corporais: peso, % gordura, massa muscular e medidas. */
export function BodyCharts({ studentId }: { studentId?: string }) {
  const { colors } = useTheme();
  const q = useApi<BodyProgress>(['progress', 'body', studentId ?? 'me'], '/progress/body', { studentId });
  const [metric, setMetric] = useState<Metric>('weight');
  const [measure, setMeasure] = useState<BodyMeasurementKey>('waist');
  const series = q.data?.series ?? [];

  const points = useMemo(() => {
    const pick = (s: BodyProgress['series'][number]) =>
      metric === 'weight' ? s.weightKg : metric === 'bodyFat' ? s.bodyFatPct : metric === 'muscle' ? s.muscleMassKg : s.measurements?.[measure];
    return series
      .map((s) => ({ label: fmtDayMonth(s.date), value: pick(s) }))
      .filter((p): p is { label: string; value: number } => p.value !== null && p.value !== undefined);
  }, [series, metric, measure]);

  const unit = metric === 'bodyFat' ? '%' : metric === 'measure' ? 'cm' : 'kg';
  const evo = metric === 'weight' ? q.data?.weight : metric === 'bodyFat' ? q.data?.bodyFat : metric === 'muscle' ? q.data?.muscleMass : null;
  const measureEvo = metric === 'measure' && points.length >= 2 ? { initial: points[0].value, current: points[points.length - 1].value } : null;
  const shown = evo ?? measureEvo;
  const delta = shown ? shown.current - shown.initial : 0;
  const good = metric === 'muscle' ? delta >= 0 : delta <= 0;

  return (
    <Card>
      <Chips
        scroll
        options={[
          { value: 'weight', label: 'Peso' },
          { value: 'bodyFat', label: '% Gordura' },
          { value: 'muscle', label: 'Massa muscular' },
          { value: 'measure', label: 'Medidas' },
        ]}
        value={metric}
        onChange={(v) => v && setMetric(v)}
      />
      {metric === 'measure' ? (
        <Chips
          scroll
          options={BODY_MEASUREMENT_KEYS.map((k) => ({ value: k, label: BODY_MEASUREMENT_LABELS[k] }))}
          value={measure}
          onChange={(v) => v && setMeasure(v)}
        />
      ) : null}
      <QueryState query={q}>
        {shown ? (
          <Row justify="space-between" style={{ marginBottom: 8 }}>
            <View>
              <T variant="small" tone="muted">
                Inicial {fmtNumber(shown.initial)} {unit} · Atual {fmtNumber(shown.current)} {unit}
              </T>
              <T variant="h1">
                {fmtNumber(shown.current)} <T tone="muted">{unit}</T>
              </T>
            </View>
            <Badge label={formatDelta(delta, unit)} tone={delta === 0 ? 'neutral' : good ? 'success' : 'warning'} icon={delta <= 0 ? 'trending-down' : 'trending-up'} />
          </Row>
        ) : null}
        <LineChart data={points} unit={unit} color={colors.accent} />
      </QueryState>
    </Card>
  );
}

export function FrequencyChart({ studentId }: { studentId?: string }) {
  const q = useApi<ProgressStats>(['progress', 'stats', studentId ?? 'me'], '/progress/stats', { studentId, weeks: 12 });
  return (
    <Card>
      <QueryState query={q}>
        {q.data ? (
          <>
            <Row justify="space-between" style={{ marginBottom: 8 }}>
              <T tone="secondary">Treinos por semana</T>
              <T variant="small" tone="muted">
                média {fmtNumber(q.data.weeklyAverage)} · meta {q.data.plannedPerWeek}
              </T>
            </Row>
            <BarChart data={q.data.weeklySeries.map((w) => ({ label: fmtDayMonth(`${w.weekStart}T12:00:00`), value: w.count }))} target={q.data.plannedPerWeek} />
          </>
        ) : null}
      </QueryState>
    </Card>
  );
}

/** Carga por exercício: lista + gráfico do exercício selecionado. */
export function ExerciseLoadSection({ studentId }: { studentId?: string }) {
  const list = useApi<ExerciseProgressItem[]>(['progress', 'exercises', studentId ?? 'me'], '/progress/exercises', { studentId });
  const [selected, setSelected] = useState<string | null>(null);
  const exerciseId = selected ?? list.data?.[0]?.exerciseId ?? null;
  const detail = useApi<ExerciseProgress>(
    ['progress', 'exercise', exerciseId, studentId ?? 'me'],
    exerciseId ? `/progress/exercises/${exerciseId}` : null,
    { studentId },
  );
  const pts = detail.data?.points ?? [];
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <QueryState query={list}>
      {list.data?.length ? (
        <Card>
          <Chips
            scroll
            options={list.data.map((e) => ({ value: e.exerciseId, label: e.name }))}
            value={exerciseId}
            onChange={(v) => v && setSelected(v)}
          />
          <QueryState query={detail}>
            {detail.data ? (
              <>
                {first && last ? (
                  <T variant="bodyStrong" style={{ marginBottom: 6 }}>
                    {detail.data.exercise.name} {fmtDayMonth(`${first.date}T12:00:00`)} {fmtNumber(first.loadKg)} kg → {fmtDayMonth(`${last.date}T12:00:00`)}{' '}
                    {fmtNumber(last.loadKg)} kg
                  </T>
                ) : null}
                {detail.data.evolution ? (
                  <Badge
                    label={`${formatDelta(detail.data.evolution.delta)}${detail.data.evolution.deltaPct !== null ? ` (${fmtNumber(detail.data.evolution.deltaPct)}%)` : ''}`}
                    tone={detail.data.evolution.delta >= 0 ? 'success' : 'warning'}
                    icon="trending-up"
                  />
                ) : null}
                <View style={{ height: 8 }} />
                <LineChart data={pts.map((p) => ({ label: fmtDayMonth(`${p.date}T12:00:00`), value: p.loadKg }))} unit="kg" />
              </>
            ) : null}
          </QueryState>
          <Divider style={{ marginVertical: 12 }} />
          {list.data.map((e) => (
            <Pressable key={e.exerciseId} onPress={() => setSelected(e.exerciseId)}>
              <Row justify="space-between" style={{ paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong" numberOfLines={1}>
                    {e.name}
                  </T>
                  <T variant="small" tone="muted">
                    {MUSCLE_GROUP_LABELS[e.muscleGroup]} · {e.sessions} sessões · recorde {fmtNumber(e.bestLoadKg)} kg
                  </T>
                </View>
                <T variant="bodyStrong" tone={e.deltaKg > 0 ? 'success' : 'secondary'}>
                  {fmtNumber(e.firstLoadKg)} → {fmtNumber(e.lastLoadKg)} kg
                </T>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : (
        <EmptyState icon="bar-chart" title="Sem cargas registradas" message="Registre séries nos treinos para acompanhar a evolução das cargas." />
      )}
    </QueryState>
  );
}

/** Metas com % de progresso. O professor pode criar/editar (GoalForm na tela do aluno). */
export function GoalsList({ studentId, onEdit }: { studentId?: string; onEdit?: (g: Goal) => void }) {
  const { colors } = useTheme();
  const q = useApi<Goal[]>(['goals', studentId ?? 'me'], '/goals', { studentId });
  return (
    <QueryState query={q}>
      {q.data?.length ? (
        <View style={{ gap: 10 }}>
          {q.data.map((g) => (
            <Card key={g.id} onPress={onEdit ? () => onEdit(g) : undefined}>
              <Row justify="space-between" style={{ marginBottom: 8 }}>
                <Row gap={8} style={{ flex: 1 }}>
                  <Icon name={g.status === 'ACHIEVED' ? 'award' : 'target'} size={18} color={g.status === 'ACHIEVED' ? colors.warning : colors.accent} />
                  <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                    {g.title}
                  </T>
                </Row>
                <T variant="h3" tone={g.progressPct >= 100 ? 'success' : 'accent'}>
                  {fmtNumber(g.progressPct, 0)}%
                </T>
              </Row>
              <ProgressBar value={g.progressPct} color={g.progressPct >= GOAL_NEAR_THRESHOLD ? colors.success : undefined} />
              <Row justify="space-between" style={{ marginTop: 8 }}>
                <T variant="small" tone="muted">
                  {fmtNumber(g.startValue)} → {fmtNumber(g.currentValue)} / {fmtNumber(g.targetValue)} {g.unit}
                </T>
                {g.status === 'ACHIEVED' ? (
                  <Badge label="Alcançada" tone="success" />
                ) : g.status === 'CANCELED' ? (
                  <Badge label="Cancelada" />
                ) : g.deadline ? (
                  <T variant="small" tone="muted">
                    Prazo {fmtDate(g.deadline)}
                  </T>
                ) : null}
              </Row>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon="target" title="Nenhuma meta definida" message={onEdit ? 'Crie metas para acompanhar o progresso do aluno.' : 'Seu professor ainda não definiu metas.'} />
      )}
    </QueryState>
  );
}

const ANGLES: PhotoAngle[] = ['FRONT', 'BACK', 'RIGHT', 'LEFT'];

/** Avaliações: lista, comparação ANTES x DEPOIS, fotos e (aluno) registro de peso. */
export function AssessmentsSection({
  studentId,
  mode,
  onOpen,
}: {
  studentId?: string;
  mode: 'student' | 'trainer';
  /** Professor: abre o formulário completo da avaliação. */
  onOpen?: (a: Assessment | null) => void;
}) {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const q = useApi<Assessment[]>(['assessments', studentId ?? 'me'], '/assessments', { studentId });
  const [selecting, setSelecting] = useState<string[]>([]);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoFor, setPhotoFor] = useState<Assessment | null>(null);

  const completed = (q.data ?? []).filter((a) => a.status === 'COMPLETED');
  const scheduled = (q.data ?? []).filter((a) => a.status === 'SCHEDULED');

  const toggle = (id: string) =>
    setSelecting((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));

  const compare = () => {
    if (selecting.length !== 2 || !q.data) return;
    const [a, b] = selecting.map((id) => q.data!.find((x) => x.id === id)!);
    const date = (x: Assessment) => new Date(x.assessedAt ?? x.scheduledFor ?? 0).getTime();
    const [before, after] = date(a) <= date(b) ? [a, b] : [b, a];
    router.push({ pathname: '/comparar', params: { before: before.id, after: after.id } });
  };

  const saveWeight = async () => {
    const kg = parseNum(weight);
    if (!kg || kg < 20 || kg > 400) {
      notify('Peso inválido', 'Informe o peso em kg (ex.: 84,5).');
      return;
    }
    setSaving(true);
    try {
      await api.post('/assessments', { weightKg: kg, studentId });
      setWeight('');
      setWeightOpen(false);
      await invalidate(['assessments'], ['progress'], ['dashboard'], ['goals'], ['me']);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (a: Assessment, angle: PhotoAngle, source: 'camera' | 'library') => {
    const file = source === 'camera' ? await takePhoto() : await pickFromLibrary('images');
    if (!file) return;
    try {
      await api.upload(`/assessments/${a.id}/photos`, await buildFileForm(file), { angle });
      setPhotoFor(null);
      await invalidate(['assessments']);
      notify('Foto enviada', `Foto (${PHOTO_ANGLE_LABELS[angle]}) adicionada à avaliação.`);
    } catch (e) {
      notifyError(e, 'Não foi possível enviar a foto');
    }
  };

  const remove = async (a: Assessment) => {
    if (!(await confirm('Excluir avaliação', 'Esta ação não pode ser desfeita.', { confirmText: 'Excluir', destructive: true }))) return;
    try {
      await api.delete(`/assessments/${a.id}`);
      await invalidate(['assessments'], ['progress'], ['dashboard']);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <View>
      <Row gap={10} style={{ marginBottom: 12 }}>
        {mode === 'student' ? (
          <View style={{ flex: 1 }}>
            <Button title="Registrar peso" icon="scale" size="sm" onPress={() => setWeightOpen(true)} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Button title="Nova avaliação" icon="plus" size="sm" onPress={() => onOpen?.(null)} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button
            title={selecting.length === 2 ? 'Comparar' : `Antes x Depois (${selecting.length}/2)`}
            icon="copy"
            size="sm"
            variant={selecting.length === 2 ? 'primary' : 'secondary'}
            disabled={selecting.length !== 2}
            onPress={compare}
          />
        </View>
      </Row>
      <T variant="small" tone="muted" style={{ marginBottom: 10 }}>
        Toque no círculo de duas avaliações para comparar ANTES x DEPOIS.
      </T>
      <QueryState query={q}>
        {scheduled.length ? (
          <Card style={{ marginBottom: 10, borderColor: colors.info, borderWidth: 1 }}>
            {scheduled.map((a) => (
              <ListItem
                key={a.id}
                icon="calendar"
                title={`Avaliação agendada · ${fmtDate(a.scheduledFor)}`}
                subtitle={a.notes ?? (mode === 'trainer' ? 'Toque para registrar os dados' : 'Seu professor fará a avaliação')}
                onPress={mode === 'trainer' ? () => onOpen?.(a) : undefined}
              />
            ))}
          </Card>
        ) : null}
        {completed.length ? (
          <View style={{ gap: 10 }}>
            {completed.map((a) => {
              const sel = selecting.includes(a.id);
              return (
                <Card key={a.id} style={sel ? { borderColor: colors.accent, borderWidth: 1.5 } : undefined}>
                  <Row gap={12} align="flex-start">
                    <Pressable onPress={() => toggle(a.id)} hitSlop={10} accessibilityLabel="Selecionar para comparar">
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: sel ? colors.accent : colors.textMuted,
                          backgroundColor: sel ? colors.accent : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {sel ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
                      </View>
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={mode === 'trainer' ? () => onOpen?.(a) : () => toggle(a.id)}>
                      <T variant="bodyStrong">{fmtDate(a.assessedAt)}</T>
                      <T variant="small" tone="secondary">
                        {[
                          a.weightKg !== null ? `${fmtNumber(a.weightKg)} kg` : null,
                          a.bmi !== null ? `IMC ${fmtNumber(a.bmi)}` : null,
                          a.bodyFatPct !== null ? `${fmtNumber(a.bodyFatPct)}% gordura` : null,
                          a.muscleMassKg !== null ? `${fmtNumber(a.muscleMassKg)} kg músculo` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Sem medidas'}
                      </T>
                    </Pressable>
                    <Pressable onPress={() => setPhotoFor(a)} hitSlop={8} accessibilityLabel="Adicionar foto">
                      <Icon name="camera" size={20} color={colors.textSecondary} />
                    </Pressable>
                    {mode === 'trainer' || !a.trainerId ? (
                      <Pressable onPress={() => remove(a)} hitSlop={8} accessibilityLabel="Excluir avaliação">
                        <Icon name="trash" size={18} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </Row>
                  {a.photos.length ? (
                    <Row gap={8} style={{ marginTop: 10 }}>
                      {a.photos.map((p) => (
                        <View key={p.id} style={{ alignItems: 'center', gap: 2 }}>
                          <Image source={{ uri: absoluteUrl(p.url) ?? undefined }} style={{ width: 56, height: 74, borderRadius: 8, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
                          <T variant="small" tone="muted" style={{ fontSize: 10 }}>
                            {PHOTO_ANGLE_LABELS[p.angle]}
                          </T>
                        </View>
                      ))}
                    </Row>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="clipboard" title="Nenhuma avaliação" message="As avaliações físicas e registros de peso aparecerão aqui." />
        )}
      </QueryState>

      <Sheet visible={weightOpen} onClose={() => setWeightOpen(false)} title="Registrar peso">
        <Input label="Peso de hoje" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" placeholder="Ex.: 84,5" autoFocus />
        <Button title="Salvar" onPress={saveWeight} loading={saving} />
      </Sheet>

      <Sheet visible={!!photoFor} onClose={() => setPhotoFor(null)} title="Foto de evolução">
        <T tone="secondary" style={{ marginBottom: 12 }}>
          Escolha o ângulo e envie uma foto (mesma luz e posição ajudam na comparação).
        </T>
        {ANGLES.map((angle) => (
          <Card key={angle} style={{ marginBottom: 10 }}>
            <Row justify="space-between">
              <T variant="bodyStrong">{PHOTO_ANGLE_LABELS[angle]}</T>
              <Row gap={8}>
                <Button title="Câmera" icon="camera" size="sm" variant="secondary" full={false} onPress={() => photoFor && uploadPhoto(photoFor, angle, 'camera')} />
                <Button title="Galeria" icon="image" size="sm" variant="secondary" full={false} onPress={() => photoFor && uploadPhoto(photoFor, angle, 'library')} />
              </Row>
            </Row>
          </Card>
        ))}
      </Sheet>
    </View>
  );
}

export function EvolutionOverview({ studentId, mode, onOpenAssessment, onEditGoal }: {
  studentId?: string;
  mode: 'student' | 'trainer';
  onOpenAssessment?: (a: Assessment | null) => void;
  onEditGoal?: (g: Goal) => void;
}) {
  return (
    <>
      <Section title="Composição corporal" style={{ marginTop: 0 }}>
        <BodyCharts studentId={studentId} />
      </Section>
      <Section title="Frequência">
        <FrequencyChart studentId={studentId} />
      </Section>
      <Section title="Carga por exercício">
        <ExerciseLoadSection studentId={studentId} />
      </Section>
      <Section title="Metas">
        <GoalsList studentId={studentId} onEdit={onEditGoal} />
      </Section>
      <Section title="Avaliações">
        <AssessmentsSection studentId={studentId} mode={mode} onOpen={onOpenAssessment} />
      </Section>
    </>
  );
}
