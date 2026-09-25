// 训练编排：开轮、判题、复习规则
// 纯函数为主，便于讲师核对"下一步该补什么"

import type {
  ActiveSession,
  DefectId,
  JudgmentRecord,
  ReviewRules,
  RoundItem,
  WineSample,
} from "./types";
import type { SampleProgress } from "./storage";

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

/** 标签集合是否一致（多选标签，不看顺序） */
export function tagsEqual(a: DefectId[], b: DefectId[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((t) => sb.has(t));
}

/** yyyy-mm-dd 字符串比较：到期 = earliest <= onDate */
export function isDue(iso: string | null, onDate: string): boolean {
  return iso !== null && iso <= onDate;
}

/**
 * 组建一轮 3–5 款样酒，优先级：
 * 1) 待复训且已到最早可复习日（按可复习日从早到晚）
 * 2) 新样酒（从未练过）
 * 3) 已掌握样酒（维护性抽测）
 */
export function buildRound(
  samples: WineSample[],
  progress: Record<string, SampleProgress>,
  rules: ReviewRules,
  roundNo: number,
): RoundItem[] {
  const size = Math.min(Math.max(3, Math.min(5, rules.roundSize)), samples.length);
  if (samples.length === 0) return [];

  const review: WineSample[] = [];
  const fresh: WineSample[] = [];
  const maintenance: WineSample[] = [];

  for (const s of samples) {
    const p = progress[s.id];
    if (p && p.needsReview && isDue(p.earliestReviewAt, rules.nextTrainingDate)) {
      review.push(s);
    } else if (!p || p.totalAnswered === 0) {
      fresh.push(s);
    } else if (p.mastered) {
      maintenance.push(s);
    }
  }

  review.sort((a, b) => {
    const da = progress[a.id]?.earliestReviewAt ?? "9999";
    const db = progress[b.id]?.earliestReviewAt ?? "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // 稳定混排：复习优先、新样酒其次、维护抽测兜底
  const pool: { s: WineSample; source: RoundItem["source"] }[] = [
    ...review.map((s) => ({ s, source: "review" as const })),
    ...fresh.map((s) => ({ s, source: "new" as const })),
    ...maintenance.map((s) => ({ s, source: "maintenance" as const })),
  ];

  return pool.slice(0, size).map(({ s, source }) => ({
    sampleId: s.id,
    code: s.code,
    clues: s.clues,
    source,
  }));
}

export function startSession(
  round: RoundItem[],
  roundNo: number,
  roundSize: number,
): ActiveSession {
  return {
    id: uid(),
    startedAt: new Date().toISOString(),
    roundNo,
    roundSize,
    queue: round,
    judgedIds: [],
    paused: false,
    finished: false,
    pausedAt: null,
  };
}

export interface JudgmentOutcome {
  record: JudgmentRecord;
  /** 应用后的该样酒进度 */
  nextProgress: SampleProgress;
}

/**
 * 应用一次判断：
 * - 答错：连对清零，归入待复训，最早可复习日 = 规则中的下一次训练日期
 * - 答对：连对 +1，连续答对达到阈值才算掌握；掌握后移出待复训
 */
export function applyJudgment(
  item: RoundItem,
  chosen: DefectId[],
  correct: DefectId[],
  rules: ReviewRules,
  prev: SampleProgress | undefined,
  sessionId: string,
  roundNo: number,
): JudgmentOutcome {
  const now = new Date().toISOString();
  const ok = tagsEqual(chosen, correct);
  const record: JudgmentRecord = {
    id: uid(),
    sampleId: item.sampleId,
    sampleCode: item.code,
    sessionId,
    roundNo,
    chosen,
    correct,
    correctAnswer: ok,
    judgedAt: now,
  };

  const base: SampleProgress =
    prev ?? {
      sampleId: item.sampleId,
      streak: 0,
      mastered: false,
      needsReview: false,
      earliestReviewAt: null,
      totalAnswered: 0,
      totalCorrect: 0,
      lastResult: null,
      lastAt: null,
    };

  const streak = ok ? base.streak + 1 : 0;
  const mastered = ok && streak >= rules.masteryStreak;
  // 只要还没掌握就留在待复训池：答错按下次训练日期排期，
  // 答对但连对未达标则沿用已有排期（新酒首次答对也排入下一训练日凑满连对）。
  const needsReview = !mastered;
  const earliestReviewAt = mastered
    ? null
    : base.earliestReviewAt ?? rules.nextTrainingDate;

  const nextProgress: SampleProgress = {
    ...base,
    streak,
    mastered,
    needsReview,
    earliestReviewAt,
    totalAnswered: base.totalAnswered + 1,
    totalCorrect: base.totalCorrect + (ok ? 1 : 0),
    lastResult: ok ? "correct" : "wrong",
    lastAt: now,
  };

  return { record, nextProgress };
}
