import { MUSCLE_GROUP_LABELS, TECHNIQUE_LABELS, type WorkoutExercise } from '@personalpro/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Badge, Row, T } from '@/components/ui';
import { fmtNumber, WEEKDAYS_SHORT } from '@/lib/format';
import { useTheme } from '@/theme';

export function groupExercises<T extends { groupKey: string | null }>(items: T[]): { key: string | null; items: T[] }[] {
  const groups: { key: string | null; items: T[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (it.groupKey && last && last.key === it.groupKey) last.items.push(it);
    else groups.push({ key: it.groupKey || null, items: [it] });
  }
  return groups;
}

export function groupLabel(size: number) {
  return size === 2 ? 'Bi-set' : size === 3 ? 'Tri-set' : size > 3 ? 'Circuito' : 'Grupo';
}

export function prescription(e: { sets: number; reps: string; suggestedLoadKg: string | number | null; restSeconds: number }) {
  const load = e.suggestedLoadKg !== null && e.suggestedLoadKg !== '' ? Number(e.suggestedLoadKg) : null;
  return [`${e.sets} × ${e.reps}`, load ? `${fmtNumber(load)} kg` : null, `${e.restSeconds}s descanso`].filter(Boolean).join(' · ');
}

export function weekdaysLabel(days: number[] | undefined) {
  if (!days?.length) return 'Sem dias fixos';
  return [...days].sort().map((d) => WEEKDAYS_SHORT[d]).join(' · ');
}

/** Lista de exercícios da ficha com agrupamento por groupKey (bi-set / tri-set). */
export function WorkoutExercises({ exercises, linkToDetail = true }: { exercises: WorkoutExercise[]; linkToDetail?: boolean }) {
  const { colors } = useTheme();
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  let n = 0;
  return (
    <View style={{ gap: 8 }}>
      {groupExercises(sorted).map((g, gi) => (
        <View
          key={gi}
          style={
            g.items.length > 1
              ? { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 10, gap: 6, marginVertical: 4 }
              : undefined
          }
        >
          {g.items.length > 1 ? (
            <Badge label={`${groupLabel(g.items.length)} ${g.key ?? ''}`.trim()} tone="accent" icon="repeat" />
          ) : null}
          {g.items.map((e) => {
            n += 1;
            return (
              <Pressable
                key={e.id}
                disabled={!linkToDetail}
                onPress={() => router.push(`/exercicio/${e.exerciseId}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Row gap={12} style={{ paddingVertical: 6 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <T variant="small" style={{ fontWeight: '800' }}>
                      {n}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong" numberOfLines={1}>
                      {e.exercise.name}
                    </T>
                    <T variant="small" tone="secondary">
                      {prescription(e)}
                    </T>
                    <Row gap={6} wrap style={{ marginTop: 4 }}>
                      <Badge label={MUSCLE_GROUP_LABELS[e.exercise.muscleGroup]} />
                      {e.technique !== 'NORMAL' ? <Badge label={TECHNIQUE_LABELS[e.technique]} tone="warning" /> : null}
                    </Row>
                    {e.notes ? (
                      <T variant="small" tone="muted" style={{ marginTop: 4 }}>
                        Obs.: {e.notes}
                      </T>
                    ) : null}
                  </View>
                  {linkToDetail ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : null}
                </Row>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
