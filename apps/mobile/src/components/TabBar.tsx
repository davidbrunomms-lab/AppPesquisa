import type { ColorValue } from 'react-native';
import { Icon, type IconName } from './Icon';

export const tabIcon =
  (name: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => <Icon name={name} color={color} size={23} strokeWidth={focused ? 2.4 : 1.9} />;
