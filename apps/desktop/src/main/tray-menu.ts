import type { MenuItemConstructorOptions } from "electron";
import type { AppCommand, Language } from "@prompthub/shared/types";

export const SUPPORTED_TRAY_MENU_LANGUAGES = [
  "en",
  "zh",
  "zh-TW",
  "ja",
  "fr",
  "de",
  "es",
] as const satisfies readonly Language[];

export interface TrayMenuLabels {
  addAgentAsset: string;
  createPrompt: string;
  createOrImportSkill: string;
  addMcpServer: string;
  addPlugin: string;
  manageRules: string;
  quickAddPrompt: string;
  analyzePrompt: string;
  generatePrompt: string;
  manageAgents: string;
  showPromptHub: string;
  hidePromptHub: string;
  checkUpdates: string;
  settings: string;
  quitPromptHub: string;
}

const LABELS: Record<Language, TrayMenuLabels> = {
  en: {
    addAgentAsset: "Add Agent Asset",
    createPrompt: "New Prompt…",
    createOrImportSkill: "Create or Import Skill…",
    addMcpServer: "Add MCP Server…",
    addPlugin: "Add Plugin…",
    manageRules: "Manage Rules…",
    quickAddPrompt: "Quick Add Prompt",
    analyzePrompt: "Analyze Existing Content…",
    generatePrompt: "Generate with AI…",
    manageAgents: "Manage Agents…",
    showPromptHub: "Show PromptHub",
    hidePromptHub: "Hide PromptHub",
    checkUpdates: "Check for Updates…",
    settings: "Settings…",
    quitPromptHub: "Quit PromptHub",
  },
  zh: {
    addAgentAsset: "添加 Agent 资产",
    createPrompt: "新建 Prompt…",
    createOrImportSkill: "新建或导入 Skill…",
    addMcpServer: "添加 MCP Server…",
    addPlugin: "添加 Plugin…",
    manageRules: "管理 Rule…",
    quickAddPrompt: "快速添加 Prompt",
    analyzePrompt: "分析已有内容…",
    generatePrompt: "使用 AI 生成…",
    manageAgents: "Agent 管理…",
    showPromptHub: "显示 PromptHub",
    hidePromptHub: "隐藏 PromptHub",
    checkUpdates: "检查更新…",
    settings: "设置…",
    quitPromptHub: "退出 PromptHub",
  },
  "zh-TW": {
    addAgentAsset: "新增 Agent 資產",
    createPrompt: "新增 Prompt…",
    createOrImportSkill: "新增或匯入 Skill…",
    addMcpServer: "新增 MCP Server…",
    addPlugin: "新增 Plugin…",
    manageRules: "管理 Rule…",
    quickAddPrompt: "快速新增 Prompt",
    analyzePrompt: "分析現有內容…",
    generatePrompt: "使用 AI 產生…",
    manageAgents: "Agent 管理…",
    showPromptHub: "顯示 PromptHub",
    hidePromptHub: "隱藏 PromptHub",
    checkUpdates: "檢查更新…",
    settings: "設定…",
    quitPromptHub: "結束 PromptHub",
  },
  ja: {
    addAgentAsset: "Agent アセットを追加",
    createPrompt: "新規 Prompt…",
    createOrImportSkill: "Skill を作成または読み込む…",
    addMcpServer: "MCP Server を追加…",
    addPlugin: "Plugin を追加…",
    manageRules: "Rule を管理…",
    quickAddPrompt: "Prompt をクイック追加",
    analyzePrompt: "既存の内容を分析…",
    generatePrompt: "AI で生成…",
    manageAgents: "Agent を管理…",
    showPromptHub: "PromptHub を表示",
    hidePromptHub: "PromptHub を隠す",
    checkUpdates: "アップデートを確認…",
    settings: "設定…",
    quitPromptHub: "PromptHub を終了",
  },
  fr: {
    addAgentAsset: "Ajouter un actif Agent",
    createPrompt: "Nouveau Prompt…",
    createOrImportSkill: "Créer ou importer un Skill…",
    addMcpServer: "Ajouter un serveur MCP…",
    addPlugin: "Ajouter un Plugin…",
    manageRules: "Gérer les Rules…",
    quickAddPrompt: "Ajout rapide de Prompt",
    analyzePrompt: "Analyser un contenu existant…",
    generatePrompt: "Générer avec l’IA…",
    manageAgents: "Gérer les Agents…",
    showPromptHub: "Afficher PromptHub",
    hidePromptHub: "Masquer PromptHub",
    checkUpdates: "Rechercher des mises à jour…",
    settings: "Réglages…",
    quitPromptHub: "Quitter PromptHub",
  },
  de: {
    addAgentAsset: "Agent-Asset hinzufügen",
    createPrompt: "Neuer Prompt…",
    createOrImportSkill: "Skill erstellen oder importieren…",
    addMcpServer: "MCP Server hinzufügen…",
    addPlugin: "Plugin hinzufügen…",
    manageRules: "Rules verwalten…",
    quickAddPrompt: "Prompt schnell hinzufügen",
    analyzePrompt: "Vorhandenen Inhalt analysieren…",
    generatePrompt: "Mit KI erstellen…",
    manageAgents: "Agents verwalten…",
    showPromptHub: "PromptHub anzeigen",
    hidePromptHub: "PromptHub ausblenden",
    checkUpdates: "Nach Updates suchen…",
    settings: "Einstellungen…",
    quitPromptHub: "PromptHub beenden",
  },
  es: {
    addAgentAsset: "Añadir activo de Agent",
    createPrompt: "Nuevo Prompt…",
    createOrImportSkill: "Crear o importar Skill…",
    addMcpServer: "Añadir MCP Server…",
    addPlugin: "Añadir Plugin…",
    manageRules: "Gestionar Rules…",
    quickAddPrompt: "Añadir Prompt rápidamente",
    analyzePrompt: "Analizar contenido existente…",
    generatePrompt: "Generar con IA…",
    manageAgents: "Gestionar Agents…",
    showPromptHub: "Mostrar PromptHub",
    hidePromptHub: "Ocultar PromptHub",
    checkUpdates: "Buscar actualizaciones…",
    settings: "Ajustes…",
    quitPromptHub: "Salir de PromptHub",
  },
};

