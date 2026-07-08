import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { SymbolView } from "expo-symbols";

import { AppScreen } from "@/components/AppScreen";
import { AppText } from "@/components/AppText";
import {
  promptRepository,
  type MobilePromptSummary,
} from "@/features/prompts/data/promptRepository";
import { useThemePalette } from "@/theme/colors";

export function PromptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prompt, setPrompt] = useState<MobilePromptSummary | null>(null);
  const router = useRouter();
  const palette = useThemePalette();
  const { t } = useTranslation();

  useEffect(() => {
    let mounted = true;
    if (id) {
      void promptRepository.getById(id).then((data) => {
        if (mounted && data) {
          setPrompt(data);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!prompt) {
    return (
      <AppScreen>
        <AppText style={{ margin: 20 }}>Loading...</AppText>
      </AppScreen>
    );
  }

  const handleDelete = async () => {
    await promptRepository.delete(prompt.id);
    router.back();
  };

  return (
    <AppScreen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={() => router.push({ pathname: "/(tabs)/prompts/edit", params: { id: prompt.id } })}>
                <SymbolView name={{ ios: "pencil", android: "edit", web: "edit" }} tintColor={palette.accent} size={20} />
              </Pressable>
              <Pressable onPress={handleDelete}>
                <SymbolView name={{ ios: "trash", android: "delete", web: "delete" }} tintColor={palette.danger} size={20} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <AppText variant="display" style={{ fontSize: 28, color: palette.text, fontWeight: '800' }}>
            {prompt.title}
          </AppText>
          {prompt.description ? (
            <AppText variant="muted" style={{ fontSize: 16, marginTop: 8 }}>
              {prompt.description}
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={{ color: palette.text, marginBottom: 8, fontWeight: '700' }}>
            System Prompt
          </AppText>
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <AppText style={{ color: prompt.systemPrompt ? palette.text : palette.muted }}>
              {prompt.systemPrompt || "No system prompt"}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={{ color: palette.text, marginBottom: 8, fontWeight: '700' }}>
            User Prompt
          </AppText>
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <AppText style={{ color: palette.text }}>
              {prompt.userPrompt}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={{ color: palette.text, marginBottom: 8, fontWeight: '700' }}>
            Metadata
          </AppText>
          <View style={[styles.card, { backgroundColor: palette.surface, padding: 0 }]}>
            <View style={[styles.metaRow, { borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <AppText variant="muted">Updated At</AppText>
              <AppText style={{ color: palette.text }}>{new Date(prompt.updatedAt).toLocaleString()}</AppText>
            </View>
            <View style={styles.metaRow}>
              <AppText variant="muted">Tags</AppText>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {prompt.tags?.length ? prompt.tags.map(tag => (
                  <View key={tag} style={[styles.chip, { backgroundColor: palette.backgroundRaised }]}>
                    <AppText variant="caption" style={{ color: palette.muted }}>{tag}</AppText>
                  </View>
                )) : <AppText style={{ color: palette.text }}>None</AppText>}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  }
});
