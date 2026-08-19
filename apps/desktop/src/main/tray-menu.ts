import type { MenuItemConstructorOptions } from "electron";
import type {
  AgentUsageMetric,
  AgentUsageQuota,
  AppCommand,
  Language,
} from "@prompthub/shared/types";
import {
  formatAgentUsagePlan,
  getPrimaryUsageMetric,
  getUsageMetricRemainingPercent,
} from "@prompthub/shared/utils/agent-usage-presentation";
import type { AgentProviderTrayGroup } from "./services/agent-provider-tray-service";
import type { AgentUsageTrayEntry } from "./services/agent-usage-tray-projection";

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
  agents: string;
  openAgent: string;
  manageAgents: string;
  agentUsage: string;
  refreshAgentUsage: string;
  usageLoading: string;
  usageCached: string;
  usageNotConnected: string;
  usageExpired: string;
  usageUnavailable: string;
  usageNoQuota: string;
  usageRemaining: string;
  usagePlan: string;
  usageUnlimited: string;
  usageUnknown: string;
  usageResetDue: string;
  usageResetsInDaysHours: string;
  usageResetsInHoursMinutes: string;
  usageFiveHourWindow: string;
  usageSevenDayWindow: string;
  usageSevenDayOpusWindow: string;
  usageWeeklyWindow: string;
  usageRollingWindow: string;
  usagePremiumRequests: string;
  usageChatRequests: string;
  usagePromptCredits: string;
  usageDailyWindow: string;
  usageMonthlyWindow: string;
  usageBillingCycle: string;
  usageProviderQuota: string;
  confirmProviderSwitch: string;
  useProviderProfile: string;
  cancel: string;
  providerReviewRequired: string;
  providerSwitchFailed: string;
  openAgents: string;
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
    agents: "Agents",
    openAgent: "Open Agent Workspace…",
    manageAgents: "Manage Agents…",
    agentUsage: "Agent Quotas",
    refreshAgentUsage: "Refresh Quotas",
    usageLoading: "Loading…",
    usageCached: "Cached",
    usageNotConnected: "Not connected",
    usageExpired: "Credentials expired",
    usageUnavailable: "Usage unavailable",
    usageNoQuota: "The provider did not report a quota",
    usageRemaining: "{remaining}% remaining",
    usagePlan: "Plan: {plan}",
    usageUnlimited: "Unlimited",
    usageUnknown: "Unknown",
    usageResetDue: "Reset pending",
    usageResetsInDaysHours: "Resets in {days}d {hours}h",
    usageResetsInHoursMinutes: "Resets in {hours}h {minutes}m",
    usageFiveHourWindow: "5-hour window",
    usageSevenDayWindow: "7-day window",
    usageSevenDayOpusWindow: "7-day Opus window",
    usageWeeklyWindow: "Weekly quota",
    usageRollingWindow: "Rolling window",
    usagePremiumRequests: "Premium requests",
    usageChatRequests: "Chat requests",
    usagePromptCredits: "Prompt credits",
    usageDailyWindow: "Daily quota",
    usageMonthlyWindow: "Monthly quota",
    usageBillingCycle: "Billing cycle",
    usageProviderQuota: "Provider quota",
    confirmProviderSwitch: "Switch provider profile?",
    useProviderProfile: "Switch",
    cancel: "Cancel",
    providerReviewRequired: "Review this change in the Agent workspace.",
    providerSwitchFailed: "Provider switch failed and no state was assumed.",
    openAgents: "Open Agents",
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
    agents: "Agents",
    openAgent: "打开 Agent 工作区…",
    manageAgents: "Agent 管理…",
    agentUsage: "Agent 额度",
    refreshAgentUsage: "刷新额度",
    usageLoading: "正在加载…",
    usageCached: "缓存数据",
    usageNotConnected: "未连接",
    usageExpired: "凭据已过期",
    usageUnavailable: "暂时无法获取用量",
    usageNoQuota: "Provider 未返回额度",
    usageRemaining: "剩余 {remaining}%",
    usagePlan: "套餐：{plan}",
    usageUnlimited: "不限量",
    usageUnknown: "未知",
    usageResetDue: "等待重置",
    usageResetsInDaysHours: "{days} 天 {hours} 小时后重置",
    usageResetsInHoursMinutes: "{hours} 小时 {minutes} 分钟后重置",
    usageFiveHourWindow: "5 小时窗口",
    usageSevenDayWindow: "7 天窗口",
    usageSevenDayOpusWindow: "7 天 Opus 窗口",
    usageWeeklyWindow: "周额度",
    usageRollingWindow: "滚动窗口",
    usagePremiumRequests: "高级请求",
    usageChatRequests: "聊天请求",
    usagePromptCredits: "Prompt 点数",
    usageDailyWindow: "日额度",
    usageMonthlyWindow: "月额度",
    usageBillingCycle: "账期额度",
    usageProviderQuota: "Provider 额度",
    confirmProviderSwitch: "切换 Provider Profile？",
    useProviderProfile: "切换",
    cancel: "取消",
    providerReviewRequired: "请在 Agent 工作区审查这次变更。",
    providerSwitchFailed: "Provider 切换失败，未假定任何状态。",
    openAgents: "打开 Agents",
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
    agents: "Agents",
    openAgent: "開啟 Agent 工作區…",
    manageAgents: "Agent 管理…",
    agentUsage: "Agent 額度",
    refreshAgentUsage: "重新整理額度",
    usageLoading: "正在載入…",
    usageCached: "快取資料",
    usageNotConnected: "未連線",
    usageExpired: "憑證已過期",
    usageUnavailable: "目前無法取得用量",
    usageNoQuota: "Provider 未回報額度",
    usageRemaining: "剩餘 {remaining}%",
    usagePlan: "方案：{plan}",
    usageUnlimited: "不限量",
    usageUnknown: "未知",
    usageResetDue: "等待重設",
    usageResetsInDaysHours: "{days} 天 {hours} 小時後重設",
    usageResetsInHoursMinutes: "{hours} 小時 {minutes} 分鐘後重設",
    usageFiveHourWindow: "5 小時視窗",
    usageSevenDayWindow: "7 天視窗",
    usageSevenDayOpusWindow: "7 天 Opus 視窗",
    usageWeeklyWindow: "每週額度",
    usageRollingWindow: "滾動視窗",
    usagePremiumRequests: "進階要求",
    usageChatRequests: "聊天要求",
    usagePromptCredits: "Prompt 點數",
    usageDailyWindow: "每日額度",
    usageMonthlyWindow: "每月額度",
    usageBillingCycle: "帳期額度",
    usageProviderQuota: "Provider 額度",
    confirmProviderSwitch: "切換 Provider Profile？",
    useProviderProfile: "切換",
    cancel: "取消",
    providerReviewRequired: "請在 Agent 工作區審查這次變更。",
    providerSwitchFailed: "Provider 切換失敗，未假定任何狀態。",
    openAgents: "開啟 Agents",
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
    agents: "Agents",
    openAgent: "Agent ワークスペースを開く…",
    manageAgents: "Agent を管理…",
    agentUsage: "Agent クォータ",
    refreshAgentUsage: "クォータを更新",
    usageLoading: "読み込み中…",
    usageCached: "キャッシュ",
    usageNotConnected: "未接続",
    usageExpired: "認証情報の期限切れ",
    usageUnavailable: "使用量を取得できません",
    usageNoQuota: "プロバイダーからクォータが返されませんでした",
    usageRemaining: "残り {remaining}%",
    usagePlan: "プラン：{plan}",
    usageUnlimited: "無制限",
    usageUnknown: "不明",
    usageResetDue: "リセット待ち",
    usageResetsInDaysHours: "{days}日 {hours}時間後にリセット",
    usageResetsInHoursMinutes: "{hours}時間 {minutes}分後にリセット",
    usageFiveHourWindow: "5時間ウィンドウ",
    usageSevenDayWindow: "7日間ウィンドウ",
    usageSevenDayOpusWindow: "7日間 Opus ウィンドウ",
    usageWeeklyWindow: "週間クォータ",
    usageRollingWindow: "ローリングウィンドウ",
    usagePremiumRequests: "プレミアムリクエスト",
    usageChatRequests: "チャットリクエスト",
    usagePromptCredits: "Prompt クレジット",
    usageDailyWindow: "日次クォータ",
    usageMonthlyWindow: "月次クォータ",
    usageBillingCycle: "請求サイクル",
    usageProviderQuota: "プロバイダークォータ",
    confirmProviderSwitch: "Provider Profile を切り替えますか？",
    useProviderProfile: "切り替え",
    cancel: "キャンセル",
    providerReviewRequired: "Agent ワークスペースで変更を確認してください。",
    providerSwitchFailed: "Provider の切り替えに失敗しました。",
    openAgents: "Agents を開く",
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
    agents: "Agents",
    openAgent: "Ouvrir l’espace Agent…",
    manageAgents: "Gérer les Agents…",
    agentUsage: "Quotas des Agents",
    refreshAgentUsage: "Actualiser les quotas",
    usageLoading: "Chargement…",
    usageCached: "En cache",
    usageNotConnected: "Non connecté",
    usageExpired: "Identifiants expirés",
    usageUnavailable: "Utilisation indisponible",
    usageNoQuota: "Le fournisseur n’a pas indiqué de quota",
    usageRemaining: "{remaining} % restants",
    usagePlan: "Forfait : {plan}",
    usageUnlimited: "Illimité",
    usageUnknown: "Inconnu",
    usageResetDue: "Réinitialisation en attente",
    usageResetsInDaysHours: "Réinitialisation dans {days} j {hours} h",
    usageResetsInHoursMinutes: "Réinitialisation dans {hours} h {minutes} min",
    usageFiveHourWindow: "Fenêtre de 5 heures",
    usageSevenDayWindow: "Fenêtre de 7 jours",
    usageSevenDayOpusWindow: "Fenêtre Opus de 7 jours",
    usageWeeklyWindow: "Quota hebdomadaire",
    usageRollingWindow: "Fenêtre glissante",
    usagePremiumRequests: "Requêtes premium",
    usageChatRequests: "Requêtes de chat",
    usagePromptCredits: "Crédits Prompt",
    usageDailyWindow: "Quota quotidien",
    usageMonthlyWindow: "Quota mensuel",
    usageBillingCycle: "Cycle de facturation",
    usageProviderQuota: "Quota du fournisseur",
    confirmProviderSwitch: "Changer de profil Provider ?",
    useProviderProfile: "Changer",
    cancel: "Annuler",
    providerReviewRequired: "Vérifiez ce changement dans l’espace Agent.",
    providerSwitchFailed: "Le changement de Provider a échoué.",
    openAgents: "Ouvrir Agents",
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
    agents: "Agents",
    openAgent: "Agent-Arbeitsbereich öffnen…",
    manageAgents: "Agents verwalten…",
    agentUsage: "Agent-Kontingente",
    refreshAgentUsage: "Kontingente aktualisieren",
    usageLoading: "Wird geladen…",
    usageCached: "Zwischengespeichert",
    usageNotConnected: "Nicht verbunden",
    usageExpired: "Anmeldedaten abgelaufen",
    usageUnavailable: "Nutzung nicht verfügbar",
    usageNoQuota: "Der Anbieter hat kein Kontingent gemeldet",
    usageRemaining: "{remaining} % verbleibend",
    usagePlan: "Tarif: {plan}",
    usageUnlimited: "Unbegrenzt",
    usageUnknown: "Unbekannt",
    usageResetDue: "Zurücksetzung ausstehend",
    usageResetsInDaysHours: "Zurücksetzung in {days} T {hours} Std.",
    usageResetsInHoursMinutes: "Zurücksetzung in {hours} Std. {minutes} Min.",
    usageFiveHourWindow: "5-Stunden-Fenster",
    usageSevenDayWindow: "7-Tage-Fenster",
    usageSevenDayOpusWindow: "7-Tage-Opus-Fenster",
    usageWeeklyWindow: "Wochenkontingent",
    usageRollingWindow: "Rollierendes Fenster",
    usagePremiumRequests: "Premium-Anfragen",
    usageChatRequests: "Chat-Anfragen",
    usagePromptCredits: "Prompt-Guthaben",
    usageDailyWindow: "Tageskontingent",
    usageMonthlyWindow: "Monatskontingent",
    usageBillingCycle: "Abrechnungszeitraum",
    usageProviderQuota: "Anbieterkontingent",
    confirmProviderSwitch: "Provider-Profil wechseln?",
    useProviderProfile: "Wechseln",
    cancel: "Abbrechen",
    providerReviewRequired: "Prüfen Sie diese Änderung im Agent-Bereich.",
    providerSwitchFailed: "Der Provider-Wechsel ist fehlgeschlagen.",
    openAgents: "Agents öffnen",
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
    agents: "Agents",
    openAgent: "Abrir espacio de Agent…",
    manageAgents: "Gestionar Agents…",
    agentUsage: "Cuotas de Agents",
    refreshAgentUsage: "Actualizar cuotas",
    usageLoading: "Cargando…",
    usageCached: "En caché",
    usageNotConnected: "Sin conexión",
    usageExpired: "Credenciales caducadas",
    usageUnavailable: "Uso no disponible",
    usageNoQuota: "El proveedor no informó de una cuota",
    usageRemaining: "{remaining} % restante",
    usagePlan: "Plan: {plan}",
    usageUnlimited: "Ilimitado",
    usageUnknown: "Desconocido",
    usageResetDue: "Restablecimiento pendiente",
    usageResetsInDaysHours: "Se restablece en {days} d {hours} h",
    usageResetsInHoursMinutes: "Se restablece en {hours} h {minutes} min",
    usageFiveHourWindow: "Ventana de 5 horas",
    usageSevenDayWindow: "Ventana de 7 días",
    usageSevenDayOpusWindow: "Ventana Opus de 7 días",
    usageWeeklyWindow: "Cuota semanal",
    usageRollingWindow: "Ventana móvil",
    usagePremiumRequests: "Solicitudes premium",
    usageChatRequests: "Solicitudes de chat",
    usagePromptCredits: "Créditos de Prompt",
    usageDailyWindow: "Cuota diaria",
    usageMonthlyWindow: "Cuota mensual",
    usageBillingCycle: "Ciclo de facturación",
    usageProviderQuota: "Cuota del proveedor",
    confirmProviderSwitch: "¿Cambiar el perfil de Provider?",
    useProviderProfile: "Cambiar",
    cancel: "Cancelar",
    providerReviewRequired: "Revisa este cambio en el espacio de Agent.",
    providerSwitchFailed: "No se pudo cambiar el Provider.",
    openAgents: "Abrir Agents",
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

