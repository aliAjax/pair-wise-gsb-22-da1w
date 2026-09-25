import type { DefectId, DefectTag } from "../types";

interface Props {
  tags: DefectTag[];
  selected: DefectId[];
  onChange: (next: DefectId[]) => void;
  disabled?: boolean;
  size?: "md" | "sm";
}

/** 缺陷标签多选（氧化 / 还原 / 软木塞污染 …），登记答案和学员答题共用 */
export default function TagPicker({ tags, selected, onChange, disabled, size = "md" }: Props) {
  const toggle = (id: DefectId) => {
    if (disabled) return;
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  };

  return (
    <div className={"tag-picker" + (size === "sm" ? " sm" : "")}>
      {tags.map((t) => (
        <button
          type="button"
          key={t.id}
          className={selected.includes(t.id) ? "tag on" : "tag"}
          onClick={() => toggle(t.id)}
          disabled={disabled}
          title={t.hint}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
