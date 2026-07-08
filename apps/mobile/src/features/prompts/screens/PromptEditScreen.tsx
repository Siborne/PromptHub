import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { SymbolView } from "expo-symbols";

import { AppScreen } from "@/components/AppScreen";
import { AppText } from "@/components/AppText";
import {
  promptRepository,
  type MobilePromptSummary,
} from "@/features/prompts/data/promptRepository";
import { useThemePalette } from "@/theme/colors";

export function PromptEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = useThemePalette();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");

  const isEditing = !!id;

  useEffect(() => {
    let mounted = true;
    if (id) {
      void promptRepository.getById(id).then((data) => {
        if (mounted && data) {
          setTitle(data.title);
          setDescription(data.description || "");
          setSystemPrompt(data.systemPrompt || "");
          setUserPrompt(data.userPrompt);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSave = async () => {
    if (!title.trim() || !userPrompt.trim()) {
      alert("Title and User Prompt are required");
      return;
    }

    if (isEditing) {
      await promptRepository.update(id, {
        title,
        description,
        systemPrompt,
        userPrompt,
      });
    } else {
      await promptRepository.create({
        id: `prompt_${Date.now()}`,
        title,
        description,
        systemPrompt,
        userPrompt,
        tags: [],
        isFavorite: false,
      });
    }

    router.back();
  };

  return (
    <AppScreen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={handleSave}>
              <AppText style={{ color: palette.accent, fontWeight: '600', fontSize: 17 }}>Save</AppText>
            </Pressable>
          ),
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <AppText style={{ color: palette.accent, fontSize: 17 }}>Cancel</AppText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <AppText variant="subtitle" style={[styles.label, { color: palette.text }]}>Title *</AppText>
          <TextInput
            style={[styles.input, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="E.g., Code Reviewer"
            placeholderTextColor={palette.muted}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={[styles.label, { color: palette.text }]}>Description</AppText>
          <TextInput
            style={[styles.input, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Briefly describe what this prompt does"
            placeholderTextColor={palette.muted}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={[styles.label, { color: palette.text }]}>System Prompt</AppText>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }]}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="You are an expert assistant..."
            placeholderTextColor={palette.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={[styles.label, { color: palette.text }]}>User Prompt *</AppText>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.border }]}
            value={userPrompt}
            onChangeText={setUserPrompt}
            placeholder="Review the following code..."
            placeholderTextColor={palette.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  label: {
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  }
});
