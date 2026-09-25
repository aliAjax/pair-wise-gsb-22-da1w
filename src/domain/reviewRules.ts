// 复习规则：缺陷诊断训练的排期、掌握判定与组卷逻辑。
// 纯函数模块，不依赖界面与本地留档，可单独调整规则。

export type DefectId = "oxidation" | "reduction" | "cork" | "va" | "brett" | "clean";

export interface SampleWine {
  id: string;
  code: string; // 样酒编号，如 A-01
  name: string; // 名称 / 背景描述
  defect: DefectId; // 缺陷标签（答案）：学员提交判断前不可见
  confidence: number; // 讲师对标签的置信度，1-5
  clues: string[]; // 闻香线索：训练时唯一对学员开放的信息
  createdAt: string;
}

export type WineStatus = "new" | "learning" | "retrain" | "mastered";

export interface WineProgress {
  status: WineStatus;
  streak: number; // 连续答对次数，答错清零
  attempts: number;
  correct: number;
  nextReviewDate: string | null; // 最早可复习日（ISO 日期），掌握后为 null
  lastResult: "correct" | "wrong" | null;
}

export interface Judgment {
  id: string;
  roundId: string;
  wineId: string;
  picked: DefectId;
  correct: boolean;
  at: string;
}

export interface RoundSession {
  id: string;
  size: number; // 本轮题量（3-5），开轮时锁定
  queue: string[]; // 本轮题序：样酒 id，组卷后不再变动
  cursor: number; // 当前题在 queue 中的下标
  judgments: Judgment[]; // 已提交判断：暂停、改题量、刷新页面均保留
  paused: boolean;
  finished: boolean;
  startedAt: string;
}

export interface TrainerSettings {
  roundSize: number; // 每轮题量 3-5，仅对下一轮生效
  nextTrainingDate: string; // 下一次训练日期：答错样酒的最早可复习日
}

export const MIN_ROUND_SIZE = 3;
export const MAX_ROUND_SIZE = 5;
export const MASTERY_STREAK = 2; // 同一款连续答对两次才算掌握

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clampRoundSize(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROUND_SIZE;
  return Math.min(MAX_ROUND_SIZE, Math.max(MIN_ROUND_SIZE, Math.round(value)));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(base: string, days: number): string {
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function initialProgress(): WineProgress {
  return { status: "new", streak: 0, attempts: 0, correct: 0, nextReviewDate: null, lastResult: null };
}

/** 提交判断后的进度流转：答错归入待复训，按下一次训练日期排入最早可复习日 */
export function applyJudgment(prev: WineProgress, correct: boolean, nextTrainingDate: string): WineProgress {
  const attempts = prev.attempts + 1;
  if (correct) {
    const streak = prev.streak + 1;
    const mastered = streak >= MASTERY_STREAK;
    return {
      status: mastered ? "mastered" : "learning",
      streak,
      attempts,
      correct: prev.correct + 1,
      // 未掌握前下一次训练日再确认；掌握后不再排期
      nextReviewDate: mastered ? null : nextTrainingDate,
      lastResult: "correct",
    };
  }
  return {
    status: "retrain",
    streak: 0,
    attempts,
    correct: prev.correct,
    nextReviewDate: nextTrainingDate,
    lastResult: "wrong",
  };
}

export function isDue(progress: WineProgress, onDate: string): boolean {
  return progress.nextReviewDate !== null && progress.nextReviewDate <= onDate;
}

/** 组卷：到期待复训/待巩固优先 → 新样酒补足 → 已掌握凑数；题序确定后不再变动 */
export function buildRoundQueue(
  wines: SampleWine[],
  progressMap: Record<string, WineProgress>,
  size: number,
  onDate: string,
): string[] {
  const entries = wines.map((wine) => ({ wine, progress: progressMap[wine.id] ?? initialProgress() }));
  const byDateThenCode = (a: (typeof entries)[number], b: (typeof entries)[number]) => {
    const da = a.progress.nextReviewDate ?? "9999-12-31";
    const db = b.progress.nextReviewDate ?? "9999-12-31";
    return da === db ? a.wine.code.localeCompare(b.wine.code) : da.localeCompare(db);
  };
  const due = entries
    .filter((e) => (e.progress.status === "retrain" || e.progress.status === "learning") && isDue(e.progress, onDate))
    .sort(byDateThenCode);
  const fresh = entries.filter((e) => e.progress.status === "new").sort(byDateThenCode);
  const mastered = entries.filter((e) => e.progress.status === "mastered").sort(byDateThenCode);

  const queue = [...due, ...fresh].slice(0, size).map((e) => e.wine.id);
  for (const e of mastered) {
    if (queue.length >= size) break;
    queue.push(e.wine.id);
  }
  return queue;
}

export function newRound(
  wines: SampleWine[],
  progressMap: Record<string, WineProgress>,
  settings: TrainerSettings,
  onDate: string,
): RoundSession {
  const size = clampRoundSize(settings.roundSize);
  return {
    id: uid(),
    size,
    queue: buildRoundQueue(wines, progressMap, size, onDate),
    cursor: 0,
    judgments: [],
    paused: false,
    finished: false,
    startedAt: new Date().toISOString(),
  };
}

export interface RetrainItem {
  wine: SampleWine;
  progress: WineProgress;
}

/** 待复训 / 待巩固队列：按最早可复习日升序 */
export function retrainQueue(wines: SampleWine[], progressMap: Record<string, WineProgress>): RetrainItem[] {
  return wines
    .map((wine) => ({ wine, progress: progressMap[wine.id] ?? initialProgress() }))
    .filter((item) => item.progress.status === "retrain" || item.progress.status === "learning")
    .sort((a, b) => (a.progress.nextReviewDate ?? "").localeCompare(b.progress.nextReviewDate ?? ""));
}
