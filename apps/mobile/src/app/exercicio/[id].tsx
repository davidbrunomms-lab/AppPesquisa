import { MUSCLE_GROUP_LABELS, type Exercise } from '@personalpro/shared';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { ExerciseMedia } from '@/components/Media';
import { Badge, Card, QueryState, Row, Screen, Section, T } from '@/components/ui';
import { useApi } from '@/features/hooks';
import { useTheme } from '@/theme';

/** Detalhe do exercício: imagem/vídeo, instruções e erros comuns. */
export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const q = useApi<Exercise>(['exercise', id], id ? `/exercises/${id}` : null);
  const e = q.data;
  return (
    <Screen title={e?.name ?? 'Exercício'} back>
      <QueryState query={q}>
        {e ? (
          <>
            <ExerciseMedia imageUrl={e.imageUrl} videoUrl={e.videoUrl} height={240} />
            <Row gap={8} wrap style={{ marginTop: 14 }}>
              <Badge label={MUSCLE_GROUP_LABELS[e.muscleGroup]} tone="accent" />
              {e.equipment ? <Badge label={e.equipment} /> : null}
              {e.trainerId ? <Badge label="Personalizado" tone="info" /> : null}
            </Row>
            {e.description ? (
              <T tone="secondary" style={{ marginTop: 12 }}>
                {e.description}
              </T>
            ) : null}
            {e.instructions.length ? (
              <Section title="Como executar">
                <Card style={{ gap: 12 }}>
                  {e.instructions.map((step, i) => (
                    <Row key={i} gap={12} align="flex-start">
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <T variant="small" tone="accent" style={{ fontWeight: '800' }}>
                          {i + 1}
                        </T>
                      </View>
                      <T style={{ flex: 1 }}>{step}</T>
                    </Row>
                  ))}
                </Card>
              </Section>
            ) : null}
            {e.commonMistakes.length ? (
              <Section title="Erros comuns">
                <Card style={{ gap: 10 }}>
                  {e.commonMistakes.map((m, i) => (
                    <Row key={i} gap={10} align="flex-start">
                      <Icon name="x" size={18} color={colors.danger} />
                      <T style={{ flex: 1 }}>{m}</T>
                    </Row>
                  ))}
                </Card>
              </Section>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
