import { useColorScheme } from 'react-native';

export const lightPalette = {
  background: "#F2F2F7",
  backgroundRaised: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfacePressed: "#E5E5EA",
  border: "#C6C6C8",
  borderStrong: "#AEAEB2",
  text: "#000000",
  muted: "#8E8E93",
  subtle: "#C7C7CC",
  accent: "#007AFF",
  accentStrong: "#0056B3",
  accentSoft: "#E5F1FF",
  success: "#34C759",
  warning: "#FF9500",
  danger: "#FF3B30",
  black: "#000000",
  white: "#FFFFFF",
  shadow: "#000000",
}

export const darkPalette = {
  background: "#000000",
  backgroundRaised: "#1C1C1E",
  surface: "#1C1C1E",
  surfaceElevated: "#2C2C2E",
  surfacePressed: "#3A3A3C",
  border: "#38383A",
  borderStrong: "#48484A",
  text: "#FFFFFF",
  muted: "#8E8E93",
  subtle: "#636366",
  accent: "#0A84FF",
  accentStrong: "#409CFF",
  accentSoft: "#003366",
  success: "#32D74B",
  warning: "#FF9F0A",
  danger: "#FF453A",
  black: "#000000",
  white: "#FFFFFF",
  shadow: "#000000",
}


export type ThemePalette = typeof lightPalette;

export function useThemePalette(): ThemePalette {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkPalette : lightPalette;
}

// Keeping a fallback static palette export for gradual migration, pointing to light palette
export const palette = lightPalette;
