import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import type { TFunction } from "i18next";
import type { CreateSkillParams } from "@prompthub/shared/types";
import type { SkillState } from "../../stores/skill/skill-store-types";
import type { AIModelConfig } from "../../stores/settings/settings-types";
import {
  generateSkillContent,
  polishSkillContent,
  type AIConfig,
} from "../../services/ai";
import { BUILTIN_SKILL_REGISTRY } from "@prompthub/shared/constants/skill-registry";
import {
  buildStarterSkillContent,
  sanitizeSkillName,
  type CreateMode,
} from "./create-skill-modal-utils";

type StringSetter = Dispatch<SetStateAction<string>>;
type OptionalStringSetter = Dispatch<SetStateAction<string | undefined>>;
type ErrorSetter = Dispatch<SetStateAction<string | null>>;
type BooleanSetter = Dispatch<SetStateAction<boolean>>;

interface ManualActionOptions {
  setError: ErrorSetter;
  setIsGenerating: BooleanSetter;
  setIsLoading: BooleanSetter;
  t: TFunction;
}

interface ManualFormOptions extends ManualActionOptions {
  aiModels: AIModelConfig[];
  createSkill: SkillState["createSkill"];
  setMode: Dispatch<SetStateAction<CreateMode>>;
}

function getDefaultChatModel(models: AIModelConfig[]): AIModelConfig | null {
  const chatModels = models.filter(
    (model) => (model.type ?? "chat") === "chat",
  );
  return chatModels.find((model) => model.isDefault) ?? chatModels[0] ?? null;
}

function toAIConfig(model: AIModelConfig): AIConfig {
  return {
    provider: model.provider,
    apiProtocol: model.apiProtocol,
    apiKey: model.apiKey,
    apiUrl: model.apiUrl,
    model: model.model,
    chatParams: model.chatParams,
  };
}

function getActionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function useManualSkillMetadata() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [author, setAuthor] = useState("");
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [iconEmoji, setIconEmoji] = useState<string | undefined>();
  const [iconBackground, setIconBackground] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setVersion("");
    setAuthor("");
    setIconUrl(undefined);
    setIconEmoji(undefined);
    setIconBackground(undefined);
    setTags([]);
    setTagInput("");
  }, []);

  return {
    name,
    setName,
    description,
    setDescription,
    version,
    setVersion,
    author,
    setAuthor,
    iconUrl,
    setIconUrl,
    iconEmoji,
    setIconEmoji,
    iconBackground,
    setIconBackground,
    tags,
    setTags,
    tagInput,
    setTagInput,
    reset,
  };
}

function useManualSkillContent() {
  const [instructions, setInstructions] = useState("");
  const [instrTab, setInstrTab] = useState<"edit" | "preview">("edit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reset = useCallback(() => {
    setInstructions("");
    setInstrTab("edit");
    setIsFullscreen(false);
    setIsNativeFullscreen(false);
  }, []);

  return {
    instructions,
    setInstructions,
    instrTab,
    setInstrTab,
    isFullscreen,
    setIsFullscreen,
    isNativeFullscreen,
    setIsNativeFullscreen,
    fileInputRef,
    textareaRef,
    reset,
  };
}

function useManualSkillTagActions({
  tagInput,
  tags,
  setTagInput,
  setTags,
}: {
  tagInput: string;
  tags: string[];
  setTagInput: StringSetter;
  setTags: Dispatch<SetStateAction<string[]>>;
}) {
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags((current) => [...current, tag]);
    }
    setTagInput("");
  }, [setTagInput, setTags, tagInput, tags]);
  const handleRemoveTag = useCallback(
    (tag: string) =>
      setTags((current) => current.filter((item) => item !== tag)),
    [setTags],
  );
  const handleTagKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );
  return { handleAddTag, handleRemoveTag, handleTagKeyDown };
}

function useManualSkillFileUpload({
  name,
  setInstructions,
  setName,
}: {
  name: string;
  setInstructions: StringSetter;
  setName: StringSetter;
}) {
  return useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ({ target }) => {
        const content = target?.result;
        if (typeof content !== "string") return;
        setInstructions(content);
        if (!name.trim()) setName(getUploadedSkillName(file.name));
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [name, setInstructions, setName],
  );
}

function getUploadedSkillName(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
}

function useManualSkillAiActions({
  content,
  metadata,
  options,
}: {
  content: ReturnType<typeof useManualSkillContent>;
  metadata: ReturnType<typeof useManualSkillMetadata>;
  options: ManualFormOptions;
}) {
  const defaultChatModel = useMemo(
    () => getDefaultChatModel(options.aiModels),
    [options.aiModels],
  );
  const skillCreatorContent = useMemo(
    () =>
      BUILTIN_SKILL_REGISTRY.find((skill) => skill.slug === "skill-creator")
        ?.content,
    [],
  );
  const canGenerateWithAI = Boolean(
    defaultChatModel?.apiKey && defaultChatModel.apiUrl,
  );
  const handleAIPolish = useCallback(
    () =>
      polishManualSkillContent(content, metadata, defaultChatModel, options),
    [content, defaultChatModel, metadata, options],
  );
  const handleAICreate = useCallback(
    () =>
      generateManualSkillContent(
        content,
        metadata,
        defaultChatModel,
        skillCreatorContent,
        options,
      ),
    [content, defaultChatModel, metadata, options, skillCreatorContent],
  );
  return { canGenerateWithAI, handleAIPolish, handleAICreate };
}

