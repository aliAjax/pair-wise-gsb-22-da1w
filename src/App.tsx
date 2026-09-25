import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { DEFECTS, defectLabel } from "./data/materials";
import {
  MASTERY_STREAK,
  MAX_ROUND_SIZE,
  MIN_ROUND_SIZE,
  applyJudgment,
  initialProgress,
  newRound,
  retrainQueue,
  todayISO,
  uid,
  type DefectId,
  type Judgment,
  type SampleWine,
  type TrainerSettings,
  type WineStatus,
} from "./domain/reviewRules";
import { clearState, defaultState, loadState, saveState, type TrainerState } from "./storage/archive";

const STATUS_LABEL: Record<WineStatus, string> = {
  new: "未训练",
  learning: "待巩固",
  retrain: "待复训",
  mastered: "已掌握",
};

const STATUS_CLASS: Record<WineStatus, string> = {
  new: "badge",
  learning: "badge warn",
  retrain: "badge danger",
  mastered: "badge ok",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("zh-CN", { hour12: false });
}

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  const colors = ["status-ok", "status-watch", "status-danger", "status-ok"];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={colors[index % colors.length]} />
    </article>
  );
}

type Tab = "train" | "register" | "review";

const TABS: { id: Tab; label: string }[] = [
  { id: "train", label: "学员训练" },
  { id: "register", label: "讲师登记" },
  { id: "review", label: "复训与留档" },
];

