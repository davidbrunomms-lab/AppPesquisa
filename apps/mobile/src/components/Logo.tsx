import { Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';

export function Logo({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' }}>
      <View
        style={{
          width: size * 1.4,
          height: size * 1.4,
          borderRadius: size * 0.4,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-8deg' }],
        }}
      >
        <Icon name="dumbbell" size={size * 0.9} color={colors.onAccent} strokeWidth={2.6} />
      </View>
      <Text style={{ color: colors.text, fontSize: size, fontWeight: '900', letterSpacing: -1 }}>
        Personal<Text style={{ color: colors.accent }}>Pro</Text>
      </Text>
    </View>
  );
}
