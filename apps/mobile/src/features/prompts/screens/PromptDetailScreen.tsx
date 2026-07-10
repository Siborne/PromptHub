import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SymbolView } from "expo-symbols";

import { AppScreen } from "@/components/AppScreen";
import { AppText } from "@/components/AppText";
import {
  showPlatformAlert,
  showPlatformConfirmation,
} from "@/components/platformAlerts";
import {
  promptRepository,
  type MobilePromptSummary,
} from "@/features/prompts/data/promptRepository";
import { useThemePalette } from "@/theme/colors";

export function PromptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prompt, setPrompt] = useState<MobilePromptSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const palette = useThemePalette();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void promptRepository
        .getById(id)
        .then((data) => {
          if (!active) return;
          setPrompt(data);
          if (!data) setError(t("prompts.workflow.notFound"));
        })
        .catch(() => {
          if (active) setError(t("prompts.workflow.loadError"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [id, t]),
  );

  if (loading || !prompt) {
    return (
      <AppScreen>
        <AppText style={{ margin: 20 }}>
          {loading ? t("prompts.workflow.loading") : error}
        </AppText>
      </AppScreen>
    );
  }

  const deletePrompt = async () => {
    try {
      await promptRepository.delete(prompt.id);
      router.back();
    } catch {
      showPlatformAlert(
        t("prompts.workflow.deleteErrorTitle"),
        t("prompts.workflow.deleteError"),
      );
    }
  };

  const handleDelete = () => {
    showPlatformConfirmation({
      cancelLabel: t("prompts.workflow.cancel"),
      confirmLabel: t("prompts.workflow.delete"),
      message: t("prompts.workflow.deleteMessage", { title: prompt.title }),
      onConfirm: () => void deletePrompt(),
      title: t("prompts.workflow.deleteTitle"),
    });
  };

  return (
    <AppScreen>
      <Stack.Screen
        options={{
          title: t("prompts.workflow.detailTitle"),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable
                accessibilityLabel={t("prompts.workflow.edit")}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/prompts/edit",
                    params: { id: prompt.id },
                  })
                }
              >
                <SymbolView
                  name={{ ios: "pencil", android: "edit", web: "edit" }}
                  tintColor={palette.accent}
                  size={20}
                />
              </Pressable>
              <Pressable
                accessibilityLabel={t("prompts.workflow.delete")}
                accessibilityRole="button"
                onPress={handleDelete}
              >
                <SymbolView
                  name={{ ios: "trash", android: "delete", web: "delete" }}
                  tintColor={palette.danger}
                  size={20}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <AppText
            variant="display"
            style={{ fontSize: 28, color: palette.text, fontWeight: "800" }}
          >
            {prompt.title}
          </AppText>
          {prompt.description ? (
            <AppText variant="muted" style={{ fontSize: 16, marginTop: 8 }}>
              {prompt.description}
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <AppText
            variant="subtitle"
            style={{ color: palette.text, marginBottom: 8, fontWeight: "700" }}
          >
            {t("prompts.workflow.systemPrompt")}
          </AppText>
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <AppText
              style={{
                color: prompt.systemPrompt ? palette.text : palette.muted,
              }}
            >
              {prompt.systemPrompt || t("prompts.workflow.noSystemPrompt")}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText
            variant="subtitle"
            style={{ color: palette.text, marginBottom: 8, fontWeight: "700" }}
          >
            {t("prompts.workflow.userPrompt")}
          </AppText>
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <AppText style={{ color: palette.text }}>
              {prompt.userPrompt}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText
            variant="subtitle"
            style={{ color: palette.text, marginBottom: 8, fontWeight: "700" }}
          >
            {t("prompts.workflow.metadata")}
          </AppText>
          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, padding: 0 },
            ]}
          >
            <View
              style={[
                styles.metaRow,
                {
                  borderBottomColor: palette.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <AppText variant="muted">
                {t("prompts.workflow.updatedAt")}
              </AppText>
              <AppText style={{ color: palette.text }}>
                {new Date(prompt.updatedAt).toLocaleString()}
              </AppText>
            </View>
            <View style={styles.metaRow}>
              <AppText variant="muted">{t("prompts.workflow.tags")}</AppText>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {prompt.tags?.length ? (
                  prompt.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.chip,
                        { backgroundColor: palette.backgroundRaised },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{ color: palette.muted }}
                      >
                        {tag}
                      </AppText>
                    </View>
                  ))
                ) : (
                  <AppText style={{ color: palette.text }}>
                    {t("prompts.workflow.none")}
                  </AppText>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    marginBottom: 8,
  },
  section: {
    gap: 8,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
