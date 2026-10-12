'use client';

import type { TrainerNote } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, NotebookPen, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, Checkbox, EmptyState, ErrorState, LoadingBlock, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';

export function NotesTab({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['notes', studentId];
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const notes = useQuery({ queryKey: key, queryFn: () => api<TrainerNote[]>(`/students/${studentId}/notes`) });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: () => api(`/students/${studentId}/notes`, { method: 'POST', body: { content: content.trim(), pinned } }),
    onSuccess: () => {
      setContent('');
      setPinned(false);
      invalidate();
    },
    onError: (e) => toast.error('Erro ao salvar', errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; content?: string; pinned?: boolean }) => api(`/notes/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error('Erro ao atualizar', errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/notes/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (e) => toast.error('Erro ao excluir', errorMessage(e)),
  });

  const sorted = [...(notes.data ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="flex items-center gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs text-info">
        <Lock className="size-3.5 shrink-0" /> Anotações privadas: visíveis apenas para você e armazenadas com criptografia. O aluno nunca vê este conteúdo.
      </p>
      <Card className="p-4">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ex.: relatou dor no ombro direito; evitar desenvolvimento com barra." />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Checkbox checked={pinned} onChange={setPinned}>
            Fixar no topo
          </Checkbox>
          <Button loading={create.isPending} disabled={!content.trim()} onClick={() => create.mutate()}>
            Salvar anotação
          </Button>
        </div>
      </Card>
      {notes.isLoading ? (
        <LoadingBlock />
      ) : notes.isError ? (
        <ErrorState error={notes.error} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={<NotebookPen className="size-5" />} title="Nenhuma anotação" description="Registre observações sobre lesões, preferências e conversas." />
      ) : (
        sorted.map((n) => (
          <Card key={n.id} className={cn('p-4', n.pinned && 'border-accent/40')}>
            {editing === n.id ? (
              <>
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" loading={update.isPending} onClick={() => update.mutate({ id: n.id, content: editText })}>
                    Salvar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-subtle">
                    {n.pinned && <Pin className="mr-1 inline size-3 text-accent-ink" />}
                    {fmtDateTime(n.createdAt)}
                    {n.updatedAt !== n.createdAt ? ' · editada' : ''}
                  </p>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title={n.pinned ? 'Desafixar' : 'Fixar'} onClick={() => update.mutate({ id: n.id, pinned: !n.pinned })}>
                      {n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar"
                      onClick={() => {
                        setEditing(n.id);
                        setEditText(n.content);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => confirm('Excluir esta anotação?') && remove.mutate(n.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
