import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '@personalpro/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Badge, Chips, EmptyState, Input, QueryState, Row, T } from '@/components/ui';
import { useApi } from '@/features/hooks';
import { useTheme } from '@/theme';

const GROUPS = (Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).map((k) => ({ value: k, label: MUSCLE_GROUP_LABELS[k] }));

/** Biblioteca de exercícios com filtro por grupo muscular e busca. Com `onPick` funciona como seletor. */
export function ExerciseLibrary({ onPick, picked }: { onPick?: (e: Exercise) => void; picked?: string[] }) {
  const { colors } = useTheme();
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const query = { muscleGroup: group ?? undefined, search: debounced || undefined, scope: scope === 'mine' ? 'custom' : undefined };
  const q = useApi<Exercise[]>(['exercises', query], '/exercises', query);

  return (
    <View>
      <Input value={search} onChangeText={setSearch} placeholder="Buscar exercício" icon="search" />
      <Chips scroll options={GROUPS} value={group} onChange={setGroup} allowClear />
      <Chips
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'mine', label: 'Meus exercícios' },
        ]}
        value={scope}
        onChange={(v) => v && setScope(v)}
      />
      <QueryState query={q}>
        {q.data?.length ? (
          <View style={{ gap: 2 }}>
            {q.data.map((e) => {
              const isPicked = picked?.includes(e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => (onPick ? onPick(e) : router.push(`/exercicio/${e.id}`))}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border })}
                >
                  <Row gap={12}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={e.videoUrl ? 'video' : e.imageUrl ? 'image' : 'dumbbell'} size={18} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="bodyStrong" numberOfLines={1}>
                        {e.name}
                      </T>
                      <Row gap={6}>
                        <T variant="small" tone="muted">
                          {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                          {e.equipment ? ` · ${e.equipment}` : ''}
                        </T>
                        {e.trainerId ? <Badge label="Meu" tone="info" /> : null}
                      </Row>
                    </View>
                    {onPick ? (
                      <Icon name={isPicked ? 'check-circle' : 'plus'} size={20} color={isPicked ? colors.success : colors.accent} />
                    ) : e.trainerId ? (
                      <Pressable onPress={() => router.push({ pathname: '/professor/exercicio-form', params: { id: e.id } })} hitSlop={8} accessibilityLabel="Editar exercício">
                        <Icon name="edit" size={18} color={colors.textMuted} />
                      </Pressable>
                    ) : (
                      <Icon name="chevron-right" size={18} color={colors.textMuted} />
                    )}
                  </Row>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="search" title="Nenhum exercício encontrado" />
        )}
      </QueryState>
    </View>
  );
}
