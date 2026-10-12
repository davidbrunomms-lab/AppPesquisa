import { toDateKey } from '@personalpro/shared';
import { Pressable, Text, View } from 'react-native';
import { MONTHS } from '@/lib/format';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { Row, T } from './ui';

const WEEK_HEADER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Calendário mensal (semana começando na segunda) com dias marcados. */
export function CalendarMonth({
  month,
  onChangeMonth,
  marked,
  selected,
  onSelect,
  dots,
}: {
  month: Date;
  onChangeMonth: (d: Date) => void;
  /** Dias "aaaa-mm-dd" destacados (ex.: dias treinados). */
  marked?: Set<string>;
  /** Dias com marcador pequeno (ex.: agendamentos). */
  dots?: Set<string>;
  selected?: string;
  onSelect?: (dateKey: string) => void;
}) {
  const { colors } = useTheme();
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = toDateKey(new Date());

  return (
    <View>
      <Row justify="space-between" style={{ marginBottom: 12 }}>
        <Pressable accessibilityLabel="Mês anterior" hitSlop={10} onPress={() => onChangeMonth(new Date(year, m - 1, 1))}>
          <Icon name="chevron-left" color={colors.text} />
        </Pressable>
        <T variant="h3">
          {MONTHS[m]} {year}
        </T>
        <Pressable accessibilityLabel="Próximo mês" hitSlop={10} onPress={() => onChangeMonth(new Date(year, m + 1, 1))}>
          <Icon name="chevron-right" color={colors.text} />
        </Pressable>
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {WEEK_HEADER.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingBottom: 6 }}>
            <T variant="caption" tone="muted">
              {d}
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const key = toDateKey(new Date(year, m, day));
          const isMarked = marked?.has(key);
          const isSelected = selected === key;
          const isToday = key === today;
          return (
            <Pressable
              key={i}
              onPress={onSelect ? () => onSelect(key) : undefined}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isMarked ? colors.accent : isSelected ? colors.surfaceMuted : 'transparent',
                  borderWidth: isToday || isSelected ? 1.5 : 0,
                  borderColor: isSelected ? colors.text : colors.accent,
                }}
              >
                <Text style={{ color: isMarked ? colors.onAccent : colors.text, fontWeight: isMarked || isToday ? '800' : '500', fontSize: 13 }}>
                  {day}
                </Text>
                {dots?.has(key) ? (
                  <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: isMarked ? colors.onAccent : colors.accent }} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
