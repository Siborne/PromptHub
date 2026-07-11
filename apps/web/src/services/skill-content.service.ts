import dns from 'node:dns/promises';

import { parseSkillMd } from '@prompthub/core/skills/skill-frontmatter';
import type {
  SafetyScanAIConfig,
  SkillSafetyFinding,
  SkillSafetyLevel,
  SkillSafetyReport,
  SkillSafetyScanInput,
} from '@prompthub/shared';
import {
  buildChatEndpointFromBase,
  buildHeadersForProtocol,
  resolveAIProtocol,
  resolveProtocolBase,
} from '@prompthub/shared/utils/ai-protocol';

const AI_REQUEST_TIMEOUT_MS = 60_000;

const TRUSTED_HOSTS = new Set(['github.com', 'raw.githubusercontent.com', 'skills.sh']);
const SAFETY_SCAN_BLOCKED_SOURCE_ERROR = 'SAFETY_SCAN_BLOCKED_SOURCE';

const AI_SAFETY_SYSTEM_PROMPT = `You are a security auditor for AI skill files (SKILL.md). Analyze the provided skill content and output a JSON object with this exact schema:
{
  "level": "safe" | "warn" | "high-risk" | "blocked",
  "findings": [
    {
      "code": "string",
      "severity": "info" | "warn" | "high",
      "title": "short title",
      "detail": "why this is risky",
      "evidence": "trigger text (max 160 chars)",
      "filePath": "optional path"
    }
  ],
  "summary": "1-2 sentence summary"
}

## Canonical finding codes
Prefer these exact codes whenever they apply:
- shell-pipe-exec
- dangerous-delete
- encoded-powershell
- encoded-shell-bootstrap
- privilege-escalation
- system-persistence
- secret-access
- security-bypass
- network-exfil
- exec-bit
- network-bootstrap
- env-mutation
- unknown-source
- invalid-source-url
- insecure-source-url
- untrusted-source-host
- internal-source
- external-audits
- persistence-file
- high-risk-binary
- script-file

Additional code guidance:
- Use unknown-source when the prompt does not include a source URL and the skill provenance is unclear.
- Use invalid-source-url for malformed URLs.
- Use insecure-source-url for non-HTTPS URLs.
- Use untrusted-source-host when the source host is not github.com, raw.githubusercontent.com, or skills.sh.
- Use internal-source when preflight validation says the source resolves to a blocked or internal address.
- Use external-audits when marketplace audit metadata is present and it materially affects the review.

Focus on intent and context. Output JSON only.`;

interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ParsedRemoteSkill {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  body: string;
  raw: string;
}

function isLoopbackOrPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10 || parts[0] === 127) {
    return true;
  }
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  return false;
}

function isLoopbackOrPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function resolvePublicAddress(hostname: string): Promise<void> {
  const normalizedHostname = hostname.trim().toLowerCase();
  const addresses = await dns.lookup(normalizedHostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error('No public address resolved');
  }

  for (const entry of addresses) {
    if (entry.family === 4 && isLoopbackOrPrivateIpv4(entry.address)) {
      throw new Error('Access to local network addresses is not allowed');
    }
    if (entry.family === 6 && isLoopbackOrPrivateIpv6(entry.address)) {
      throw new Error('Access to local network addresses is not allowed');
    }
  }
}

