import type { DefectTag, JudgmentRecord, WineSample } from "../types";
import type { SampleProgress } from "../storage";

interface Props {
  samples: WineSample[];
  tags: DefectTag[];
  progress: Record<string, SampleProgress>;
  archive: JudgmentRecord[];
  trainingDate: string;
}

const tagName = (tags: DefectTag[], id: string) =>
  tags.find((t) => t.id === id)?.name ?? id;

/** 待复训队列（按最早可复习日） + 本地留档（只增不改），两块分开展示 */
export default function ReviewBoard({ samples, tags, progress, archive, trainingDate }: Props) {
  const sampleById = new Map(samples.map((s) => [s.id, s]));

  const reviewRows = Object.values(progress)
    .filter((p) => p.needsReview && !p.mastered)
    .sort((a, b) => {
      const da = a.earliestReviewAt ?? "9999";
      const db = b.earliestReviewAt ?? "9999";
      return da < db ? -1 : da > db ? 1 : 0;
    });

  const exportArchive = () => {
    const blob = new Blob([JSON.stringify(archive, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `defect-judgments-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="review-board">
      <section className="subpanel">
        <h3>
          待复训队列 <em>{reviewRows.length}</em>
        </h3>
        <p className="muted-hint">答错即入队，最早可复习日按下次训练日期排；同一款连续答对两次出队。</p>
        {reviewRows.length === 0 ? (
          <p className="empty-hint">暂无待复训样酒。</p>
        ) : (
          <table className="queue-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>状态</th>
                <th>连对</th>
                <th>最早可复习日</th>
              </tr>
            </thead>
            <tbody>
              {reviewRows.map((p) => {
                const s = sampleById.get(p.sampleId);
                const due = p.earliestReviewAt !== null && p.earliestReviewAt <= trainingDate;
                return (
                  <tr key={p.sampleId} className={due ? "due" : ""}>
                    <td>{s?.code ?? "（已删除）"}</td>
                    <td>{due ? "可排入本轮" : "未到期"}</td>
                    <td>
                      {p.streak}
                    </td>
                    <td>{p.earliestReviewAt ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="subpanel">
        <div className="subpanel-head">
          <h3>
            本地留档 <em>{archive.length}</em>
          </h3>
          <button onClick={exportArchive} disabled={archive.length === 0}>
            导出 JSON
          </button>
        </div>
        <p className="muted-hint">每次提交的判断只增不改，与训练资料、复习规则分开存储。</p>
        {archive.length === 0 ? (
          <p className="empty-hint">还没有判断记录，完成一轮训练后自动留档。</p>
        ) : (
          <div className="archive-list">
            {[...archive].reverse().slice(0, 12).map((r) => (
              <div key={r.id} className={r.correctAnswer ? "archive-row ok" : "archive-row bad"}>
                <span className="arc-time">{new Date(r.judgedAt).toLocaleString("zh-CN", { hour12: false })}</span>
                <strong>{r.sampleCode}</strong>
                <span>{r.correctAnswer ? "✓ 答对" : "✗ 答错"}</span>
                <span className="arc-tags">
                  判：{r.chosen.map((t) => tagName(tags, t)).join("、")}
                  {!r.correctAnswer && <> / 答：{r.correct.map((t) => tagName(tags, t)).join("、")}</>}
                </span>
              </div>
            ))}
            {archive.length > 12 && <p className="muted-hint">仅显示最近 12 条，完整记录见导出。</p>}
          </div>
        )}
      </section>
    </div>
  );
}
