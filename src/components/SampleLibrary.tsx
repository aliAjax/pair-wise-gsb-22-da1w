import { useState } from "react";
import type { DefectTag, WineSample } from "../types";
import type { SampleProgress } from "../storage";

interface Props {
  samples: WineSample[];
  tags: DefectTag[];
  progress: Record<string, SampleProgress>;
  /** 进行中场次占用的样酒：不可删、答案强制遮蔽 */
  lockedIds: string[];
  onDelete: (id: string) => void;
}

const tagName = (tags: DefectTag[], id: string) =>
  tags.find((t) => t.id === id)?.name ?? id;

function Badge({ p }: { p?: SampleProgress }) {
  if (!p || p.totalAnswered === 0) return <span className="badge new">未练</span>;
  if (p.mastered) return <span className="badge mastered">已掌握</span>;
  if (p.needsReview) return <span className="badge review">待复训</span>;
  return <span className="badge">练习中</span>;
}

/** 样酒资料库：线索与答案分开，训练中或默认收起时不显示标签 */
export default function SampleLibrary({
  samples,
  tags,
  progress,
  lockedIds,
  onDelete,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const anyLocked = lockedIds.length > 0;
  const showAnswers = revealed && !anyLocked;

  return (
    <div className="library">
      <div className="library-toolbar">
        <label className="reveal-toggle">
          <input
            type="checkbox"
            checked={showAnswers}
            disabled={anyLocked}
            onChange={(e) => setRevealed(e.target.checked)}
          />
          {anyLocked ? "训练进行中，答案已对学员遮蔽" : "讲师查看答案与置信度"}
        </label>
        <span className="muted-hint">同一场：线索对学员公开，标签在提交判断前不可见</span>
      </div>

      {samples.length === 0 && (
        <p className="empty-hint">还没有登记样酒，先用上方表单开课前登记。</p>
      )}

      <div className="library-list">
        {samples.map((s) => {
          const p = progress[s.id];
          const locked = lockedIds.includes(s.id);
          return (
            <article key={s.id} className="sample-card">
              <header>
                <div className="sample-id">
                  <strong>{s.code}</strong>
                  {showAnswers ? <span>{s.name}</span> : <em>酒款描述已隐藏</em>}
                </div>
                <Badge p={p} />
              </header>

              <ul className="clue-list">
                {s.clues.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>

              <footer>
                {showAnswers ? (
                  <div className="answer-line">
                    <span className="answer-label">答案</span>
                    {s.tags.map((t) => (
                      <span key={t} className="answer-tag">
                        {tagName(tags, t)}
                      </span>
                    ))}
                    <span className="confidence">置信度 {s.confidence}%</span>
                  </div>
                ) : (
                  <div className="answer-line hidden">
                    <span>答案与置信度已遮蔽（{anyLocked ? "训练中" : "默认隐藏"}）</span>
                  </div>
                )}
                {p && p.totalAnswered > 0 && (
                  <span className="streak-hint">
                    连对 {p.streak} · 累计 {p.totalCorrect}/{p.totalAnswered}
                    {p.needsReview && p.earliestReviewAt && !p.mastered
                      ? ` · 最早复习 ${p.earliestReviewAt}`
                      : ""}
                  </span>
                )}
                <button
                  className="danger-btn"
                  disabled={locked}
                  title={locked ? "该样酒在进行中的题序里，不能删除" : "从资料库删除"}
                  onClick={() => onDelete(s.id)}
                >
                  删除
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