const MAX_AGENT_USAGE_MENU_LABEL_LENGTH = 180;
const MAX_AGENT_USAGE_MENU_METRICS = 64;

function formatNativeTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function sanitizeNativeMenuLabel(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, MAX_AGENT_USAGE_MENU_LABEL_LENGTH);
}

const KNOWN_USAGE_METRIC_LABELS: Readonly<
  Record<string, keyof TrayMenuLabels>
> = {
  fiveHour: "usageFiveHourWindow",
  sevenDay: "usageSevenDayWindow",
  sevenDayOpus: "usageSevenDayOpusWindow",
  weekly: "usageWeeklyWindow",
  rolling: "usageRollingWindow",
  premium: "usagePremiumRequests",
  chat: "usageChatRequests",
  promptCredits: "usagePromptCredits",
};

function resolveNativeMetricLabel(
  metric: AgentUsageMetric,
  labels: TrayMenuLabels,
): string {
  if (metric.scope.kind === "model") {
    return sanitizeNativeMenuLabel(
      metric.scope.label,
      labels.usageProviderQuota,
    );
  }
  const known = KNOWN_USAGE_METRIC_LABELS[metric.id];
  if (known) return labels[known];
  if (metric.period.kind === "calendar") {
    return {
      day: labels.usageDailyWindow,
      week: labels.usageWeeklyWindow,
      month: labels.usageMonthlyWindow,
      "billing-cycle": labels.usageBillingCycle,
    }[metric.period.unit];
  }
  if (
    metric.period.kind === "rolling" &&
    metric.period.durationSeconds === 18_000
  ) {
    return labels.usageFiveHourWindow;
  }
  if (metric.period.kind === "provider-defined") {
    return labels.usageProviderQuota;
  }
  return sanitizeNativeMenuLabel(metric.label, labels.usageProviderQuota);
}

