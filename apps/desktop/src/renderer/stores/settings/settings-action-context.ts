import type { Settings } from "@prompthub/shared/types";
import type { StoreApi } from "zustand";
import type { SettingsState } from "./settings-types";

export interface SettingsActionContext {
  set: StoreApi<SettingsState>["setState"];
  get: StoreApi<SettingsState>["getState"];
  setTouched: (partial: Partial<SettingsState>) => void;
  commitAISettings: (partial: Partial<SettingsState>) => void;
  persistSettingsToMain: (settings: Partial<Settings>) => Promise<void>;
  syncSettingsToMain: (settings: Partial<Settings>) => Promise<void>;
  syncSettingsToMainThenRefreshRules: (settings: Partial<Settings>) => void;
}

export type ActionKeys = {
  [Key in keyof SettingsState]: SettingsState[Key] extends (
    ...args: never[]
  ) => unknown
    ? Key
    : never;
}[keyof SettingsState];

export type SettingsActionGroup<Key extends ActionKeys> = Pick<
  SettingsState,
  Key
>;
