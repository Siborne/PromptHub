import { useTranslation } from "react-i18next";
import {
  AlertCircleIcon,
  HashIcon,
  LoaderIcon,
  Maximize2Icon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { SkillIconPicker } from "./SkillIconPicker";
import { SkillMarkdown } from "./SkillMarkdown";
import { sanitizeSkillName } from "./create-skill-modal-utils";
import type { CreateSkillModalController } from "./useCreateSkillModalController";

interface CreateSkillManualEditorProps {
  controller: CreateSkillModalController;
}

export function CreateSkillManualEditor({
  controller,
}: CreateSkillManualEditorProps) {
  return (
    <div className="space-y-5">
      <ManualSkillIdentityFields controller={controller} />
      <ManualSkillTags controller={controller} />
      <ManualSkillInstructions controller={controller} />
      <ManualSkillFileInput controller={controller} />
    </div>
  );
}

function ManualSkillFileInput({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  return (
    <input
      ref={controller.fileInputRef}
      type="file"
      aria-label={t("skill.uploadMd", "Upload .md")}
      accept=".md,.markdown,.txt"
      className="hidden"
      onChange={controller.handleFileUpload}
    />
  );
}

function ManualSkillIdentityFields({
  controller,
}: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("skill.skillName", "Skill Name")}{" "}
          <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={controller.name}
          onChange={(event) =>
            controller.setName(sanitizeSkillName(event.target.value))
          }
          placeholder="my-skill-name"
          className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t(
            "skill.nameHint",
            "Lowercase letters, numbers, and hyphens only, e.g. my-skill-name",
          )}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("skill.skillDescription", "Description")}
        </label>
        <input
          type="text"
          value={controller.description}
          onChange={(event) => controller.setDescription(event.target.value)}
          placeholder={t(
            "skill.descriptionPlaceholder",
            "What does this skill do?",
          )}
          className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <SkillIconPicker
        name={controller.name}
        iconUrl={controller.iconUrl}
        iconEmoji={controller.iconEmoji}
        iconBackground={controller.iconBackground}
        onChange={(icon) => updateSkillIcon(controller, icon)}
      />
      <div className="grid grid-cols-2 gap-4">
        <ManualTextField
          label={t("skill.version", "Version")}
          value={controller.version}
          onChange={controller.setVersion}
          placeholder="1.0.0"
        />
        <ManualTextField
          label={t("skill.author", "Author")}
          value={controller.author}
          onChange={controller.setAuthor}
          placeholder={t("skill.authorPlaceholder", "Author name")}
        />
      </div>
    </>
  );
}

function updateSkillIcon(
  controller: CreateSkillModalController,
  icon: { iconBackground?: string; iconEmoji?: string; iconUrl?: string },
) {
  controller.setIconUrl(icon.iconUrl);
  controller.setIconEmoji(icon.iconEmoji);
  controller.setIconBackground(icon.iconBackground);
}

function ManualTextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function ManualSkillTags({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {t("skill.tagsOptional", "Tags (Optional)")}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        <ManualTagPills controller={controller} />
      </div>
      <ExistingTagSuggestions controller={controller} />
      <div className="flex gap-2">
        <input
          type="text"
          value={controller.tagInput}
          onChange={(event) => controller.setTagInput(event.target.value)}
          onKeyDown={controller.handleTagKeyDown}
          placeholder={t("skill.enterTagHint", "Enter new tag and press Enter")}
          className="flex-1 h-10 px-4 rounded-xl bg-muted/50 border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-all duration-base"
        />
        <button
          type="button"
          onClick={controller.handleAddTag}
          disabled={!controller.tagInput.trim()}
          className="px-3 py-2 bg-accent hover:bg-accent/80 text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {t("skill.addTag", "Add tag")}
        </button>
      </div>
    </div>
  );
}

function ManualTagPills({ controller }: CreateSkillManualEditorProps) {
  return (
    <>
      {controller.tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-white"
        >
          <HashIcon aria-hidden="true" className="w-3 h-3" />
          {tag}
          <button
            type="button"
            onClick={() => controller.handleRemoveTag(tag)}
            className="ml-1 hover:text-white/70"
          >
            <XIcon aria-hidden="true" className="w-3 h-3" />
          </button>
        </span>
      ))}
    </>
  );
}