function App() {
  const [state, setState] = useState<TrainerState>(() => loadState());
  const [tab, setTab] = useState<Tab>("train");

  // 本地留档：任何状态变化立即落盘，关掉页面再打开可接着练
  useEffect(() => {
    saveState(state);
  }, [state]);

  const winesById = useMemo(() => new Map(state.wines.map((w) => [w.id, w])), [state.wines]);

  const stats = useMemo(() => {
    let retrain = 0;
    let mastered = 0;
    for (const wine of state.wines) {
      const status = (state.progress[wine.id] ?? initialProgress()).status;
      if (status === "retrain") retrain += 1;
      if (status === "mastered") mastered += 1;
    }
    return { total: state.wines.length, retrain, mastered };
  }, [state.wines, state.progress]);

  const startRound = () =>
    setState((prev) => ({ ...prev, session: newRound(prev.wines, prev.progress, prev.settings, todayISO()) }));

  const setPaused = (paused: boolean) =>
    setState((prev) => (prev.session ? { ...prev, session: { ...prev.session, paused } } : prev));

  const submitJudgment = (picked: DefectId) =>
    setState((prev) => {
      const session = prev.session;
      if (!session || session.paused || session.finished) return prev;
      if (session.judgments.length !== session.cursor) return prev; // 当前题已提交过
      const wineId = session.queue[session.cursor];
      const wine = prev.wines.find((w) => w.id === wineId);
      if (!wine) return prev;
      const judgment: Judgment = {
        id: uid(),
        roundId: session.id,
        wineId,
        picked,
        correct: picked === wine.defect,
        at: new Date().toISOString(),
      };
      return {
        ...prev,
        session: { ...session, judgments: [...session.judgments, judgment] },
        progress: {
          ...prev.progress,
          [wineId]: applyJudgment(
            prev.progress[wineId] ?? initialProgress(),
            judgment.correct,
            prev.settings.nextTrainingDate,
          ),
        },
        archive: [...prev.archive, judgment],
      };
    });

  const nextQuestion = () =>
    setState((prev) => {
      const session = prev.session;
      if (!session || session.judgments.length <= session.cursor) return prev;
      const cursor = session.cursor + 1;
      return { ...prev, session: { ...session, cursor, finished: cursor >= session.queue.length } };
    });

  const endRound = () =>
    setState((prev) =>
      prev.session ? { ...prev, session: { ...prev.session, finished: true, paused: false } } : prev,
    );

  const addWine = (input: Omit<SampleWine, "id" | "createdAt">) =>
    setState((prev) => ({
      ...prev,
      wines: [...prev.wines, { ...input, id: uid(), createdAt: new Date().toISOString() }],
    }));

  const removeWine = (id: string) =>
    setState((prev) => {
      // 进行中的轮次题序锁定，不允许删除其中的样酒
      if (prev.session && !prev.session.finished && prev.session.queue.includes(id)) return prev;
      const progress = { ...prev.progress };
      delete progress[id];
      return { ...prev, wines: prev.wines.filter((w) => w.id !== id), progress };
    });

  const updateSettings = (patch: Partial<TrainerSettings>) =>
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  const exportArchive = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      wines: state.wines,
      progress: state.progress,
      archive: state.archive,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `defect-trainer-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearArchive = () => {
    if (!window.confirm("确定清空全部判断留档？样酒与复训进度会保留。")) return;
    setState((prev) => ({ ...prev, archive: [] }));
  };

  const resetAll = () => {
    if (!window.confirm("确定重置全部数据？样酒、进度与留档都会清空。")) return;
    clearState();
    setState(defaultState());
  };

  const session = state.session;
  const roundProgress = session && !session.finished ? `${session.judgments.length}/${session.queue.length}` : "—";

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-08 · port 5108</p>
          <h1>缺陷诊断训练台</h1>
          <p className="subtitle">
            开课前登记样酒与闻香线索，学员按 3–5 款一轮提交缺陷判断；答错归入待复训并排入下一次训练日，
            同一款连续答对两次才算掌握。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>训练资料 / 复习规则 / 本地留档分层存放</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="登记样酒" value={String(stats.total)} index={0} />
        <MetricCard label="待复训" value={String(stats.retrain)} index={1} />
        <MetricCard label="已掌握" value={String(stats.mastered)} index={2} />
        <MetricCard label="本轮进度" value={roundProgress} index={3} />
      </section>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "train" && (
        <TrainPanel
          state={state}
          winesById={winesById}
          onStart={startRound}
          onPauseToggle={setPaused}
          onSubmit={submitJudgment}
          onNext={nextQuestion}
          onEnd={endRound}
        />
      )}
      {tab === "register" && (
        <RegisterPanel state={state} onAddWine={addWine} onRemoveWine={removeWine} onSettings={updateSettings} />
      )}
      {tab === "review" && (
        <ReviewPanel
          state={state}
          winesById={winesById}
          onExport={exportArchive}
          onClearArchive={clearArchive}
          onReset={resetAll}
        />
      )}
    </main>
  );
}

interface TrainPanelProps {
  state: TrainerState;
  winesById: Map<string, SampleWine>;
  onStart: () => void;
  onPauseToggle: (paused: boolean) => void;
  onSubmit: (picked: DefectId) => void;
  onNext: () => void;
  onEnd: () => void;
}

function TrainPanel({ state, winesById, onStart, onPauseToggle, onSubmit, onNext, onEnd }: TrainPanelProps) {
  const session = state.session;
  const [picked, setPicked] = useState<DefectId | null>(null);
  const cursorKey = session ? `${session.id}:${session.cursor}` : "idle";
  useEffect(() => setPicked(null), [cursorKey]);

  if (state.wines.length === 0) {
    return (
      <section className="panel">
        <h2>学员训练</h2>
        <p className="empty-note">样酒库为空，请先到「讲师登记」页录入样酒与闻香线索。</p>
      </section>
    );
  }

  if (!session || session.finished) {
    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>
              每轮 {state.settings.roundSize} 款 · 连续答对 {MASTERY_STREAK} 次计为掌握
            </p>
            <h2>学员训练</h2>
          </div>
          <button className="primary-action" onClick={onStart}>
            开始新一轮
          </button>
        </div>
        {session?.finished ? (
          <RoundSummary state={state} winesById={winesById} />
        ) : (
          <p className="empty-note">
            组卷规则：到期待复训样酒优先，新样酒补足题量；题序确定后，暂停、改题量或关闭页面都不会丢失进度。
          </p>
        )}
      </section>
    );
  }

  if (session.paused) {
    return (
      <section className="panel">
        <div className="banner pause">
          训练已暂停：已提交 {session.judgments.length} 个判断与剩余 {session.queue.length - session.cursor}{" "}
          题的顺序均已保留，关掉页面再打开也能接着练。
        </div>
        <div className="row-actions">
          <button className="primary-action" onClick={() => onPauseToggle(false)}>
            继续训练
          </button>
          <button onClick={onEnd}>结束本轮</button>
        </div>
      </section>
    );
  }

  const wine = winesById.get(session.queue[session.cursor]);
  if (!wine) {
    return (
      <section className="panel">
        <p className="empty-note">当前样酒已被移除。</p>
        <button className="primary-action" onClick={onNext}>
          跳过
        </button>
      </section>
    );
  }

  const answered = session.judgments.length > session.cursor;
  const lastJudgment = answered ? session.judgments[session.judgments.length - 1] : null;
  const progress = state.progress[wine.id] ?? initialProgress();
  const isLast = session.cursor === session.queue.length - 1;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>
            第 {session.cursor + 1} / {session.queue.length} 题 · 本轮 {session.size} 款
          </p>
          <h2>
            样酒 {wine.code} · {wine.name}
          </h2>
        </div>
        <div className="row-actions">
          <button onClick={() => onPauseToggle(true)}>暂停</button>
          <button onClick={onEnd}>提前结束</button>
        </div>
      </div>

      <div className="clue-card">
        <span className="badge">闻香线索 · 缺陷标签已隐藏</span>
        <ul>
          {wine.clues.map((clue) => (
            <li key={clue}>{clue}</li>
          ))}
        </ul>
      </div>

      <div className="option-grid">
        {DEFECTS.map((d) => {
          const classes = ["option"];
          if (!answered && picked === d.id) classes.push("selected");
          if (answered && d.id === wine.defect) classes.push("correct");
          if (answered && lastJudgment?.picked === d.id && d.id !== wine.defect) classes.push("wrong");
          return (
            <button key={d.id} className={classes.join(" ")} disabled={answered} onClick={() => setPicked(d.id)}>
              {d.label}
              <small>{d.short}</small>
            </button>
          );
        })}
      </div>

      {!answered ? (
        <button className="primary-action" disabled={!picked} onClick={() => picked && onSubmit(picked)}>
          提交判断
        </button>
      ) : (
        <div className={`banner ${lastJudgment?.correct ? "ok" : "bad"}`}>
          <strong>
            {lastJudgment?.correct ? "判断正确" : "判断错误"} · 实际标签：{defectLabel(wine.defect)}（讲师置信度{" "}
            {wine.confidence}/5）
          </strong>
          <span>
            {lastJudgment?.correct
              ? progress.status === "mastered"
                ? `连续答对 ${progress.streak} 次，该款已掌握，移出复训队列。`
                : `连续答对 ${progress.streak}/${MASTERY_STREAK}，下一次训练日（${progress.nextReviewDate}）再确认一次。`
              : `已归入待复训，最早可复习日：${progress.nextReviewDate}（下一次训练日期）。`}
          </span>
          <div>
            <button className="primary-action" onClick={onNext}>
              {isLast ? "完成本轮" : "下一题"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function RoundSummary({ state, winesById }: { state: TrainerState; winesById: Map<string, SampleWine> }) {
  const session = state.session;
  if (!session) return null;
  const correctCount = session.judgments.filter((j) => j.correct).length;
  return (
    <div>
      <p className="empty-note">
        本轮 {session.queue.length} 款，提交 {session.judgments.length} 个判断，答对 {correctCount} 个。
      </p>
      <div className="summary-list">
        {session.judgments.map((j) => {
          const wine = winesById.get(j.wineId);
          return (
            <div key={j.id} className="summary-item">
              <span>{wine ? `${wine.code} · ${wine.name}` : "样酒已删除"}</span>
              <span className={j.correct ? "text-ok" : "text-bad"}>
                {j.correct ? "✓ 正确" : `✗ 误判为${defectLabel(j.picked)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RegisterPanelProps {
  state: TrainerState;
  onAddWine: (input: Omit<SampleWine, "id" | "createdAt">) => void;
  onRemoveWine: (id: string) => void;
  onSettings: (patch: Partial<TrainerSettings>) => void;
}

function RegisterPanel({ state, onAddWine, onRemoveWine, onSettings }: RegisterPanelProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [defect, setDefect] = useState<DefectId>("oxidation");
  const [confidence, setConfidence] = useState(4);
  const [cluesText, setCluesText] = useState("");

  const clues = cluesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = code.trim().length > 0 && name.trim().length > 0 && clues.length > 0;
  const roundActive = Boolean(state.session && !state.session.finished);
  const activeQueue = roundActive && state.session ? state.session.queue : [];

  const submit = () => {
    if (!valid) return;
    onAddWine({ code: code.trim(), name: name.trim(), defect, confidence, clues });
    setCode("");
    setName("");
    setDefect("oxidation");
    setConfidence(4);
    setCluesText("");
  };

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>复习规则参数</p>
            <h2>轮次与排期</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>
              每轮题量（{MIN_ROUND_SIZE}–{MAX_ROUND_SIZE} 款）
            </span>
            <select value={state.settings.roundSize} onChange={(e) => onSettings({ roundSize: Number(e.target.value) })}>
              {[MIN_ROUND_SIZE, 4, MAX_ROUND_SIZE].map((n) => (
                <option key={n} value={n}>
                  {n} 款 / 轮
                </option>
              ))}
            </select>
            {roundActive && <span className="hint">本轮已开卷：已提交判断与剩余题序保留，新题量下一轮生效。</span>}
          </label>
          <label>
            <span>下一次训练日期（答错样酒的最早可复习日）</span>
            <input
              type="date"
              value={state.settings.nextTrainingDate}
              onChange={(e) => e.target.value && onSettings({ nextTrainingDate: e.target.value })}
            />
            <span className="hint">
              答错归入待复训并按此日期排入复习；同一款连续答对 {MASTERY_STREAK} 次计为掌握。
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>开课前登记</p>
            <h2>新增样酒</h2>
          </div>
          <button className="primary-action" disabled={!valid} onClick={submit}>
            登记样酒
          </button>
        </div>
        <div className="form-grid">
          <label>
            <span>样酒编号</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 A-09" />
          </label>
          <label>
            <span>名称 / 背景</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 2018 干红 · 不锈钢罐" />
          </label>
          <label>
            <span>缺陷标签（答案）</span>
            <select value={defect} onChange={(e) => setDefect(e.target.value as DefectId)}>
              {DEFECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} · {d.short}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>讲师置信度（1–5）</span>
            <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            <span>闻香线索（每行一条，学员可见）</span>
            <textarea
              value={cluesText}
              onChange={(e) => setCluesText(e.target.value)}
              placeholder={"湿纸板与发霉地窖气味\n果香沉闷不展开"}
            />
          </label>
        </div>
        <p className="hint">线索与答案分开存放：学员在提交判断前只能看到线索。</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>缺陷图鉴</p>
            <h2>标签参考</h2>
          </div>
        </div>
        <div className="defect-ref">
          {DEFECTS.map((d) => (
            <article key={d.id}>
              <h3>
                {d.label} <small>{d.short}</small>
              </h3>
              <p>{d.hints}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>样酒库（仅讲师可见标签）</p>
            <h2>已登记 {state.wines.length} 款</h2>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>名称</th>
              <th>缺陷标签</th>
              <th>置信度</th>
              <th>线索</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.wines.map((wine) => {
              const p = state.progress[wine.id] ?? initialProgress();
              const locked = activeQueue.includes(wine.id);
              return (
                <tr key={wine.id}>
                  <td>{wine.code}</td>
                  <td>{wine.name}</td>
                  <td>{defectLabel(wine.defect)}</td>
                  <td>{wine.confidence}/5</td>
                  <td>{wine.clues.length} 条</td>
                  <td>
                    <span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td>
                    <button
                      disabled={locked}
                      title={locked ? "本轮进行中，题序锁定" : "删除样酒"}
                      onClick={() => onRemoveWine(wine.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

interface ReviewPanelProps {
  state: TrainerState;
  winesById: Map<string, SampleWine>;
  onExport: () => void;
  onClearArchive: () => void;
  onReset: () => void;
}

function ReviewPanel({ state, winesById, onExport, onClearArchive, onReset }: ReviewPanelProps) {
  const queue = retrainQueue(state.wines, state.progress);
  const recent = [...state.archive].slice(-12).reverse();

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>按最早可复习日升序</p>
            <h2>待复训 / 待巩固队列（{queue.length}）</h2>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="empty-note">暂无待复训样酒。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>名称</th>
                <th>状态</th>
                <th>连续答对</th>
                <th>最早可复习日</th>
                <th>历史正确</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(({ wine, progress }) => (
                <tr key={wine.id}>
                  <td>{wine.code}</td>
                  <td>{wine.name}</td>
                  <td>
                    <span className={STATUS_CLASS[progress.status]}>{STATUS_LABEL[progress.status]}</span>
                  </td>
                  <td>
                    {progress.streak}/{MASTERY_STREAK}
                  </td>
                  <td>{progress.nextReviewDate ?? "—"}</td>
                  <td>{progress.attempts === 0 ? "—" : `${progress.correct}/${progress.attempts}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint">缺陷标签不在此展示：学员提交判断前，标签仅在讲师登记页可见。</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>本地留档 · 共 {state.archive.length} 条判断</p>
            <h2>判断留档</h2>
          </div>
          <div className="row-actions">
            <button onClick={onExport}>导出 JSON</button>
            <button onClick={onClearArchive}>清空留档</button>
            <button onClick={onReset}>重置全部数据</button>
          </div>
        </div>
        {recent.length === 0 ? (
          <p className="empty-note">还没有提交过判断。</p>
        ) : (
          <div className="record-list">
            {recent.map((j) => {
              const wine = winesById.get(j.wineId);
              return (
                <article key={j.id} className="record-card">
                  <div className={`record-index ${j.correct ? "ok" : "bad"}`}>{j.correct ? "对" : "错"}</div>
                  <div>
                    <h3>{wine ? `${wine.code} · ${wine.name}` : "样酒已删除"}</h3>
                    <p>
                      学员判断：{defectLabel(j.picked)} · {formatTime(j.at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default App;
