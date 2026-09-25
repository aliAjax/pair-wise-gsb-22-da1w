import type { WineSample } from "./types";
import { uid } from "./engine";

/** 首次开课时的示范样酒（仅在本地完全没有资料时写入） */
export function seedSamples(): WineSample[] {
  const now = new Date().toISOString();
  const rows: Omit<WineSample, "id" | "createdAt">[] = [
    {
      code: "A-01",
      name: "氧化型白葡萄酒（老年份）",
      tags: ["oxidation"],
      confidence: 88,
      clues: ["颜色明显偏琥珀棕", "雪利酒与烂苹果味", "入口坚果、焦糖，鲜度流失"],
    },
    {
      code: "A-02",
      name: "还原态干红（紧密封瓶）",
      tags: ["reduction"],
      confidence: 82,
      clues: ["初闻臭鸡蛋与橡胶味", "晃杯十分钟后闷味散开", "果香重新浮现，无湿纸板感"],
    },
    {
      code: "A-03",
      name: "TCA 软木塞污染霞多丽",
      tags: ["cork"],
      confidence: 95,
      clues: ["湿纸板、发霉地下室", "旧湿抹布气息", "果香被整体压低，晃杯不改善"],
    },
    {
      code: "A-04",
      name: "挥发酸偏高的自然酒",
      tags: ["volatile_acidity"],
      confidence: 74,
      clues: ["初闻像醋和沙拉汁", "尾段有洗甲水的冲鼻感", "入口酸得尖锐发飘"],
    },
    {
      code: "A-05",
      name: "酒香酵母污染西拉",
      tags: ["brett"],
      confidence: 70,
      clues: ["马厩、创可贴味", "烟熏培根与汗水气息", "黑色水果被野味盖住"],
    },
    {
      code: "A-06",
      name: "状态干净的黑皮诺（对照）",
      tags: ["none"],
      confidence: 92,
      clues: ["红樱桃、蘑菇香干净清晰", "无闷臭、醋感或湿纸板", "杯中香气随时间舒展"],
    },
    {
      code: "A-07",
      name: "透明瓶受光的白葡萄酒",
      tags: ["light_strike"],
      confidence: 78,
      clues: ["煮白菜与老玉米罐头味", "湿羊毛气息", "瓶身为透明玻璃，长期灯光陈列"],
    },
    {
      code: "A-08",
      name: "运输热损伤波尔多",
      tags: ["cooked"],
      confidence: 65,
      clues: ["煮果酱、炖水果味", "甜香发闷发平，缺乏层次", "酒塞略微凸起"],
    },
  ];

  return rows.map((r) => ({ ...r, id: uid(), createdAt: now }));
}