async function collectSourcePreflightFindings(
  input: SkillSafetyScanInput,
): Promise<SkillSafetyFinding[]> {
  const findings: SkillSafetyFinding[] = [];
  const urls = [input.sourceUrl, input.contentUrl].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  if (urls.length === 0) {
    findings.push({
      code: 'unknown-source',
      severity: 'warn',
      title: 'Source provenance is missing',
      detail: 'The skill does not declare a source URL. Review it carefully before trusting it.',
    });
    return findings;
  }

  for (const urlValue of urls) {
    let parsed: URL;
    try {
      parsed = new URL(urlValue);
    } catch {
      findings.push({
        code: 'invalid-source-url',
        severity: 'warn',
        title: 'Source URL is invalid',
        detail: 'The skill declares a malformed source URL, so provenance cannot be verified cleanly.',
        evidence: urlValue,
      });
      continue;
    }

    if (parsed.protocol !== 'https:') {
      findings.push({
        code: 'insecure-source-url',
        severity: 'warn',
        title: 'Source URL is not HTTPS',
        detail: 'The skill uses a non-HTTPS source URL, which weakens transport integrity.',
        evidence: urlValue,
      });
    }

    const host = parsed.hostname.toLowerCase();
    if (!TRUSTED_HOSTS.has(host)) {
      findings.push({
        code: 'untrusted-source-host',
        severity: 'warn',
        title: 'Source host is not a known marketplace host',
        detail: 'The skill comes from a custom host. That is not necessarily unsafe, but it should be reviewed manually.',
        evidence: host,
      });
    }

    try {
      await resolvePublicAddress(host);
    } catch (error) {
      findings.push({
        code: 'internal-source',
        severity: 'high',
        title: 'Source resolves to a blocked or internal address',
        detail: 'The declared source host resolves to a local or internal address and should not be trusted for marketplace delivery.',
        evidence: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return findings;
}

async function chatCompletion(
  config: SafetyScanAIConfig,
  messages: AIChatMessage[],
): Promise<string> {
  if (!config.apiKey || !config.apiUrl || !config.model) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const protocol = resolveAIProtocol(config);
  const endpoint = buildChatEndpointFromBase(
    resolveProtocolBase(config.apiUrl, protocol),
  );
  const headers = buildHeadersForProtocol(protocol, config.apiKey, {
    accept: 'application/json',
  });
  const isGemini = protocol === 'gemini';
  const isAnthropic = protocol === 'anthropic';
  const model = isGemini ? config.model.replace(/^models\//, '') : config.model;

  const body: Record<string, unknown> = isAnthropic
    ? {
        model,
        max_tokens: 4096,
        messages: messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
          })),
        stream: false,
      }
    : {
        model,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
        stream: false,
        response_format: { type: 'json_object' },
      };

  if (isAnthropic) {
    const systemMessage = messages.find((message) => message.role === 'system');
    if (systemMessage?.content) {
      body.system = systemMessage.content;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `AI API request failed (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as Record<string, unknown>;
        const inner = errorJson.error as Record<string, unknown> | undefined;
        errorMessage =
          (inner?.message as string) ??
          (errorJson.message as string) ??
          errorMessage;
      } catch {
        // keep default error message
      }
      throw new Error(errorMessage);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: Array<{ type?: string; text?: string }>;
    };

    const content = isAnthropic
      ? (json.content ?? [])
          .filter(
            (item): item is { type?: string; text: string } =>
              item?.type === 'text' && typeof item.text === 'string',
          )
          .map((item) => item.text)
          .join('')
      : json.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error('AI API returned an unexpected response format');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function buildSummary(
  level: SkillSafetyLevel,
  findings: SkillSafetyFinding[],
  checkedFileCount: number,
): string {
  if (level === 'safe') {
    return `No obvious malicious patterns were detected across ${checkedFileCount} scanned files.`;
  }

  const highCount = findings.filter((finding) => finding.severity === 'high').length;
  const warnCount = findings.filter((finding) => finding.severity === 'warn').length;
  const blockedText =
    level === 'blocked' ? ' Installation should be blocked until reviewed.' : '';

  return `Detected ${highCount} high-risk and ${warnCount} warning findings across ${checkedFileCount} scanned files.${blockedText}`;
}

function parseAIReport(
  raw: string,
  checkedFileCount: number,
  now: number,
): SkillSafetyReport {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned) as {
    level?: unknown;
    findings?: unknown[];
    summary?: unknown;
  };

  if (
    parsed.level !== 'safe' &&
    parsed.level !== 'warn' &&
    parsed.level !== 'high-risk' &&
    parsed.level !== 'blocked'
  ) {
    throw new Error(`Invalid AI report level: ${String(parsed.level)}`);
  }

  const findings: SkillSafetyFinding[] = Array.isArray(parsed.findings)
    ? parsed.findings.flatMap((finding) => {
        if (!finding || typeof finding !== 'object') {
          return [];
        }

        const rawFinding = finding as Record<string, unknown>;
        if (
          typeof rawFinding.code !== 'string' ||
          (rawFinding.severity !== 'info' &&
            rawFinding.severity !== 'warn' &&
            rawFinding.severity !== 'high') ||
          typeof rawFinding.title !== 'string' ||
          typeof rawFinding.detail !== 'string'
        ) {
          return [];
        }

        return [
          {
            code: rawFinding.code,
            severity: rawFinding.severity,
            title: rawFinding.title,
            detail: rawFinding.detail,
            evidence:
              typeof rawFinding.evidence === 'string'
                ? rawFinding.evidence.slice(0, 160)
                : undefined,
            filePath:
              typeof rawFinding.filePath === 'string'
                ? rawFinding.filePath
                : undefined,
          } satisfies SkillSafetyFinding,
        ];
      })
    : [];

  return {
    level: parsed.level,
    findings,
    recommendedAction:
      parsed.level === 'blocked'
        ? 'block'
        : parsed.level === 'high-risk'
          ? 'review'
          : 'allow',
    scannedAt: now,
    checkedFileCount,
    scanMethod: 'ai',
    summary:
      typeof parsed.summary === 'string' && parsed.summary.length > 0
        ? parsed.summary
        : buildSummary(parsed.level, findings, checkedFileCount),
    score:
      parsed.level === 'safe'
        ? 95
        : parsed.level === 'warn'
          ? 65
          : parsed.level === 'high-risk'
            ? 35
            : 5,
  };
}

export function scanSkillContent(content: string): SkillSafetyReport {
  const normalized = content.trim();
  const blocked = /\b(?:curl|wget)\b[\s\S]{0,120}?\|\s*(?:sh|bash|zsh|fish|pwsh|powershell)\b/i.test(
    normalized,
  );
  const findings: SkillSafetyFinding[] = blocked
    ? [
        {
          code: 'shell-pipe-exec',
          severity: 'high',
          title: 'Detected pipe-to-shell execution',
          detail:
            'The skill content downloads remote content and pipes it directly into a shell.',
          evidence: normalized.slice(0, 160),
          filePath: 'SKILL.md',
        },
      ]
    : [];
  const level: SkillSafetyLevel = blocked ? 'blocked' : 'safe';

  return {
    level,
    findings,
    recommendedAction: blocked ? 'block' : 'allow',
    scannedAt: Date.now(),
    checkedFileCount: normalized ? 1 : 0,
    scanMethod: 'ai',
    summary: buildSummary(level, findings, normalized ? 1 : 0),
    score: blocked ? 5 : 95,
  };
}

export async function scanSkillContentWithAI(
  input: SkillSafetyScanInput,
): Promise<SkillSafetyReport> {
  if (!input.aiConfig?.apiKey || !input.aiConfig?.apiUrl || !input.aiConfig?.model) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const preflightFindings = await collectSourcePreflightFindings(input);
  if (preflightFindings.some((finding) => finding.code === 'internal-source')) {
    throw new Error(SAFETY_SCAN_BLOCKED_SOURCE_ERROR);
  }

  const parts: string[] = [];
  if (input.name) {
    parts.push(`## Skill Name\n${input.name}`);
  }
  if (input.sourceUrl) {
    parts.push(`## Source URL\n${input.sourceUrl}`);
  }
  if (input.contentUrl) {
    parts.push(`## Content URL\n${input.contentUrl}`);
  }
  if (input.securityAudits?.length) {
    parts.push(`## Marketplace Audit Metadata\n${input.securityAudits.join('\n')}`);
  }
  if (preflightFindings.length > 0) {
    parts.push(
      `## Preflight Validation Findings\n${preflightFindings
        .map((finding) => {
          const segments = [
            `- code: ${finding.code}`,
            `severity: ${finding.severity}`,
            `title: ${finding.title}`,
            `detail: ${finding.detail}`,
          ];
          if (finding.evidence) {
            segments.push(`evidence: ${finding.evidence}`);
          }
          return segments.join(' | ');
        })
        .join('\n')}`,
    );
  }
  if (input.content) {
    parts.push(`## SKILL.md Content\n\`\`\`markdown\n${input.content}\n\`\`\``);
  }
  if (parts.length === 0) {
    parts.push('No skill content provided for analysis.');
  }

  const raw = await chatCompletion(input.aiConfig, [
    { role: 'system', content: AI_SAFETY_SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n\n') },
  ]);

  const checkedFileCount = input.content ? 1 : 0;
  return parseAIReport(raw, checkedFileCount, Date.now());
}

export function parseRemoteSkill(content: string): ParsedRemoteSkill {
  const parsed = parseSkillMd(content);
  if (!parsed) {
    return {
      body: content.trim(),
      raw: content,
    };
  }

  const frontmatter = parsed.frontmatter;
  return {
    ...(frontmatter.name ? { name: frontmatter.name } : {}),
    ...(frontmatter.description !== undefined ? { description: frontmatter.description } : {}),
    ...(frontmatter.version !== undefined ? { version: frontmatter.version } : {}),
    ...(frontmatter.author !== undefined ? { author: frontmatter.author } : {}),
    ...(frontmatter.tags !== undefined ? { tags: frontmatter.tags } : {}),
    body: parsed.body,
    raw: content,
  };
}
