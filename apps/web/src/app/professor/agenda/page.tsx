'use client';

import { APPOINTMENT_STATUS_LABELS, type Appointment, type StudentListItem } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, Check, CheckCheck, Clock, MapPin, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Avatar, Badge, Button, ErrorState, Input, LoadingBlock, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { startOfThisWeek, WeekCalendar, WeekNav } from '@/components/week-calendar';
import { api, errorMessage } from '@/lib/api';
import { addDaysLocal, appointmentTone, combineLocal, fmtTime, fmtWeekdayLong, toInputDate, toInputTime } from '@/lib/format';

export default function TrainerAgendaPage() {
  const [weekStart, setWeekStart] = useState(startOfThisWeek);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [create, setCreate] = useState<{ mode: 'slots' | 'appointment'; date: Date } | null>(null);
  const from = weekStart.toISOString();
  const to = addDaysLocal(weekStart, 7).toISOString();
  const q = useQuery({ queryKey: ['appointments', from], queryFn: () => api<Appointment[]>('/appointments', { query: { from, to } }) });
  const pending = (q.data ?? []).filter((a) => a.status === 'REQUESTED');

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Horários disponíveis, solicitações e treinos agendados"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreate({ mode: 'slots', date: defaultDate() })}>
              <Clock className="size-4" /> Liberar horários
            </Button>
            <Button onClick={() => setCreate({ mode: 'appointment', date: defaultDate() })}>
              <CalendarPlus className="size-4" /> Agendar aluno
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <WeekNav weekStart={weekStart} onChange={setWeekStart} />
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(['AVAILABLE', 'REQUESTED', 'CONFIRMED', 'COMPLETED'] as const).map((s) => (
            <Badge key={s} tone={appointmentTone(s)}>
              {APPOINTMENT_STATUS_LABELS[s]}
            </Badge>
          ))}
        </div>
      </div>
      {pending.length > 0 && (
        <div className="mb-4 rounded-2xl border border-warning/40 bg-warning-soft p-3">
          <p className="mb-2 text-sm font-semibold text-warning">{pending.length} solicitação(ões) aguardando confirmação</p>
          <div className="flex flex-wrap gap-2">
            {pending.map((a) => (
              <button key={a.id} onClick={() => setSelected(a)} className="flex items-center gap-2 rounded-full bg-surface px-2 py-1 pr-3 text-xs">
                <Avatar name={a.student?.name} size={22} />
                {a.student?.name} · {new Date(a.startsAt).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })} {fmtTime(a.startsAt)}
              </button>
            ))}
          </div>
        </div>
      )}
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <WeekCalendar weekStart={weekStart} appointments={q.data ?? []} onSelect={setSelected} onEmptyClick={(date) => setCreate({ mode: 'appointment', date })} />
      )}
      {selected && <AppointmentModal appointment={selected} onClose={() => setSelected(null)} />}
      {create && <CreateModal mode={create.mode} date={create.date} onClose={() => setCreate(null)} />}
    </div>
  );
}

function defaultDate() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['dashboard-trainer'] });
  };
}

