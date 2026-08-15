import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme/colors';

const IS_WEB = Platform.OS === 'web';

export const BREAKPOINT_DESKTOP = 900;

export function useResponsive() {
  const { width } = useWindowDimensions();
  return {
    width,
    isWeb: IS_WEB,
    isDesktop: IS_WEB && width >= BREAKPOINT_DESKTOP,
    isMobile: !IS_WEB || width < BREAKPOINT_DESKTOP,
  };
}

// ---- Layout ----
export function Container({ children, style }) {
  const { isDesktop } = useResponsive();
  return (
    <View
      style={[
        isDesktop && { width: '100%', maxWidth: 1120, alignSelf: 'center' },
        { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Grid({ cols = 2, gap = spacing.md, children, style }) {
  const { isDesktop } = useResponsive();
  return (
    <View
      style={[
        isDesktop && { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function GridItem({ cols = 2, children, style }) {
  const { isDesktop } = useResponsive();
  return (
    <View
      style={[
        isDesktop
          ? {
              width: `${100 / cols}%`,
              paddingHorizontal: spacing.md / 2,
              marginBottom: spacing.md,
            }
          : { marginBottom: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const cardShadow = (() => {
  const base = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  };
  if (IS_WEB) {
    return {
      ...base,
      boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 8px 24px rgba(16,24,40,0.06)',
    };
  }
  return {
    ...base,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  };
})();

export function Card({ children, style, muted = false, pad = true }) {
  return (
    <View
      style={[
        cardShadow,
        pad && { padding: spacing.md },
        muted && { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children, style }) {
  return (
    <Text
      style={[
        {
          fontSize: font.sm,
          fontWeight: font.weight.semibold,
          color: colors.textMuted,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---- Form ----
export function Input({ style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          fontSize: font.md,
          color: colors.text,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function PasswordInput({ style, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <TextInput
        placeholderTextColor={colors.textMuted}
        secureTextEntry={!visible}
        style={{ flex: 1, fontSize: font.md, color: colors.text, paddingVertical: spacing.md }}
        {...props}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={[
          !visible && { opacity: 0.55 },
          IS_WEB ? { cursor: 'pointer' } : null,
        ]}
      >
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

export function Field({ label, hint, children }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text
          style={{
            fontSize: font.md,
            fontWeight: font.weight.semibold,
            color: colors.text,
            marginBottom: spacing.xs,
          }}
        >
          {label}
        </Text>
      ) : null}
      {children}
      {hint ? (
        <Text style={{ fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ---- Buttons ----
export function Button({
  variant = 'primary',
  onPress,
  disabled,
  loading,
  children,
  style,
  icon,
}) {
  const [hovered, setHovered] = useState(false);
  const palettes = {
    primary: { bg: colors.primary, border: colors.primary, textColor: colors.white },
    secondary: { bg: colors.surface, border: colors.borderStrong, textColor: colors.text },
    danger: { bg: colors.dangerSoft, border: colors.dangerSoft, textColor: colors.danger },
    ghost: { bg: 'transparent', border: 'transparent', textColor: colors.primary },
  };
  const palette = palettes[variant] || palettes.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      onMouseEnter={IS_WEB ? () => setHovered(true) : undefined}
      onMouseLeave={IS_WEB ? () => setHovered(false) : undefined}
      style={[
        palette.bg === 'transparent' ? {} : { backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border },
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.45 : 1,
          ...(IS_WEB ? { cursor: 'pointer' } : {}),
          ...(IS_WEB && hovered && variant === 'primary'
            ? { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark, boxShadow: '0 6px 16px rgba(22,163,74,0.28)' }
            : {}),
          ...(IS_WEB && hovered && variant === 'secondary'
            ? { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong }
            : {}),
          ...(IS_WEB ? { transition: 'background-color 150ms ease, box-shadow 150ms ease' } : {}),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={palette.textColor} /> : null}
          <Text style={{ color: palette.textColor, fontWeight: font.weight.semibold, fontSize: font.md }}>
            {children}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ---- Chip group (segmented) ----
export function ChipGroup({ options, value, onChange }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.pill,
        padding: spacing.xs,
        gap: spacing.xs,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              {
                flex: 1,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                ...(IS_WEB ? { cursor: 'pointer' } : {}),
              },
              active && {
                backgroundColor: colors.surface,
                ...(IS_WEB
                  ? { boxShadow: '0 1px 2px rgba(16,24,40,0.12)' }
                  : { elevation: 1, shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }),
              },
            ]}
          >
            <Text
              style={{
                fontSize: font.base,
                flexShrink: 1,
                textAlign: 'center',
                fontWeight: active ? font.weight.semibold : font.weight.medium,
                color: active ? colors.primary : colors.textMuted,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---- Empty / badges ----
export function EmptyState({ icon = 'leaf-outline', title, hint }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={{ fontSize: font.md, fontWeight: font.weight.semibold, color: colors.text, textAlign: 'center' }}>
        {title}
      </Text>
      {hint ? (
        <Text style={{ fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

export function Badge({ children, tone = 'primary' }) {
  const tones = {
    primary: { bg: colors.primarySoft, text: colors.primaryDark },
    danger: { bg: colors.dangerSoft, text: colors.danger },
    warning: { bg: colors.warningSoft, text: colors.warning },
    muted: { bg: colors.surfaceMuted, text: colors.textMuted },
  };
  const t = tones[tone] || tones.muted;
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
      <Text style={{ color: t.text, fontSize: font.sm, fontWeight: font.weight.semibold }}>{children}</Text>
    </View>
  );
}

export { colors, font, radius, spacing };