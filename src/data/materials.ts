// 训练资料：缺陷图鉴与开课前预置的样酒库。
// 只放静态资料，不含复习规则与存储逻辑。

import type { DefectId, SampleWine } from "../domain/reviewRules";

export interface DefectInfo {
  id: DefectId;
  label: string; // 中文标签：学员选项 & 答案
  short: string; // 英文 / 俗称
  hints: string; // 典型闻香特征，供讲师登记时参考
}

export const DEFECTS: DefectInfo[] = [
  { id: "oxidation", label: "氧化", short: "Oxidation", hints: "苹果酒、雪莉、坚果、焦糖气息，果香衰退，酒色偏棕" },
  { id: "reduction", label: "还原", short: "Reduction", hints: "臭鸡蛋、火柴、橡胶、大蒜气息，通气后可能散去" },
  { id: "cork", label: "软木塞污染", short: "TCA", hints: "湿纸板、发霉地窖、湿狗味，果香像被闷住" },
  { id: "va", label: "挥发酸", short: "Volatile Acidity", hints: "醋、洗甲水般的刺鼻感，入口灼热" },
  { id: "brett", label: "酒香酵母", short: "Brett", hints: "马厩、皮革、创可贴、丁香味，覆盖果香" },
  { id: "clean", label: "无明显缺陷", short: "Clean", hints: "果香清晰开放，无异味，作为对照样" },
];

export function defectLabel(id: DefectId): string {
  return DEFECTS.find((d) => d.id === id)?.label ?? id;
}

let seedSeq = 0;
const seed = (code: string, name: string, defect: DefectId, confidence: number, clues: string[]): SampleWine => ({
  id: `seed-${(seedSeq += 1)}`,
  code,
  name,
  defect,
  confidence,
  clues,
  createdAt: "2026-09-25T09:00:00.000Z",
});

export const seedWines: SampleWine[] = [
  seed("A-01", "干红 · 橡木桶陈酿", "oxidation", 5, [
    "苹果酒与雪莉酒气息",
    "坚果、焦糖，果香明显衰退",
    "酒色偏棕，口感平淡",
  ]),
  seed("A-02", "干红 · 密闭不锈钢罐", "reduction", 4, [
    "开瓶有臭鸡蛋与火柴味",
    "略带橡胶与大蒜气息",
    "醒酒十分钟后异味减弱",
  ]),
  seed("A-03", "干红 · 软木塞封装", "cork", 5, [
    "湿纸板与发霉地窖气味",
    "隐约有湿狗味",
    "果香像被罩住，沉闷不展开",
  ]),
  seed("A-04", "干红 · 小酒庄自然派", "va", 4, [
    "明显醋酸味",
    "洗甲水般的刺鼻感",
    "入口灼热，余味发酸",
  ]),
  seed("A-05", "干红 · 旧桶陈酿", "brett", 4, [
    "马厩与皮革气息",
    "创可贴、丁香味",
    "果香被动物气息覆盖",
  ]),
  seed("A-06", "干红 · 对照样", "clean", 5, [
    "黑莓与紫罗兰香气清晰",
    "黑胡椒与淡淡烟熏",
    "无异味，香气开放",
  ]),
  seed("A-07", "干白 · 陈年五年", "oxidation", 3, [
    "蜂蜜与干苹果气息",
    "新鲜感下降",
    "酸度仍在但果味发闷",
  ]),
  seed("A-08", "干红 · 螺旋盖", "reduction", 3, [
    "淡淡煮白菜味",
    "摇杯后逐渐散去",
    "底层仍有黑樱桃果香",
  ]),
];
