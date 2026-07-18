export const DEFAULT_TARGET_KCAL = 900;

export const FOOD_CATEGORIES = [
  { id: "staple", label: "主食" },
  { id: "protein", label: "荤菜" },
  { id: "produce", label: "果蔬" },
  { id: "other", label: "其他" },
];

function option(id, label, multiplier) {
  return { id, label, multiplier };
}

export const seedFoods = [
  {
    id: "abbott-ensure-powder",
    name: "雅培全安素",
    pickerName: "奶粉",
    variant: "新一代 TY20230052，干粉",
    category: "staple",
    unitName: "勺",
    gramsPerUnit: 10,
    unitOptions: [option("1", "1勺", 1), option("2", "2勺", 2), option("3", "3勺", 3)],
    kcalPerGram: 4.369,
    sourceBasis: "1828 kJ / 100g（换算）",
    sourceUrl:
      "https://static.foodtalks.cn/cms/entry/form/38e130fdb2d07f4010c485eddbcb5a1ed8a8.png",
    archived: false,
  },
  {
    id: "walnut-oil",
    name: "核桃油",
    variant: "纯油",
    category: "other",
    unitName: "滴",
    gramsPerUnit: 0.05,
    unitOptions: [option("5", "5滴", 5), option("10", "10滴", 10), option("15", "15滴", 15)],
    kcalPerGram: 8.795,
    sourceBasis: "3680 kJ / 100g（换算）",
    sourceUrl: "https://nlc.chinanutri.cn/fq/foodinfo/1511.html",
    archived: false,
  },
  {
    id: "egg-hard-boiled",
    name: "鸡蛋",
    variant: "水煮，可食熟重",
    category: "protein",
    unitName: "个",
    gramsPerUnit: 50,
    unitOptions: [option("1", "1个", 1)],
    kcalPerGram: 1.55,
    sourceBasis: "155 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173424/nutrients",
    archived: false,
  },
  {
    id: "rice-steamed",
    name: "米饭",
    variant: "蒸熟重",
    category: "staple",
    unitName: "碗",
    gramsPerUnit: 30,
    unitOptions: [
      option("quarter", "1/4碗", 1 / 4),
      option("third", "1/3碗", 1 / 3),
      option("half", "1/2碗", 1 / 2),
      option("1", "1碗", 1),
    ],
    kcalPerGram: 100 / 30,
    sourceBasis: "1碗 30g = 100 kcal（用户设定）",
    sourceUrl: "https://nlc.chinanutri.cn/fq/foodinfo/287.html",
    archived: false,
  },
  {
    id: "oats-dry",
    name: "麦片",
    variant: "燕麦片，干重",
    category: "staple",
    unitName: "勺",
    gramsPerUnit: 10,
    unitOptions: [option("1", "1勺", 1), option("2", "2勺", 2), option("3", "3勺", 3)],
    kcalPerGram: 3.79,
    sourceBasis: "379 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173904/nutrients",
    archived: false,
  },
  {
    id: "chicken-breast-cooked",
    name: "鸡胸肉",
    variant: "去皮熟重",
    category: "protein",
    unitName: "块",
    gramsPerUnit: 25,
    unitOptions: [
      option("third", "1/3块", 1 / 3),
      option("half", "1/2块", 1 / 2),
      option("1", "1块", 1),
    ],
    kcalPerGram: 1.65,
    sourceBasis: "165 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/171477/nutrients",
    archived: false,
  },
  {
    id: "pork-floss",
    name: "猪肉松",
    variant: "即食均值，品牌可覆盖",
    category: "protein",
    unitName: "包",
    gramsPerUnit: 5,
    unitOptions: [option("1", "1包", 1)],
    kcalPerGram: 5,
    sourceBasis: "1包 5g = 25 kcal（用户设定）",
    sourceUrl: "https://nlc.chinanutri.cn/fq/foodinfo/811.html",
    archived: false,
  },
  {
    id: "sablefish-cooked",
    name: "银鳕鱼",
    variant: "裸盖鱼，熟重",
    category: "protein",
    unitName: "块",
    gramsPerUnit: 10,
    unitOptions: [option("1", "1块", 1), option("2", "2块", 2), option("3", "3块", 3)],
    kcalPerGram: 2.5,
    sourceBasis: "250 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/174240/nutrients",
    archived: false,
  },
  {
    id: "pork-tenderloin-raw",
    name: "猪里脊",
    variant: "鲜，生重",
    category: "protein",
    unitName: "块",
    gramsPerUnit: 25,
    unitOptions: [
      option("half", "1/2块", 1 / 2),
      option("1", "1块", 1),
      option("2", "2块", 2),
    ],
    kcalPerGram: 1.2,
    sourceBasis: "120 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/168312/nutrients",
    archived: false,
  },
  {
    id: "chinese-yam",
    name: "山药",
    variant: "鲜，可食部",
    category: "produce",
    unitName: "段",
    gramsPerUnit: 30,
    unitOptions: [option("1", "1段", 1)],
    kcalPerGram: 0.581,
    sourceBasis: "243 kJ / 100g（换算）",
    sourceUrl: "https://nlc.chinanutri.cn/fq/foodinfo/525.html",
    archived: false,
  },
  {
    id: "banana",
    name: "香蕉",
    variant: "去皮可食部",
    category: "other",
    unitName: "个",
    gramsPerUnit: 80,
    unitOptions: [
      option("quarter", "1/4个", 1 / 4),
      option("third", "1/3个", 1 / 3),
      option("half", "1/2个", 1 / 2),
      option("1", "1个", 1),
    ],
    kcalPerGram: 0.942,
    sourceBasis: "394 kJ / 100g（换算）",
    sourceUrl: "https://nlc.chinanutri.cn/fq/foodinfo/726.html",
    archived: false,
  },
  {
    id: "jujube-dried",
    name: "红枣",
    variant: "干枣，去核可食部",
    category: "other",
    unitName: "个",
    gramsPerUnit: 10,
    unitOptions: [option("1", "1个", 1), option("2", "2个", 2), option("3", "3个", 3)],
    kcalPerGram: 2.796,
    sourceBasis: "1170 kJ / 100g（换算）",
    sourceUrl: "https://nlc.chinanutri.cn/fq/foodinfo/675.html",
    archived: false,
  },
  {
    id: "zucchini",
    name: "西葫芦",
    variant: "熟、带皮、煮制沥水",
    category: "produce",
    unitName: "段",
    gramsPerUnit: 20,
    unitOptions: [option("1", "1段", 1)],
    kcalPerGram: 0.15,
    sourceBasis: "15 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/169292/nutrients",
    archived: false,
  },
  {
    id: "luffa-raw",
    name: "丝瓜",
    variant: "鲜，生重",
    category: "produce",
    unitName: "段",
    gramsPerUnit: 20,
    unitOptions: [
      option("half", "1/2段", 1 / 2),
      option("1", "1段", 1),
      option("2", "2段", 2),
    ],
    kcalPerGram: 0.2,
    sourceBasis: "20 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/168414/nutrients",
    archived: false,
  },
  {
    id: "cucumber-raw",
    name: "黄瓜",
    variant: "鲜，带皮生重",
    category: "produce",
    unitName: "段",
    gramsPerUnit: 20,
    unitOptions: [
      option("half", "1/2段", 1 / 2),
      option("1", "1段", 1),
      option("2", "2段", 2),
    ],
    kcalPerGram: 0.15,
    sourceBasis: "15 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/168409/nutrients",
    archived: false,
  },
  {
    id: "pumpkin-raw",
    name: "南瓜",
    variant: "鲜，生重",
    category: "produce",
    unitName: "块",
    gramsPerUnit: 30,
    unitOptions: [
      option("half", "1/2块", 1 / 2),
      option("1", "1块", 1),
      option("2", "2块", 2),
    ],
    kcalPerGram: 0.26,
    sourceBasis: "26 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/168448/nutrients",
    archived: false,
  },
  {
    id: "tofu-soft",
    name: "嫩豆腐",
    variant: "软豆腐",
    category: "other",
    unitName: "块",
    gramsPerUnit: 30,
    unitOptions: [
      option("half", "1/2块", 1 / 2),
      option("1", "1块", 1),
      option("2", "2块", 2),
    ],
    kcalPerGram: 0.61,
    sourceBasis: "61 kcal / 100g",
    sourceUrl: "https://fdc.nal.usda.gov/fdc-app.html#/food-details/172449/nutrients",
    archived: false,
  },
];

