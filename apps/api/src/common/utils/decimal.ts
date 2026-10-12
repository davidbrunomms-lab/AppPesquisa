import { Prisma } from '@prisma/client';

/** Converte Decimal/number/null do Prisma para number|null. */
export const num = (value: Prisma.Decimal | number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Igual a num(), mas com 0 como padrão. */
export const num0 = (value: Prisma.Decimal | number | string | null | undefined): number => num(value) ?? 0;
