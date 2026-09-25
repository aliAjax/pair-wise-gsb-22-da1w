import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type {
  ActiveSession,
  DefectId,
  JudgmentRecord,
  ReviewRules,
  WineSample,
} from "./types";
import {
  defaultRules,
  loadArchive,
  loadProgress,
  loadRules,
  loadSamples,
  loadSession,
  loadTags,
  appendArchive,
  saveProgress,
  saveRules,
  saveSamples,
  saveSession,
  type SampleProgress,
} from "./storage";
import { applyJudgment, buildRound, startSession, uid } from "./engine";
import { seedSamples } from "./seed";
import SampleForm from "./components/SampleForm";
import SampleLibrary from "./components/SampleLibrary";
import RulesPanel from "./components/RulesPanel";
import Trainer from "./components/Trainer";
import ReviewBoard from "./components/ReviewBoard";

type Tab = "train" | "library" | "review";

function initSamples(): WineSample[] {
  const existing = loadSamples();
  if (existing.length > 0) return existing;
  const seeded = seedSamples();
  saveSamples(seeded);
  return seeded;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("train");
  const [samples, setSamples] = useState<WineSample[]>(initSamples);
  const [rules, setRules] = useState<ReviewRules>(loadRules);
  const [progress, setProgress] = useState<Record<string, SampleProgress>>(loadProgress);
  const [archive, setArchive] = useState<JudgmentRecord[]>(loadArchive);
  const [session, setSession] = useState<ActiveSession | null>(loadSession);
  const tags = loadTags(); // 标签字典基本固定，直接读取

  // 四类数据各自持久化，互不混用
  useEffect(() => saveSamples(samples), [samples]);
  useEffect(() => saveRules(rules), [rules]);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveSession(session), [session]);

  const sampleById = useMemo(() => new Map(samples.map((s) => [s.id, s])), [samples]);

  const sessionRecords = useMemo(
    () => (session ? archive.filter((r) => r.sessionId === session.id) : []),
    [archive, session],
  );

  const roundNo = useMemo(() => {
    const rounds = new Set(archive.map((r) => `${r.sessionId}#${r.roundNo}`));
    return rounds.size + (session ? 0 : 1);
  }, [archive, session]);

  // ---- 看板统计 ----
  const stats = useMemo(() => {
    const mastered = Object.values(progress).filter((p) => p.mastered).length;
    const reviewing = Object.values(progress).filter((p) => p.needsReview && !p.mastered);
    const due = reviewing.filter(
      (p) => p.earliestReviewAt !== null && p.earliestReviewAt <= rules.nextTrainingDate,
    ).length;
    const fresh = samples.filter((s) => !progress[s.id] || progress[s.id].totalAnswered === 0)
      .length;
    const recent = archive.slice(-30);
    const acc = recent.length ? Math.round((recent.filter((r) => r.correctAnswer).length / recent.length) * 100) : null;
    // 混淆矩阵线索：被错判最多的正确标签
    const missByTag = new Map<DefectId, number>();
    archive
      .filter((r) => !r.correctAnswer)
      .forEach((r) => r.correct.forEach((t) => missByTag.set(t, (missByTag.get(t) ?? 0) + 1)));
    const weakest = [...missByTag.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return { mastered, due, fresh, reviewing: reviewing.length, acc, weakest };
  }, [progress, samples, archive, rules.nextTrainingDate]);

  // ---- 下一轮预排 ----
  const preview = useMemo(
    () => buildRound(samples, progress, rules, roundNo),
    [samples, progress, rules, roundNo],
  );

  const addSample = (data: Omit<WineSample, "id" | "createdAt">) => {
    setSamples((prev) => [...prev, { ...data, id: uid(), createdAt: new Date().toISOString() }]);
  };

  const deleteSample = (id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
  };

  const startRound = () => {
    const round = buildRound(samples, progress, rules, roundNo);
    if (round.length < 3) return;
    setSession(startSession(round, roundNo, rules.roundSize));
    setTab("train");
  };

  const judge = (chosen: DefectId[]) => {
    if (!session) throw new Error("no active session");
    const item = session.queue[0];
    if (session.judgedIds.includes(item.sampleId)) {
      throw new Error("current sample already judged");
    }
    const sample = sampleById.get(item.sampleId);
    if (!sample) throw new Error("sample missing");
    const { record, nextProgress } = applyJudgment(
      item,
      chosen,
      sample.tags,
      rules,
      progress[item.sampleId],
      session.id,
      session.roundNo,
    );
    appendArchive(record); // 立刻写入留档（只增）
    setArchive((prev) => [...prev, record]);
    setProgress((prev) => ({ ...prev, [item.sampleId]: nextProgress }));
    setSession({ ...session, judgedIds: [...session.judgedIds, item.sampleId] });
    return { record, progress: nextProgress };
  };

  const advance = () => {
    if (!session) return;
    // 最后一款：保留队列、仅标记结束，确保刷新后仍能看到本轮小结
    if (session.queue.length <= 1) {
      setSession({ ...session, finished: true, paused: false, pausedAt: null });
    } else {
      setSession({ ...session, queue: session.queue.slice(1) });
    }
  };

  const togglePause = () => {
    if (!session) return;
    setSession({
      ...session,
      paused: !session.paused,
      pausedAt: session.paused ? null : new Date().toISOString(),
    });
  };

  // 终止本轮：进行中题序作废，但已提交判断与进度都在留档里
  const abortRound = () => {
    if (!session) return;
    if (window.confirm("终止本轮？已提交的判断会保留在留档，剩余题序作废。")) {
      setSession(null);
    }
  };

  const closeRound = () => setSession(null);

  const lockedIds = session ? session.queue.map((q) => q.sampleId) : [];
  const weakestName = stats.weakest ? tags.find((t) => t.id === stats.weakest![0])?.name : null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">缺陷诊断训练台 · 盲品复习</p>
          <h1>氧化、还原、软木塞污染，分得清</h1>
          <p className="subtitle">
            开课前登记样酒、缺陷标签、置信度与闻香线索；同一场线索公开、答案在提交前不可见。
            答错自动排入待复训，连续答对两次才算掌握，关掉页面也能接着练。
          </p>
        </div>
        <div className="stack-card">
          <span>存储分区</span>
          <strong>
            训练资料 · 复习规则 · 复习进度 · 本地留档 · 进行中场次
            <br />
            五类数据分键保存在浏览器本地
          </strong>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>已掌握样酒</span>
          <strong>{stats.mastered}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>到期可复习（{rules.nextTrainingDate}）</span>
          <strong>{stats.due}</strong>
          <i className="status-watch" />
        </article>
        <article className="metric-card">
          <span>待复训 / 未练</span>
          <strong>
            {stats.reviewing} / {stats.fresh}
          </strong>
          <i className="status-danger" />
        </article>
        <article className="metric-card">
          <span>近 30 次正确率{weakestName ? ` · 最弱：${weakestName}` : ""}</span>
          <strong>{stats.acc === null ? "—" : `${stats.acc}%`}</strong>
          <i className="status-watch" />
        </article>
      </section>

      <nav className="tabs">
        <button className={tab === "train" ? "tab on" : "tab"} onClick={() => setTab("train")}>
          训练台
        </button>
        <button className={tab === "library" ? "tab on" : "tab"} onClick={() => setTab("library")}>
          样酒资料库（{samples.length}）
        </button>
        <button className={tab === "review" ? "tab on" : "tab"} onClick={() => setTab("review")}>
          复习与留档（{stats.reviewing} / {archive.length}）
        </button>
      </nav>

      {tab === "train" && (
        <section className="workspace train-layout">
          <aside className="panel narrow">
            <h2>复习规则</h2>
            <RulesPanel rules={rules} onChange={setRules} roundLocked={!!session && !session.finished} />
          </aside>

          <section className="panel">
            {session ? (
              <Trainer
                session={session}
                samples={samples}
                tags={tags}
                records={sessionRecords}
                onJudge={judge}
                onAdvance={advance}
                onPauseToggle={togglePause}
                onAbort={abortRound}
                onCloseRound={closeRound}
              />
            ) : (
              <StartPanel
                roundNo={roundNo}
                preview={preview}
                samples={samples}
                rules={rules}
                stats={{ due: stats.due, fresh: stats.fresh, reviewing: stats.reviewing }}
                onStart={startRound}
              />
            )}
          </section>
        </section>
      )}

      {tab === "library" && (
        <section className="workspace library-layout">
          <aside className="panel narrow">
            <h2>开课前登记</h2>
            <SampleForm tags={tags} usedCodes={samples.map((s) => s.code)} onAdd={addSample} />
          </aside>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p>训练资料（独立存储）</p>
                <h2>样酒资料库</h2>
              </div>
            </div>
            <SampleLibrary
              samples={samples}
              tags={tags}
              progress={progress}
              lockedIds={lockedIds}
              onDelete={deleteSample}
            />
          </section>
        </section>
      )}

      {tab === "review" && (
        <section className="panel">
          <ReviewBoard
            samples={samples}
            tags={tags}
            progress={progress}
            archive={archive}
            trainingDate={rules.nextTrainingDate}
          />
        </section>
      )}

      <footer className="page-foot">
        所有数据仅保存在本机浏览器（localStorage，按用途分键）；清除浏览器数据会同时清空资料与留档。
      </footer>
    </main>
  );
}

