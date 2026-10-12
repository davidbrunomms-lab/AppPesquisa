'use client';

import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '@personalpro/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Dumbbell, ImagePlus, ListChecks, Pencil, Plus, Search, Trash2, Video } from 'lucide-react';
import { useRef, useState } from 'react';
import { MUSCLE_GROUPS, useExercises } from '@/components/exercise-picker';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Input, LoadingBlock, Modal, PageHeader, Segmented, Select, Textarea } from '@/components/ui';
import { api, errorMessage, uploadFile } from '@/lib/api';

export default function ExercisesPage() {
  const [group, setGroup] = useState<MuscleGroup | ''>('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'all' | 'library' | 'custom'>('all');
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const list = useExercises(group, search, scope);

  return (
    <div>
      <PageHeader
        title="Biblioteca de exercícios"
        subtitle="Exercícios padrão e personalizados, com instruções e mídia"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Novo exercício
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar exercício" className="pl-10" />
        </div>
        <Segmented
          value={scope}
          onChange={setScope}
          className="h-11 items-center"
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'library', label: 'Padrão' },
            { value: 'custom', label: 'Meus' },
          ]}
        />
      </div>
      <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={group === ''} onClick={() => setGroup('')}>
          Todos
        </Chip>
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
            {MUSCLE_GROUP_LABELS[g]}
          </Chip>
        ))}
      </div>

      {list.isLoading ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : list.data!.length === 0 ? (
        <Card>
          <EmptyState icon={<Dumbbell className="size-5" />} title="Nenhum exercício encontrado" />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.data!.map((e) => (
            <button key={e.id} type="button" onClick={() => setDetail(e)} className="text-left">
              <Card className="h-full overflow-hidden transition hover:border-border-strong">
                <div className="relative aspect-[4/3] bg-surface-2">
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.imageUrl} alt={e.name} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-subtle">
                      <Dumbbell className="size-8" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {e.trainerId && <Badge tone="info">Meu</Badge>}
                    {e.videoUrl && (
                      <Badge>
                        <Video className="size-3" />
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{e.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                    {e.equipment ? ` · ${e.equipment}` : ''}
                  </p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <ExerciseDetail
          exercise={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
        />
      )}
      {editing && <ExerciseForm exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExerciseDetail({ exercise: e, onClose, onEdit }: { exercise: Exercise; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: () => api(`/exercises/${e.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Exercício excluído');
      qc.invalidateQueries({ queryKey: ['exercises'] });
      onClose();
    },
    onError: (err) => toast.error('Não foi possível excluir', errorMessage(err)),
  });
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={e.name}
      description={`${MUSCLE_GROUP_LABELS[e.muscleGroup]}${e.equipment ? ` · ${e.equipment}` : ''}`}
      footer={
        e.trainerId ? (
          <>
            <Button variant="danger" loading={remove.isPending} onClick={() => confirm('Excluir este exercício?') && remove.mutate()}>
              <Trash2 className="size-4" /> Excluir
            </Button>
            <Button onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {(e.videoUrl || e.imageUrl) && (
          <div className="overflow-hidden rounded-xl bg-surface-2">
            {e.videoUrl ? (
              isYoutube(e.videoUrl) ? (
                <iframe src={youtubeEmbed(e.videoUrl)} title={e.name} className="aspect-video w-full" allowFullScreen />
              ) : (
                <video src={e.videoUrl} controls poster={e.imageUrl ?? undefined} className="aspect-video w-full bg-black" />
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.imageUrl!} alt={e.name} className="max-h-80 w-full object-cover" />
            )}
          </div>
        )}
        {e.description && <p className="text-sm text-muted">{e.description}</p>}
        {e.instructions.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="size-4 text-accent-ink" /> Como executar
            </p>
            <ol className="space-y-2">
              {e.instructions.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                  <span className="pt-0.5 text-muted">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {e.commonMistakes.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Erros comuns
            </p>
            <ul className="space-y-1.5">
              {e.commonMistakes.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

const isYoutube = (url: string) => /youtube\.com|youtu\.be/.test(url);
function youtubeEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function ExerciseForm({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    name: exercise?.name ?? '',
    muscleGroup: exercise?.muscleGroup ?? 'CHEST',
    equipment: exercise?.equipment ?? '',
    description: exercise?.description ?? '',
    instructions: (exercise?.instructions ?? []).join('\n'),
    commonMistakes: (exercise?.commonMistakes ?? []).join('\n'),
    imageUrl: exercise?.imageUrl ?? '',
    videoUrl: exercise?.videoUrl ?? '',
  });
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  async function upload(file: File, kind: 'image' | 'video') {
    setUploading(kind);
    try {
      const res = await uploadFile(file, 'exercises');
      setF((x) => ({ ...x, [kind === 'image' ? 'imageUrl' : 'videoUrl']: res.url }));
      toast.success(kind === 'image' ? 'Imagem enviada' : 'Vídeo enviado');
    } catch (err) {
      toast.error('Falha no envio', errorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        muscleGroup: f.muscleGroup,
        equipment: f.equipment || undefined,
        description: f.description || undefined,
        instructions: lines(f.instructions),
        commonMistakes: lines(f.commonMistakes),
        imageUrl: f.imageUrl || undefined,
        videoUrl: f.videoUrl || undefined,
      };
      return exercise ? api(`/exercises/${exercise.id}`, { method: 'PATCH', body }) : api('/exercises', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(exercise ? 'Exercício atualizado' : 'Exercício criado');
      qc.invalidateQueries({ queryKey: ['exercises'] });
      onClose();
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={exercise ? 'Editar exercício' : 'Novo exercício personalizado'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={save.isPending} disabled={!f.name.trim() || !!uploading} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nome *" value={f.name} onChange={set('name')} wrapperClassName="sm:col-span-2" />
        <Select label="Grupo muscular" value={f.muscleGroup} onChange={set('muscleGroup')} options={MUSCLE_GROUPS.map((g) => ({ value: g, label: MUSCLE_GROUP_LABELS[g] }))} />
        <Input label="Equipamento" value={f.equipment} onChange={set('equipment')} placeholder="Ex.: Halteres" />
        <Textarea label="Descrição" value={f.description} onChange={set('description')} wrapperClassName="sm:col-span-2" className="min-h-16" />
        <Textarea label="Instruções (uma por linha)" value={f.instructions} onChange={set('instructions')} />
        <Textarea label="Erros comuns (um por linha)" value={f.commonMistakes} onChange={set('commonMistakes')} />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Imagem</p>
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'image')} />
          {f.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.imageUrl} alt="" className="h-28 w-full rounded-xl object-cover" />
          )}
          <Button variant="secondary" size="sm" loading={uploading === 'image'} onClick={() => imgRef.current?.click()}>
            <ImagePlus className="size-4" /> {f.imageUrl ? 'Trocar imagem' : 'Enviar imagem'}
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Vídeo</p>
          <input ref={vidRef} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'video')} />
          <Input value={f.videoUrl} onChange={set('videoUrl')} placeholder="URL (YouTube) ou envie um arquivo" className="h-10" />
          <Button variant="secondary" size="sm" loading={uploading === 'video'} onClick={() => vidRef.current?.click()}>
            <Video className="size-4" /> Enviar vídeo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
