import { addDays, APPOINTMENT_STATUS_LABELS, startOfWeek, toDateKey, type Appointment, type AppointmentStatus, type StudentListItem } from '@personalpro/shared';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CalendarMonth } from '@/components/CalendarMonth';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Avatar, Badge, Button, Card, Chips, EmptyState, Input, QueryState, Row, Section, Segmented, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { combineLocal, fmtTime, isoToBrDate, parseBrDate, WEEKDAYS_LONG } from '@/lib/format';
import { useTheme } from '@/theme';

type Role = 'STUDENT' | 'TRAINER';

const STATUS_TONE: Record<AppointmentStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'> = {
  AVAILABLE: 'accent',
  REQUESTED: 'warning',
  CONFIRMED: 'success',
  CANCELED: 'danger',
  COMPLETED: 'info',
};

type FormKind = 'request' | 'reschedule' | 'slots' | 'appointment';

export function AgendaView({ role }: { role: Role }) {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => toDateKey(new Date()));
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [form, setForm] = useState<{ kind: FormKind; appointment?: Appointment } | null>(null);

  // Janela: mês exibido (+ semana selecionada, que pode cruzar meses).
  const from = startOfWeek(new Date(Math.min(new Date(month.getFullYear(), month.getMonth(), 1).getTime(), new Date(`${selected}T00:00:00`).getTime())));
  const to = addDays(new Date(Math.max(new Date(month.getFullYear(), month.getMonth() + 1, 0).getTime(), new Date(`${selected}T00:00:00`).getTime())), 8);
  const q = useApi<Appointment[]>(['appointments', toDateKey(from), toDateKey(to)], '/appointments', { from: from.toISOString(), to: to.toISOString() });

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of q.data ?? []) {
      const k = toDateKey(a.startsAt);
      map.set(k, [...(map.get(k) ?? []), a].sort((x, y) => x.startsAt.localeCompare(y.startsAt)));
    }
    return map;
  }, [q.data]);
  const dots = useMemo(() => new Set([...byDay.entries()].filter(([, v]) => v.some((a) => a.status !== 'CANCELED')).map(([k]) => k)), [byDay]);

  const days = mode === 'day' ? [selected] : Array.from({ length: 7 }, (_, i) => toDateKey(addDays(startOfWeek(new Date(`${selected}T12:00:00`)), i)));

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      await invalidate(['appointments'], ['dashboard']);
      if (success) notify(success);
    } catch (e) {
      notifyError(e);
    }
  };

  const actions = (a: Appointment) => {
    const list: { label: string; icon: Parameters<typeof Button>[0]['icon']; variant?: 'primary' | 'secondary' | 'danger'; onPress: () => void }[] = [];
    const future = new Date(a.endsAt).getTime() > Date.now();
    if (role === 'STUDENT') {
      if (a.status === 'AVAILABLE' && future)
        list.push({ label: 'Reservar', icon: 'check', variant: 'primary', onPress: () => act(() => api.post(`/appointments/${a.id}/book`, {}), 'Horário reservado!') });
      if ((a.status === 'CONFIRMED' || a.status === 'REQUESTED') && future) {
        list.push({ label: 'Remarcar', icon: 'repeat', onPress: () => setForm({ kind: 'reschedule', appointment: a }) });
        list.push({ label: 'Cancelar', icon: 'x', variant: 'danger', onPress: () => cancel(a) });
      }
    } else {
      if (a.status === 'REQUESTED') list.push({ label: 'Confirmar', icon: 'check', variant: 'primary', onPress: () => act(() => api.post(`/appointments/${a.id}/confirm`), 'Agendamento confirmado') });
      if (a.status === 'CONFIRMED') list.push({ label: 'Concluir', icon: 'check-circle', variant: 'primary', onPress: () => act(() => api.post(`/appointments/${a.id}/complete`)) });
      if (a.status !== 'CANCELED' && a.status !== 'COMPLETED') {
        list.push({ label: 'Remarcar', icon: 'repeat', onPress: () => setForm({ kind: 'reschedule', appointment: a }) });
        if (a.status === 'AVAILABLE')
          list.push({
            label: 'Excluir',
            icon: 'trash',
            variant: 'danger',
            onPress: async () => {
              if (await confirm('Excluir horário', 'Remover este horário disponível?', { confirmText: 'Excluir', destructive: true }))
                await act(() => api.delete(`/appointments/${a.id}`));
            },
          });
        else list.push({ label: 'Cancelar', icon: 'x', variant: 'danger', onPress: () => cancel(a) });
      }
    }
    return list;
  };

  const cancel = async (a: Appointment) => {
    if (!(await confirm('Cancelar agendamento', `Cancelar o horário das ${fmtTime(a.startsAt)}?`, { confirmText: 'Cancelar horário', destructive: true }))) return;
    await act(() => api.post(`/appointments/${a.id}/cancel`, { reason: role === 'STUDENT' ? 'Cancelado pelo aluno' : 'Cancelado pelo professor' }), 'Agendamento cancelado');
  };

  return (
    <View>
      <Card>
        <CalendarMonth month={month} onChangeMonth={setMonth} selected={selected} onSelect={setSelected} dots={dots} />
      </Card>
      <Row gap={10} style={{ marginTop: 12 }}>
        {role === 'STUDENT' ? (
          <View style={{ flex: 1 }}>
            <Button title="Solicitar horário" icon="plus" size="sm" variant="secondary" onPress={() => setForm({ kind: 'request' })} />
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Button title="Horários livres" icon="plus" size="sm" variant="secondary" onPress={() => setForm({ kind: 'slots' })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Agendar aluno" icon="user-plus" size="sm" onPress={() => setForm({ kind: 'appointment' })} />
            </View>
          </>
        )}
      </Row>

      <Section title={mode === 'day' ? `${WEEKDAYS_LONG[new Date(`${selected}T12:00:00`).getDay()]}, ${isoToBrDate(selected).slice(0, 5)}` : 'Semana'}>
        <Segmented
          options={[
            { value: 'day', label: 'Dia' },
            { value: 'week', label: 'Semana' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <QueryState query={q}>
          {days.map((day) => {
            const items = byDay.get(day) ?? [];
            if (mode === 'week' && !items.length) return null;
            return (
              <View key={day} style={{ marginBottom: 12 }}>
                {mode === 'week' ? (
                  <T variant="caption" tone="muted" style={{ marginBottom: 6 }}>
                    {WEEKDAYS_LONG[new Date(`${day}T12:00:00`).getDay()]} · {isoToBrDate(day).slice(0, 5)}
                  </T>
                ) : null}
                {items.length ? (
                  <View style={{ gap: 10 }}>
                    {items.map((a) => (
                      <Card key={a.id} style={a.status === 'AVAILABLE' ? { borderStyle: 'dashed', borderColor: colors.accent, borderWidth: 1 } : undefined}>
                        <Row gap={12} align="flex-start">
                          <View style={{ width: 56 }}>
                            <T variant="h3">{fmtTime(a.startsAt)}</T>
                            <T variant="small" tone="muted">
                              {fmtTime(a.endsAt)}
                            </T>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            {a.status === 'AVAILABLE' ? (
                              <T variant="bodyStrong" tone="accent">
                                {fmtTime(a.startsAt)} — horário disponível
                              </T>
                            ) : (
                              <Row gap={8}>
                                {role === 'TRAINER' && a.student ? <Avatar name={a.student.name} url={a.student.avatarUrl} size={24} /> : null}
                                <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                                  {role === 'TRAINER' ? (a.student?.name ?? 'Sem aluno') : `Sessão com ${a.trainer.name}`}
                                </T>
                              </Row>
                            )}
                            <Badge label={APPOINTMENT_STATUS_LABELS[a.status]} tone={STATUS_TONE[a.status]} />
                            {a.location ? (
                              <Row gap={4}>
                                <Icon name="map-pin" size={13} color={colors.textMuted} />
                                <T variant="small" tone="muted">
                                  {a.location}
                                </T>
                              </Row>
                            ) : null}
                            {a.notes ? (
                              <T variant="small" tone="secondary">
                                {a.notes}
                              </T>
                            ) : null}
                            {a.cancelReason ? (
                              <T variant="small" tone="danger">
                                Motivo: {a.cancelReason}
                              </T>
                            ) : null}
                          </View>
                        </Row>
                        {actions(a).length ? (
                          <Row gap={8} wrap style={{ marginTop: 12 }}>
                            {actions(a).map((b) => (
                              <Button key={b.label} title={b.label} icon={b.icon} size="sm" full={false} variant={b.variant ?? 'secondary'} onPress={b.onPress} />
                            ))}
                          </Row>
                        ) : null}
                      </Card>
                    ))}
                  </View>
                ) : (
                  <EmptyState icon="calendar" title="Nenhum horário neste dia" message={role === 'STUDENT' ? 'Solicite um horário ao seu professor.' : 'Crie horários disponíveis para seus alunos.'} />
                )}
              </View>
            );
          })}
          {mode === 'week' && days.every((d) => !(byDay.get(d) ?? []).length) ? <EmptyState icon="calendar" title="Semana livre" /> : null}
        </QueryState>
      </Section>

      <AppointmentForm form={form} defaultDay={selected} onClose={() => setForm(null)} onDone={() => invalidate(['appointments'], ['dashboard'])} />
    </View>
  );
}

function AppointmentForm({
  form,
  defaultDay,
  onClose,
  onDone,
}: {
  form: { kind: FormKind; appointment?: Appointment } | null;
  defaultDay: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const kind = form?.kind;
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const students = useApi<StudentListItem[]>(['students', 'list', 'ACTIVE'], kind === 'appointment' ? '/students' : null, { status: 'ACTIVE' });

  // Reinicia os campos ao abrir.
  const key = form ? `${form.kind}-${form.appointment?.id ?? ''}-${defaultDay}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (form) {
      const a = form.appointment;
      setDate(isoToBrDate(a ? toDateKey(a.startsAt) : defaultDay));
      setStart(a ? fmtTime(a.startsAt) : kind === 'slots' ? '08:00' : '10:00');
      setEnd(a ? fmtTime(a.endsAt) : kind === 'slots' ? '12:00' : '11:00');
      setDuration(60);
      setLocation('');
      setNotes('');
      setStudentId(null);
    }
  }

  const title =
    kind === 'request' ? 'Solicitar horário' : kind === 'reschedule' ? 'Remarcar' : kind === 'slots' ? 'Criar horários disponíveis' : 'Agendar aluno';

  const submit = async () => {
    const dk = parseBrDate(date);
    const s = dk ? combineLocal(dk, start) : null;
    const e = dk ? combineLocal(dk, end) : null;
    if (!s || !e || e <= s) {
      notify('Data/horário inválidos', 'Use o formato dd/mm/aaaa e HH:mm, com fim após o início.');
      return;
    }
    setLoading(true);
    try {
      if (kind === 'request') await api.post('/appointments/request', { startsAt: s.toISOString(), endsAt: e.toISOString(), notes: notes.trim() || undefined });
      else if (kind === 'reschedule') await api.post(`/appointments/${form!.appointment!.id}/reschedule`, { startsAt: s.toISOString(), endsAt: e.toISOString() });
      else if (kind === 'slots')
        await api.post('/appointments/slots', { startsAt: s.toISOString(), endsAt: e.toISOString(), durationMinutes: duration, location: location.trim() || undefined });
      else {
        if (!studentId) {
          notify('Selecione o aluno');
          setLoading(false);
          return;
        }
        await api.post('/appointments', { studentId, startsAt: s.toISOString(), endsAt: e.toISOString(), location: location.trim() || undefined, notes: notes.trim() || undefined });
      }
      onDone();
      onClose();
      notify(kind === 'request' ? 'Solicitação enviada ao professor' : kind === 'slots' ? 'Horários criados' : 'Agenda atualizada');
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet visible={!!form} onClose={onClose} title={title}>
      {kind === 'appointment' ? (
        <QueryState query={students}>
          <Chips label="Aluno" scroll options={(students.data ?? []).map((s) => ({ value: s.id, label: s.name }))} value={studentId} onChange={setStudentId} />
        </QueryState>
      ) : null}
      <Input label="Data" value={date} onChangeText={setDate} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" icon="calendar" />
      <Row gap={10} align="flex-start">
        <View style={{ flex: 1 }}>
          <Input label={kind === 'slots' ? 'Das' : 'Início'} value={start} onChangeText={setStart} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={kind === 'slots' ? 'Até' : 'Fim'} value={end} onChangeText={setEnd} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
        </View>
      </Row>
      {kind === 'slots' ? (
        <Chips
          label="Duração de cada horário"
          options={[30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))}
          value={duration}
          onChange={(v) => v && setDuration(v)}
        />
      ) : null}
      {kind === 'slots' || kind === 'appointment' ? <Input label="Local (opcional)" value={location} onChangeText={setLocation} icon="map-pin" /> : null}
      {kind === 'request' || kind === 'appointment' ? <Input label="Observações (opcional)" value={notes} onChangeText={setNotes} multiline /> : null}
      <Button title={kind === 'request' ? 'Enviar solicitação' : 'Salvar'} onPress={submit} loading={loading} />
    </Sheet>
  );
}
