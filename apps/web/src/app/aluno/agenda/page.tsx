'use client';

import { APPOINTMENT_STATUS_LABELS, type Appointment } from '@personalpro/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, CalendarX2, Clock, MapPin, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Input, LoadingBlock, Modal, PageHeader, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { appointmentTone, combineLocal, fmtTime, fmtWeekdayLong, toInputDate, toInputTime } from '@/lib/format';

export default function StudentAgendaPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [range] = useState(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const [requestOpen, setRequestOpen] = useState(false);
  const [resched, setResched] = useState<Appointment | null>(null);
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const q = useQuery({ queryKey: ['appointments', 'student', range.from], queryFn: () => api<Appointment[]>('/appointments', { query: range }) });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['dashboard-student'] });
  };
  const book = useMutation({
    mutationFn: (id: string) => api(`/appointments/${id}/book`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Horário solicitado!', 'Seu personal vai confirmar em breve.');
      invalidate();
    },
    onError: (e) => toast.error('Não foi possível reservar', errorMessage(e)),
  });

  const now = Date.now();
  const all = q.data ?? [];
  const mine = all.filter((a) => a.student && a.status !== 'AVAILABLE' && new Date(a.endsAt).getTime() >= now - 86400000).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const available = all.filter((a) => a.status === 'AVAILABLE' && new Date(a.startsAt).getTime() > now);
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of available.sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
      const k = toInputDate(a.startsAt);
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()];
  }, [available]);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Reserve horários com seu personal"
        actions={
          <Button onClick={() => setRequestOpen(true)}>
            <CalendarPlus className="size-4" /> Solicitar horário
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="h-fit">
            <CardHeader title="Meus agendamentos" subtitle="Próximos 30 dias" icon={<CalendarClock className="size-4" />} />
            <CardBody>
              {mine.length === 0 ? (
                <EmptyState icon={<CalendarX2 className="size-5" />} title="Nenhum agendamento" description="Reserve um dos horários disponíveis ou solicite um horário." />
              ) : (
                <ul className="space-y-2">
                  {mine.map((a) => {
                    const active = a.status === 'REQUESTED' || a.status === 'CONFIRMED';
                    return (
                      <li key={a.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{fmtWeekdayLong(a.startsAt)}</p>
                            <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" /> {fmtTime(a.startsAt)} – {fmtTime(a.endsAt)}
                              </span>
                              {a.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3" /> {a.location}
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                        </div>
                        {a.cancelReason && <p className="mt-2 text-xs text-danger">Motivo: {a.cancelReason}</p>}
                        {active && (
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setResched(a)}>
                              <CalendarClock className="size-3.5" /> Reagendar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancel(a)}>
                              <X className="size-3.5" /> Cancelar
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Horários disponíveis" subtitle="Toque para reservar" icon={<CalendarPlus className="size-4" />} />
            <CardBody>
              {byDay.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Seu personal ainda não liberou horários. Você pode solicitar um horário.</p>
              ) : (
                <div className="space-y-4">
                  {byDay.map(([day, slots]) => (
                    <div key={day}>
                      <p className="mb-2 text-xs font-semibold text-muted">{fmtWeekdayLong(`${day}T12:00:00`)}</p>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((s) => (
                          <Button
                            key={s.id}
                            variant="outline"
                            size="sm"
                            className="tabular h-9"
                            loading={book.isPending && book.variables === s.id}
                            onClick={() => confirm(`Reservar ${fmtTime(s.startsAt)}–${fmtTime(s.endsAt)}?`) && book.mutate(s.id)}
                          >
                            {fmtTime(s.startsAt)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
      {requestOpen && <TimeModal title="Solicitar horário" onClose={() => setRequestOpen(false)} withNotes onSubmit={(b) => api('/appointments/request', { method: 'POST', body: b })} successMsg="Solicitação enviada ao seu personal" onDone={invalidate} />}
      {resched && (
        <TimeModal
          title="Reagendar"
          initial={resched}
          onClose={() => setResched(null)}
          onSubmit={(b) => api(`/appointments/${resched.id}/reschedule`, { method: 'POST', body: { startsAt: b.startsAt, endsAt: b.endsAt } })}
          successMsg="Pedido de reagendamento enviado"
          onDone={invalidate}
        />
      )}
      {cancel && <CancelModal appointment={cancel} onClose={() => setCancel(null)} onDone={invalidate} />}
    </div>
  );
}

function TimeModal({
  title,
  initial,
  withNotes,
  onClose,
  onSubmit,
  successMsg,
  onDone,
}: {
  title: string;
  initial?: Appointment;
  withNotes?: boolean;
  onClose: () => void;
  onSubmit: (b: { startsAt: string; endsAt: string; notes?: string }) => Promise<unknown>;
  successMsg: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const base = initial ? new Date(initial.startsAt) : new Date(Date.now() + 86400000);
  if (!initial) base.setHours(7, 0, 0, 0);
  const [date, setDate] = useState(toInputDate(base));
  const [start, setStart] = useState(toInputTime(base));
  const [end, setEnd] = useState(initial ? toInputTime(initial.endsAt) : toInputTime(new Date(base.getTime() + 3600000)));
  const [notes, setNotes] = useState('');
  const m = useMutation({
    mutationFn: () => onSubmit({ startsAt: combineLocal(date, start), endsAt: combineLocal(date, end), notes: notes || undefined }),
    onSuccess: () => {
      toast.success(successMsg);
      onDone();
      onClose();
    },
    onError: (e) => toast.error('Não foi possível enviar', errorMessage(e)),
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      footer={
        <Button loading={m.isPending} onClick={() => m.mutate()}>
          Enviar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} wrapperClassName="col-span-2" />
        <Input label="Início" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="Fim" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        {withNotes && <Textarea label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} wrapperClassName="col-span-2" className="min-h-16" />}
      </div>
    </Modal>
  );
}

function CancelModal({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/appointments/${appointment.id}/cancel`, { method: 'POST', body: { reason: reason || undefined } }),
    onSuccess: () => {
      toast.success('Agendamento cancelado');
      onDone();
      onClose();
    },
    onError: (e) => toast.error('Não foi possível cancelar', errorMessage(e)),
  });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Cancelar agendamento"
      description={`${fmtWeekdayLong(appointment.startsAt)} às ${fmtTime(appointment.startsAt)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>
            Cancelar agendamento
          </Button>
        </>
      }
    >
      <Textarea label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