function StartPanel({
  roundNo,
  preview,
  samples,
  rules,
  stats,
  onStart,
}: {
  roundNo: number;
  preview: ReturnType<typeof buildRound>;
  samples: WineSample[];
  rules: ReviewRules;
  stats: { due: number; fresh: number; reviewing: number };
  onStart: () => void;
}) {
  const canStart = preview.length >= 3;
  const sourceName: Record<string, string> = {
    review: "到期复训",
    new: "新样酒",
    maintenance: "已掌握抽测",
  };

  return (
    <div className="start-panel">
      <div className="section-heading">
        <div>
          <p>第 {roundNo} 轮 · 每轮 {rules.roundSize} 款</p>
          <h2>准备开训</h2>
        </div>
        <button className="primary-action" disabled={!canStart} onClick={onStart}>
          开始本轮
        </button>
      </div>

      {!canStart && samples.length < 3 ? (
        <p className="form-error">
          资料库至少要有 3 款样酒才能开一轮（当前 {samples.length} 款），先去「样酒资料库」登记。
        </p>
      ) : !canStart ? (
        <p className="form-error">
          可排入本轮的样酒不足 3 款：到期复训 {stats.due}、未练 {stats.fresh}；
          可在左侧把「下一次训练日期」调到更晚，让待复训到期，或先登记新样酒。
        </p>
      ) : null}

      <div className="queue-preview">
        <p className="muted-hint">
          排队顺序：优先到期的待复训（按最早可复习日从早到晚），其次未练新酒，不足再用已掌握样酒抽测。
          学员侧本轮只看得到编号与闻香线索。
        </p>
        <div className="preview-grid">
          {preview.map((item, i) => (
            <article key={item.sampleId} className="preview-card">
              <span className="preview-no">{String(i + 1).padStart(2, "0")}</span>
              <strong>{item.code}</strong>
              <span className="source-chip">{sourceName[item.source]}</span>
            </article>
          ))}
          {preview.length < rules.roundSize && (
            <article className="preview-card short">
              题量要求 {rules.roundSize} 款，当前可排 {preview.length} 款
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
