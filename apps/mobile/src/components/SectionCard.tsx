import { type PropsWithChildren, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemePalette, type ThemePalette } from '@/theme/colors';

export function SectionCard({ children }: PropsWithChildren) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return <View style={styles.card}>{children}</View>;
}

function useStyles(palette: ThemePalette) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: palette.surface,
      borderRadius: 16, // iOS card style
      gap: 12,
      padding: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
  }), [palette]);
}
