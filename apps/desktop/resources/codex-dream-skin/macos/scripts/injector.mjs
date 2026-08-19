import fs from "node:fs/promises";
import { watch as watchFs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./injector-args.mjs";
import {
  bestEffortOperationUi,
  nextOperationToken,
  presentOperationUi,
} from "./injector-operation-ui.mjs";
import {
  isFreshBusyOperation,
  watchOperationState,
  writeModeAck,
} from "./injector-operation-state.mjs";
import {
  invalidateStaticPayloadAssets,
  loadPayload,
  SKIN_VERSION,
} from "./injector-theme.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const root = path.resolve(here, "..");
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CDP_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;

function validatedDebuggerUrl(target, port) {
  const url = new URL(target.webSocketDebuggerUrl);
  const pathIsValid = /^\/devtools\/page\/[A-Za-z0-9._-]{1,200}$/.test(url.pathname);
  if (
    url.protocol !== "ws:" || !LOOPBACK_HOSTS.has(url.hostname) || Number(url.port) !== port
    || url.username || url.password || url.search || url.hash || !pathIsValid
  ) {
    throw new Error("Rejected a CDP WebSocket URL outside the allowed loopback page endpoint shape");
  }
  return url.href;
}

function isValidCdpPageTarget(item, port) {
  if (
    item?.type !== "page" || !item.url?.startsWith("app://")
    || typeof item.id !== "string" || !CDP_ID_PATTERN.test(item.id)
    || !item.webSocketDebuggerUrl
  ) return false;
  try {
    const debuggerUrl = new URL(validatedDebuggerUrl(item, port));
    return debuggerUrl.pathname === `/devtools/page/${item.id}`;
  } catch {
    return false;
  }
}

class CdpSession {
  constructor(target, port) {
    this.target = target;
    this.ws = new WebSocket(validatedDebuggerUrl(target, port));
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { this.ws.close(); } catch {}
        reject(new Error("CDP WebSocket open timed out"));
      }, 5000);
      this.ws.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("CDP WebSocket open failed")); }, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.onMessage(event));
    this.ws.addEventListener("error", () => this.close());
    this.ws.addEventListener("close", () => {
      this.closed = true;
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    return this;
  }

  onMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      this.close();
      return;
    }
    if (!message || typeof message !== "object") {
      this.close();
      return;
    }
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timeout);
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) {
      try { listener(message.params ?? {}); } catch (error) {
        console.error(`[dream-skin] CDP listener failed: ${error.message}`);
      }
    }
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}, timeoutMs = 10000) {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression, timeoutMs = 10000) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    }, timeoutMs);
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Renderer evaluation failed: ${detail}`);
    }
    return result.result?.value;
  }

  close() {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("CDP session closed"));
    }
    this.pending.clear();
    if (!this.closed) {
      try { this.ws.close(); } catch {}
    }
    this.closed = true;
  }
}

async function listAppTargets(port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const targets = await response.json();
    if (!Array.isArray(targets)) throw new Error("CDP target list was not an array");
    return targets.filter((item) => isValidCdpPageTarget(item, port));
  } finally {
    clearTimeout(timeout);
  }
}

async function probeSession(session) {
  return session.evaluate(`(() => {
    const markers = {
      shell: Boolean(document.querySelector('main.main-surface')),
      sidebar: Boolean(document.querySelector('aside.app-shell-left-panel')),
      composer: Boolean(document.querySelector('.composer-surface-chrome')),
      main: Boolean(document.querySelector('[role="main"]')),
    };
    return {
      title: document.title,
      href: location.href,
      markers,
      codex: markers.shell && markers.sidebar,
    };
  })()`);
}

async function waitForCodexProbe(session, timeoutMs = 1800) {
  const deadline = Date.now() + timeoutMs;
  let probe = null;
  while (Date.now() < deadline) {
    probe = await probeSession(session);
    if (probe?.codex) return probe;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return probe;
}

async function connectTarget(target, port) {
  return new CdpSession(target, port).open();
}

async function connectCodexTargets(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const targets = await listAppTargets(port);
      const connected = [];
      for (const target of targets) {
        let session;
        try {
          session = await connectTarget(target, port);
          const probe = await probeSession(session);
          if (probe?.codex) connected.push({ target, session, probe });
          else session.close();
        } catch (error) {
          session?.close();
          lastError = error;
        }
      }
      if (connected.length) return connected;
      lastError = new Error("No page matched the expected ChatGPT shell markers");
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`No verified ChatGPT renderer on 127.0.0.1:${port}: ${lastError?.message ?? "timed out"}`);
}

async function applyToSession(session, payload) {
  return session.evaluate(payload);
}

async function removeFromSession(session) {
  return session.evaluate(`(() => {
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    const state = window.__CODEX_DREAM_SKIN_STATE__;
    if (state?.cleanup) return state.cleanup();
    document.documentElement?.classList.remove('codex-dream-skin');
    document.documentElement?.style.removeProperty('--dream-skin-art');
    document.getElementById('codex-dream-skin-style')?.remove();
    document.getElementById('codex-dream-skin-chrome')?.remove();
    delete window.__CODEX_DREAM_SKIN_STATE__;
    return true;
  })()`);
}

async function verifyRemovedSession(session) {
  return session.evaluate(`(() =>
    !document.documentElement.classList.contains('codex-dream-skin') &&
    !document.getElementById('codex-dream-skin-style') &&
    !document.getElementById('codex-dream-skin-chrome') &&
    !window.__CODEX_DREAM_SKIN_STATE__
  )()`);
}

async function verifySession(session, expectedThemeId = null, expectedRevision = null) {
  return session.evaluate(`(() => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        width: Math.round(r.width), height: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      };
    };
    const homeIndicator = document.querySelector('[data-testid="home-icon"]');
    const homeSignal = homeIndicator ?? document.querySelector('[data-feature="game-source"]') ??
      document.querySelector('.group\\\\/home-suggestions');
    const homeRoute = homeSignal?.closest('[role="main"]') ?? null;
    const home = document.querySelector('[role="main"].dream-skin-home');
    const suggestions = home?.querySelector('.group\\\\/home-suggestions') ?? null;
    const cardButtons = suggestions ? [...suggestions.querySelectorAll('button')] : [];
    const cardBoxes = cardButtons.map(box);
    const visibleCards = cardBoxes.filter((item) => item?.visible);
    const suggestionLabels = cardButtons.flatMap((button) => {
      const expectedColor = getComputedStyle(button).color;
      return [...button.querySelectorAll('*')]
        .filter((node) => [...node.childNodes].some((child) =>
          child.nodeType === 3 && child.textContent.trim()))
        .map((node) => ({
          ...box(node),
          text: node.textContent.trim().slice(0, 80),
          color: getComputedStyle(node).color,
          expectedColor,
        }));
    });
    const visibleSuggestionLabels = suggestionLabels.filter((item) => item?.visible);
    const suggestionLabelColorsMatch = visibleSuggestionLabels.every((item) =>
      item.color === item.expectedColor);
    const hero = box(home?.firstElementChild?.firstElementChild?.firstElementChild);
    const projectButton = box(home?.querySelector('.group\\\\/project-selector > button'));
    const shell = box(document.querySelector('main.main-surface'));
    const composer = box(document.querySelector('.composer-surface-chrome'));
    const sidebar = box(document.querySelector('aside.app-shell-left-panel'));
    const chrome = document.getElementById('codex-dream-skin-chrome');
    const result = {
      installed: document.documentElement.classList.contains('codex-dream-skin'),
      version: window.__CODEX_DREAM_SKIN_STATE__?.version ?? null,
      themeId: window.__CODEX_DREAM_SKIN_STATE__?.themeId ?? null,
      revision: window.__CODEX_DREAM_SKIN_STATE__?.revision ?? null,
      stylePresent: Boolean(document.getElementById('codex-dream-skin-style')),
      chromePresent: Boolean(chrome),
      chromePointerEvents: getComputedStyle(chrome || document.body).pointerEvents,
      homeRoute: Boolean(homeRoute),
      homePresent: Boolean(home),
      hero,
      cards: cardBoxes,
      visibleCardCount: visibleCards.length,
      suggestionLabels,
      suggestionLabelColorsMatch,
      projectButton,
      shell,
      composer,
      sidebar,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: {
        x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      },
    };
    const basePass = result.installed && result.version === ${JSON.stringify(SKIN_VERSION)} &&
      result.stylePresent && result.chromePresent && result.chromePointerEvents === 'none' &&
      Boolean(result.shell?.visible) && Boolean(result.sidebar?.visible) && !result.documentOverflow.x;
    const expectedThemeId = ${JSON.stringify(expectedThemeId)};
    const expectedRevision = ${JSON.stringify(expectedRevision)};
    const payloadPass = (!expectedThemeId || result.themeId === expectedThemeId) &&
      (!expectedRevision || result.revision === expectedRevision);
    // Project selector markup varies across Codex builds — soft requirement.
    const homePass = !result.homeRoute || (
      result.homePresent && result.hero?.visible && result.hero.width >= 280 &&
      result.hero.height >= 120 && (result.visibleCardCount === 0 || (
        visibleSuggestionLabels.length >= result.visibleCardCount &&
        result.suggestionLabelColorsMatch
      ))
    );
    result.pass = Boolean(basePass && homePass && payloadPass);
    result.expectedThemeId = expectedThemeId;
    result.expectedRevision = expectedRevision;
    result.softNotes = {
      projectButtonOptional: !result.projectButton?.visible,
      composerOptionalOnNonTaskRoutes: !result.composer?.visible,
      suggestionCardsOptional: result.homeRoute && result.visibleCardCount === 0,
    };
    return result;
  })()`);
}

async function waitForVerifiedSession(session, timeoutMs, expectedThemeId = null, expectedRevision = null) {
  const deadline = Date.now() + timeoutMs;
  let lastResult;
  while (Date.now() < deadline) {
    lastResult = await verifySession(session, expectedThemeId, expectedRevision);
    if (lastResult.pass) return lastResult;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return lastResult;
}

async function capture(session, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(outputPath, Buffer.from(result.data, "base64"));
}

function operationKindMessage(kind) {
  if (kind === "pause") return "正在暂停皮肤…";
  if (kind === "switch") return "正在切换主题…";
  return "正在应用皮肤…";
}

async function runBeginOperation(options) {
  const connected = await connectCodexTargets(options.port, options.timeoutMs);
  const operationToken = options.operationToken ?? nextOperationToken();
  let shown = false;
  try {
    const results = await Promise.all(connected.map(({ session }) => presentOperationUi(
      session,
      operationToken,
      "loading",
      operationKindMessage(options.operationKind),
      Math.max(250, Math.floor(options.timeoutMs / 2)),
    )));
    shown = results.some(Boolean);
  } finally {
    for (const { session } of connected) session.close();
  }
  if (!shown) throw new Error("Could not show operation progress in the verified ChatGPT renderer");
  process.stdout.write(`${operationToken}\n`);
}

async function runFinishOperation(options) {
  const connected = await connectCodexTargets(options.port, options.timeoutMs);
  let shown = false;
  try {
    const results = await Promise.all(connected.map(({ session }) => presentOperationUi(
      session,
      options.operationToken,
      options.operationUiState,
      options.operationMessage,
      Math.max(250, Math.floor(options.timeoutMs / 2)),
    )));
    shown = results.some(Boolean);
  } finally {
    for (const { session } of connected) session.close();
  }
  if (!shown) throw new Error("Could not show the completed operation state in the verified ChatGPT renderer");
}

async function runOneShot(options) {
  const connected = await connectCodexTargets(options.port, options.timeoutMs);
  const operationToken = options.mode === "once" || options.mode === "remove"
    ? options.operationToken ?? nextOperationToken()
    : null;
  if (operationToken) {
    const message = options.mode === "remove" ? "正在暂停皮肤…" : "正在准备皮肤…";
    const action = options.operationToken ? presentOperationUi : (session, token, state, text) =>
      bestEffortOperationUi(session, "show", token, state, text);
    await Promise.all(connected.map(({ session }) => action(
      session, operationToken, "loading", message,
    )));
  }
  let loaded = null;
  try {
    loaded = (options.mode === "once" || options.mode === "verify" || options.reload)
      ? await loadPayload(options.themeDir)
      : null;
  } catch (error) {
    if (operationToken) {
      await Promise.all(connected.map(({ session }) => presentOperationUi(
        session, operationToken, "error", "皮肤准备失败",
      )));
    }
    for (const { session } of connected) session.close();
    throw error;
  }
  const payload = loaded?.payload ?? null;
  const results = [];
  let screenshotCaptured = false;

  for (const { target, session, probe } of connected) {
    try {
      if (options.mode === "remove") await removeFromSession(session);
      else if (options.mode === "once") {
        await bestEffortOperationUi(
          session, "update", operationToken, "loading", `正在应用「${loaded.theme.name}」…`,
        );
        await applyToSession(session, payload);
      }

      if (options.reload) {
        await session.send("Page.reload", { ignoreCache: true });
        await new Promise((resolve) => setTimeout(resolve, 1600));
        if (options.mode !== "remove") {
          if (operationToken) {
            await presentOperationUi(
              session, operationToken, "loading", `正在应用「${loaded.theme.name}」…`,
            );
          }
          await applyToSession(session, payload);
        }
      }

      if (operationToken) {
        await presentOperationUi(
          session,
          operationToken,
          "loading",
          options.mode === "remove" ? "正在确认皮肤已暂停…" : "正在检查显示效果…",
        );
      }
      const result = options.mode === "remove"
        ? await verifyRemovedSession(session)
        : await waitForVerifiedSession(
          session,
          options.timeoutMs,
          loaded?.theme.id ?? null,
          loaded?.revision ?? null,
        );
      results.push({ targetId: target.id, title: target.title, url: target.url, probe, result });
      if (operationToken) {
        const passed = options.mode === "remove" ? result === true : result?.pass;
        await presentOperationUi(
          session,
          operationToken,
          passed ? "success" : "error",
          passed
            ? options.mode === "remove" ? "皮肤已暂停" : `已应用「${loaded.theme.name}」`
            : options.mode === "remove" ? "暂停校验失败" : "显示校验失败",
        );
      }

      if (options.screenshot && !screenshotCaptured) {
        if (operationToken) {
          await bestEffortOperationUi(session, "hide", operationToken, "loading", "");
        }
        await capture(session, options.screenshot);
        screenshotCaptured = true;
      }
    } catch (error) {
      if (operationToken) {
        await presentOperationUi(
          session,
          operationToken,
          "error",
          options.mode === "remove" ? "暂停失败，请重试" : "应用失败，请重试",
        );
      }
      results.push({
        targetId: target.id,
        title: target.title,
        url: target.url,
        probe,
        error: error.message,
        result: null,
      });
    } finally {
      session.close();
    }
  }

  console.log(JSON.stringify({ mode: options.mode, version: SKIN_VERSION, port: options.port, targets: results }, null, 2));
  const failed = results.length === 0 || results.some((item) =>
    item.error || (options.mode === "remove" ? item.result !== true : !item.result?.pass));
  if (failed) process.exitCode = 2;
}

export function earlyPayloadFor(payload, revision) {
  return `(() => {
    const generationKey = "__CODEX_DREAM_SKIN_EARLY_GENERATION__";
    const appliedKey = "__CODEX_DREAM_SKIN_EARLY_APPLIED__";
    const generation = ${JSON.stringify(revision)};
    window[generationKey] = generation;
    let observer = null;
    let timeout = null;
    const stop = () => {
      observer?.disconnect();
      observer = null;
      if (timeout) clearTimeout(timeout);
      timeout = null;
    };
    const install = () => {
      if (window[generationKey] !== generation) { stop(); return true; }
      if (!document.documentElement) return false;
      const shell = document.querySelector('main.main-surface');
      const sidebar = document.querySelector('aside.app-shell-left-panel');
      if (!shell || !sidebar) return false;
      stop();
      ${payload};
      window[appliedKey] = generation;
      return true;
    };
    if (install()) return;
    if (typeof MutationObserver === "function" && document.documentElement) {
      observer = new MutationObserver(install);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    timeout = setTimeout(stop, 10000);
  })()`;
}

function watchPayloadSources(themeDir, onDirty) {
  const assetsRoot = path.join(root, "assets");
  const themeRoot = themeDir ?? assetsRoot;
  const watchers = [];
  const add = (directory, kind) => {
    let watcher;
    try {
      watcher = watchFs(directory, { persistent: false }, (_event, filename) => {
        const name = filename ? String(filename) : "";
        const staticChanged = directory === assetsRoot &&
          (!name || name === "dream-skin.css" || name === "renderer-inject.js");
        if (kind === "static" && !staticChanged) return;
        onDirty({ staticChanged });
      });
      watcher.on("error", (error) => {
        console.error(`[dream-skin] file watch unavailable for ${directory}: ${error.message}`);
      });
      watchers.push(watcher);
    } catch (error) {
      console.error(`[dream-skin] file watch unavailable for ${directory}: ${error.message}`);
    }
  };
  add(themeRoot, "theme");
  if (themeRoot !== assetsRoot) add(assetsRoot, "static");
  return () => watchers.forEach((watcher) => watcher.close());
}

async function runWatch(options) {
  let current = await loadPayload(options.themeDir);
  const sessions = new Map();
  const rejected = new Set();
  let stopping = false;
  let reloadTimer = null;
  let reloadChain = Promise.resolve();
  let discoveryDelayMs = 100;
  let lastListErrorAt = 0;
  let operationSignalChain = Promise.resolve();
  let activeOperation = null;
  let pauseRecovery = null;
  let controlOnly = false;
  let mutationEpoch = 0;
  let activeTargetSetups = 0;
  const targetSetupWaiters = new Set();
  let wakeControlWait = null;
  const wakeControlLoop = () => {
    const wake = wakeControlWait;
    wakeControlWait = null;
    wake?.();
  };
  const waitForControlOperation = () => new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (wakeControlWait === finish) wakeControlWait = null;
      resolve();
    };
    const timer = setTimeout(finish, 60000);
    wakeControlWait = finish;
  });
  const stop = () => {
    stopping = true;
    wakeControlLoop();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const beginTargetSetup = () => { activeTargetSetups += 1; };
  const finishTargetSetup = () => {
    activeTargetSetups = Math.max(0, activeTargetSetups - 1);
    if (activeTargetSetups !== 0) return;
    for (const resolve of targetSetupWaiters) resolve();
    targetSetupWaiters.clear();
  };
  const waitForTargetSetups = async (timeoutMs = 2500) => {
    if (activeTargetSetups === 0) return;
    let timeout;
    let release;
    const completed = new Promise((resolve) => {
      release = resolve;
      targetSetupWaiters.add(resolve);
    });
    try {
      await Promise.race([
        completed,
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Renderer setup did not quiesce for pause")), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
      targetSetupWaiters.delete(release);
    }
  };

  const registerEarly = async (session, payload, revision) => {
    const result = await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: earlyPayloadFor(payload, revision),
    });
    return result.identifier ?? null;
  };

  const removeEarlyIdentifier = async (record, identifier, { strict = false } = {}) => {
    if (!identifier) return true;
    if (record.session.closed) {
      if (strict) throw new Error("Renderer session closed before early script removal");
      return false;
    }
    try {
      await record.session.send(
        "Page.removeScriptToEvaluateOnNewDocument",
        { identifier },
        strict ? 1500 : 10000,
      );
      record.earlyScriptIds.delete(identifier);
      if (record.earlyScriptId === identifier) record.earlyScriptId = null;
      return true;
    } catch (error) {
      if (strict) throw error;
      return false;
    }
  };

  const removeEarly = async (record, { strict = false } = {}) => {
    const identifiers = new Set(record.earlyScriptIds);
    if (record.earlyScriptId) identifiers.add(record.earlyScriptId);
    const results = await Promise.all([...identifiers].map((identifier) =>
      removeEarlyIdentifier(record, identifier, { strict })));
    return results.every(Boolean);
  };

  const registerEarlyForRecord = async (record, payload, revision) => {
    const identifier = await registerEarly(record.session, payload, revision);
    if (identifier) record.earlyScriptIds.add(identifier);
    return identifier;
  };

  const invalidateEarly = async (record, { strict = false } = {}) => {
    record.needsLoadFallback = false;
    if (record.session.closed) {
      if (strict) throw new Error("Renderer session closed before pause invalidation");
    } else {
      await record.session.evaluate(`(() => {
        window.__CODEX_DREAM_SKIN_EARLY_GENERATION__ = ${JSON.stringify(`disabled:${process.pid}`)};
        window.__CODEX_DREAM_SKIN_DISABLED__ = true;
        return true;
      })()`, strict ? 1500 : 10000).catch((error) => {
        if (strict) throw error;
      });
    }
    return removeEarly(record, { strict });
  };

  const releaseControlSessions = () => {
    for (const record of sessions.values()) record.session.close();
    sessions.clear();
  };

  const restoreAfterAbortedPause = async (operation) => {
    mutationEpoch += 1;
    controlOnly = false;
    pauseRecovery = {
      token: operation.token,
      message: operation.message || "暂停失败，原皮肤已恢复",
    };
    releaseControlSessions();
    wakeControlLoop();
  };

  const refreshPayload = async () => {
    const refreshEpoch = mutationEpoch;
    let next;
    try {
      next = await loadPayload(options.themeDir);
    } catch (error) {
      await Promise.all([...sessions.values()].map(async (record) => {
        if (record.session.closed) return;
        const externalOperation = activeOperation;
        const operationToken = externalOperation?.token ?? nextOperationToken();
        record.operationToken = operationToken;
        record.operationExternal = Boolean(externalOperation);
        await presentOperationUi(
          record.session,
          operationToken,
          externalOperation ? "loading" : "error",
          externalOperation ? "正在准备主题…" : "主题读取失败，当前皮肤未改变",
        );
      }));
      throw error;
    }
    if (next.revision === current.revision) return;
    current = next;
    if (controlOnly || mutationEpoch !== refreshEpoch) {
      console.log(`[dream-skin] staged theme ${current.theme.id} while skin is paused`);
      return;
    }
    for (const record of sessions.values()) {
      const { session } = record;
      if (session.closed) continue;
      const externalOperation = activeOperation;
      const operationToken = externalOperation?.token ?? nextOperationToken();
      record.operationToken = operationToken;
      record.operationExternal = Boolean(externalOperation);
      try {
        await presentOperationUi(
          session, operationToken, "loading", `正在应用「${current.theme.name}」…`,
        );
        if (controlOnly || mutationEpoch !== refreshEpoch) continue;
        const nextIdentifier = await registerEarlyForRecord(
          record, current.payload, current.revision,
        );
        if (controlOnly || mutationEpoch !== refreshEpoch) {
          await removeEarlyIdentifier(record, nextIdentifier);
          continue;
        }
        if (record.earlyScriptId) {
          await removeEarlyIdentifier(record, record.earlyScriptId);
        }
        record.earlyScriptId = nextIdentifier;
        record.needsLoadFallback = !nextIdentifier;
        await applyToSession(session, current.payload);
        if (controlOnly || mutationEpoch !== refreshEpoch) continue;
        const verification = await waitForVerifiedSession(
          session,
          Math.min(options.timeoutMs, 8000),
          current.theme.id,
          current.revision,
        );
        if (!verification?.pass) throw new Error("Theme refresh verification failed");
        if (!externalOperation) {
          await presentOperationUi(session, operationToken, "success", `已应用「${current.theme.name}」`);
        }
      } catch (error) {
        record.needsLoadFallback = true;
        if (!externalOperation) {
          await presentOperationUi(session, operationToken, "error", "主题切换失败，未确认应用");
        }
        console.error(`[dream-skin] theme refresh failed: ${error.message}`);
      }
    }
    console.log(`[dream-skin] refreshed theme ${current.theme.id} (${current.timings.buildMs}ms)`);
  };

  const queuePayloadRefresh = ({ staticChanged = false } = {}) => {
    if (staticChanged) invalidateStaticPayloadAssets();
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      reloadChain = reloadChain.then(refreshPayload).catch((error) => {
        console.error(`[dream-skin] theme reload failed: ${error.message}`);
      });
    }, 45);
  };
  const closePayloadWatchers = watchPayloadSources(options.themeDir, queuePayloadRefresh);
  const closeOperationWatcher = await watchOperationState(options.operationState, (operation) => {
    operationSignalChain = operationSignalChain.then(async () => {
      const previousOperation = activeOperation?.token === operation.token ? activeOperation : null;
      const busy = isFreshBusyOperation(operation);
      if (pauseRecovery && pauseRecovery.token !== operation.token) pauseRecovery = null;
      if (busy) {
        activeOperation = operation;
        wakeControlLoop();
      }
      else if (activeOperation?.token === operation.token) activeOperation = null;
      const abortedPause = !busy
        && (operation.status === "failed" || operation.status === "cancelled")
        && previousOperation?.status === "pausing";
      const pauseState = (busy && operation.status === "pausing") || operation.status === "paused";
      if (pauseState && !controlOnly) {
        controlOnly = true;
        mutationEpoch += 1;
      }
      await Promise.all([...sessions.values()].map(async (record) => {
        if (record.session.closed) return;
        if (busy) {
          const kind = operation.status === "pausing" ? "pause" : "apply";
          record.operationToken = operation.token;
          record.operationExternal = true;
          await presentOperationUi(
            record.session,
            operation.token,
            "loading",
            operationKindMessage(kind),
            1000,
          );
          return;
        }
        if (record.operationToken !== operation.token) return;
        const state = operation.status === "failed" ? "error"
          : operation.status === "cancelled" ? "cancelled"
            : operation.status === "success" || operation.status === "paused" ? "success" : null;
        if (!state) return;
        await presentOperationUi(
          record.session,
          operation.token,
          state,
          operation.message || (state === "error" ? "操作失败，请重试" : "操作已完成"),
        );
      }));
      if (busy && operation.status === "pausing") {
        await reloadChain.catch(() => {});
        await waitForTargetSetups();
        await Promise.all([...sessions.values()].map(async (record) => {
          await invalidateEarly(record, { strict: true });
        }));
        await writeModeAck(options.operationAck, operation.token, "control");
      } else if (abortedPause) await restoreAfterAbortedPause(operation);
      else if (operation.status === "paused") {
        await reloadChain.catch(() => {});
        await waitForTargetSetups().catch(() => {});
        await Promise.all([...sessions.values()].map((record) =>
          invalidateEarly(record, { strict: true }))).catch((error) => {
          console.error(`[dream-skin] final pause invalidation failed: ${error.message}`);
        });
        releaseControlSessions();
      }
    }).catch((error) => {
      console.error(`[dream-skin] operation progress failed: ${error.message}`);
    });
    return operationSignalChain;
  });

  try {
    while (!stopping) {
      if (activeOperation && !isFreshBusyOperation(activeOperation)) {
        const expiredOperation = activeOperation;
        activeOperation = null;
        await Promise.all([...sessions.values()].map(async (record) => {
          if (record.session.closed || record.operationToken !== expiredOperation.token) return;
          await presentOperationUi(
            record.session,
            expiredOperation.token,
            "error",
            "操作超时，请重试",
            1000,
          );
        }));
        if (expiredOperation.status === "pausing") {
          controlOnly = true;
          releaseControlSessions();
        }
      }
      if (controlOnly && !activeOperation) {
        releaseControlSessions();
        await waitForControlOperation();
        continue;
      }
      let targets = [];
      try {
        targets = await listAppTargets(options.port);
        discoveryDelayMs = 100;
      } catch (error) {
        if (Date.now() - lastListErrorAt >= 2000) {
          console.error(`[dream-skin] ${new Date().toISOString()} ${error.message}`);
          lastListErrorAt = Date.now();
        }
        await new Promise((resolve) => setTimeout(resolve, discoveryDelayMs));
        discoveryDelayMs = Math.min(500, Math.round(discoveryDelayMs * 1.6));
        continue;
      }

      if (controlOnly && !activeOperation) {
        releaseControlSessions();
        continue;
      }

      const activeIds = new Set(targets.map((target) => target.id));
      for (const [id, record] of sessions) {
        if (!activeIds.has(id) || record.session.closed) {
          if (!record.session.closed && record.operationToken && !record.operationExternal) {
            await bestEffortOperationUi(
              record.session, "hide", record.operationToken, "loading", "",
            );
          }
          record.session.close();
          sessions.delete(id);
        }
      }

      const cycleRecovery = activeOperation ? null : pauseRecovery;
      let recoveredPauseThisCycle = false;
      let recoveryFailedThisCycle = false;
      for (const target of targets) {
        if (sessions.has(target.id)) continue;
        let session;
        let record;
        let connectionEpoch;
        let recoveryOperation = cycleRecovery;
        beginTargetSetup();
        try {
          session = await connectTarget(target, options.port);
          record = {
            session,
            earlyScriptId: null,
            earlyScriptIds: new Set(),
            needsLoadFallback: false,
            operationToken: null,
            operationExternal: false,
          };
          connectionEpoch = mutationEpoch;
          sessions.set(target.id, record);
          session.on("Page.loadEventFired", () => {
            if (!record.needsLoadFallback) return;
            const fallbackEpoch = mutationEpoch;
            setTimeout(() => {
              if (session.closed || controlOnly || mutationEpoch !== fallbackEpoch
                || !record.needsLoadFallback) return;
              applyToSession(session, current.payload).catch((error) => {
                console.error(`[dream-skin] fallback reinject failed: ${error.message}`);
              });
            }, 0);
          });
          const initialOperation = activeOperation;
          recoveryOperation = initialOperation ? null : cycleRecovery;
          const pausing = initialOperation?.status === "pausing";
          if (!controlOnly) {
            try {
              record.earlyScriptId = await registerEarlyForRecord(
                record, current.payload, current.revision,
              );
              await session.evaluate(earlyPayloadFor(current.payload, current.revision));
              if (controlOnly || mutationEpoch !== connectionEpoch) await invalidateEarly(record);
            } catch (error) {
              record.needsLoadFallback = true;
              console.error(`[dream-skin] early injection unavailable: ${error.message}`);
            }
          }
          const probe = await waitForCodexProbe(session);
          if (!probe?.codex) {
            await removeEarly(record);
            session.close();
            sessions.delete(target.id);
            if (!rejected.has(target.id)) {
              console.error(`[dream-skin] rejected non-ChatGPT app target ${target.id}`);
              rejected.add(target.id);
            }
            continue;
          }
          rejected.delete(target.id);
          if (controlOnly || pausing || mutationEpoch !== connectionEpoch) {
            await invalidateEarly(record);
          }
          if (controlOnly && !initialOperation) {
            console.log(`[dream-skin] connected control-only target ${target.id}`);
            continue;
          }
          record.operationToken = initialOperation?.token
            ?? recoveryOperation?.token
            ?? nextOperationToken();
          record.operationExternal = Boolean(initialOperation || recoveryOperation);
          await presentOperationUi(
            session,
            record.operationToken,
            "loading",
            initialOperation
              ? operationKindMessage(initialOperation.status === "pausing" ? "pause" : "apply")
              : recoveryOperation
                ? "暂停未完成，正在恢复原皮肤…"
              : `正在应用「${current.theme.name}」…`,
          );
          if (controlOnly || pausing) {
            continue;
          }
          const earlyApplied = await session.evaluate(
            `window.__CODEX_DREAM_SKIN_EARLY_APPLIED__ === ${JSON.stringify(current.revision)}`,
          );
          if (!earlyApplied) {
            if (controlOnly || mutationEpoch !== connectionEpoch) {
              await invalidateEarly(record);
              continue;
            }
            await session.evaluate(
              `window.__CODEX_DREAM_SKIN_EARLY_GENERATION__ = ${JSON.stringify(`fallback:${current.revision}`)}`,
            );
            await applyToSession(session, current.payload);
          }
          if (controlOnly || mutationEpoch !== connectionEpoch) {
            await invalidateEarly(record);
            continue;
          }
          const verification = await waitForVerifiedSession(
            session,
            Math.min(options.timeoutMs, 8000),
            current.theme.id,
            current.revision,
          );
          if (!verification?.pass) throw new Error("Initial theme verification failed");
          if (recoveryOperation && !activeOperation
            && pauseRecovery?.token === recoveryOperation.token) {
            await presentOperationUi(
              session,
              recoveryOperation.token,
              "error",
              "暂停失败，原皮肤已恢复",
              1000,
            );
            recoveredPauseThisCycle = true;
          } else if (!record.operationExternal) {
            await presentOperationUi(
              session, record.operationToken, "success", `已应用「${current.theme.name}」`,
            );
          }
          console.log(`[dream-skin] injected verified ChatGPT target ${target.id} (${target.title || target.url})`);
        } catch (error) {
          const recoveryStillCurrent = recoveryOperation && !activeOperation
            && pauseRecovery?.token === recoveryOperation.token;
          if (recoveryStillCurrent) recoveryFailedThisCycle = true;
          if (record?.operationToken && session && !session.closed) {
            if (recoveryStillCurrent) {
              await presentOperationUi(
                session,
                recoveryOperation.token,
                "error",
                "暂停失败，原皮肤恢复未确认",
                1000,
              );
            } else if (!record.operationExternal) {
              await presentOperationUi(
                session, record.operationToken, "error", "应用失败，未通过显示校验",
              );
            }
          }
          if (record) await removeEarly(record);
          session?.close();
          sessions.delete(target.id);
          console.error(`[dream-skin] inject failed for ${target.id}: ${error.message}`);
        } finally {
          finishTargetSetup();
        }
      }
      if (recoveredPauseThisCycle && !recoveryFailedThisCycle && !activeOperation
        && cycleRecovery?.token === pauseRecovery?.token) {
        await writeModeAck(options.operationAck, cycleRecovery.token, "full");
        pauseRecovery = null;
      }
      const pollDelay = sessions.size ? 800 : (targets.length ? 250 : 100);
      await new Promise((resolve) => setTimeout(resolve, pollDelay));
    }
  } finally {
    if (reloadTimer) clearTimeout(reloadTimer);
    closePayloadWatchers();
    closeOperationWatcher();
    await reloadChain.catch(() => {});
    await operationSignalChain.catch(() => {});
    await Promise.all([...sessions.values()].map((record) =>
      record.operationToken && !record.operationExternal
        ? bestEffortOperationUi(record.session, "hide", record.operationToken, "loading", "")
        : Promise.resolve(false)));
    await Promise.all([...sessions.values()].map((record) => removeEarly(record)));
    for (const record of sessions.values()) record.session.close();
  }
}

async function runOneShotAndExit(options) {
  await runOneShot(options);
  await new Promise((resolve) => process.stdout.write("", resolve));
  process.exit(process.exitCode ?? 0);
}

if (path.resolve(process.argv[1] || "") === path.resolve(scriptPath)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.mode === "check") {
      const loaded = await loadPayload(options.themeDir);
      console.log(JSON.stringify({
        pass: true,
        version: SKIN_VERSION,
        themeId: loaded.theme.id,
        themeName: loaded.theme.name,
        imageBytes: loaded.imageBytes,
        payloadBytes: Buffer.byteLength(loaded.payload),
        artMetadata: loaded.theme.artMetadata ?? null,
        timings: loaded.timings,
      }, null, 2));
    } else if (options.mode === "begin-operation") {
      await runBeginOperation(options);
      await new Promise((resolve) => process.stdout.write("", resolve));
      process.exit(0);
    } else if (options.mode === "finish-operation") {
      await runFinishOperation(options);
      await new Promise((resolve) => process.stdout.write("", resolve));
      process.exit(0);
    } else if (options.mode === "watch") await runWatch(options);
    else await runOneShotAndExit(options);
  } catch (error) {
    console.error(`[dream-skin] ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
