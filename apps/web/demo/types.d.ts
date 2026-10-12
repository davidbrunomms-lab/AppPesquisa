/** Módulo virtual gerado por build.mjs a partir de apps/web/src/app (page.tsx/layout.tsx). */
declare module 'demo:routes' {
  import type { ComponentType, ReactNode } from 'react';
  export interface DemoRoute {
    /** Ex.: "/professor/alunos/[id]" (grupos de rota já removidos). */
    path: string;
    segments: string[];
    page: ComponentType<any>;
    layouts: ComponentType<{ children: ReactNode; params: Promise<Record<string, string>> }>[];
  }
  export const routes: DemoRoute[];
}
