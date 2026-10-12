import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingBlock } from '@/components/ui';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Definir senha' };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ResetForm />
    </Suspense>
  );
}
