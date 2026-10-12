import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingBlock } from '@/components/ui';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Criar conta' };

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RegisterForm />
    </Suspense>
  );
}
