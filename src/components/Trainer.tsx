import { useState } from "react";
import type {
  ActiveSession,
  DefectId,
  DefectTag,
  JudgmentRecord,
  WineSample,
} from "../types";
import type { SampleProgress } from "../storage";
import TagPicker from "./TagPicker";

interface JudgeOutcome {
  record: JudgmentRecord;
  progress: SampleProgress;
}

interface Props {
  session: ActiveSession;
  samples: WineSample[];
  tags: DefectTag[];
  /** 本场已提交的判断（从留档按 sessionId 取出，刷新后小结仍完整） */
  records: JudgmentRecord[];
  /** 判题：返回留档记录与新进度（此时题序尚未推进，先展示反馈） */
  onJudge: (chosen: DefectId[]) => JudgeOutcome;
  /** 学员看完反馈：进入下一款，或结束本轮 */
  onAdvance: () => void;
  onPauseToggle: () => void;
  onAbort: () => void;
  /** 结束本轮并清掉进行中场次 */
  onCloseRound: () => void;
}

const tagName = (tags: DefectTag[], id: DefectId) =>
  tags.find((t) => t.id === id)?.name ?? id;

const sourceLabel: Record<string, string> = {
  review: "待复训到期",
  new: "新样酒",
  maintenance: "已掌握抽测",
};

export default function Trainer({
  session,
  samples,
  tags,
  records,
  onJudge,
  onAdvance,
  onPauseToggle,
  onAbort,
  onCloseRound,
}: Props) {
  const [chosen, setChosen] = useState<DefectId[]>([]);
  const [outcome, setOutcome] = useState<JudgeOutcome | null>(null);
  const [error, setError] = useState("");

  const current = session.queue[0] ?? null;
  const sample = current ? samples.find((s) => s.id === current.sampleId) ?? null : null;
  const answeredCount = records.length;
  const correctCount = records.filter((r) => r.correctAnswer).length;

  const submit = () => {
    if (chosen.length === 0) {
      setError("请至少选择一个判断标签");
      return;
    }
    setError("");
    setOutcome(onJudge(chosen)); // 题序保留：答错也先停在本款看反馈
    setChosen([]);
  };

  // 当前款已判（含刷新后回放）：用留档里的该款本场记录展示反馈
  const currentRecord =
    current && session.judgedIds.includes(current.sampleId)
      ? [...records].reverse().find((r) => r.sampleId === current.sampleId) ?? null
      : null;
  const shownOutcome =
    outcome && current && outcome.record.sampleId === current.sampleId
      ? outcome
      : currentRecord
        ? { record: currentRecord, progress: undefined }
        : null;
  const feedbackProgress = shownOutcome?.progress;

  // ---- 一轮结束：小结 ----
  if (session.finished || !current) {
    const wrong = records.filter((r) => !r.correctAnswer);
    return (
      <div className="trainer">
        <div className="trainer-head done">
          <div>
            <p className="eyebrow-sm">第 {session.roundNo} 轮 · 已结束</p>
            <h3>
              本轮 {records.length} 款，答对 {correctCount} 款
            </h3>
          </div>
        </div>
        <div className="round-summary">
          {records.map((r) => (
            <div key={r.id} className={r.correctAnswer ? "summary-row ok" : "summary-row bad"}>
              <strong>{r.sampleCode}</strong>
              <span className="verdict">{r.correctAnswer ? "答对" : "答错"}</span>
              <span className="summary-tags">
                你的判断：{r.chosen.map((t) => tagName(tags, t)).join("、") || "—"}
              </span>
              {!r.correctAnswer && (
                <span className="summary-tags">答案：{r.correct.map((t) => tagName(tags, t)).join("、")}</span>
              )}
            </div>
          ))}
        </div>
        {wrong.length > 0 ? (
          <p className="review-note">
            {wrong.length} 款答错，已归入待复训，并按规则中的下一次训练日期排入最早可复习日。
          </p>
        ) : (
          <p className="review-note ok">本轮全部答对；同一款连续答对两次才算掌握。</p>
        )}
        <div className="trainer-actions">
          <button className="primary-action" onClick={onCloseRound}>
            完成并回到看板
          </button>
        </div>
      </div>
    );
  }

  const total = session.roundSize;
  const indexNo = answeredCount + 1;

  return (
    <div className={"trainer" + (session.paused ? " paused" : "")}>
      <div className="trainer-head">
        <div>
          <p className="eyebrow-sm">
            第 {session.roundNo} 轮 · 第 {indexNo}/{total} 款
          </p>
          <div className="progress-dots">
            {Array.from({ length: total }).map((_, i) => (
              <i
                key={i}
                className={i < answeredCount ? "dot done" : i === answeredCount ? "dot now" : "dot"}
              />
            ))}
          </div>
        </div>
        <div className="trainer-controls">
          <button onClick={onPauseToggle}>{session.paused ? "继续训练" : "暂停"}</button>
          <button className="danger-btn" onClick={onAbort} title="已提交的判断和留档都会保留">
            终止本轮
          </button>
        </div>
      </div>

      {session.paused ? (
        <div className="paused-mask">
          <h3>训练已暂停</h3>
          <p>已提交的判断和剩余题序都已保留，关掉页面再打开也能接着练。</p>
          <button className="primary-action" onClick={onPauseToggle}>
            继续训练
          </button>
        </div>
      ) : (
        <article className="tasting-card">
          <div className="tasting-head">
            <div>
              <span className="sample-code-lg">样酒 {current.code}</span>
              <span className="source-chip">{sourceLabel[current.source]}</span>
            </div>
            <span className="remain-hint">剩余 {session.queue.length} 款待品</span>
          </div>

          <div className="clue-box">
            <h4>闻香线索</h4>
            <ul>
              {current.clues.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {shownOutcome ? (
            <div className={shownOutcome.record.correctAnswer ? "feedback ok" : "feedback bad"}>
              <h4>{shownOutcome.record.correctAnswer ? "✓ 判断正确" : "✗ 判断错误，已归入待复训"}</h4>
              <p>
                答案：{shownOutcome.record.correct.map((t) => tagName(tags, t)).join("、")} ·
                你的判断：{shownOutcome.record.chosen.map((t) => tagName(tags, t)).join("、")}
              </p>
              {sample && (
                <p className="fb-note">
                  讲师备注：{sample.name}（置信度 {sample.confidence}%）
                  {feedbackProgress
                    ? <> · 当前连对 {feedbackProgress.streak} 次
                        {feedbackProgress.mastered ? "，已掌握" : ""}
                        {feedbackProgress.needsReview && feedbackProgress.earliestReviewAt
                          ? ` · 最早可复习 ${feedbackProgress.earliestReviewAt}`
                          : ""}
                      </>
                    : ""}
                </p>
              )}
            </div>
          ) : (
            <div className="answer-box">
              <h4>你的判断（提交前看不到标签答案）</h4>
              <TagPicker tags={tags} selected={chosen} onChange={setChosen} />
              {error && <p className="form-error">{error}</p>}
            </div>
          )}
        </article>
      )}

      {!session.paused && (
        <div className="trainer-actions">
          {shownOutcome ? (
            <button
              className="primary-action"
              onClick={() => {
                setOutcome(null);
                onAdvance();
              }}
            >
              {answeredCount >= total ? "结束本轮" : "下一款"}
            </button>
          ) : (
            <button className="primary-action" onClick={submit}>
              提交判断
            </button>
          )}
        </div>
      )}
    </div>
  );
}