function AppointmentModal({ appointment: a, onClose }: { appointment: Appointment; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [reschedule, setReschedule] = useState(false);
  const [date, setDate] = useState(toInputDate(a.startsAt));
  const [start, setStart] = useState(toInputTime(a.startsAt));
  const [end, setEnd] = useState(toInputTime(a.endsAt));
  const [reason, setReason] = useState('');

  const act = useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: 'POST' | 'DELETE'; body?: unknown }) => api(`/appointments/${a.id}${path}`, { method, body }),
    onSuccess: (_, v) => {
      const msg: Record<string, string> = {
        '/confirm': 'Agendamento confirmado',
        '/complete': 'Treino marcado como concluído',
        '/cancel': 'Agendamento cancelado',
        '/reschedule': 'Agendamento reagendado',
        '': 'Horário removido',
      };
      toast.success(msg[v.path] ?? 'Atualizado');
      invalidate();
      onClose();
    },
    onError: (e) => toast.error('Não foi possível atualizar', errorMessage(e)),
  });

  const open = a.status === 'REQUESTED' || a.status === 'CONFIRMED';
  return (
    <Modal open onClose={onClose} size="sm" title={a.student?.name ?? 'Horário disponível'} description={<span className="">{fmtWeekdayLong(a.startsAt)}</span>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
          <span className="tabular flex items-center gap-1 text-muted">
            <Clock className="size-3.5" /> {fmtTime(a.startsAt)} – {fmtTime(a.endsAt)}
          </span>
          {a.location && (
            <span className="flex items-center gap-1 text-muted">
              <MapPin className="size-3.5" /> {a.location}
            </span>
          )}
        </div>
        {a.notes && <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{a.notes}</p>}
        {a.cancelReason && <p className="text-sm text-danger">Motivo: {a.cancelReason}</p>}

        {reschedule ? (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="grid grid-cols-3 gap-2">
              <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="col-span-3" />
              <Input label="Início" type="time" value={start} onChange={(e) => setStart(e.target.value)} wrapperClassName="col-span-3 sm:col-span-1" />
              <Input label="Fim" type="time" value={end} onChange={(e) => setEnd(e.target.value)} wrapperClassName="col-span-3 sm:col-span-1" />
            </div>
            <Button
              className="w-full"
              loading={act.isPending}
              onClick={() => act.mutate({ path: '/reschedule', body: { startsAt: combineLocal(date, start), endsAt: combineLocal(date, end) } })}
            >
              Salvar novo horário
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {a.status === 'REQUESTED' && (
              <Button loading={act.isPending} onClick={() => act.mutate({ path: '/confirm' })}>
                <Check className="size-4" /> Confirmar solicitação
              </Button>
            )}
            {a.status === 'CONFIRMED' && (
              <Button loading={act.isPending} onClick={() => act.mutate({ path: '/complete' })}>
                <CheckCheck className="size-4" /> Marcar como concluído
              </Button>
            )}
            {open && (
              <Button variant="secondary" onClick={() => setReschedule(true)}>
                <CalendarClock className="size-4" /> Reagendar
              </Button>
            )}
            {open && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo do cancelamento (opcional)" className="h-10" />
                <Button variant="danger" className="w-full" loading={act.isPending} onClick={() => act.mutate({ path: '/cancel', body: { reason: reason || undefined } })}>
                  <X className="size-4" /> Cancelar agendamento
                </Button>
              </div>
            )}
            {(a.status === 'AVAILABLE' || a.status === 'CANCELED') && (
              <Button variant="danger" loading={act.isPending} onClick={() => act.mutate({ path: '', method: 'DELETE' })}>
                <Trash2 className="size-4" /> Excluir horário
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateModal({ mode: initialMode, date, onClose }: { mode: 'slots' | 'appointment'; date: Date; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [mode, setMode] = useState(initialMode);
  const [day, setDay] = useState(toInputDate(date));
  const [start, setStart] = useState(toInputTime(date));
  const [end, setEnd] = useState(toInputTime(new Date(date.getTime() + (initialMode === 'slots' ? 4 : 1) * 3600_000)));
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [studentId, setStudentId] = useState('');
  const students = useQuery({ enabled: mode === 'appointment', queryKey: ['students', { status: 'ACTIVE' }], queryFn: () => api<StudentListItem[]>('/students', { query: { status: 'ACTIVE' } }) });

  const save = useMutation({
    mutationFn: () =>
      mode === 'slots'
        ? api<Appointment[]>('/appointments/slots', {
            method: 'POST',
            body: { startsAt: combineLocal(day, start), endsAt: combineLocal(day, end), durationMinutes: Number(duration), location: location || undefined },
          })
        : api('/appointments', {
            method: 'POST',
            body: { studentId, startsAt: combineLocal(day, start), endsAt: combineLocal(day, end), location: location || undefined, notes: notes || undefined },
          }),
    onSuccess: (res) => {
      toast.success(mode === 'slots' ? `${Array.isArray(res) ? res.length : ''} horário(s) liberado(s)` : 'Treino agendado', mode === 'appointment' ? 'O aluno foi notificado.' : undefined);
      invalidate();
      onClose();
    },
    onError: (e) => toast.error('Não foi possível salvar', errorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'slots' ? 'Liberar horários disponíveis' : 'Agendar treino com aluno'}
      description={mode === 'slots' ? 'O período é dividido em horários que os alunos podem reservar.' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => setMode(mode === 'slots' ? 'appointment' : 'slots')}>
            {mode === 'slots' ? 'Agendar aluno' : 'Liberar horários'}
          </Button>
          <Button loading={save.isPending} disabled={mode === 'appointment' && !studentId} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {mode === 'appointment' && (
          <Select
            label="Aluno"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Selecione…"
            options={(students.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            wrapperClassName="col-span-2"
          />
        )}
        <Input label="Data" type="date" value={day} onChange={(e) => setDay(e.target.value)} wrapperClassName="col-span-2" />
        <Input label={mode === 'slots' ? 'Das' : 'Início'} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label={mode === 'slots' ? 'Até' : 'Fim'} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        {mode === 'slots' && (
          <Select
            label="Duração de cada horário"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            options={['30', '45', '60', '90'].map((v) => ({ value: v, label: `${v} minutos` }))}
            wrapperClassName="col-span-2"
          />
        )}
        <Input label="Local" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Academia, online…" wrapperClassName="col-span-2" />
        {mode === 'appointment' && <Textarea label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} wrapperClassName="col-span-2" className="min-h-16" />}
      </div>
    </Modal>
  );
}