async function polishManualSkillContent(
  content: ReturnType<typeof useManualSkillContent>,
  metadata: ReturnType<typeof useManualSkillMetadata>,
  model: AIModelConfig | null,
  { setError, setIsGenerating, t }: ManualActionOptions,
) {
  if (!content.instructions.trim()) {
    setError(
      t(
        "skill.polishNeedsContent",
        "Please write some content first before polishing",
      ),
    );
    return;
  }
  if (!model) {
    setError(
      t(
        "skill.noAiModelConfigured",
        "Please configure an AI model in settings first",
      ),
    );
    return;
  }
  setIsGenerating(true);
  setError(null);
  try {
    content.setInstructions(
      await polishSkillContent(
        toAIConfig(model),
        content.instructions,
        metadata.name || undefined,
      ),
    );
  } catch (error) {
    setError(
      getActionError(
        error,
        t("skill.polishFailed", "Failed to polish skill content"),
      ),
    );
  } finally {
    setIsGenerating(false);
  }
}

async function generateManualSkillContent(
  content: ReturnType<typeof useManualSkillContent>,
  metadata: ReturnType<typeof useManualSkillMetadata>,
  model: AIModelConfig | null,
  skillCreatorContent: string | undefined,
  { setError, setIsGenerating, setMode, t }: ManualFormOptions,
) {
  const name = validateGenerationInput(metadata, model, setError, t);
  if (!name || !model) return;
  setIsGenerating(true);
  setError(null);
  try {
    content.setInstructions(
      await generateSkillContent(
        toAIConfig(model),
        name,
        metadata.description,
        undefined,
        skillCreatorContent,
      ),
    );
    metadata.setName(name);
    setMode("manual");
  } catch (error) {
    setError(
      getActionError(
        error,
        t("skill.generateFailed", "Failed to generate skill content"),
      ),
    );
  } finally {
    setIsGenerating(false);
  }
}

function validateGenerationInput(
  metadata: ReturnType<typeof useManualSkillMetadata>,
  model: AIModelConfig | null,
  setError: ErrorSetter,
  t: TFunction,
): string | null {
  const name = sanitizeSkillName(metadata.name);
  if (!name) setError(t("skill.nameRequired", "Please enter a skill name"));
  else if (!metadata.description.trim())
    setError(
      t(
        "skill.descriptionRequired",
        "Please enter a skill description for AI generation",
      ),
    );
  else if (!model)
    setError(
      t(
        "skill.noAiModelConfigured",
        "Please configure an AI model in settings first",
      ),
    );
  return name && metadata.description.trim() && model ? name : null;
}

function useManualSkillCreateAction({
  content,
  metadata,
  options,
}: {
  content: ReturnType<typeof useManualSkillContent>;
  metadata: ReturnType<typeof useManualSkillMetadata>;
  options: ManualFormOptions;
}) {
  return useCallback(
    () => createManualSkill(content, metadata, options),
    [content, metadata, options],
  );
}

async function createManualSkill(
  content: ReturnType<typeof useManualSkillContent>,
  metadata: ReturnType<typeof useManualSkillMetadata>,
  { createSkill, setError, setIsLoading, t }: ManualFormOptions,
): Promise<boolean> {
  const name = sanitizeSkillName(metadata.name);
  if (!name) {
    setError(t("skill.nameRequired", "Please enter a skill name"));
    return false;
  }
  setIsLoading(true);
  setError(null);
  try {
    const createdSkill = await createSkill(
      buildCreateSkillParams(name, content.instructions, metadata),
    );
    if (!createdSkill)
      throw new Error(
        t(
          "skill.createReturnedEmpty",
          "Skill creation did not return a result",
        ),
      );
    return true;
  } catch (error) {
    setError(
      getActionError(error, t("skill.createFailed", "Failed to create skill")),
    );
    return false;
  } finally {
    setIsLoading(false);
  }
}

function buildCreateSkillParams(
  name: string,
  instructions: string,
  metadata: ReturnType<typeof useManualSkillMetadata>,
): CreateSkillParams {
  const content =
    instructions.trim() || buildStarterSkillContent(name, metadata.description);
  return {
    name,
    description: metadata.description,
    instructions: content,
    content,
    protocol_type: "skill",
    is_favorite: false,
    tags: metadata.tags,
    version: metadata.version || undefined,
    author: metadata.author || undefined,
    icon_url: metadata.iconUrl,
    icon_emoji: metadata.iconEmoji,
    icon_background: metadata.iconBackground,
  };
}

export function useCreateSkillManualForm(options: ManualFormOptions) {
  const metadata = useManualSkillMetadata();
  const content = useManualSkillContent();
  const tagActions = useManualSkillTagActions(metadata);
  const handleFileUpload = useManualSkillFileUpload({
    ...content,
    ...metadata,
  });
  const aiActions = useManualSkillAiActions({ content, metadata, options });
  const createSkill = useManualSkillCreateAction({
    content,
    metadata,
    options,
  });
  const reset = useCallback(() => {
    metadata.reset();
    content.reset();
  }, [content, metadata]);
  const hasUnsavedChanges = useCallback(
    () =>
      Boolean(
        metadata.name.trim() ||
        metadata.description.trim() ||
        content.instructions.trim() ||
        metadata.iconUrl ||
        metadata.iconEmoji ||
        metadata.iconBackground,
      ),
    [
      content.instructions,
      metadata.description,
      metadata.iconBackground,
      metadata.iconEmoji,
      metadata.iconUrl,
      metadata.name,
    ],
  );
  return {
    ...metadata,
    ...content,
    ...tagActions,
    ...aiActions,
    handleFileUpload,
    createSkill,
    hasUnsavedChanges,
    reset,
  };
}
