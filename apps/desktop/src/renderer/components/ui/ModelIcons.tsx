import React from "react";
import { CircleDotDashedIcon, SlidersHorizontalIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// AI model provider icon component
// Prioritize using local provider brand icons, fallback to first letter circle when no matching icon

import openaiSvg from "../../assets/providers/openai.svg";
import anthropicSvg from "../../assets/providers/anthropic.svg";
import azureAiSvg from "../../assets/providers/azureai.svg";
import geminiSvg from "../../assets/providers/gemini.svg";
import deepseekSvg from "../../assets/providers/deepseek.svg";
import qwenSvg from "../../assets/providers/qwen.svg";
import doubaoSvg from "../../assets/providers/doubao.svg";
import zhipuSvg from "../../assets/providers/zhipu.svg";
import moonshotSvg from "../../assets/providers/moonshot.svg";
import mistralSvg from "../../assets/providers/mistral.svg";
import zeroOneSvg from "../../assets/providers/zero-one.svg";
import tencentCloudTiSvg from "../../assets/providers/tencent-cloud-ti.svg";
import newApiSvg from "../../assets/providers/newapi.svg";
import ollamaSvg from "../../assets/providers/ollama.svg";
import grokSvg from "../../assets/providers/grok.svg";

// Map category names to local provider icon resources
// 按模型分类名称映射到本地 provider 图标资源
const CATEGORY_ICON_SRC: Record<string, string> = {
  GPT: openaiSvg,
  "Azure OpenAI": azureAiSvg,
  Claude: anthropicSvg,
  Gemini: geminiSvg,
  DeepSeek: deepseekSvg,
  Qwen: qwenSvg,
  Doubao: doubaoSvg,
  GLM: zhipuSvg,
  Moonshot: moonshotSvg,
  Mistral: mistralSvg,
  Yi: zeroOneSvg,
  Spark: tencentCloudTiSvg,
  Hunyuan: tencentCloudTiSvg, // Map Hunyuan to Tencent icon
  "New API": newApiSvg,
  Llama: ollamaSvg,
  Grok: grokSvg,
  ERNIE: "", // Placeholder for ERNIE
};

const SPECIAL_CATEGORY_ICONS: Record<
  string,
  { icon: LucideIcon; className: string }
> = {
  Custom: {
    icon: SlidersHorizontalIcon,
    className:
      "border border-blue-600/20 bg-blue-50 text-blue-600 shadow-sm dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300",
  },
  Other: {
    icon: CircleDotDashedIcon,
    className:
      "border border-slate-500/20 bg-slate-100 text-slate-600 shadow-sm dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-300",
  },
};

const MONOCHROME_CATEGORY_ICONS = new Set(["GPT", "Moonshot", "Llama", "Grok"]);

export function hasDedicatedCategoryIcon(category: string): boolean {
  return Boolean(
    CATEGORY_ICON_SRC[category] || SPECIAL_CATEGORY_ICONS[category],
  );
}

function renderSpecialCategoryIcon(
  category: string,
  size: number,
): React.ReactNode {
  const specialIcon = SPECIAL_CATEGORY_ICONS[category];
  if (!specialIcon) {
    return null;
  }

  const Icon = specialIcon.icon;
  return (
    <div
      data-category-icon={category}
      className={`flex shrink-0 items-center justify-center rounded-md ${specialIcon.className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <Icon size={size * 0.68} strokeWidth={2.2} />
    </div>
  );
}

/**
 * Get category icon
 * 获取分类图标
 */
export function getCategoryIcon(category: string, size = 20): React.ReactNode {
  // 0. nanobananai 🍌 special icon
  if (category === "nanobananai 🍌") {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md border border-yellow-400 bg-yellow-50 text-yellow-900 shadow-sm dark:border-yellow-300/30 dark:bg-yellow-300/10 dark:text-yellow-100"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.75,
          lineHeight: 1,
        }}
      >
        🍌
      </div>
    );
  }

  // 1. Prioritize using local provider brand icons
  // 优先使用本地 provider 品牌图标
  const src = CATEGORY_ICON_SRC[category];

  if (src) {
    return (
      <img
        src={src}
        alt={category}
        width={size}
        height={size}
        className={`block rounded-md object-contain ${
          MONOCHROME_CATEGORY_ICONS.has(category)
            ? "brightness-0 dark:invert"
            : ""
        }`}
        onError={(e) => {
          // Keep broken-image glyphs out of compact provider icon slots.
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  const specialIcon = renderSpecialCategoryIcon(category, size);
  if (specialIcon) {
    return specialIcon;
  }

  // 2. Fallback: use first letter of category name when no local icon is found
  const letter = (category && category[0]) || "?";
  const fontSize = size * 0.55;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground dark:bg-slate-600 dark:text-slate-50"
      style={{
        width: size,
        height: size,
        fontSize,
        fontWeight: 600,
      }}
    >
      {letter}
    </div>
  );
}
