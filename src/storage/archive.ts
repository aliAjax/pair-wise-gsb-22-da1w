// 本地留档：训练状态在浏览器 localStorage 的读写与兜底。
// 关掉页面再打开，已提交判断与剩余题序都能恢复。

import {
  addDaysISO,
  clampRoundSize,
  todayISO,
  type Judgment,
  type RoundSession,
  type SampleWine,
  type TrainerSettings,
  type WineProgress,
} from "../domain/reviewRules";
import { seedWines } from "../data/materials";

export interface TrainerState {
  version: 1;
  wines: SampleWine[];
  progress: Record<string, WineProgress>;
  settings: TrainerSettings;
  session: RoundSession | null; // 进行中的轮次（含题序与已提交判断）
  archive: Judgment[]; // 全部历史判断留档
}

export const STORAGE_KEY = "hxwl-08.defect-trainer.v1";

export function defaultState(): TrainerState {
  return {
    version: 1,
    wines: seedWines,
    progress: {},
    settings: { roundSize: 4, nextTrainingDate: addDaysISO(todayISO(), 7) },
    session: null,
    archive: [],
  };
}

export function loadState(): TrainerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<TrainerState>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.wines)) return defaultState();
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      settings: {
        ...base.settings,
        ...parsed.settings,
        roundSize: clampRoundSize(Number(parsed.settings?.roundSize)),
      },
      progress: parsed.progress ?? {},
      session: parsed.session ?? null,
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: TrainerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储满或隐私模式下静默失败，界面状态仍在内存中
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