function ExistingTagSuggestions({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  const tags = controller.existingTags.filter(
    (tag) => !controller.tags.includes(tag),
  );
  if (!tags.length) return null;
  return (
    <div className="mb-2">
      <div className="text-xs text-muted-foreground mb-1.5">
        {t("skill.selectExistingTags", "Select existing tags:")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => controller.setTags((current) => [...current, tag])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted hover:bg-accent transition-colors"
          >
            <HashIcon aria-hidden="true" className="w-3 h-3" />
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function ManualSkillInstructions({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  return (
    <div>
      <InstructionToolbar controller={controller} />
      {!controller.canGenerateWithAI ? <AiConfigurationHint /> : null}
      <InstructionBody controller={controller} />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {t(
          "skill.instructionsHint",
          "Supports Markdown format for guiding AI on how to use this skill",
        )}
      </p>
    </div>
  );
}

function InstructionToolbar({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-2">
      <label className="block text-sm font-medium">
        {t("skill.instructions", "Instructions (SKILL.md)")}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => controller.fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <UploadIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {t("skill.uploadMd", "Upload .md")}
        </button>
        <button
          type="button"
          onClick={controller.handleAIPolish}
          disabled={
            controller.isGenerating ||
            !controller.canGenerateWithAI ||
            !controller.instructions.trim()
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${controller.canGenerateWithAI ? "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
          title={getPolishTitle(controller, t)}
          aria-label={t("skill.aiPolish", "AI Polish")}
        >
          {controller.isGenerating ? (
            <LoaderIcon
              className="w-3.5 h-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <SparklesIcon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {controller.isGenerating
            ? t("skill.polishing", "Polishing...")
            : t("skill.aiPolish", "AI Polish")}
        </button>
        <InstructionTabs controller={controller} />
        <button
          type="button"
          onClick={controller.handleEnterNativeFullscreen}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
          aria-label={t("common.fullscreen", "Fullscreen Edit")}
          title={t("common.fullscreen", "Fullscreen Edit")}
        >
          <Maximize2Icon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function getPolishTitle(
  controller: CreateSkillModalController,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!controller.canGenerateWithAI)
    return t(
      "skill.configureAiFirst",
      "Please configure AI model in settings first",
    );
  return controller.instructions.trim()
    ? t("skill.aiPolishHint", "Polish content to SKILL.md standard format")
    : t("skill.polishNeedsContent", "Write some content first");
}

function InstructionTabs({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
      <button
        type="button"
        onClick={() => controller.setInstrTab("edit")}
        className={getTabClassName(controller.instrTab === "edit")}
      >
        {t("prompt.edit", "Edit")}
      </button>
      <button
        type="button"
        onClick={() => controller.setInstrTab("preview")}
        className={getTabClassName(controller.instrTab === "preview")}
      >
        {t("prompt.preview", "Preview")}
      </button>
    </div>
  );
}

function getTabClassName(active: boolean): string {
  return `px-3 py-1 rounded-md text-xs font-medium transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;
}

function AiConfigurationHint() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
      <AlertCircleIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {t(
          "skill.aiGenerateHint",
          "Configure an AI model in settings to enable AI generation",
        )}
      </p>
    </div>
  );
}

function InstructionBody({ controller }: CreateSkillManualEditorProps) {
  const { t } = useTranslation();
  if (controller.instrTab === "edit")
    return (
      <textarea
        ref={controller.textareaRef}
        value={controller.instructions}
        onChange={(event) => controller.setInstructions(event.target.value)}
        placeholder={t(
          "skill.instructionsPlaceholder",
          "Enter skill instructions or SKILL.md content...",
        )}
        rows={controller.isFullscreen ? 20 : 10}
        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
    );
  return (
    <div
      className={`p-4 rounded-lg app-wallpaper-surface border border-border text-sm break-words overflow-auto ${controller.isFullscreen ? "min-h-[400px]" : "min-h-[200px]"}`}
    >
      {controller.instructions ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <SkillMarkdown content={controller.instructions} enableHighlight />
        </div>
      ) : (
        <div className="text-muted-foreground text-sm italic">
          {t("skill.noContent", "No content")}
        </div>
      )}
    </div>
  );
}
