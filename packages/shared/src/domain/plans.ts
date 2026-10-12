export interface PlanDefinition {
  code: 'PERSONAL_STARTER' | 'PERSONAL_PRO' | 'PERSONAL_UNLIMITED';
  name: string;
  description: string;
  maxStudents: number | null;
  priceCents: number;
}

/** Catálogo padrão (o banco é a fonte da verdade; isto alimenta o seed). */
export const PLAN_CATALOG: PlanDefinition[] = [
  {
    code: 'PERSONAL_STARTER',
    name: 'Personal Starter',
    description: 'Até 10 alunos',
    maxStudents: 10,
    priceCents: 4990,
  },
  {
    code: 'PERSONAL_PRO',
    name: 'Personal Pro',
    description: 'Até 50 alunos',
    maxStudents: 50,
    priceCents: 9990,
  },
  {
    code: 'PERSONAL_UNLIMITED',
    name: 'Personal Unlimited',
    description: 'Alunos ilimitados',
    maxStudents: null,
    priceCents: 19990,
  },
];

export const TRIAL_DAYS = 14;

export function canAddStudent(activeStudents: number, maxStudents: number | null): boolean {
  return maxStudents === null || activeStudents < maxStudents;
}

export function formatCurrency(cents: number, currency = 'BRL'): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
}
