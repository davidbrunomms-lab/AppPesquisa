import { Tabs } from 'expo-router/js-tabs';
import { tabIcon } from '@/components/TabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export default function StudentTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="treinos" options={{ title: 'Treinos', tabBarIcon: tabIcon('dumbbell') }} />
      <Tabs.Screen name="evolucao" options={{ title: 'Evolução', tabBarIcon: tabIcon('trending-up') }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
