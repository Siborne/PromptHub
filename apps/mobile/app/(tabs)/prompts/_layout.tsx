import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function PromptsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: t("prompts.workflow.detailTitle"),
          headerBackTitle: t("prompts.workflow.back"),
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          presentation: "modal",
          headerShown: true,
          title: t("prompts.workflow.editTitle"),
        }}
      />
    </Stack>
  );
}
