import { useState } from "react";
import type { DefectId, DefectTag, WineSample } from "../types";
import TagPicker from "./TagPicker";

interface Props {
  tags: DefectTag[];
  usedCodes: string[];
  onAdd: (s: Omit<WineSample, "id" | "createdAt">) => void;
}

const empty = { code: "", name: "", confidence: 70, cluesText: "", tags: [] as DefectId[] };

/** 开课前登记：样酒编号 / 酒款 / 缺陷标签（答案）/ 置信度 / 闻香线索 */
export default function SampleForm({ tags, usedCodes, onAdd }: Props) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  const submit = () => {
    const code = form.code.trim();
    const name = form.name.trim();
    const clues = form.cluesText
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!code) return setError("请填写样酒编号（盲品时学员只看编号）");
    if (usedCodes.some((c) => c === code)) return setError(`编号 ${code} 已存在`);
    if (!name) return setError("请填写酒款描述（讲师侧）");
    if (form.tags.length === 0) return setError("请至少选择一个缺陷标签");
    if (clues.length === 0) return setError("请填写至少一条闻香线索");

    onAdd({ code, name, tags: form.tags, confidence: form.confidence, clues });
    setForm(empty);
    setError("");
  };

  return (
    <div className="sample-form">
      <div className="form-row">
        <label className="col-code">
          <span>样酒编号 *</span>
          <input
            value={form.code}
            placeholder="如 B-03"
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </label>
        <label className="col-name">
          <span>酒款描述（仅讲师可见）*</span>
          <input
            value={form.name}
            placeholder="如 被氧化的陈年雷司令"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
      </div>

      <div>
        <span className="field-label">缺陷标签（答案）*</span>
        <TagPicker
          tags={tags}
          selected={form.tags}
          onChange={(next) => setForm({ ...form, tags: next })}
        />
      </div>

      <label>
        <span>
          讲师置信度：<strong>{form.confidence}%</strong>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={form.confidence}
          onChange={(e) => setForm({ ...form, confidence: Number(e.target.value) })}
        />
      </label>

      <label>
        <span>闻香线索（每行一条，学员侧可见）*</span>
        <textarea
          rows={3}
          value={form.cluesText}
          placeholder={"烂苹果、雪利酒味\n颜色偏琥珀棕"}
          onChange={(e) => setForm({ ...form, cluesText: e.target.value })}
        />
      </label>

      {error && <p className="form-error">{error}</p>}
      <button className="primary-action" onClick={submit}>
        登记样酒
      </button>
    </div>
  );
}