export function createDefaultMeals() {
  return [
    {
      id: "meal-breakfast",
      name: "早餐",
      time: "05:00",
      type: "main",
      expanded: false,
      items: [],
    },
    {
      id: "meal-snack-am",
      name: "上午加餐",
      time: "09:00",
      type: "snack",
      expanded: false,
      items: [],
    },
    {
      id: "meal-lunch",
      name: "午餐",
      time: "12:00",
      type: "main",
      expanded: false,
      items: [],
    },
    {
      id: "meal-snack-pm",
      name: "下午加餐",
      time: "15:00",
      type: "snack",
      expanded: false,
      items: [],
    },
    {
      id: "meal-dinner",
      name: "晚餐",
      time: "17:30",
      type: "main",
      expanded: false,
      items: [],
    },
    {
      id: "meal-snack-evening",
      name: "晚间加餐",
      time: "19:00",
      type: "snack",
      expanded: false,
      items: [],
    },
  ];
}

export function getFoodUnitOption(food, optionId) {
  return food?.unitOptions?.find((candidate) => candidate.id === optionId) ?? null;
}

export function getItemGrams(item, foods) {
  const food = foods.find((candidate) => candidate.id === item.foodId);
  const unitOption = getFoodUnitOption(food, item.unitOptionId);
  if (food && unitOption) {
    return Number(food.gramsPerUnit || 0) * Number(unitOption.multiplier || 0);
  }
  return Math.max(Number(item.grams) || 0, 0);
}

export function getItemUnitLabel(item, food) {
  const unitOption = getFoodUnitOption(food, item.unitOptionId);
  if (unitOption) return unitOption.label;
  return `历史值 ${Number(item.grams || 0).toLocaleString("zh-CN", { maximumFractionDigits: 3 })}g`;
}

export function calculateItemKcal(item, foods) {
  const food = foods.find((candidate) => candidate.id === item.foodId);
  return food ? getItemGrams(item, foods) * Number(food.kcalPerGram || 0) : 0;
}

export function calculateMealKcal(meal, foods) {
  return meal.items.reduce((total, item) => total + calculateItemKcal(item, foods), 0);
}

export function calculateDayKcal(plan, foods) {
  return plan.meals.reduce((total, meal) => total + calculateMealKcal(meal, foods), 0);
}

export function formatKcal(value) {
  return String(Math.round(Number(value || 0)));
}
