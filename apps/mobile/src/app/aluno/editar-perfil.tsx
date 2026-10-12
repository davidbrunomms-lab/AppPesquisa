import type { StudentDetail } from '@personalpro/shared';
import { router } from 'expo-router';
import { QueryState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useApi, useInvalidate } from '@/features/hooks';
import { StudentProfileForm } from '@/features/student/StudentProfileForm';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';

export default function EditStudentProfile() {
  const q = useApi<StudentDetail>(['me'], '/students/me');
  const invalidate = useInvalidate();
  const { refreshUser } = useAuth();
  return (
    <Screen title="Editar perfil" back>
      <QueryState query={q}>
        {q.data ? (
          <StudentProfileForm
            initial={q.data}
            onSubmit={async (data) => {
              try {
                await api.patch('/students/me', data);
                await invalidate(['me'], ['dashboard'], ['progress']);
                await refreshUser().catch(() => undefined);
                notify('Perfil atualizado');
                router.back();
              } catch (e) {
                notifyError(e);
              }
            }}
          />
        ) : null}
      </QueryState>
    </Screen>
  );
}
