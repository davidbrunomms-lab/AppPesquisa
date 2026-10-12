import {
  formatDelta,
  TRAINING_GOAL_LABELS,
  TRAINING_LEVEL_LABELS,
  type LinkStatus,
  type StudentListItem,
  type TrainingGoal,
  type TrainingLevel,
} from '@personalpro/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar, Badge, Card, Chips, EmptyState, IconButton, Input, QueryState, Row, Screen, T } from '@/components/ui';
import { useApi, useRefresh } from '@/features/hooks';
import { relativeDays } from '@/lib/format';
import { useTheme } from '@/theme';

const STATUS_LABEL: Record<LinkStatus, string> = { ACTIVE: 'Ativo', PENDING: 'Pendente', INACTIVE: 'Inativo' };

export default function StudentsScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [goal, setGoal] = useState<TrainingGoal | null>(null);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [inactive, setInactive] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = { search: debounced || undefined, status: status ?? undefined, goal: goal ?? undefined, level: level ?? undefined, inactiveDays: inactive ?? undefined, sort: 'name' };
  const q = useApi<StudentListItem[]>(['students', 'list', query], '/students', query);
  const { refreshing, onRefresh } = useRefresh(q.refetch);
  const activeFilters = [status, goal, level, inactive].filter((v) => v !== null).length;

  return (
    <Screen
      title="Alunos"
      subtitle={q.data ? `${q.data.length} aluno(s)` : undefined}
      refreshing={refreshing}
      onRefresh={onRefresh}
      edgeBottom={false}
      right={<IconButton icon="user-plus" label="Adicionar aluno" tone="accent" onPress={() => router.push('/professor/aluno/novo')} />}
    >
      <Row gap={10} align="flex-start">
        <View style={{ flex: 1 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Buscar por nome ou e-mail" icon="search" autoCapitalize="none" />
        </View>
        <IconButton icon="filter" label="Filtros" badge={activeFilters || undefined} onPress={() => setShowFilters((v) => !v)} size={50} />
      </Row>
      {showFilters ? (
        <Card style={{ marginBottom: 14 }}>
          <Chips label="Status" options={(Object.keys(STATUS_LABEL) as LinkStatus[]).map((k) => ({ value: k, label: STATUS_LABEL[k] }))} value={status} onChange={setStatus} allowClear />
          <Chips label="Objetivo" scroll options={(Object.keys(TRAINING_GOAL_LABELS) as TrainingGoal[]).map((k) => ({ value: k, label: TRAINING_GOAL_LABELS[k] }))} value={goal} onChange={setGoal} allowClear />
          <Chips label="Nível" options={(Object.keys(TRAINING_LEVEL_LABELS) as TrainingLevel[]).map((k) => ({ value: k, label: TRAINING_LEVEL_LABELS[k] }))} value={level} onChange={setLevel} allowClear />
          <Chips label="Sem treinar há" options={[3, 7, 14, 30].map((n) => ({ value: n, label: `${n}+ dias` }))} value={inactive} onChange={setInactive} allowClear />
        </Card>
      ) : null}

      <QueryState query={q}>
        {q.data?.length ? (
          <View style={{ gap: 10 }}>
            {q.data.map((s) => (
              <Pressable key={s.id} onPress={() => router.push(`/professor/aluno/${s.id}`)}>
                {({ pressed }) => (
                  <Card style={{ opacity: pressed ? 0.85 : 1 }}>
                    <Row gap={12} align="flex-start">
                      <Avatar name={s.name} url={s.avatarUrl} size={48} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Row justify="space-between">
                          <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                            {s.name}
                          </T>
                          <Badge label={STATUS_LABEL[s.status]} tone={s.status === 'ACTIVE' ? 'success' : s.status === 'PENDING' ? 'warning' : 'neutral'} />
                        </Row>
                        <T variant="small" tone="secondary">
                          {s.goal ? TRAINING_GOAL_LABELS[s.goal] : 'Objetivo não definido'} · {TRAINING_LEVEL_LABELS[s.level]}
                        </T>
                        <Row gap={12} wrap>
                          <Row gap={4}>
                            <Icon name="clock" size={13} color={(s.daysSinceLastWorkout ?? 99) >= 7 ? colors.danger : colors.textMuted} />
                            <T variant="small" tone={(s.daysSinceLastWorkout ?? 99) >= 7 ? 'danger' : 'muted'}>
                              {relativeDays(s.daysSinceLastWorkout)}
                            </T>
                          </Row>
                          <Row gap={4}>
                            <Icon name="activity" size={13} color={colors.textMuted} />
                            <T variant="small" tone="muted">
                              {s.workoutsThisWeek}/{s.weeklyFrequency} na semana
                            </T>
                          </Row>
                          {s.weightEvolution ? (
                            <Row gap={4}>
                              <Icon name={s.weightEvolution.delta <= 0 ? 'trending-down' : 'trending-up'} size={13} color={colors.accent} />
                              <T variant="small" tone="accent">
                                {formatDelta(s.weightEvolution.delta)}
                              </T>
                            </Row>
                          ) : null}
                        </Row>
                      </View>
                    </Row>
                  </Card>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="users"
            title={debounced || activeFilters ? 'Nenhum aluno encontrado' : 'Nenhum aluno ainda'}
            message={debounced || activeFilters ? 'Ajuste a busca ou os filtros.' : 'Convide seus alunos por WhatsApp, e-mail ou QR Code.'}
            action="Adicionar aluno"
            onAction={() => router.push('/professor/aluno/novo')}
          />
        )}
      </QueryState>
    </Screen>
  );
}