function formatNativeUsageReset(
  resetsAt: number | null,
  labels: TrayMenuLabels,
  now: () => number,
): string {
  if (resetsAt === null || !Number.isFinite(resetsAt)) return "";
  const remainingMinutes = Math.max(0, Math.ceil((resetsAt - now()) / 60_000));
  if (remainingMinutes === 0) return labels.usageResetDue;
  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  if (days > 0) {
    return formatNativeTemplate(labels.usageResetsInDaysHours, { days, hours });
  }
  return formatNativeTemplate(labels.usageResetsInHoursMinutes, {
    hours,
    minutes: remainingMinutes % 60,
  });
}

function formatNativeMetricValue(
  metric: AgentUsageMetric,
  labels: TrayMenuLabels,
): string {
  if (metric.value.kind === "unlimited") return labels.usageUnlimited;
  const remaining = getUsageMetricRemainingPercent(metric);
  if (remaining === null) return labels.usageUnknown;
  const percentage = formatNativeTemplate(labels.usageRemaining, { remaining });
  if (metric.value.kind !== "amount") return percentage;
  const unit = sanitizeNativeMenuLabel(metric.value.unit, "");
  const amount = `${metric.value.remainingAmount}/${metric.value.limitAmount}${
    unit ? ` ${unit}` : ""
  }`;
  return `${percentage} · ${amount}`;
}

