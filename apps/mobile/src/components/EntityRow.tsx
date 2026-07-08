import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import { AppText } from '@/components/AppText';
import { useThemePalette, type ThemePalette } from '@/theme/colors';

interface EntityRowProps {
  accent?: string;
  description: string;
  label: string;
  meta?: string;
}

export function EntityRow({ accent, description, label, meta }: EntityRowProps) {
  const palette = useThemePalette();
  const styles = useStyles(palette);
  const activeAccent = accent || palette.accent;

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: activeAccent + '20' }]} />
      <View style={styles.copy}>
        <View style={styles.header}>
          <AppText variant="subtitle" style={styles.title}>
            {label}
          </AppText>
          {meta ? <AppText variant="caption">{meta}</AppText> : null}
        </View>
        <AppText variant="muted" style={styles.description}>
          {description}
        </AppText>
      </View>
    </View>
  );
}

function useStyles(palette: ThemePalette) {
  return useMemo(() => StyleSheet.create({
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    icon: {
      borderRadius: 12,
      height: 42,
      width: 42,
    },
    copy: {
      flex: 1,
      gap: 4,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    title: {
      flex: 1,
    },
    description: {
      color: palette.muted,
    },
  }), [palette]);
}
