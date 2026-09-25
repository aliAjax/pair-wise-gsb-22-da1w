// 缺陷诊断训练台 —— 领域模型

/** 内置缺陷标签（氧化 / 还原 / 软木塞污染 为三大高频混淆项） */
export type DefectId =
  | "oxidation"
  | "reduction"
  | "cork"
  | "volatile_acidity"
  | "brett"
  | "light_strike"
  | "cooked"
  | "none";

export interface DefectTag {
  id: DefectId;
  name: string;
  /** 讲师侧参考：典型闻香线索 */
  hint: string;
}

/** 训练资料：开课前登记的样酒（资料库，独立留档） */
export interface WineSample {
  id: string;
  /** 样酒编号，如 A-01，盲品时对学员可见 */
  code: string;
  /** 酒款描述（讲师侧） */
  name: string;
  /** 缺陷标签：答案，支持多选；学员提交判断前不可见 */
  tags: DefectId[];
  /** 讲师置信度 0–100：该样酒缺陷判断的把握程度 */
  confidence: number;
  /** 闻香线索：学员侧在盲品中可见的客观描述 */
  clues: string[];
  createdAt: string;
}

/** 复习规则（独立存储，可调） */
export interface ReviewRules {
  /** 连续答对几次算掌握 */
  masteryStreak: number;
  /** 下一次训练日期（ISO yyyy-mm-dd）：答错样酒按此排入最早可复习日 */
  nextTrainingDate: string;
  /** 每轮题量 3–5，仅对未开始的下一轮生效 */
  roundSize: number;
}

/** 本地留档：一条判断记录（只增不改） */
export interface JudgmentRecord {
  id: string;
  sampleId: string;
  /** 判断时的样酒编号快照 */
  sampleCode: string;
  sessionId: string;
  roundNo: number;
  /** 学员选择的标签 */
  chosen: DefectId[];
  /** 正确标签快照 */
  correct: DefectId[];
  correctAnswer: boolean;
  judgedAt: string;
}

/** 一轮中的一款样酒（只放学员可见信息 + 快照，绝不放答案/置信度） */
export interface RoundItem {
  sampleId: string;
  code: string;
  clues: string[];
  /** 来源：待复训到期 / 新样酒 / 维护（已掌握） */
  source: "review" | "new" | "maintenance";
}

/** 进行中的场次：题序整体保存，提交结果存于留档并按 sessionId 关联 */
export interface ActiveSession {
  id: string;
  startedAt: string;
  roundNo: number;
  /** 本轮题量快照（改全局题量不影响已开始的一轮） */
  roundSize: number;
  /** 剩余题序：已答的从头弹出，顺序固定 */
  queue: RoundItem[];
  /** 本场已经判过的样酒：防止刷新后对当前款重复判题 */
  judgedIds: string[];
  paused: boolean;
  finished: boolean;
  /** 暂停时间戳，便于展示 */
  pausedAt: string | null;
}
