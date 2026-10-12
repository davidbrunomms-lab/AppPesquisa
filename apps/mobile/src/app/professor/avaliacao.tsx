import { BODY_MEASUREMENT_KEYS, BODY_MEASUREMENT_LABELS, bmiCategory, calculateBmi, type Assessment, type BodyMeasurementKey, type StudentDetail } from '@personalpro/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Input, Loading, Row, Screen, Section, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { notify, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { fmtNumber, isoDateOnly, isoToBrDate, numToText, parseBrDate, parseNum } from '@/lib/format';

const MAIN = [
  { key: 'weightKg', label: 'Peso', suffix: 'kg' },
  { key: 'heightCm', label: 'Altura', suffix: 'cm' },
  { key: 'bodyFatPct', label: '% Gordura', suffix: '%' },
  { key: 'muscleMassKg', label: 'Massa muscular', suffix: 'kg' },
  { key: 'leanMassKg', label: 'Massa magra', suffix: 'kg' },
  { key: 'visceralFat', label: 'Gordura visceral', suffix: '' },
] as const;
type MainKey = (typeof MAIN)[number]['key'];

/** Avaliação física completa (criar, ou registrar uma avaliação agendada). */
export default function AssessmentFormScreen() {
  const { studentId, id } = useLocalSearchParams<{ studentId: string; id?: string }>();
  const invalidate = useInvalidate();
  const student = useApi<StudentDetail>(['student', studentId], studentId ? `/students/${studentId}` : null);
  const existing = useApi<Assessment>(['assessment', id], id ? `/assessments/${id}` : null);
  const [date, setDate] = useState(isoToBrDate(isoDateOnly(new Date().toISOString())));
  const [main, setMain] = useState<Record<MainKey, string>>({ weightKg: '', heightCm: '', bodyFatPct: '', muscleMassKg: '', leanMassKg: '', visceralFat: '' });
  const [measures, setMeasures] = useState<Record<BodyMeasurementKey, string>>(
    Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, ''])) as Record<BodyMeasurementKey, string>,
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (id && existing.data) {
      const a = existing.data;
      setMain({
        weightKg: numToText(a.weightKg),
        heightCm: numToText(a.heightCm ?? student.data?.heightCm),
        bodyFatPct: numToText(a.bodyFatPct),
        muscleMassKg: numToText(a.muscleMassKg),
        leanMassKg: numToText(a.leanMassKg),
        visceralFat: numToText(a.visceralFat),
      });
      if (a.measurements) setMeasures(Object.fromEntries(BODY_MEASUREMENT_KEYS.map((k) => [k, numToText(a.measurements?.[k])])) as Record<BodyMeasurementKey, string>);
      setNotes(a.notes ?? '');
      if (a.assessedAt) setDate(isoToBrDate(isoDateOnly(a.assessedAt)));
      setHydrated(true);
    } else if (!id && student.data) {
      setMain((m) => ({ ...m, heightCm: numToText(student.data?.heightCm), weightKg: numToText(student.data?.currentWeightKg) }));
      setHydrated(true);
    }
  }, [id, existing.data, student.data, hydrated]);

  const weight = parseNum(main.weightKg);
  const height = parseNum(main.heightCm);
  const bmi = weight && height ? calculateBmi(weight, height) : null;

  const submit = async () => {
    const assessedAt = parseBrDate(date);
    if (!assessedAt) return notify('Data inválida', 'Use dd/mm/aaaa.');
    const measurements = Object.fromEntries(
      BODY_MEASUREMENT_KEYS.map((k) => [k, parseNum(measures[k])]).filter(([, v]) => v !== undefined),
    );
    const body = {
      assessedAt: new Date(`${assessedAt}T12:00:00`).toISOString(),
      ...Object.fromEntries(MAIN.map((m) => [m.key, parseNum(main[m.key])]).filter(([, v]) => v !== undefined)),
      notes: notes.trim() || undefined,
      measurements: Object.keys(measurements).length ? measurements : undefined,
    };
    setLoading(true);
    try {
      if (id) await api.patch(`/assessments/${id}`, { ...body, status: 'COMPLETED' });
      else await api.post('/assessments', { ...body, studentId });
      await invalidate(['assessments'], ['progress'], ['student', studentId], ['dashboard'], ['goals']);
      notify('Avaliação salva', 'Use o ícone de câmera na lista para adicionar fotos.');
      router.back();
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };

  if ((id && existing.isLoading) || student.isLoading) {
    return (
      <Screen title="Avaliação física" back>
        <Loading />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        title={id ? 'Registrar avaliação' : 'Nova avaliação'}
        subtitle={student.data?.name}
        back
        footer={<Button title="Salvar avaliação" icon="check" size="lg" onPress={submit} loading={loading} />}
      >
        <Input label="Data da avaliação" value={date} onChangeText={setDate} placeholder="dd/mm/aaaa" icon="calendar" />
        <Section title="Composição corporal" style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
            {MAIN.map((m) => (
              <View key={m.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <Input label={m.label} value={main[m.key]} onChangeText={(t) => setMain((s) => ({ ...s, [m.key]: t }))} keyboardType="decimal-pad" suffix={m.suffix} />
              </View>
            ))}
          </View>
          {bmi ? (
            <Card>
              <Row justify="space-between">
                <T tone="secondary">IMC calculado</T>
                <T variant="h3" tone="accent">
                  {fmtNumber(bmi)} · {bmiCategory(bmi)}
                </T>
              </Row>
            </Card>
          ) : null}
        </Section>
        <Section title="Medidas corporais (cm)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
            {BODY_MEASUREMENT_KEYS.map((k) => (
              <View key={k} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <Input label={BODY_MEASUREMENT_LABELS[k]} value={measures[k]} onChangeText={(t) => setMeasures((s) => ({ ...s, [k]: t }))} keyboardType="decimal-pad" suffix="cm" />
              </View>
            ))}
          </View>
        </Section>
        <Section title="Observações">
          <Input value={notes} onChangeText={setNotes} multiline placeholder="Postura, limitações, protocolo utilizado…" />
        </Section>
      </Screen>
    </KeyboardAvoidingView>
  );
}
