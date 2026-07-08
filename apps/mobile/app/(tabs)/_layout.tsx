import { SymbolView } from "expo-symbols";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet } from "react-native";

import { MOBILE_TABS } from "@/features/navigation/tabs";
import { useThemePalette } from "@/theme/colors";

export default function TabLayout() {
  const { t } = useTranslation();
  const palette = useThemePalette();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
          ...(Platform.OS === 'ios' ? {
            position: 'absolute', // To allow content behind if we added blur
            backgroundColor: palette.surface + 'F2', // Slight transparency for a pseudo-blur effect
          } : {}),
        },
      }}
    >
      {MOBILE_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.routeName}
          name={tab.routeName}
          options={{
            title: t(tab.titleKey),
            tabBarIcon: ({ color }) => (
              <SymbolView name={tab.symbol} tintColor={color} size={24} weight="medium" />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
