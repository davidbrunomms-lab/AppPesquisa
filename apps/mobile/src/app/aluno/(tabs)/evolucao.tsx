import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui';
import { useRefresh } from '@/features/hooks';
import { EvolutionOverview } from '@/features/progress/EvolutionSections';

export default function StudentEvolution() {
  const qc = useQueryClient();
  const { refreshing, onRefresh } = useRefresh(
    () => qc.invalidateQueries({ queryKey: ['progress'] }),
    () => qc.invalidateQueries({ queryKey: ['goals'] }),
    () => qc.invalidateQueries({ queryKey: ['assessments'] }),
  );
  return (
    <Screen title="Minha evolução" refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <EvolutionOverview mode="student" />
    </Screen>
  );
}
