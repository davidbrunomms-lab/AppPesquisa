import { BODY_MEASUREMENT_KEYS, BODY_MEASUREMENT_LABELS, formatDelta, PHOTO_ANGLE_LABELS, type AssessmentComparison } from '@personalpro/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Badge, Card, Divider, EmptyState, QueryState, Row, Screen, Section, T } from '@/components/ui';
import { useApi } from '@/features/hooks';
import { absoluteUrl } from '@/lib/config';
import { fmtDate, fmtNumber } from '@/lib/format';
import { useTheme } from '@/theme';

const MAIN: { key: keyof AssessmentComparison['deltas']; label: string; unit: string; lowerIsBetter: boolean }[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', lowerIsBetter: true },
  { key: 'bmi', label: 'IMC', unit: '', lowerIsBetter: true },
  { key: 'bodyFatPct', label: '% Gordura', unit: '%', lowerIsBetter: true },
  { key: 'muscleMassKg', label: 'Massa muscular', unit: 'kg', lowerIsBetter: false },
  { key: 'leanMassKg', label: 'Massa magra', unit: 'kg', lowerIsBetter: false },
  { key: 'visceralFat', label: 'Gordura visceral', unit: '', lowerIsBetter: true },
];

/** ANTES x DEPOIS: fotos lado a lado por ângulo + diferenças. */
export default function CompareScreen() {
  const { before, after } = useLocalSearchParams<{ before: string; after: string }>();
  const { colors } = useTheme();
  const q = useApi<AssessmentComparison>(['assessments', 'compare', before, after], before && after ? '/assessments/compare' : null, { before, after });
  const c = q.data;

  return (
    <Screen title="Antes x Depois" back>
      <QueryState query={q}>
        {c ? (
          <>
            <Row gap={10}>
              <Card style={{ flex: 1, alignItems: 'center' }} padding={12}>
                <T variant="caption" tone="muted">
                  Antes
                </T>
                <T variant="h3">{fmtDate(c.before.assessedAt)}</T>
              </Card>
              <Card style={{ flex: 1, alignItems: 'center', borderColor: colors.accent, borderWidth: 1 }} padding={12}>
                <T variant="caption" tone="accent">
                  Depois
                </T>
                <T variant="h3">{fmtDate(c.after.assessedAt)}</T>
              </Card>
            </Row>

            <Section title="Fotos">
              {c.photos.some((p) => p.before || p.after) ? (
                <View style={{ gap: 14 }}>
                  {c.photos
                    .filter((p) => p.before || p.after)
                    .map((p) => (
                      <View key={p.angle}>
                        <T variant="caption" tone="muted" style={{ marginBottom: 6 }}>
                          {PHOTO_ANGLE_LABELS[p.angle]}
                        </T>
                        <Row gap={10}>
                          {[p.before, p.after].map((url, i) => (
                            <View key={i} style={{ flex: 1, aspectRatio: 3 / 4, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                              {url ? (
                                <Image source={{ uri: absoluteUrl(url) ?? undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                              ) : (
                                <T variant="small" tone="muted">
                                  Sem foto
                                </T>
                              )}
                            </View>
                          ))}
                        </Row>
                      </View>
                    ))}
                </View>
              ) : (
                <EmptyState icon="camera" title="Sem fotos" message="Adicione fotos às avaliações para comparar visualmente." />
              )}
            </Section>

            <Section title="Composição corporal">
              <Card padding={12}>
                {MAIN.map((m, i) => {
                  const b = c.before[m.key as 'weightKg'];
                  const a = c.after[m.key as 'weightKg'];
                  const d = c.deltas[m.key] as number | null;
                  if (b === null && a === null) return null;
                  return (
                    <View key={m.key}>
                      {i > 0 ? <Divider /> : null}
                      <DeltaRow label={m.label} before={b} after={a} delta={d} unit={m.unit} lowerIsBetter={m.lowerIsBetter} />
                    </View>
                  );
                })}
              </Card>
            </Section>

            <Section title="Medidas (cm)">
              <Card padding={12}>
                {BODY_MEASUREMENT_KEYS.map((k) => {
                  const b = c.before.measurements?.[k] ?? null;
                  const a = c.after.measurements?.[k] ?? null;
                  if (b === null && a === null) return null;
                  return <DeltaRow key={k} label={BODY_MEASUREMENT_LABELS[k]} before={b} after={a} delta={c.deltas.measurements[k]} unit="cm" lowerIsBetter={['waist', 'abdomen', 'hip'].includes(k)} />;
                })}
              </Card>
            </Section>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

function DeltaRow({ label, before, after, delta, unit, lowerIsBetter }: { label: string; before: number | null; after: number | null; delta: number | null; unit: string; lowerIsBetter: boolean }) {
  const good = delta === null || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <Row justify="space-between" style={{ paddingVertical: 10 }}>
      <T variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </T>
      <T tone="secondary" style={{ width: 120, textAlign: 'right' }}>
        {fmtNumber(before)} → {fmtNumber(after)}
      </T>
      <View style={{ width: 92, alignItems: 'flex-end' }}>
        {delta !== null ? <Badge label={formatDelta(delta, unit)} tone={good === null ? 'neutral' : good ? 'success' : 'warning'} /> : <T tone="muted">—</T>}
      </View>
    </Row>
  );
}
