import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui';
import { useRefresh } from '@/features/hooks';
import { AgendaView } from '@/features/schedule/AgendaView';

export default function StudentAgenda() {
  const qc = useQueryClient();
  const { refreshing, onRefresh } = useRefresh(() => qc.invalidateQueries({ queryKey: ['appointments'] }));
  return (
    <Screen title="Agenda" refreshing={refreshing} onRefresh={onRefresh} edgeBottom={false}>
      <AgendaView role="STUDENT" />
    </Screen>
  );
}