export function normalizeTrayMenuLanguage(locale: string): Language {
  const normalized = locale.trim().toLowerCase();
  if (normalized.startsWith("zh")) {
    return /(?:^|-)hant(?:-|$)|^zh-(?:tw|hk|mo)(?:-|$)/.test(normalized)
      ? "zh-TW"
      : "zh";
  }

  const language = normalized.split("-")[0];
  return language === "ja" ||
    language === "fr" ||
    language === "de" ||
    language === "es"
    ? language
    : "en";
}

export function getTrayMenuLabels(locale: string): TrayMenuLabels {
  return LABELS[normalizeTrayMenuLanguage(locale)];
}

interface BuildTrayMenuTemplateOptions {
  agentManagementEnabled: boolean;
  isWindowVisible: boolean;
  labels: TrayMenuLabels;
  onCommand: (command: AppCommand) => void;
  onQuit: () => void;
  onToggleWindow: () => void;
}

export function buildTrayMenuTemplate({
  agentManagementEnabled,
  isWindowVisible,
  labels,
  onCommand,
  onQuit,
  onToggleWindow,
}: BuildTrayMenuTemplateOptions): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.addAgentAsset,
      submenu: [
        {
          label: labels.createPrompt,
          click: () => onCommand({ type: "asset:create", asset: "prompt" }),
        },
        {
          label: labels.createOrImportSkill,
          click: () => onCommand({ type: "asset:create", asset: "skill" }),
        },
        {
          label: labels.addMcpServer,
          click: () => onCommand({ type: "asset:create", asset: "mcp" }),
        },
        {
          label: labels.addPlugin,
          click: () => onCommand({ type: "asset:create", asset: "plugin" }),
        },
        { type: "separator" },
        {
          label: labels.manageRules,
          click: () => onCommand({ type: "asset:manage", asset: "rule" }),
        },
      ],
    },
    {
      label: labels.quickAddPrompt,
      submenu: [
        {
          label: labels.analyzePrompt,
          click: () => onCommand({ type: "prompt:quick-add", mode: "analyze" }),
        },
        {
          label: labels.generatePrompt,
          click: () =>
            onCommand({ type: "prompt:quick-add", mode: "generate" }),
        },
      ],
    },
  ];

  if (agentManagementEnabled) {
    template.push({
      label: labels.manageAgents,
      click: () => onCommand({ type: "agent:manage" }),
    });
  }

  template.push(
    { type: "separator" },
    {
      label: isWindowVisible ? labels.hidePromptHub : labels.showPromptHub,
      click: onToggleWindow,
    },
    {
      label: labels.checkUpdates,
      click: () => onCommand({ type: "updater:open" }),
    },
    {
      label: labels.settings,
      click: () => onCommand({ type: "settings:open" }),
    },
    { type: "separator" },
    { label: labels.quitPromptHub, click: onQuit },
  );

  return template;
}
