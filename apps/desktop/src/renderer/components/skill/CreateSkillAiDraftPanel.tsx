import { useTranslation } from "react-i18next";
import {
  AlertCircleIcon,
  BrainIcon,
  LoaderIcon,
  SparklesIcon,
} from "lucide-react";
import { sanitizeSkillName } from "./create-skill-modal-utils";
import type { CreateSkillModalController } from "./useCreateSkillModalController";

interface CreateSkillAiDraftPanelProps {
  controller: CreateSkillModalController;
}

export function CreateSkillAiDraftPanel({
  controller,
}: CreateSkillAiDraftPanelProps) {
  const { t } = useTranslation();
  const canGenerate = Boolean(
    controller.canGenerateWithAI &&
    controller.name.trim() &&
    controller.description.trim(),
  );
  return (
    <div className="space-y-4">
      <AiDraftIntro />
      {!controller.canGenerateWithAI ? <AiDraftConfigurationHint /> : null}
      <AiDraftFields controller={controller} />
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => controller.setMode("select")}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
        >
          {t("common.back", "Back")}
        </button>
        <button
          type="button"
          onClick={controller.handleAICreate}
          disabled={controller.isGenerating || !canGenerate}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {controller.isGenerating ? (
            <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <SparklesIcon className="w-4 h-4" aria-hidden="true" />
          )}
          {controller.isGenerating
            ? t("skill.generating", "Generating...")
            : t("skill.generateAndReview", "Generate & Review")}
        </button>
      </div>
    </div>
  );
}

function AiDraftIntro() {
  const { t } = useTranslation();
  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <p className="text-xs text-primary flex items-center gap-2">
        <BrainIcon className="w-3.5 h-3.5" />
        {t(
          "skill.aiCreateHint",
          "Uses the Skill Creator skill to draft a professional SKILL.md. You can review and edit before saving.",
        )}
      </p>
    </div>
  );
}

function AiDraftConfigurationHint() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
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

function AiDraftFields({ controller }: CreateSkillAiDraftPanelProps) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("skill.name", "Name")}
          <span className="ml-1 text-destructive">*</span>
        </label>
        <input
          type="text"
          value={controller.name}
          onChange={(event) =>
            controller.setName(sanitizeSkillName(event.target.value))
          }
          placeholder={t("skill.namePlaceholder", "my-skill")}
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
          {t("skill.description", "Description")}
          <span className="ml-1 text-destructive">*</span>
        </label>
        <textarea
          value={controller.description}
          onChange={(event) => controller.setDescription(event.target.value)}
          placeholder={t(
            "skill.aiDescPlaceholder",
            "Describe what this skill should do, its purpose, and when to use it...",
          )}
          rows={4}
          className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>
    </>
  );
}
