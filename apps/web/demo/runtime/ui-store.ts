/** Estado dos diálogos da demo (confirmação e exportação), fora do React. */

export interface ConfirmRequest {
  id: number;
  message: string;
  onConfirm: () => unknown;
}
export interface ExportRequest {
  id: number;
  json: string;
  filename: string;
  done: () => void;
}

interface State {
  confirm: ConfirmRequest | null;
  exportData: ExportRequest | null;
}

let state: State = { confirm: null, exportData: null };
let seq = 0;
const listeners = new Set<() => void>();

export const getUiState = () => state;
export function subscribeUi(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function openConfirm(message: string, onConfirm: () => unknown) {
  set({ confirm: { id: ++seq, message, onConfirm } });
}
export function closeConfirm(accepted: boolean) {
  const req = state.confirm;
  set({ confirm: null });
  if (accepted && req) {
    try {
      req.onConfirm();
    } catch (e) {
      console.error(e);
    }
  }
}

export function openExport(json: string, filename: string): Promise<void> {
  return new Promise((resolve) => set({ exportData: { id: ++seq, json, filename, done: resolve } }));
}
export function closeExport() {
  const req = state.exportData;
  set({ exportData: null });
  req?.done();
}
