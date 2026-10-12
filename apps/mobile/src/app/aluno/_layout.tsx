import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function StudentLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="executar/[workoutId]" options={{ gestureEnabled: false }} />
      <Stack.Screen name="resumo/[sessionId]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