function quotaStatusLabel(
  quota: AgentUsageQuota,
  labels: TrayMenuLabels,
): string {
  if (quota.status === "no-credentials") return labels.usageNotConnected;
  if (quota.status === "expired") return labels.usageExpired;
  if (quota.status === "unavailable") return labels.usageUnavailable;
  if (quota.metrics.length === 0) return labels.usageNoQuota;
  return formatNativeMetricValue(getPrimaryUsageMetric(quota)!, labels);
}

function buildNativeUsageEntry(
  entry: AgentUsageTrayEntry,
  labels: TrayMenuLabels,
  now: () => number,
): MenuItemConstructorOptions {
  const name = sanitizeNativeMenuLabel(entry.name, entry.id);
  const summary =
    entry.isLoading || !entry.quota
      ? labels.usageLoading
      : quotaStatusLabel(entry.quota, labels);
  const suffix = entry.isStale ? ` · ${labels.usageCached}` : "";
  const label = sanitizeNativeMenuLabel(`${name} — ${summary}${suffix}`, name);
  if (!entry.quota || entry.quota.status !== "ok") {
    return { label, enabled: false };
  }

  const submenu: MenuItemConstructorOptions[] = [];
  const plan = entry.quota.plan ? formatAgentUsagePlan(entry.quota.plan) : "";
  if (plan) {
    submenu.push({
      label: sanitizeNativeMenuLabel(
        formatNativeTemplate(labels.usagePlan, { plan }),
        labels.usagePlan,
      ),
      enabled: false,
    });
  }
  if (entry.isStale) {
    submenu.push({ label: labels.usageCached, enabled: false });
  }
  if (entry.quota.metrics.length === 0) {
    submenu.push({ label: labels.usageNoQuota, enabled: false });
  }
  for (const metric of entry.quota.metrics.slice(
    0,
    MAX_AGENT_USAGE_MENU_METRICS,
  )) {
    const metricLabel = resolveNativeMetricLabel(metric, labels);
    const value = formatNativeMetricValue(metric, labels);
    const reset = formatNativeUsageReset(metric.resetsAt, labels, now);
    submenu.push({
      label: sanitizeNativeMenuLabel(
        `${metricLabel} — ${value}${reset ? ` · ${reset}` : ""}`,
        metricLabel,
      ),
      enabled: false,
    });
  }
  return { label, submenu };
}

