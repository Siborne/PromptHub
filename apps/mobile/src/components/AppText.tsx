import { type PropsWithChildren, useMemo } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';

import { useThemePalette, type ThemePalette } from '@/theme/colors';

type AppTextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'muted' | 'caption' | 'mono';

interface AppTextProps extends PropsWithChildren, TextProps {
  variant?: AppTextVariant;
  style?: StyleProp<TextStyle>;
}

export function AppText({ children, style, variant = 'body', ...textProps }: AppTextProps) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return (
    <Text style={[styles.base, styles[variant], style]} {...textProps}>
      {children}
    </Text>
  );
}

function useStyles(palette: ThemePalette) {
  return useMemo(() => StyleSheet.create({
    base: {
      color: palette.text,
      letterSpacing: -0.1,
    },
    display: {
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 34,
      letterSpacing: -0.5,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 28,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 14,
      lineHeight: 21,
    },
    muted: {
      color: palette.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    caption: {
      color: palette.subtle,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 14,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    mono: {
      color: palette.accent,
      fontFamily: "SpaceMono",
      fontSize: 11,
      lineHeight: 15,
    },
  }), [palette]);
}
