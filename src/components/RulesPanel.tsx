import type { ReviewRules } from "../types";

interface Props {
  rules: ReviewRules;
  onChange: (r: ReviewRules) => void;
  /** 进行中的一轮：题量已快照，全局题量本场不可改 */
  roundLocked: boolean;
}

/** 复习规则（与训练资料、本地留档分开放） */
export default function RulesPanel({ rules, onChange, roundLocked }: Props) {
  return (
    <div className="rules-panel">
      <label className="rule-item">
        <span>掌握门槛：同一款连续答对次数</span>
        <select
          value={rules.masteryStreak}
          onChange={(e) => onChange({ ...rules, masteryStreak: Number(e.target.value) })}
        >
          <option value={2}>2 次</option>
          <option value={3}>3 次</option>
          <option value={4}>4 次</option>
        </select>
      </label>

      <label className="rule-item">
        <span>下一次训练日期（答错样酒排入的最早可复习日）</span>
        <input
          type="date"
          value={rules.nextTrainingDate}
          onChange={(e) => onChange({ ...rules, nextTrainingDate: e.target.value })}
        />
      </label>

      <label className="rule-item">
        <span>每轮题量（3–5 款，仅对未开始的一轮生效）</span>
        <div className="stepper">
          {[3, 4, 5].map((n) => (
            <button
              key={n}
              className={rules.roundSize === n ? "step on" : "step"}
              disabled={roundLocked}
              onClick={() => onChange({ ...rules, roundSize: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </label>
      {roundLocked && (
        <p className="muted-hint">当前一轮进行中：改题量不影响本轮，下一轮才生效；判断记录与剩余题序均保留。</p>
      )}
    </div>
  );
}
