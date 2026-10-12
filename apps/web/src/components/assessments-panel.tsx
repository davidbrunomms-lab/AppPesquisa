'use client';

import {
  BODY_MEASUREMENT_KEYS,
  BODY_MEASUREMENT_LABELS,
  PHOTO_ANGLE_LABELS,
  type Assessment,
  type AssessmentComparison,
  type BodyMeasurementKey,
  type PhotoAngle,
} from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CalendarClock, Camera, ClipboardList, ImagePlus, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { combineLocal, fmtDate, fmtDateTime, fmtNumber, fmtSigned, toInputDate } from '@/lib/format';
import { useToast } from './toast';
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, Modal, Select, Textarea } from './ui';

const ANGLES: PhotoAngle[] = ['FRONT', 'BACK', 'RIGHT', 'LEFT'];
const STATUS_LABEL = { SCHEDULED: 'Agendada', COMPLETED: 'Concluída', CANCELED: 'Cancelada' } as const;

export function AssessmentsPanel({ studentId, role }: { studentId?: string; role: 'TRAINER' | 'STUDENT' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Assessment | 'new' | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [photosFor, setPhotosFor] = useState<Assessment | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const key = ['assessments', studentId ?? 'me'];
  const list = useQuery({ queryKey: key, queryFn: () => api<Assessment[]>('/assessments', { query: studentId ? { studentId } : undefined }) });
  const isTrainer = role === 'TRAINER';

  const remove = useMutation({
    mutationFn: (id: string) => api(`/assessments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Avaliação excluída');
      invalidateAssessments(qc);
    },
    onError: (e) => toast.error('Erro ao excluir', errorMessage(e)),
  });

  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data ?? [];
  const completed = items.filter((a) => a.status === 'COMPLETED');
  // Mantém a versão mais recente da avaliação aberta no modal de fotos.
  const photosCurrent = photosFor ? items.find((a) => a.id === photosFor.id) ?? photosFor : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={completed.length < 2} onClick={() => setCompareOpen(true)}>
          <ArrowLeftRight className="size-4" /> Antes x depois
        </Button>
        {isTrainer ? (
          <>
            <Button variant="secondary" onClick={() => setScheduleOpen(true)}>
              <CalendarClock className="size-4" /> Agendar
            </Button>
            <Button onClick={() => setForm('new')}>
              <Plus className="size-4" /> Nova avaliação
            </Button>
          </>
        ) : (
          <Button onClick={() => setWeightOpen(true)}>
            <Scale className="size-4" /> Registrar peso
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList className="size-5" />} title="Nenhuma avaliação registrada" description="As avaliações físicas alimentam os gráficos de peso, gordura, massa muscular e medidas." />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((a) => {
            const canEdit = isTrainer || !a.trainerId;
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.status === 'SCHEDULED' ? `Agendada para ${fmtDateTime(a.scheduledFor)}` : fmtDate(a.assessedAt ?? a.scheduledFor)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={a.status === 'COMPLETED' ? 'success' : a.status === 'SCHEDULED' ? 'info' : 'default'}>{STATUS_LABEL[a.status]}</Badge>
                      {!a.trainerId && <Badge>Registrada pelo aluno</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canEdit && a.status !== 'CANCELED' && (
                      <Button size="icon" variant="ghost" aria-label="Fotos" title="Fotos de evolução" onClick={() => setPhotosFor(a)}>
                        <Camera className="size-4" />
                      </Button>
                    )}
                    {isTrainer && (
                      <Button size="icon" variant="ghost" aria-label="Editar" title={a.status === 'SCHEDULED' ? 'Registrar resultados' : 'Editar'} onClick={() => setForm(a)}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => confirm('Excluir esta avaliação?') && remove.mutate(a.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {a.status === 'COMPLETED' && (
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                    {[
                      ['Peso', a.weightKg, 'kg'],
                      ['IMC', a.bmi, ''],
                      ['% gordura', a.bodyFatPct, '%'],
                      ['M. muscular', a.muscleMassKg, 'kg'],
                      ['M. magra', a.leanMassKg, 'kg'],
                    ].map(([l, v, u]) => (
                      <div key={l as string} className="rounded-xl bg-surface-2 px-2 py-2">
                        <dt className="text-[11px] text-muted">{l}</dt>
                        <dd className="tabular text-sm font-semibold">{v === null || v === undefined ? '—' : `${fmtNumber(v as number)}${u ? ` ${u}` : ''}`}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {a.notes && <p className="mt-3 text-sm text-muted">{a.notes}</p>}
                {a.photos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {a.photos.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={PHOTO_ANGLE_LABELS[p.angle]} className="h-20 w-16 rounded-lg object-cover ring-1 ring-border" />
                        <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 px-1 text-center text-[9px] text-white">{PHOTO_ANGLE_LABELS[p.angle]}</span>
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {form && studentId && <AssessmentForm studentId={studentId} assessment={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {scheduleOpen && studentId && <ScheduleModal studentId={studentId} onClose={() => setScheduleOpen(false)} />}
      {weightOpen && <WeightModal onClose={() => setWeightOpen(false)} />}
      {photosCurrent && <PhotosModal assessment={photosCurrent} onClose={() => setPhotosFor(null)} />}
      {compareOpen && <CompareModal assessments={completed} onClose={() => setCompareOpen(false)} />}
    </div>
  );
}

function invalidateAssessments(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['assessments'] });
  qc.invalidateQueries({ queryKey: ['progress-body'] });
  qc.invalidateQueries({ queryKey: ['student'] });
  qc.invalidateQueries({ queryKey: ['goals'] });
  qc.invalidateQueries({ queryKey: ['dashboard-student'] });
}

const optNum = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

function AssessmentForm({ studentId, assessment, onClose }: { studentId: string; assessment: Assessment | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const init = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  const [date, setDate] = useState(toInputDate(assessment?.assessedAt ?? new Date()));
  const [v, setV] = useState({
    weightKg: init(assessment?.weightKg),
    heightCm: init(assessment?.heightCm),
    bodyFatPct: init(assessment?.bodyFatPct),
    muscleMassKg: init(assessment?.muscleMassKg),
    leanMassKg: init(assessment?.leanMassKg),
    visceralFat: init(assessment?.visceralFat),
    notes: assessment?.notes ?? '',
  });
  const [m, setM] = useState<Record<BodyMeasurementKey, string>>(
    Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, init(assessment?.measurements?.[k])])) as Record<BodyMeasurementKey, string>,
  );
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const measurements = Object.fromEntries(BODY_MEASUREMENT_KEYS.filter((k) => m[k] !== '').map((k) => [k, optNum(m[k])]));
      const body = {
        assessedAt: new Date(`${date}T12:00:00`).toISOString(),
        weightKg: optNum(v.weightKg),
        heightCm: optNum(v.heightCm),
        bodyFatPct: optNum(v.bodyFatPct),
        muscleMassKg: optNum(v.muscleMassKg),
        leanMassKg: optNum(v.leanMassKg),
        visceralFat: optNum(v.visceralFat),
        notes: v.notes.trim() || undefined,
        measurements: Object.keys(measurements).length ? measurements : undefined,
      };
      return assessment
        ? api(`/assessments/${assessment.id}`, { method: 'PATCH', body: { ...body, status: 'COMPLETED' } })
        : api('/assessments', { method: 'POST', body: { ...body, studentId } });
    },
    onSuccess: () => {
      toast.success('Avaliação salva', 'Gráficos e metas foram atualizados.');
      invalidateAssessments(qc);
      onClose();
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={assessment ? (assessment.status === 'SCHEDULED' ? 'Registrar resultados' : 'Editar avaliação') : 'Nova avaliação física'}
      description="Preencha o que tiver medido — campos vazios são ignorados. IMC e massa magra são calculados automaticamente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Salvar avaliação
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="col-span-2 sm:col-span-1" />
          <Input label="Peso (kg)" inputMode="decimal" value={v.weightKg} onChange={set('weightKg')} />
          <Input label="Altura (cm)" inputMode="decimal" value={v.heightCm} onChange={set('heightCm')} />
          <Input label="% de gordura" inputMode="decimal" value={v.bodyFatPct} onChange={set('bodyFatPct')} />
          <Input label="Massa muscular (kg)" inputMode="decimal" value={v.muscleMassKg} onChange={set('muscleMassKg')} />
          <Input label="Massa magra (kg)" inputMode="decimal" value={v.leanMassKg} onChange={set('leanMassKg')} />
          <Input label="Gordura visceral" inputMode="decimal" value={v.visceralFat} onChange={set('visceralFat')} />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Medidas corporais (cm)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BODY_MEASUREMENT_KEYS.map((k) => (
              <Input key={k} label={BODY_MEASUREMENT_LABELS[k]} inputMode="decimal" value={m[k]} onChange={(e) => setM((x) => ({ ...x, [k]: e.target.value }))} />
            ))}
          </div>
        </div>
        <Textarea label="Observações" value={v.notes} onChange={set('notes')} />
      </div>
    </Modal>
  );
}

function ScheduleModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [date, setDate] = useState(toInputDate(new Date(Date.now() + 7 * 86400000)));
  const [time, setTime] = useState('08:00');
  const [notes, setNotes] = useState('');
  const save = useMutation({
    mutationFn: () => api('/assessments/schedule', { method: 'POST', body: { studentId, scheduledFor: combineLocal(date, time), notes: notes || undefined } }),
    onSuccess: () => {
      toast.success('Avaliação agendada', 'O aluno foi notificado.');
      invalidateAssessments(qc);
      onClose();
    },
    onError: (e) => toast.error('Erro ao agendar', errorMessage(e)),
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Agendar avaliação"
      footer={
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Agendar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Horário" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Textarea label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} wrapperClassName="col-span-2" />
      </div>
    </Modal>
  );
}

export function WeightModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(toInputDate(new Date()));
  const save = useMutation({
    mutationFn: () => api('/assessments', { method: 'POST', body: { weightKg: Number(weight.replace(',', '.')), assessedAt: new Date(`${date}T12:00:00`).toISOString() } }),
    onSuccess: () => {
      toast.success('Peso registrado!');
      invalidateAssessments(qc);
      onClose();
    },
    onError: (e) => toast.error('Erro ao registrar', errorMessage(e)),
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Registrar peso"
      description="Seu professor verá o novo registro na sua evolução."
      footer={
        <Button loading={save.isPending} disabled={!weight} onClick={() => save.mutate()}>
          Salvar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Peso (kg)" inputMode="decimal" autoFocus value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex.: 78,5" />
        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  );
}

function PhotosModal({ assessment, onClose }: { assessment: Assessment; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [angle, setAngle] = useState<PhotoAngle>('FRONT');
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api(`/assessments/${assessment.id}/photos`, { method: 'POST', form, query: { angle } });
    },
    onSuccess: () => {
      toast.success('Foto enviada');
      invalidateAssessments(qc);
    },
    onError: (e) => toast.error('Falha no envio', errorMessage(e)),
  });
  return (
    <Modal open size="lg" onClose={onClose} title="Fotos de evolução" description={`Avaliação de ${fmtDate(assessment.assessedAt ?? assessment.scheduledFor)} — uma foto por ângulo.`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ANGLES.map((a) => {
          const photo = assessment.photos.find((p) => p.angle === a);
          return (
            <button
              key={a}
              type="button"
              disabled={upload.isPending}
              onClick={() => {
                setAngle(a);
                setTimeout(() => inputRef.current?.click(), 0);
              }}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-2 text-muted transition hover:border-accent"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={PHOTO_ANGLE_LABELS[a]} className="size-full object-cover" />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-2 text-xs">
                  <ImagePlus className="size-6" /> Enviar
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] font-medium text-white">
                {PHOTO_ANGLE_LABELS[a]}
                {upload.isPending && angle === a ? ' · enviando…' : photo ? ' · trocar' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function CompareModal({ assessments, onClose }: { assessments: Assessment[]; onClose: () => void }) {
  const sorted = [...assessments].sort((a, b) => (a.assessedAt ?? '').localeCompare(b.assessedAt ?? ''));
  const [before, setBefore] = useState(sorted[0]?.id ?? '');
  const [after, setAfter] = useState(sorted[sorted.length - 1]?.id ?? '');
  const cmp = useQuery({
    enabled: !!before && !!after && before !== after,
    queryKey: ['assessment-compare', before, after],
    queryFn: () => api<AssessmentComparison>('/assessments/compare', { query: { before, after } }),
  });
  const opts = sorted.map((a) => ({ value: a.id, label: `${fmtDate(a.assessedAt)}${a.weightKg ? ` · ${fmtNumber(a.weightKg)} kg` : ''}` }));
  const rows: [string, keyof AssessmentComparison['deltas'] & keyof Assessment, string, boolean][] = [
    ['Peso', 'weightKg', 'kg', true],
    ['IMC', 'bmi', '', true],
    ['% de gordura', 'bodyFatPct', '%', true],
    ['Massa muscular', 'muscleMassKg', 'kg', false],
    ['Massa magra', 'leanMassKg', 'kg', false],
    ['Gordura visceral', 'visceralFat', '', true],
  ];

  return (
    <Modal open size="xl" onClose={onClose} title="Antes x Depois" description="Compare duas avaliações lado a lado.">
      <div className="grid grid-cols-2 gap-3">
        <Select label="Antes" value={before} onChange={(e) => setBefore(e.target.value)} options={opts} />
        <Select label="Depois" value={after} onChange={(e) => setAfter(e.target.value)} options={opts} />
      </div>
      {before === after && <p className="mt-4 text-sm text-warning">Selecione duas avaliações diferentes.</p>}
      {cmp.isLoading && <LoadingBlock />}
      {cmp.isError && <ErrorState error={cmp.error} />}
      {cmp.data && (
        <div className="mt-5 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cmp.data.photos.map((p) => (
              <div key={p.angle}>
                <p className="mb-1.5 text-xs font-medium text-muted">{PHOTO_ANGLE_LABELS[p.angle]}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[p.before, p.after].map((url, i) => (
                    <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-[10px] text-subtle">sem foto</span>
                      )}
                      <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-[9px] font-semibold text-white uppercase">{i === 0 ? 'Antes' : 'Depois'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Indicador</th>
                  <th className="pb-2 text-right font-medium">Antes · {fmtDate(cmp.data.before.assessedAt)}</th>
                  <th className="pb-2 text-right font-medium">Depois · {fmtDate(cmp.data.after.assessedAt)}</th>
                  <th className="pb-2 text-right font-medium">Variação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, k, unit, lowerBetter]) => (
                  <DeltaRow key={k} label={label} a={cmp.data.before[k] as number | null} b={cmp.data.after[k] as number | null} d={cmp.data.deltas[k] as number | null} unit={unit} lowerBetter={lowerBetter} />
                ))}
                {BODY_MEASUREMENT_KEYS.filter((k) => cmp.data.deltas.measurements[k] !== null).map((k) => (
                  <DeltaRow
                    key={k}
                    label={BODY_MEASUREMENT_LABELS[k]}
                    a={cmp.data.before.measurements?.[k] ?? null}
                    b={cmp.data.after.measurements?.[k] ?? null}
                    d={cmp.data.deltas.measurements[k]}
                    unit="cm"
                    lowerBetter={['waist', 'abdomen', 'hip'].includes(k)}
                    neutral={!['waist', 'abdomen', 'hip'].includes(k)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DeltaRow({ label, a, b, d, unit, lowerBetter, neutral }: { label: string; a: number | null; b: number | null; d: number | null; unit: string; lowerBetter: boolean; neutral?: boolean }) {
  const good = d === null || d === 0 || neutral ? null : lowerBetter ? d < 0 : d > 0;
  return (
    <tr className="border-t border-border">
      <td className="py-2">{label}</td>
      <td className="tabular py-2 text-right text-muted">{a === null ? '—' : `${fmtNumber(a)} ${unit}`}</td>
      <td className="tabular py-2 text-right">{b === null ? '—' : `${fmtNumber(b)} ${unit}`}</td>
      <td className={cn('tabular py-2 text-right font-semibold', good === true && 'text-success', good === false && 'text-warning')}>{fmtSigned(d, unit)}</td>
    </tr>
  );
}
