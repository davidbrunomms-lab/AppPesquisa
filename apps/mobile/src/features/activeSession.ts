import { localStore } from '@/lib/storage';

const KEY = 'pp.activeSession';

export interface ActiveSessionRef {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
}

/** Treino em andamento salvo localmente para o banner "Retomar treino". */
export const activeSession = {
  get: () => localStore.getJson<ActiveSessionRef>(KEY),
  set: (s: ActiveSessionRef) => localStore.setJson(KEY, s),
  clear: () => localStore.remove(KEY),
};
