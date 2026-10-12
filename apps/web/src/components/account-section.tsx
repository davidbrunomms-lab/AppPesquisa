'use client';

import { Download, KeyRound, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, downloadJson, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { setSession } from '@/lib/session';
import { useToast } from './toast';
import { Button, Card, CardBody, CardHeader, Input, Modal } from './ui';

export function SecurityCard() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return toast.error('As senhas não conferem');
    setLoading(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: current || undefined, newPassword: next } });
      toast.success('Senha alterada', 'Use a nova senha no próximo login.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error('Não foi possível alterar a senha', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Senha" subtitle={user?.hasPassword ? 'Altere sua senha de acesso' : 'Crie uma senha para entrar também com e-mail'} icon={<KeyRound className="size-4" />} />
      <CardBody>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
          {user?.hasPassword !== false && <Input label="Senha atual" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}
          <Input label="Nova senha" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" hint="Mín. 8 caracteres, letras e números" />
          <Input label="Confirmar nova senha" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" loading={loading} disabled={!next}>
              Alterar senha
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function PrivacyCard() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      await downloadJson('/account/export', `personalpro-meus-dados-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('Exportação concluída', 'O arquivo JSON com seus dados foi baixado.');
    } catch (err) {
      toast.error('Falha ao exportar', errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api('/account', { method: 'DELETE', body: { password: password || undefined } });
      setSession(null);
      toast.success('Conta excluída', 'Seus dados foram removidos conforme a LGPD.');
      window.location.href = '/';
    } catch (err) {
      toast.error('Não foi possível excluir', errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Privacidade e dados (LGPD)" subtitle="Seus direitos como titular dos dados" icon={<ShieldCheck className="size-4" />} />
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Exportar meus dados</p>
            <p className="text-xs text-muted">Baixe um arquivo JSON com perfil, treinos, avaliações, metas e mensagens.</p>
          </div>
          <Button variant="secondary" loading={exporting} onClick={exportData}>
            <Download className="size-4" /> Exportar
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Excluir conta</p>
            <p className="text-xs text-muted">Remove definitivamente sua conta, dados pessoais, fotos e arquivos. Não pode ser desfeito.</p>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Excluir conta
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Link href="/privacidade" target="_blank" className="text-sm text-muted underline-offset-2 hover:text-fg hover:underline">
            Ler a Política de Privacidade
          </Link>
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="size-4" /> Sair da conta
          </Button>
        </div>
      </CardBody>
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Excluir conta definitivamente?"
        description="Seus dados serão apagados e você perderá o acesso. Se for professor, seus alunos serão desvinculados."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} disabled={typed !== 'EXCLUIR' || (user?.hasPassword !== false && !password)} onClick={deleteAccount}>
              Excluir minha conta
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {user?.hasPassword !== false && <Input label="Confirme sua senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          <Input label='Digite "EXCLUIR" para confirmar' value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      </Modal>
    </Card>
  );
}
