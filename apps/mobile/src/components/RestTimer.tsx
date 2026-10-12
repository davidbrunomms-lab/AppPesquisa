import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { formatDuration } from '@personalpro/shared';
import { useTheme } from '@/theme';
import { ProgressRing } from './ProgressRing';
import { Button, Card, Row, T } from './ui';

export function haptic(kind: 'success' | 'light' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  } catch {
    // sem suporte
  }
}

/** Cronômetro de descanso entre séries ("Descanso: 60 segundos") com PULAR DESCANSO. */
export function RestTimer({ seconds, onFinish }: { seconds: number; onFinish: () => void }) {
  const { colors } = useTheme();
  const [total, setTotal] = useState(seconds);
  const endAt = useRef(Date.now() + seconds * 1000);
  const [remaining, setRemaining] = useState(seconds);
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 3 || left === 2 || left === 1) haptic('light');
      if (left <= 0 && !done.current) {
        done.current = true;
        haptic('success');
        onFinish();
      }
    }, 250);
    return () => clearInterval(id);
  }, [onFinish]);

  const add = (delta: number) => {
    endAt.current += delta * 1000;
    setTotal((t) => Math.max(1, t + delta));
    setRemaining(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)));
  };

  return (
    <Card elevated style={{ alignItems: 'center', gap: 12, borderColor: colors.accent, borderWidth: 1 }}>
      <T variant="caption" tone="accent">
        Descanso: {seconds} segundos
      </T>
      <ProgressRing value={(remaining / total) * 100} size={150} stroke={12}>
        <T variant="display">{formatDuration(remaining)}</T>
        <T variant="small" tone="muted">
          restantes
        </T>
      </ProgressRing>
      <Row gap={10} style={{ alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <Button title="−15s" variant="secondary" onPress={() => add(-15)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="+15s" variant="secondary" onPress={() => add(15)} />
        </View>
      </Row>
      <Button
        title="PULAR DESCANSO"
        icon="skip-forward"
        onPress={() => {
          done.current = true;
          onFinish();
        }}
      />
    </Card>
  );
}