interface BuildTrayMenuTemplateOptions {
  agentManagementEnabled: boolean;
  agentProviderGroups?: AgentProviderTrayGroup[];
  agentUsageEntries?: AgentUsageTrayEntry[];
  isWindowVisible: boolean;
  labels: TrayMenuLabels;
  now?: () => number;
  onAgentProviderProfile?: (agentId: string, profileId: string) => void;
  onCommand: (command: AppCommand) => void;
  onRefreshAgentUsage?: () => void;
  onQuit: () => void;
  onToggleWindow: () => void;
}

export function buildTrayMenuTemplate({
  agentManagementEnabled,
  agentProviderGroups = [],
  agentUsageEntries = [],
  isWindowVisible,
  labels,
  now = Date.now,
  onAgentProviderProfile = () => undefined,
  onCommand,
  onRefreshAgentUsage = () => undefined,
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
    const usageSubmenu: MenuItemConstructorOptions[] =
      agentUsageEntries.length > 0
        ? agentUsageEntries.map((entry) =>
            buildNativeUsageEntry(entry, labels, now),
          )
        : [{ label: labels.usageUnavailable, enabled: false }];
    usageSubmenu.push(
      { type: "separator" },
      { label: labels.refreshAgentUsage, click: onRefreshAgentUsage },
      {
        label: labels.openAgents,
        click: () => onCommand({ type: "agent:manage" }),
      },
    );
    template.push({ label: labels.agentUsage, submenu: usageSubmenu });
    if (agentProviderGroups.length > 0) {
      template.push({
        label: labels.agents,
        submenu: [
          ...agentProviderGroups.map((group) => ({
            label: group.name,
            submenu: [
              ...group.profiles.map((profile) => ({
                label: profile.model
                  ? `${profile.name} · ${profile.model}`
                  : profile.name,
                type: profile.isCurrent
                  ? ("checkbox" as const)
                  : ("normal" as const),
                checked: profile.isCurrent,
                enabled: !profile.isCurrent,
                click: profile.isCurrent
                  ? undefined
                  : () => onAgentProviderProfile(group.agentId, profile.id),
              })),
              { type: "separator" as const },
              {
                label: labels.openAgent,
                click: () => onCommand({ type: "agent:manage" }),
              },
            ],
          })),
          { type: "separator" },
          {
            label: labels.manageAgents,
            click: () => onCommand({ type: "agent:manage" }),
          },
        ],
      });
    } else {
      template.push({
        label: labels.manageAgents,
        click: () => onCommand({ type: "agent:manage" }),
      });
    }
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
