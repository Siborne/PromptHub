import { type PropsWithChildren, useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

import { useThemePalette, type ThemePalette } from "@/theme/colors";

interface AppScreenProps extends PropsWithChildren {
  scroll?: boolean;
}

export function AppScreen({ children, scroll = true }: AppScreenProps) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  const content = (
    <View style={styles.contentContainer}>
      <View style={styles.content}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={styles.textureOne} />
      <View pointerEvents="none" style={styles.textureTwo} />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

function useStyles(palette: ThemePalette) {
  return useMemo(() => StyleSheet.create({
    root: {
      backgroundColor: palette.background,
      flex: 1,
    },
    contentContainer: {
      alignSelf: "center",
      maxWidth: 600,
      width: "100%",
    },
    content: {
      gap: 16,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 30,
    },
    scrollContent: {
      flexGrow: 1,
    },
    textureOne: {
      backgroundColor: palette.accentSoft,
      borderRadius: 96,
      height: 172,
      opacity: 0.35,
      position: "absolute",
      right: -74,
      top: -62,
      width: 172,
    },
    textureTwo: {
      backgroundColor: palette.surfacePressed,
      borderRadius: 120,
      bottom: 96,
      height: 220,
      left: -128,
      opacity: 0.25,
      position: "absolute",
      width: 220,
    },
  }), [palette]);
}
