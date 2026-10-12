import { Image } from 'expo-image';
import { router } from 'expo-router';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { absoluteUrl } from '@/lib/config';
import { initials } from '@/lib/format';
import { MAX_CONTENT_WIDTH, useTheme, type Colors } from '@/theme';
import { Icon, type IconName } from './Icon';

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'number';
type Tone = 'default' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'onAccent' | 'info';

export function toneColor(colors: Colors, tone: Tone) {
  switch (tone) {
    case 'secondary':
      return colors.textSecondary;
    case 'muted':
      return colors.textMuted;
    case 'accent':
      return colors.accent;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.info;
    case 'onAccent':
      return colors.onAccent;
    default:
      return colors.text;
  }
}

export function T({
  variant = 'body',
  tone = 'default',
  style,
  center,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; center?: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <Text
      {...rest}
      style={[typography[variant], { color: toneColor(colors, tone) }, center && { textAlign: 'center' }, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Row({
  children,
  gap = 8,
  style,
  align = 'center',
  justify,
  wrap,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, gap, justifyContent: justify }, wrap && { flexWrap: 'wrap' }, style]}>
      {children}
    </View>
  );
}

export function Spacer({ size = 16 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

interface ScreenProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  padded?: boolean;
  /** Para telas dentro das abas (sem margem inferior extra). */
  edgeBottom?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Contêiner padrão: área segura, cabeçalho, rolagem, pull-to-refresh e largura máxima em tablets. */
export function Screen({
  title,
  subtitle,
  back,
  onBack,
  right,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  footer,
  padded = true,
  edgeBottom = true,
  contentStyle,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const header =
    title || back || right ? (
      <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={10}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Icon name="chevron-left" color={colors.text} size={22} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {title ? (
            <T variant={back ? 'h2' : 'h1'} numberOfLines={1}>
              {title}
            </T>
          ) : null}
          {subtitle ? (
            <T variant="small" tone="secondary" numberOfLines={1}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const inner = (
    <View style={[styles.inner, !scroll && { flex: 1 }, padded && { paddingHorizontal: spacing.lg }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.maxWidth}>{header}</View>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: (edgeBottom ? insets.bottom : 0) + 32, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
            ) : undefined
          }
        >
          <View style={styles.maxWidth}>{inner}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, styles.maxWidth]}>{inner}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <View style={[styles.maxWidth, { paddingHorizontal: spacing.lg }]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function Section({
  title,
  action,
  onAction,
  children,
  style,
}: {
  title?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: 24 }, style]}>
      {title ? (
        <Row justify="space-between" style={{ marginBottom: 12 }}>
          <T variant="h3">{title}</T>
          {action ? (
            <Pressable onPress={onAction} hitSlop={8}>
              <T variant="small" tone="accent" style={{ fontWeight: '700' }}>
                {action}
              </T>
            </Pressable>
          ) : null}
        </Row>
      ) : null}
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  elevated,
  accent,
  padding = 16,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
  accent?: boolean;
  padding?: number;
}) {
  const { colors, radius } = useTheme();
  const base: ViewStyle = {
    backgroundColor: accent ? colors.accent : elevated ? colors.surfaceElevated : colors.surface,
    borderRadius: radius.lg,
    borderWidth: accent ? 0 : StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
  full = true,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}) {
  const { colors, radius } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.surfaceElevated, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.accent },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    outline: { bg: 'transparent', fg: colors.text, border: colors.border },
  };
  const p = palette[variant];
  const height = size === 'lg' ? 58 : size === 'sm' ? 38 : 50;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} color={p.fg} size={size === 'sm' ? 16 : 20} /> : null}
          <Text
            style={{
              color: p.fg,
              fontSize: size === 'lg' ? 16 : size === 'sm' ? 13 : 15,
              fontWeight: '800',
              letterSpacing: size === 'lg' ? 0.6 : 0.2,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  badge,
  label,
  tone = 'default',
  size = 42,
}: {
  icon: IconName;
  onPress?: () => void;
  badge?: number;
  label: string;
  tone?: 'default' | 'accent' | 'danger';
  size?: number;
}) {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accent : tone === 'danger' ? colors.dangerSoft : colors.surfaceElevated;
  const fg = tone === 'accent' ? colors.onAccent : tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, backgroundColor: bg, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} color={fg} size={size * 0.48} />
      {badge ? (
        <View style={[styles.badgeDot, { backgroundColor: colors.danger, borderColor: colors.background }]}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

export const Input = forwardRef<
  TextInput,
  TextInputProps & { label?: string; error?: string | null; hint?: string; icon?: IconName; suffix?: string; containerStyle?: StyleProp<ViewStyle> }
>(function Input({ label, error, hint, icon, suffix, containerStyle, secureTextEntry, style, multiline, ...rest }, ref) {
  const { colors, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[{ marginBottom: 14 }, containerStyle]}>
      {label ? (
        <T variant="small" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
          {label}
        </T>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
          paddingHorizontal: 14,
          minHeight: multiline ? 96 : 50,
          gap: 10,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          secureTextEntry={secureTextEntry && hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            { flex: 1, color: colors.text, fontSize: 15, paddingVertical: multiline ? 12 : 0, minHeight: multiline ? 96 : 48 },
            multiline && { textAlignVertical: 'top' },
            style as StyleProp<TextStyle>,
          ]}
          {...rest}
        />
        {suffix ? <T tone="muted">{suffix}</T> : null}
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}>
            <Icon name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <T variant="small" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </T>
      ) : hint ? (
        <T variant="small" tone="muted" style={{ marginTop: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
});

export interface Option<V extends string | number> {
  value: V;
  label: string;
}

/** Seletor em chips (horizontal com rolagem ou quebra de linha). */
export function Chips<V extends string | number>({
  options,
  value,
  onChange,
  label,
  scroll,
  allowClear,
}: {
  options: readonly Option<V>[];
  value: V | null | undefined;
  onChange: (v: V | null) => void;
  label?: string;
  scroll?: boolean;
  allowClear?: boolean;
}) {
  const { colors, radius } = useTheme();
  const items = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={String(o.value)}
        onPress={() => onChange(active && allowClear ? null : o.value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={{
          paddingHorizontal: 14,
          height: 36,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.accent : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
        }}
      >
        <Text style={{ color: active ? colors.onAccent : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <T variant="small" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          {label}
        </T>
      ) : null}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {items}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items}</View>
      )}
    </View>
  );
}

/** Seleção múltipla em chips. */
export function MultiChips<V extends string | number>({
  options,
  values,
  onChange,
  label,
}: {
  options: readonly Option<V>[];
  values: V[];
  onChange: (v: V[]) => void;
  label?: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <T variant="small" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          {label}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const active = values.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(active ? values.filter((v) => v !== o.value) : [...values, o.value])}
              style={{
                paddingHorizontal: 12,
                height: 36,
                minWidth: 44,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.accentSoft : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
              }}
            >
              <Text style={{ color: active ? colors.accent : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? colors.accent : colors.textMuted,
          backgroundColor: checked ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Exibição
// ---------------------------------------------------------------------------

export function Avatar({ name, url, size = 44 }: { name?: string | null; url?: string | null; size?: number }) {
  const { colors } = useTheme();
  const src = absoluteUrl(url);
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceMuted }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const { colors, radius } = useTheme();
  const map: Record<BadgeTone, [string, string]> = {
    neutral: [colors.surfaceMuted, colors.textSecondary],
    accent: [colors.accentSoft, colors.accent],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    info: [colors.infoSoft, colors.info],
  };
  const [bg, fg] = map[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, height = 8, color, track }: { value: number; height?: number; color?: string; track?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? colors.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height, backgroundColor: color ?? colors.accent }} />
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  onPress,
  style,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: IconName;
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const iconColor =
    tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.accent;
  return (
    <Card onPress={onPress} style={[{ flex: 1, minWidth: 140 }, style]} padding={14}>
      <Row justify="space-between" align="flex-start">
        <T variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={2}>
          {label}
        </T>
        {icon ? <Icon name={icon} size={18} color={iconColor} /> : null}
      </Row>
      <T variant="number" style={{ marginTop: 8 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {hint ? (
        <T variant="small" tone="secondary" numberOfLines={2}>
          {hint}
        </T>
      ) : null}
    </Card>
  );
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  icon,
  chevron = !!onPress,
  danger,
}: {
  title: string;
  subtitle?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  chevron?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {left}
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: danger ? colors.dangerSoft : colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} color={danger ? colors.danger : colors.text} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong" tone={danger ? 'danger' : 'default'} numberOfLines={2}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" tone="secondary" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

export function EmptyState({
  icon = 'inbox',
  title,
  message,
  action,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 8 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Icon name={icon} size={26} color={colors.textSecondary} />
      </View>
      <T variant="h3" center>
        {title}
      </T>
      {message ? (
        <T tone="secondary" center>
          {message}
        </T>
      ) : null}
      {action ? <Button title={action} onPress={onAction} full={false} size="sm" style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.accent} size="large" />
      {label ? <T tone="secondary">{label}</T> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados.';
  return <EmptyState icon="alert" title="Não foi possível carregar" message={message} action={onRetry ? 'Tentar novamente' : undefined} onAction={onRetry} />;
}

/** Atalho: renderiza loading/erro de uma query ou os filhos. */
export function QueryState({
  query,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  children: ReactNode;
}) {
  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children}</>;
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Row justify="space-between" style={{ paddingVertical: 8 }}>
      <T tone="secondary">{label}</T>
      {typeof value === 'string' || typeof value === 'number' ? <T variant="bodyStrong">{value}</T> : value}
    </Row>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 8, minHeight: 56 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  inner: { width: '100%' },
  maxWidth: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});

/** Controle segmentado (abas internas de uma tela). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Option<V>[];
  value: V;
  onChange: (v: V) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                flexGrow: 1,
                paddingHorizontal: 12,
                height: 38,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.surfaceMuted : 'transparent',
              }}
            >
              <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
