// 本地存储：四类数据分开，互不混淆
//  1. samples   训练资料（开课前登记的样酒、标签、置信度、闻香线索）
//  2. rules     复习规则（掌握连对数、下次训练日期、每轮题量）
//  3. progress  复习状态（连对计数、待复训队列、最早可复习日）
//  4. archive   本地留档（已提交的判断，只增不改）
//  5. session   进行中的场次（题序与暂停状态，关掉页面再打开可继续）

import type {
  ActiveSession,
  DefectTag,
  JudgmentRecord,
  ReviewRules,
  WineSample,
} from "./types";

const PREFIX = "defect-lab/v1/";
const KEYS = {
  samples: PREFIX + "samples",
  tags: PREFIX + "tags",
  rules: PREFIX + "rules",
  progress: PREFIX + "progress",
  archive: PREFIX + "archive",
  session: PREFIX + "session",
} as const;

export const DEFAULT_TAGS: DefectTag[] = [
  { id: "oxidation", name: "氧化", hint: "雪利酒、烂苹果、坚果、焦糖，颜色偏棕" },
  { id: "reduction", name: "还原", hint: "臭鸡蛋、橡胶、点燃的火柴、闷臭，晃杯后可能散去" },
  { id: "cork", name: "软木塞污染", hint: "湿纸板、发霉地下室、旧湿抹布，果香被压住" },
  { id: "volatile_acidity", name: "挥发性酸", hint: "醋、指甲油洗甲水，刺鼻酸感" },
  { id: "brett", name: "酒香酵母", hint: "马厩、创可贴、烟熏培根、汗味" },
  { id: "light_strike", name: "光击味", hint: "煮白菜、老玉米罐头、湿羊毛" },
  { id: "cooked", name: "热损伤", hint: "煮过的果酱、炖水果，甜味发闷发平" },
  { id: "none", name: "无缺陷", hint: "果香干净，无非典型气味" },
];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时静默失败，内存态仍可运行
  }
}

// ---- 训练资料 ----
export const loadSamples = (): WineSample[] => read(KEYS.samples, []);
export const saveSamples = (v: WineSample[]) => write(KEYS.samples, v);

// ---- 缺陷标签（讲师可补充参考说明，与样酒分开放） ----
export const loadTags = (): DefectTag[] => read(KEYS.tags, DEFAULT_TAGS);

// ---- 复习规则 ----
const todayISO = () => new Date().toISOString().slice(0, 10);

export const defaultRules = (): ReviewRules => ({
  masteryStreak: 2,
  nextTrainingDate: todayISO(),
  roundSize: 3,
});

export const loadRules = (): ReviewRules => {
  const r = read<ReviewRules | null>(KEYS.rules, null);
  return { ...defaultRules(), ...(r ?? {}) };
};
export const saveRules = (v: ReviewRules) => write(KEYS.rules, v);

// ---- 复习进度（每款样酒一条） ----
export interface SampleProgress {
  sampleId: string;
  /** 当前连续答对数；答错清零并进待复训 */
  streak: number;
  mastered: boolean;
  /** 是否在待复训队列 */
  needsReview: boolean;
  /** 最早可复习日 yyyy-mm-dd */
  earliestReviewAt: string | null;
  totalAnswered: number;
  totalCorrect: number;
  lastResult: "correct" | "wrong" | null;
  lastAt: string | null;
}

export const loadProgress = (): Record<string, SampleProgress> =>
  read(KEYS.progress, {});
export const saveProgress = (v: Record<string, SampleProgress>) =>
  write(KEYS.progress, v);

// ---- 本地留档（只增） ----
export const loadArchive = (): JudgmentRecord[] => read(KEYS.archive, []);
export const appendArchive = (rec: JudgmentRecord) => {
  const all = loadArchive();
  all.push(rec);
  write(KEYS.archive, all);
};

// ---- 进行中场次 ----
export const loadSession = (): ActiveSession | null =>
  read<ActiveSession | null>(KEYS.session, null);
export const saveSession = (v: ActiveSession | null) => {
  if (v) write(KEYS.session, v);
  else localStorage.removeItem(KEYS.session);
};
