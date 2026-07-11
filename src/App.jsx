import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TARGET_KCAL,
  FOOD_CATEGORIES,
  calculateDayKcal,
  calculateItemKcal,
  calculateMealKcal,
  createDefaultMeals,
  formatKcal,
  getFoodUnitOption,
  getItemGrams,
  getItemUnitLabel,
  seedFoods,
} from "./foodData.js";

const STORAGE_KEY = "food-energy-planner.v9";
const LEGACY_STORAGE_KEYS = ["food-energy-planner.v8", "food-energy-planner.v7", "food-energy-planner.v6", "food-energy-planner.v5", "food-energy-planner.v4", "food-energy-planner.v3", "food-energy-planner.v2"];
const SCHEMA_VERSION = 9;
const SINGLE_UNIT_FOOD_IDS = new Set(["zucchini", "egg-hard-boiled", "chinese-yam", "pork-floss"]);
const FOOD_CATEGORY_IDS = new Set(FOOD_CATEGORIES.map((category) => category.id));
const SEED_FOOD_BY_ID = Object.fromEntries(seedFoods.map((food) => [food.id, food]));
const RECORD_TYPES = [
  { id: "burp", label: "打嗝", icon: "air" },
  { id: "discomfort", label: "不舒服", icon: "sick" },
  { id: "other", label: "其他", icon: "notes" },
];
const MEDICATIONS = [
  {
    id: "tegoprazan",
    name: "替戈拉生片",
    strength: "50mg · 蓝色包装",
    instruction: "每天1次，饭前服用",
    tone: "blue",
    doses: ["今日已服"],
  },
  {
    id: "digestive-enzymes",
    name: "复方消化酶胶囊",
    strength: "黄色包装",
    instruction: "每天2次，饭后立即服用",
    tone: "yellow",
    doses: ["第1次", "第2次"],
  },
  {
    id: "itopride",
    name: "盐酸伊托必利片",
    strength: "50mg · 绿色包装",
    instruction: "每天3次，饭前15～30分钟服用",
    tone: "green",
    doses: ["第1次", "第2次", "第3次"],
  },
];
const FOOD_VOICE_ALIASES = {
  "abbott-ensure-powder": ["奶粉", "全安素", "雅培全安素", "雅培奶粉"],
  "walnut-oil": ["核桃油"],
  "egg-hard-boiled": ["鸡蛋", "水煮蛋", "煮鸡蛋"],
  "rice-steamed": ["白米饭", "米饭"],
  "chicken-breast-cooked": ["鸡胸肉", "鸡胸"],
  "pork-floss": ["猪肉松", "肉松"],
  "sablefish-cooked": ["银鳕鱼", "鳕鱼"],
  "chinese-yam": ["山药", "淮山"],
  banana: ["香蕉"],
  "jujube-dried": ["红枣", "干枣"],
  zucchini: ["西葫芦", "角瓜"],
};

function createDefaultMedicationChecks() {
  return Object.fromEntries(
    MEDICATIONS.map((medication) => [medication.id, medication.doses.map(() => false)]),
  );
}

function createId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
}

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPlannerDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1900 || year > 2100) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && toLocalDateKey(parsed) === value;
}

function parseChineseInteger(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tensText, onesText] = value.split("十");
    const tens = tensText ? digits[tensText] : 1;
    const ones = onesText ? digits[onesText] : 0;
    return Number.isFinite(tens) && Number.isFinite(ones) ? tens * 10 + ones : Number.NaN;
  }
  return value.length === 1 ? digits[value] : Number.NaN;
}

function parseVoiceTime(transcript) {
  const colonMatch = transcript.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})[:：](\d{1,2})/);
  const spokenMatch = transcript.match(
    /(凌晨|早上|上午|中午|下午|晚上)?\s*([零〇一二两三四五六七八九十\d]{1,3})\s*[点时](?:\s*(半|一刻|三刻)|\s*([零〇一二两三四五六七八九十\d]{1,3})\s*分?)?/,
  );
  const match = colonMatch ?? spokenMatch;
  if (!match) return null;

  const period = match[1] ?? "";
  let hour = parseChineseInteger(match[2]);
  let minute = 0;
  if (colonMatch) minute = Number(match[3]);
  else if (match[3] === "半") minute = 30;
  else if (match[3] === "一刻") minute = 15;
  else if (match[3] === "三刻") minute = 45;
  else if (match[4]) minute = parseChineseInteger(match[4]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 24 || minute > 59) return null;
  if (period === "凌晨" && hour === 12) hour = 0;
  if ((period === "下午" || period === "晚上") && hour < 12) hour += 12;
  if (period === "中午" && hour < 11) hour += 12;
  if (hour === 24) hour = 0;

  if (minute < 15) minute = 0;
  else if (minute < 45) minute = 30;
  else {
    minute = 0;
    hour = (hour + 1) % 24;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeVoiceQuantity(value) {
  return value
    .replace(/\s+/g, "")
    .replace(/四分之一/g, "1/4")
    .replace(/三分之一/g, "1/3")
    .replace(/二分之一|一半|半/g, "1/2")
    .replace(/十五/g, "15")
    .replace(/十/g, "10")
    .replace(/[五伍]/g, "5")
    .replace(/[三叁]/g, "3")
    .replace(/[二两贰]/g, "2")
    .replace(/[一壹]/g, "1");
}

function findVoiceOption(food, transcript, alias) {
  const normalizedTranscript = normalizeVoiceQuantity(transcript);
  const normalizedAlias = normalizeVoiceQuantity(alias);
  const aliasIndex = normalizedTranscript.indexOf(normalizedAlias);
  const context = aliasIndex >= 0
    ? normalizedTranscript.slice(Math.max(0, aliasIndex - 10), aliasIndex + normalizedAlias.length + 10)
    : normalizedTranscript;
  const explicitOption = [...food.unitOptions]
    .sort((first, second) => second.label.length - first.label.length)
    .find((unitOption) => context.includes(normalizeVoiceQuantity(unitOption.label)));
  if (explicitOption) return explicitOption;
  return food.unitOptions.find((unitOption) => Math.abs(Number(unitOption.multiplier) - 1) < 1e-8) ?? null;
}

export function parseVoiceCommand(transcript, foods) {
  const time = parseVoiceTime(transcript);
  if (!time) return { ok: false, message: "没有听到时间，请说“晚上7点吃半碗米饭”。" };

  const candidates = foods
    .filter((food) => !food.archived)
    .flatMap((food) => {
      const aliases = [food.name, food.pickerName, ...(FOOD_VOICE_ALIASES[food.id] ?? [])]
        .filter(Boolean)
        .filter((alias, index, all) => all.indexOf(alias) === index);
      return aliases.map((alias) => ({ food, alias }));
    })
    .sort((first, second) => second.alias.length - first.alias.length);

  const selections = [];
  const usedFoodIds = new Set();
  for (const candidate of candidates) {
    if (usedFoodIds.has(candidate.food.id) || !transcript.includes(candidate.alias)) continue;
    const unitOption = findVoiceOption(candidate.food, transcript, candidate.alias);
    if (!unitOption) {
      return {
        ok: false,
        message: `${candidate.food.pickerName || candidate.food.name}需要说清数量，可选：${candidate.food.unitOptions.map((option) => option.label).join("、")}。`,
      };
    }
    usedFoodIds.add(candidate.food.id);
    selections.push({
      foodId: candidate.food.id,
      unitOptionId: unitOption.id,
      label: `${candidate.food.pickerName || candidate.food.name}${unitOption.label}`,
    });
  }

  if (selections.length === 0) {
    return { ok: false, message: "没有识别到食品，请使用食品库里的名称。" };
  }
  return { ok: true, time, selections };
}

function formatSummaryQuantity(value) {
  const rounded = Math.round(Number(value) * 1000) / 1000;
  const integer = Math.floor(rounded + 1e-8);
  const fraction = rounded - integer;
  const fractions = [
    [1 / 4, "1/4"],
    [1 / 3, "1/3"],
    [1 / 2, "1/2"],
    [2 / 3, "2/3"],
    [3 / 4, "3/4"],
  ];
  const matched = fractions.find(([candidate]) => Math.abs(fraction - candidate) < 0.002);
  if (!matched) return rounded.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
  return integer > 0 ? `${integer}又${matched[1]}` : matched[1];
}

function buildDailyFoodSummary(plan, foods) {
  const categoryById = Object.fromEntries(FOOD_CATEGORIES.map((category) => [category.id, category.label]));
  const summaryByFood = {};
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      const food = foods.find((candidate) => candidate.id === item.foodId);
      if (!food) continue;
      const unitOption = getFoodUnitOption(food, item.unitOptionId);
      const entry = summaryByFood[food.id] ?? {
        food,
        kcal: 0,
        unitAmount: 0,
        legacyGrams: 0,
      };
      entry.kcal += calculateItemKcal(item, foods);
      if (unitOption) entry.unitAmount += Number(unitOption.multiplier || 0);
      else entry.legacyGrams += getItemGrams(item, foods);
      summaryByFood[food.id] = entry;
    }
  }
  return Object.values(summaryByFood)
    .map((entry) => {
      const amounts = [];
      if (entry.unitAmount > 0) amounts.push(`${formatSummaryQuantity(entry.unitAmount)}${entry.food.unitName}`);
      if (entry.legacyGrams > 0) amounts.push(`历史${formatSummaryQuantity(entry.legacyGrams)}g`);
      return {
        ...entry,
        name: entry.food.pickerName || entry.food.name,
        category: categoryById[entry.food.category] ?? "其他",
        amountLabel: amounts.join(" + "),
      };
    })
    .sort((first, second) => second.kcal - first.kcal || first.name.localeCompare(second.name, "zh-CN"));
}

function createPlan(targetKcal) {
  return {
    targetKcal,
    meals: createDefaultMeals(),
    records: [],
    medicationChecks: createDefaultMedicationChecks(),
    weightKg: null,
  };
}

function createInitialState() {
  const today = toLocalDateKey();
  return {
    version: SCHEMA_VERSION,
    foods: seedFoods,
    settings: { defaultTargetKcal: DEFAULT_TARGET_KCAL, dailyTemplate: null },
    plans: { [today]: createPlan(DEFAULT_TARGET_KCAL) },
  };
}

function defaultLegacyUnitOptions() {
  return [
    { id: "10", label: "10克", multiplier: 10 },
    { id: "50", label: "50克", multiplier: 50 },
    { id: "100", label: "100克", multiplier: 100 },
  ];
}

function normalizeFood(food) {
  const seed = SEED_FOOD_BY_ID[food.id];
  return {
    ...seed,
    ...food,
    pickerName: seed?.pickerName ?? food.pickerName,
    category: seed?.category ?? (FOOD_CATEGORY_IDS.has(food.category) ? food.category : "other"),
    unitName: food.unitName?.trim() || seed?.unitName || "克",
    gramsPerUnit:
      Number(food.gramsPerUnit) > 0
        ? Number(food.gramsPerUnit)
        : Number(seed?.gramsPerUnit) > 0
          ? Number(seed.gramsPerUnit)
          : 1,
    unitOptions:
      food.id === "rice-steamed" || SINGLE_UNIT_FOOD_IDS.has(food.id)
        ? seed.unitOptions
        : Array.isArray(food.unitOptions) && food.unitOptions.length > 0
        ? food.unitOptions
        : seed?.unitOptions ?? defaultLegacyUnitOptions(),
    kcalPerGram:
      food.id === "pork-floss" || food.id === "rice-steamed"
        ? seed.kcalPerGram
        : Number(food.kcalPerGram || 0),
    sourceBasis:
      food.id === "pork-floss" || food.id === "rice-steamed"
        ? seed.sourceBasis
        : food.sourceBasis,
  };
}

function ensureDefaultMeals(plan) {
  const defaultsById = Object.fromEntries(createDefaultMeals().map((meal) => [meal.id, meal]));
  const currentMeals = (Array.isArray(plan?.meals) ? plan.meals : []).map((meal) => {
    const defaultMeal = defaultsById[meal.id];
    return defaultMeal
      ? { ...meal, name: defaultMeal.name, time: defaultMeal.time, type: defaultMeal.type }
      : meal;
  });
  const currentTimes = new Set(currentMeals.map((meal) => meal.time));
  const missingMeals = createDefaultMeals()
    .filter((meal) => !currentTimes.has(meal.time))
    .map((meal) => ({ ...meal, id: createId("meal") }));
  return {
    ...plan,
    meals: [...currentMeals, ...missingMeals],
    records: Array.isArray(plan?.records) ? plan.records : [],
    medicationChecks: Object.fromEntries(
      MEDICATIONS.map((medication) => {
        const storedChecks = plan?.medicationChecks?.[medication.id];
        return [
          medication.id,
          medication.doses.map((_, index) => Boolean(storedChecks?.[index])),
        ];
      }),
    ),
    weightKg: Number(plan?.weightKg) > 0 ? Number(plan.weightKg) : null,
  };
}

function normalizeStoredState(stored, fallback) {
  const storedFoods = Array.isArray(stored.foods) ? stored.foods : [];
  const storedIds = new Set(storedFoods.map((food) => food.id));
  const missingSeeds = seedFoods.filter((food) => !storedIds.has(food.id));

  const isTargetMigration = Number(stored.version) < SCHEMA_VERSION;
  return {
    version: SCHEMA_VERSION,
    foods: [...storedFoods.map(normalizeFood), ...missingSeeds],
    settings: {
      defaultTargetKcal: isTargetMigration
        ? DEFAULT_TARGET_KCAL
        : Number(stored.settings?.defaultTargetKcal) || DEFAULT_TARGET_KCAL,
      dailyTemplate:
        Array.isArray(stored.settings?.dailyTemplate?.meals)
          ? {
              savedAt: stored.settings.dailyTemplate.savedAt ?? null,
              meals: stored.settings.dailyTemplate.meals.map((meal) => ({
                name: meal.name,
                time: meal.time,
                type: meal.type,
                items: Array.isArray(meal.items)
                  ? meal.items.map(({ foodId, unitOptionId, grams }) => ({ foodId, unitOptionId, grams }))
                  : [],
              })),
            }
          : null,
    },
    plans:
      stored.plans && typeof stored.plans === "object"
        ? Object.fromEntries(
            Object.entries(stored.plans).map(([dateKey, plan]) => [
              dateKey,
              ensureDefaultMeals({
                ...plan,
                targetKcal: isTargetMigration ? DEFAULT_TARGET_KCAL : plan.targetKcal,
              }),
            ]),
          )
        : fallback.plans,
  };
}

function loadState() {
  const fallback = createInitialState();

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.version === SCHEMA_VERSION) return normalizeStoredState(stored, fallback);

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacy = JSON.parse(localStorage.getItem(legacyKey));
      if (legacy?.version === 8 || legacy?.version === 7 || legacy?.version === 6 || legacy?.version === 5 || legacy?.version === 4 || legacy?.version === 3 || legacy?.version === 2) {
        return normalizeStoredState(legacy, fallback);
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function Icon({ name, filled = false, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded icon ${filled ? "is-filled" : ""} ${className}`}
    >
      {name}
    </span>
  );
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

function EnergyGauge({ consumed, target, onEditTarget, themeKey }) {
  const canvasRef = useRef(null);
  const safeTarget = Math.max(Number(target) || 0, 0);
  const ratio = safeTarget > 0 ? consumed / safeTarget : 0;
  const isOver = ratio > 1;
  const difference = safeTarget - consumed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const box = 330;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = box * dpr;
    canvas.height = box * dpr;
    canvas.style.width = `${box}px`;
    canvas.style.height = `${box}px`;

    const context = canvas.getContext("2d");
    const themeStyles = getComputedStyle(canvas.closest(".mobile-prototype") ?? canvas);
    const trackColor = themeStyles.getPropertyValue("--track").trim() || "#365446";
    const accentColor = themeStyles.getPropertyValue("--lime-500").trim() || "#c9e36a";
    const outlineColor = themeStyles.getPropertyValue("--gauge-outline").trim() || "rgba(201, 227, 106, 0.12)";
    const overColor = themeStyles.getPropertyValue("--coral").trim() || "#ff8b72";
    context.scale(dpr, dpr);
    context.clearRect(0, 0, box, box);

    const center = box / 2;
    const radius = 130;
    const start = (100 * Math.PI) / 180;
    const full = Math.PI * 2;
    const progress = Math.min(Math.max(ratio, 0), 1);
    const end = start + full * progress;

    context.beginPath();
    context.arc(center, center, 164, 0, full);
    context.strokeStyle = outlineColor;
    context.lineWidth = 1;
    context.stroke();

    context.beginPath();
    context.arc(center, center, radius, start, start + full);
    context.strokeStyle = trackColor;
    context.lineWidth = 10;
    context.lineCap = "round";
    context.stroke();

    if (progress > 0) {
      const gaugeColor = isOver ? overColor : accentColor;
      context.beginPath();
      context.arc(center, center, radius, start, end);
      context.strokeStyle = gaugeColor;
      context.lineWidth = 10;
      context.lineCap = "round";
      context.stroke();

      context.beginPath();
      context.arc(
        center + Math.cos(end) * radius,
        center + Math.sin(end) * radius,
        8,
        0,
        full,
      );
      context.fillStyle = gaugeColor;
      context.fill();
    }
  }, [isOver, ratio, themeKey]);

  return (
    <div className={`gauge ${isOver ? "is-over" : ""}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="gauge-copy">
        <Icon name="bolt" filled className="gauge-bolt" />
        <div className="gauge-total">
          <strong>{formatKcal(consumed)}</strong>
          <span>/</span>
          <button type="button" onClick={onEditTarget} aria-label="编辑每日目标">
            {formatKcal(safeTarget)} kcal
          </button>
        </div>
        <span className="gauge-rule" />
        <p>
          {difference >= 0 ? "还差" : "已超"}
          <strong>{formatKcal(Math.abs(difference))}</strong>
          kcal
        </p>
      </div>
    </div>
  );
}

function MealIcon({ type, name }) {
  const iconName = type === "snack" ? "local_cafe" : name.includes("早餐") ? "brunch_dining" : "soup_kitchen";
  return (
    <span className="meal-icon">
      <Icon name={iconName} />
    </span>
  );
}

function MealRow({ meal, foods, onToggle, onAdjustTime, onAddFood, onEditUnit, onRemoveItem }) {
  const mealKcal = calculateMealKcal(meal, foods);

  return (
    <article className={`meal-row ${meal.expanded ? "is-expanded" : ""}`} data-meal-id={meal.id}>
      <button className="meal-summary" type="button" onClick={onToggle}>
        <MealIcon type={meal.type} name={meal.name} />
        <time
          onClick={(event) => {
            event.stopPropagation();
            onAdjustTime();
          }}
          title="调整餐次时间"
        >
          {meal.time}
        </time>
        <span className="meal-name">{meal.name}</span>
        <strong>{formatKcal(mealKcal)} kcal</strong>
        <Icon name={meal.expanded ? "expand_less" : "chevron_right"} />
      </button>

      {meal.expanded && (
        <div className="meal-details">
          {meal.items.length === 0 ? (
            <p className="meal-empty">这餐还没有食品</p>
          ) : (
            meal.items.map((item) => {
              const food = foods.find((candidate) => candidate.id === item.foodId);
              if (!food) return null;
              return (
                <div className="meal-item" key={item.id}>
                  <span title={food.variant}>{food.name}</span>
                  <button
                    className={`meal-unit-button ${item.unitOptionId ? "" : "is-legacy"}`}
                    type="button"
                    onClick={() => onEditUnit(item.id)}
                    aria-label={`调整${food.name}单位`}
                  >
                    {getItemUnitLabel(item, food)}
                    <Icon name="expand_more" />
                  </button>
                  <strong>{formatKcal(calculateItemKcal(item, foods))} kcal</strong>
                  <button
                    className="icon-button item-remove"
                    type="button"
                    aria-label={`删除${food.name}`}
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              );
            })
          )}
          <button className="meal-add-food-link" type="button" onClick={onAddFood}>
            <Icon name="add_circle" />
            添加食品
          </button>
        </div>
      )}
    </article>
  );
}

function DailySummaryDialog({ plan, foods, onClose }) {
  const summary = buildDailyFoodSummary(plan, foods);
  const totalKcal = summary.reduce((total, item) => total + item.kcal, 0);

  return (
    <Dialog title="每日饮食汇总" onClose={onClose} className="summary-dialog">
      <div className="summary-total">
        <span>全天总能量</span>
        <strong>{formatKcal(totalKcal)} kcal</strong>
      </div>
      {summary.length === 0 ? (
        <div className="summary-empty">
          <Icon name="receipt_long" />
          <p>今天还没有添加食品</p>
        </div>
      ) : (
        <div className="summary-list">
          {summary.map((item, index) => (
            <article key={item.food.id}>
              <span className="summary-rank">{index + 1}</span>
              <div>
                <strong>{item.name}</strong>
                <p><span>{item.category}</span>{item.amountLabel}</p>
              </div>
              <output>{formatKcal(item.kcal)} kcal</output>
            </article>
          ))}
        </div>
      )}
    </Dialog>
  );
}

function TodayScreen({
  dateKey,
  plan,
  foods,
  onChangeDate,
  onEditTarget,
  onToggleMeal,
  onAdjustMealTime,
  onEditUnit,
  onRemoveItem,
  onAddFood,
  onAddMeal,
  onOpenSummary,
  onVoiceCommand,
  hasDailyTemplate,
  onImportTemplate,
}) {
  const dateInputRef = useRef(null);
  const mealScrollRef = useRef(null);
  const pendingScrollMealIdRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const consumed = calculateDayKcal(plan, foods);
  const sortedMeals = [...plan.meals].sort((first, second) => first.time.localeCompare(second.time));
  const activeMeal = sortedMeals.find((meal) => meal.expanded) ?? sortedMeals.at(-1);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  }

  function toggleAndRevealMeal(meal) {
    if (!meal.expanded) pendingScrollMealIdRef.current = meal.id;
    onToggleMeal(meal.id);
  }

  function startVoice() {
    const SpeechRecognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("当前浏览器不支持语音识别，请使用最新版Chrome。 ");
      return;
    }
    recognitionRef.current?.abort?.();
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setVoiceMessage("正在听，请说“晚上7点吃半碗米饭”");
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      setVoiceMessage(onVoiceCommand(transcript));
    };
    recognition.onerror = (event) => {
      const messages = {
        "not-allowed": "没有麦克风权限，请在浏览器设置中允许。",
        "no-speech": "没有听清，请按住按钮后再说一次。",
        network: "语音识别网络不可用，请稍后重试。",
      };
      setVoiceMessage(messages[event.error] ?? "语音识别失败，请再试一次。");
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setVoiceMessage("语音识别尚未准备好，请稍后再试。");
    }
  }

  function stopVoice() {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // The pointer may be released before recognition has fully started.
    }
  }

  useEffect(() => {
    const mealId = pendingScrollMealIdRef.current;
    const container = mealScrollRef.current;
    if (!mealId || !container) return;
    const expandedMeal = plan.meals.find((meal) => meal.id === mealId && meal.expanded);
    if (!expandedMeal) return;
    const frame = requestAnimationFrame(() => {
      const row = [...container.querySelectorAll(".meal-row")].find(
        (candidate) => candidate.dataset.mealId === mealId,
      );
      const target = row?.querySelector(".meal-add-food-link") ?? row;
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const overflow = targetRect.bottom - containerRect.bottom + 12;
        if (overflow > 0) container.scrollBy({ top: overflow, behavior: "smooth" });
      }
      pendingScrollMealIdRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [plan.meals]);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  return (
    <section className="today-screen" aria-label="今日能量计划">
      <header className="energy-hero">
        <button className="date-trigger" type="button" onClick={openDatePicker}>
          {formatDateLabel(dateKey)}
          <Icon name="calendar_month" />
        </button>
        <input
          ref={dateInputRef}
          className="native-date-input"
          min="1900-01-01"
          max="2100-12-31"
          type="date"
          value={dateKey}
          onChange={(event) => {
            if (isPlannerDate(event.target.value)) {
              onChangeDate(event.target.value);
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="选择计划日期"
        />
        <button className="brand-leaf summary-trigger" type="button" onClick={onOpenSummary} aria-label="查看每日饮食汇总">
          <Icon name="receipt_long" />
        </button>
        <button
          className="hero-template-import"
          type="button"
          disabled={!hasDailyTemplate}
          onClick={onImportTemplate}
          aria-label="导入每日模板"
        >
          <Icon name="download" />
          导入
        </button>
        <h1>今日能量</h1>
        <EnergyGauge consumed={consumed} target={plan.targetKcal} onEditTarget={onEditTarget} themeKey={dateKey} />
        <Icon name="eco" className="hero-leaf" />
      </header>

      <div className="meal-sheet">
        <span className="sheet-handle" aria-hidden="true" />
        <button className="meal-add-button" type="button" onClick={onAddMeal} aria-label="添加餐次">
          <Icon name="add_circle" />
        </button>
        <div className="meal-scroll" ref={mealScrollRef}>
          {sortedMeals.length === 0 ? (
            <div className="empty-state">
              <Icon name="restaurant" />
              <h2>今天还没有餐次</h2>
              <p>先添加一餐，再安排食品和克数。</p>
            </div>
          ) : (
            sortedMeals.map((meal) => (
              <MealRow
                key={meal.id}
                meal={meal}
                foods={foods}
                onToggle={() => toggleAndRevealMeal(meal)}
                onAdjustTime={() => onAdjustMealTime(meal.id)}
                onAddFood={() => onAddFood(meal.id)}
                onEditUnit={(itemId) => onEditUnit(meal.id, itemId)}
                onRemoveItem={(itemId) => onRemoveItem(meal.id, itemId)}
              />
            ))
          )}
        </div>

        <div className="sheet-actions is-with-voice">
          {voiceMessage && <p className={`voice-message ${isListening ? "is-listening" : ""}`} aria-live="polite">{voiceMessage}</p>}
          <button
            className="primary-button"
            type="button"
            disabled={!activeMeal}
            onClick={() => activeMeal && onAddFood(activeMeal.id)}
          >
            <Icon name="add_circle" />
            添加食品
          </button>
          <button
            className={`voice-button ${isListening ? "is-listening" : ""}`}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              startVoice();
            }}
            onPointerUp={stopVoice}
            onPointerCancel={stopVoice}
            onContextMenu={(event) => event.preventDefault()}
          >
            <Icon name={isListening ? "graphic_eq" : "mic"} />
          </button>
        </div>
      </div>
    </section>
  );
}

function FoodLibraryScreen({ foods, onAddFood, onEditFood, onToggleArchive }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const filteredFoods = foods.filter((food) =>
    `${food.name} ${food.variant}`.toLocaleLowerCase("zh-CN").includes(normalized),
  );

  return (
    <section className="utility-screen" aria-label="食品单位表">
      <header className="utility-header">
        <p>每 1 克对应能量</p>
        <h1>食品单位表</h1>
        <button type="button" className="header-action" onClick={onAddFood}>
          <Icon name="add_circle" />
          新增
        </button>
      </header>
      <div className="utility-sheet">
        <label className="search-box">
          <Icon name="search" />
          <span className="sr-only">搜索食品</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索食品或规格"
          />
        </label>

        <div className="food-table-head" aria-hidden="true">
          <span>食品</span>
          <span>kcal / 1g</span>
          <span>操作</span>
        </div>
        <div className="food-list">
          {filteredFoods.map((food) => (
            <article className={`food-row ${food.archived ? "is-archived" : ""}`} key={food.id}>
              <div>
                <strong>{food.name}</strong>
                <span>{food.variant || "未注明规格"}</span>
                {food.sourceUrl && (
                  <a href={food.sourceUrl} target="_blank" rel="noreferrer">
                    {food.sourceBasis || "查看来源"}
                  </a>
                )}
              </div>
              <output>{Number(food.kcalPerGram).toFixed(3)}</output>
              <span className="food-row-actions">
                <button type="button" aria-label={`编辑${food.name}`} onClick={() => onEditFood(food.id)}>
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  aria-label={`${food.archived ? "恢复" : "停用"}${food.name}`}
                  onClick={() => onToggleArchive(food.id)}
                >
                  <Icon name={food.archived ? "unarchive" : "archive"} />
                </button>
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SettingsScreen({
  dateKey,
  plan,
  defaultTarget,
  onUpdatePlanTarget,
  onUpdateDefaultTarget,
  onConfirm,
  dailyTemplate,
  onSaveTemplate,
  onImportTemplate,
}) {
  const [currentDraft, setCurrentDraft] = useState(String(plan.targetKcal));
  const [defaultDraft, setDefaultDraft] = useState(String(defaultTarget));

  useEffect(() => {
    setCurrentDraft(String(plan.targetKcal));
  }, [dateKey, plan.targetKcal]);

  useEffect(() => {
    setDefaultDraft(String(defaultTarget));
  }, [defaultTarget]);

  const currentValue = Number(currentDraft);
  const defaultValue = Number(defaultDraft);
  const canSave =
    Number.isFinite(currentValue) && currentValue > 0 &&
    Number.isFinite(defaultValue) && defaultValue > 0;

  function saveTargets() {
    if (!canSave) return;
    onUpdatePlanTarget(currentValue);
    onUpdateDefaultTarget(defaultValue);
    onConfirm();
  }

  return (
    <section className="utility-screen" aria-label="能量目标设置">
      <header className="utility-header">
        <p>目标会用于计算还差或已超</p>
        <h1>目标设置</h1>
      </header>
      <div className="utility-sheet settings-sheet">
        <section className="setting-group">
          <span className="setting-icon"><Icon name="flag" /></span>
          <div>
            <label htmlFor="current-target">{formatDateLabel(dateKey)}的目标</label>
            <p>只影响当前选择的这一天。</p>
          </div>
          <label className="target-input">
            <input
              id="current-target"
              min="1"
              step="10"
              type="number"
              value={currentDraft}
              onChange={(event) => setCurrentDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTargets();
              }}
            />
            <span>kcal</span>
          </label>
        </section>

        <section className="setting-group">
          <span className="setting-icon"><Icon name="calendar_month" /></span>
          <div>
            <label htmlFor="default-target">新日期默认目标</label>
            <p>以后首次打开新日期时自动使用。</p>
          </div>
          <label className="target-input">
            <input
              id="default-target"
              min="1"
              step="10"
              type="number"
              value={defaultDraft}
              onChange={(event) => setDefaultDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTargets();
              }}
            />
            <span>kcal</span>
          </label>
        </section>

        <button className="primary-button settings-confirm" type="button" onClick={saveTargets} disabled={!canSave}>
          确定
        </button>

        <section className="template-setting">
          <div className="template-setting-heading">
            <span className="setting-icon"><Icon name="bookmark" /></span>
            <div>
              <h2>每日饮食模板</h2>
              <p>{dailyTemplate?.savedAt ? `已保存：${dailyTemplate.savedAt.slice(0, 10)}` : "把当前6顿餐食保存下来，每天可以重复导入。"}</p>
            </div>
          </div>
          <div className="template-actions">
            <button type="button" className="secondary-button" onClick={onSaveTemplate}>
              <Icon name="bookmark_add" />
              保存当前模板
            </button>
            <button type="button" className="primary-button" onClick={onImportTemplate} disabled={!dailyTemplate}>
              <Icon name="download" />
              导入到当天
            </button>
          </div>
          <p className="template-warning">导入会覆盖当天6顿餐食，不影响用药、体重和身体记录。</p>
        </section>

        <div className="settings-note">
          <Icon name="info" />
          <p>单位表保存的是 kcal/1g。克数变化后，单项、餐次和全天能量会立即重新计算。</p>
        </div>
      </div>
    </section>
  );
}

function HealthScreen({
  dateKey,
  records,
  medicationChecks,
  weightKg,
  onToggleMedication,
  onSaveWeight,
  onAddRecord,
  onDeleteRecord,
}) {
  const [weightDraft, setWeightDraft] = useState(weightKg ? String(weightKg) : "");
  const sortedRecords = [...records].sort((first, second) => second.time.localeCompare(first.time));
  const totalDoses = MEDICATIONS.reduce((total, medication) => total + medication.doses.length, 0);
  const completedDoses = MEDICATIONS.reduce(
    (total, medication) =>
      total + (medicationChecks?.[medication.id] ?? []).filter(Boolean).length,
    0,
  );

  useEffect(() => {
    setWeightDraft(weightKg ? String(weightKg) : "");
  }, [dateKey, weightKg]);

  const weightValue = Number(weightDraft);
  const canSaveWeight = Number.isFinite(weightValue) && weightValue > 0 && weightValue < 500;

  return (
    <section className="utility-screen" aria-label="吃药记录">
      <header className="utility-header">
        <p>{formatDateLabel(dateKey)}</p>
        <h1>吃药记录</h1>
        <button type="button" className="header-action" onClick={onAddRecord}>
          <Icon name="add_circle" />
          情况
        </button>
      </header>
      <div className="utility-sheet health-sheet">
        <section className="health-section medication-section">
          <header>
            <div>
              <h2>今日用药</h2>
              <p>按医生给出的用法打卡</p>
            </div>
            <strong>{completedDoses}/{totalDoses}</strong>
          </header>
          <div className="medication-list">
            {MEDICATIONS.map((medication) => (
              <article className={`medication-card tone-${medication.tone}`} key={medication.id}>
                <span className="medicine-color" aria-hidden="true" />
                <div className="medicine-copy">
                  <strong>{medication.name}</strong>
                  <small>{medication.strength}</small>
                  <p>{medication.instruction}</p>
                </div>
                <div className="dose-checks">
                  {medication.doses.map((dose, index) => (
                    <label key={dose}>
                      <input
                        type="checkbox"
                        checked={Boolean(medicationChecks?.[medication.id]?.[index])}
                        onChange={() => onToggleMedication(medication.id, index)}
                      />
                      <span><Icon name="check" /></span>
                      {dose}
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="health-section weight-section">
          <header>
            <div>
              <h2>今日体重</h2>
              <p>每天保存一次，可随时修改</p>
            </div>
            <Icon name="monitor_weight" />
          </header>
          <div className="weight-entry">
            <label>
              <input
                min="1"
                max="499.9"
                step="0.1"
                type="number"
                value={weightDraft}
                onChange={(event) => setWeightDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                placeholder="0.0"
              />
              <span>kg</span>
            </label>
            <button type="button" onClick={() => canSaveWeight && onSaveWeight(weightValue)} disabled={!canSaveWeight}>
              {weightKg ? "更新" : "保存"}
            </button>
          </div>
        </section>

        <section className="health-section situation-section">
          <header>
            <div>
              <h2>身体情况</h2>
              <p>打嗝、不舒服或其他情况</p>
            </div>
            <button type="button" onClick={onAddRecord}><Icon name="add_circle" />记录</button>
          </header>
          {sortedRecords.length === 0 ? (
            <p className="health-empty-note">今天还没有身体情况记录</p>
          ) : (
          <div className="record-list">
            {sortedRecords.map((record) => {
              const recordType = RECORD_TYPES.find((type) => type.id === record.type) ?? RECORD_TYPES[2];
              return (
                <article className="record-row" key={record.id}>
                  <span className="record-icon"><Icon name={recordType.icon} /></span>
                  <div>
                    <strong>{recordType.label}</strong>
                    <time>{record.time}</time>
                    <p>{record.note || "未填写备注"}</p>
                  </div>
                  <button type="button" aria-label={`删除${recordType.label}记录`} onClick={() => onDeleteRecord(record.id)}>
                    <Icon name="delete" />
                  </button>
                </article>
              );
            })}
          </div>
          )}
        </section>
      </div>
    </section>
  );
}

function BottomNavigation({ activeTab, onChange }) {
  const items = [
    { id: "today", label: "今日", icon: "eco" },
    { id: "foods", label: "食品库", icon: "soup_kitchen" },
    { id: "records", label: "吃药", icon: "health_metrics" },
    { id: "settings", label: "设置", icon: "settings" },
  ];

  return (
    <nav className="bottom-navigation" aria-label="主要页面">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={activeTab === item.id ? "is-active" : ""}
          onClick={() => onChange(item.id)}
        >
          <Icon name={item.icon} filled={activeTab === item.id} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Dialog({ title, children, onClose, className = "" }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`dialog-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function getMealMetaByTime(time) {
  if (time < "08:00") return { name: "早餐", type: "main" };
  if (time < "10:30") return { name: "上午加餐", type: "snack" };
  if (time < "14:00") return { name: "午餐", type: "main" };
  if (time < "16:30") return { name: "下午加餐", type: "snack" };
  if (time < "18:30") return { name: "晚餐", type: "main" };
  return { name: "晚间加餐", type: "snack" };
}

const HALF_HOUR_TIMES = Array.from({ length: 33 }, (_, index) => {
  const totalMinutes = 4 * 60 + index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = totalMinutes % 60 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function MealDialog({ initialMeal, onSave, onClose }) {
  const [time, setTime] = useState(initialMeal?.time ?? "12:00");
  const mealMeta = getMealMetaByTime(time);
  const morningTimes = HALF_HOUR_TIMES.filter((timeOption) => timeOption < "12:00");
  const afternoonTimes = HALF_HOUR_TIMES.filter((timeOption) => timeOption >= "12:00");

  return (
    <Dialog title={initialMeal ? "调整餐次时间" : "添加餐次"} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...mealMeta, time });
        }}
      >
        <div className="meal-time-groups" aria-label="选择时间">
          <fieldset>
            <legend>上午</legend>
            <div>
              {morningTimes.map((timeOption) => (
                <button
                  className={time === timeOption ? "is-selected" : ""}
                  key={timeOption}
                  type="button"
                  onClick={() => setTime(timeOption)}
                >
                  {timeOption}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>下午</legend>
            <div>
              {afternoonTimes.map((timeOption) => (
                <button
                  className={time === timeOption ? "is-selected" : ""}
                  key={timeOption}
                  type="button"
                  onClick={() => setTime(timeOption)}
                >
                  {timeOption}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="meal-auto-name">将自动归类为：<strong>{mealMeta.name}</strong></p>
        <button className="primary-button" type="submit">确定</button>
      </form>
    </Dialog>
  );
}

function getCurrentHalfHourTime() {
  const now = new Date();
  const roundedMinutes = now.getHours() * 60 + (now.getMinutes() < 30 ? 0 : 30);
  const totalMinutes = Math.min(Math.max(roundedMinutes, 4 * 60), 20 * 60);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = totalMinutes % 60 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
}

function RecordDialog({ onSave, onClose }) {
  const [type, setType] = useState("burp");
  const [time, setTime] = useState(getCurrentHalfHourTime);
  const [note, setNote] = useState("");

  return (
    <Dialog title="新增记录" onClose={onClose}>
      <form
        className="dialog-form record-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ type, time, note: note.trim() });
        }}
      >
        <fieldset className="record-type-picker">
          <legend>情况</legend>
          {RECORD_TYPES.map((recordType) => (
            <label className={type === recordType.id ? "is-selected" : ""} key={recordType.id}>
              <input
                type="radio"
                name="record-type"
                value={recordType.id}
                checked={type === recordType.id}
                onChange={() => setType(recordType.id)}
              />
              <Icon name={recordType.icon} />
              {recordType.label}
            </label>
          ))}
        </fieldset>
        <label>
          <span>发生时间</span>
          <select value={time} onChange={(event) => setTime(event.target.value)}>
            {HALF_HOUR_TIMES.map((timeOption) => (
              <option key={timeOption} value={timeOption}>{timeOption}</option>
            ))}
          </select>
        </label>
        <label>
          <span>备注（选填）</span>
          <textarea
            rows="3"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：吃完午餐后打嗝，持续约10分钟"
          />
        </label>
        <button className="primary-button" type="submit">保存记录</button>
      </form>
    </Dialog>
  );
}

function unitOptionsToText(food) {
  if (!food?.unitOptions?.length) return "1，2，3";
  return food.unitOptions
    .map((unitOption) =>
      unitOption.label.endsWith(food.unitName)
        ? unitOption.label.slice(0, -food.unitName.length)
        : String(unitOption.multiplier),
    )
    .join("，");
}

function parseUnitMultiplier(value) {
  const normalized = value.trim().replace("／", "/");
  const fraction = normalized.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : Number.NaN;
  }
  return Number(normalized);
}

function buildUnitOptions(text, unitName, existingOptions = []) {
  const seen = new Set();
  return text
    .split(/[,，、]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token, index) => {
      const multiplier = parseUnitMultiplier(token);
      if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
      const key = multiplier.toFixed(8);
      if (seen.has(key)) return null;
      seen.add(key);
      const existing = existingOptions.find(
        (unitOption) => Math.abs(Number(unitOption.multiplier) - multiplier) < 1e-8,
      );
      return {
        id: existing?.id ?? `unit-${index}-${key.replace(".", "-")}`,
        label: `${token}${unitName.trim()}`,
        multiplier,
      };
    })
    .filter(Boolean);
}

function FoodFields({ draft, onChange }) {
  return (
    <>
      <label>
        <span>食品名称</span>
        <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="例如：燕麦" />
      </label>
      <label>
        <span>规格或状态</span>
        <input value={draft.variant} onChange={(event) => onChange({ ...draft, variant: event.target.value })} placeholder="例如：煮熟重、某品牌" />
      </label>
      <label>
        <span>分类</span>
        <select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>
          {FOOD_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>
      <div className="food-unit-fields">
        <label>
          <span>单位名称</span>
          <input value={draft.unitName} onChange={(event) => onChange({ ...draft, unitName: event.target.value })} placeholder="例如：勺、个、块" />
        </label>
        <label>
          <span>每单位克数</span>
          <span className="unit-input">
            <input min="0.001" step="0.001" type="number" value={draft.gramsPerUnit} onChange={(event) => onChange({ ...draft, gramsPerUnit: event.target.value })} onFocus={(event) => event.currentTarget.select()} />
            <small>g</small>
          </span>
        </label>
      </div>
      <label>
        <span>可选份量</span>
        <input value={draft.unitOptionsText} onChange={(event) => onChange({ ...draft, unitOptionsText: event.target.value })} placeholder="例如：1，2，3 或 1/4，1/2，1" />
      </label>
      <label>
        <span>每 1 克能量</span>
        <span className="unit-input">
          <input min="0" step="0.001" type="number" value={draft.kcalPerGram} onChange={(event) => onChange({ ...draft, kcalPerGram: event.target.value })} onFocus={(event) => event.currentTarget.select()} />
          <small>kcal/g</small>
        </span>
      </label>
      <label>
        <span>数据说明（选填）</span>
        <input value={draft.sourceBasis} onChange={(event) => onChange({ ...draft, sourceBasis: event.target.value })} placeholder="例如：389 kcal / 100g" />
      </label>
      <label>
        <span>来源网址（选填）</span>
        <input type="url" value={draft.sourceUrl} onChange={(event) => onChange({ ...draft, sourceUrl: event.target.value })} placeholder="https://" />
      </label>
    </>
  );
}

function FoodEditorDialog({ food, onSave, onClose }) {
  const [draft, setDraft] = useState({
    name: food?.name ?? "",
    variant: food?.variant ?? "",
    category: food?.category ?? "other",
    unitName: food?.unitName ?? "份",
    gramsPerUnit: food?.gramsPerUnit ?? "",
    unitOptionsText: unitOptionsToText(food),
    kcalPerGram: food?.kcalPerGram ?? "",
    sourceBasis: food?.sourceBasis ?? "",
    sourceUrl: food?.sourceUrl ?? "",
  });
  const unitOptions = buildUnitOptions(draft.unitOptionsText, draft.unitName, food?.unitOptions);
  const canSave =
    draft.name.trim() &&
    FOOD_CATEGORY_IDS.has(draft.category) &&
    draft.unitName.trim() &&
    Number(draft.gramsPerUnit) > 0 &&
    unitOptions.length > 0 &&
    draft.kcalPerGram !== "" &&
    Number(draft.kcalPerGram) >= 0;

  return (
    <Dialog title={food ? "编辑食品" : "新增食品"} onClose={onClose} className="dialog-tall">
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave({ ...draft, unitOptions });
        }}
      >
        <FoodFields draft={draft} onChange={setDraft} />
        <button className="primary-button" type="submit" disabled={!canSave}>保存到单位表</button>
      </form>
    </Dialog>
  );
}

function AddFoodDialog({
  foods,
  meal,
  initialFoodId,
  keepOpen = false,
  onSelectUnit,
  onUpdateItemUnit,
  onRemoveItem,
  onConfirm,
  onManageFoods,
  onClose,
}) {
  const [selectedFoodId, setSelectedFoodId] = useState(initialFoodId ?? null);
  const [addedCount, setAddedCount] = useState(0);
  const [editingItemId, setEditingItemId] = useState(null);
  const availableFoods = foods.filter((food) => !food.archived);
  const selectedFood = (initialFoodId ? foods : availableFoods).find(
    (food) => food.id === selectedFoodId,
  );
  const previewItems = (meal?.items ?? []).flatMap((item) => {
      const food = foods.find((candidate) => candidate.id === item.foodId);
      return food ? [{ item, food, label: `${food.pickerName || food.name} · ${getItemUnitLabel(item, food)}` }] : [];
    });

  function selectFood(food) {
    if (food.unitOptions.length === 1) {
      onSelectUnit(food.id, food.unitOptions[0].id);
      if (keepOpen) setAddedCount((count) => count + 1);
      return;
    }
    setSelectedFoodId(food.id);
  }

  return (
    <Dialog title={selectedFood ? "选择单位" : "添加食品"} onClose={onClose} className="food-picker-dialog">
      {!selectedFood ? (
        <>
          {previewItems.length > 0 && (
            <section className="meal-food-preview" aria-label="本餐已添加食品">
              <p>
                <span>本餐已添加</span>
                <small>{meal?.time} {meal?.name}</small>
              </p>
              <div>
                {previewItems.map((item) => (
                  <span key={item.item.id} className="meal-food-preview-item">
                    <strong>{item.label}</strong>
                    <button
                      type="button"
                      aria-label={`调整${item.food.name}单位`}
                      onClick={() => {
                        setEditingItemId(item.item.id);
                        setSelectedFoodId(item.item.foodId);
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除${item.food.name}`}
                      onClick={() => onRemoveItem(item.item.id)}
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}
          <div className="food-category-list">
            {FOOD_CATEGORIES.map((category) => {
              const categoryFoods = availableFoods.filter((food) => food.category === category.id);
              if (categoryFoods.length === 0) return null;
              return (
                <section className="food-picker-category" key={category.id}>
                  <h3>{category.label}</h3>
                  <div>
                    {categoryFoods.map((food) => (
                      <button key={food.id} type="button" onClick={() => selectFood(food)}>
                        {food.pickerName || food.name}
                        <Icon name="add_circle" />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <button className="inline-create" type="button" onClick={onManageFoods}>
            没有需要的食品？去食品库新增
          </button>
          {keepOpen && addedCount > 0 && (
            <div className="food-confirm-bar">
              <button className="primary-button" type="button" onClick={onConfirm}>
                <Icon name="check_circle" />
                确认完成（已添加{addedCount}项）
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="unit-picker-step">
          {!initialFoodId && (
            <button className="picker-back" type="button" onClick={() => setSelectedFoodId(null)}>
              <Icon name="arrow_back" />
              返回食品
            </button>
          )}
          <p>{selectedFood.pickerName || selectedFood.name}</p>
          <div className="unit-option-grid">
            {selectedFood.unitOptions.map((unitOption) => (
              <button
                key={unitOption.id}
                type="button"
                onClick={() => {
                  if (editingItemId) {
                    onUpdateItemUnit(editingItemId, unitOption.id);
                    setEditingItemId(null);
                    setSelectedFoodId(null);
                  } else {
                    onSelectUnit(selectedFood.id, unitOption.id);
                  }
                  if (keepOpen && !editingItemId) {
                    setAddedCount((count) => count + 1);
                    setSelectedFoodId(null);
                  }
                }}
              >
                {unitOption.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function App() {
  const [state, setState] = useState(loadState);
  const [selectedDate, setSelectedDate] = useState(toLocalDateKey);
  const [activeTab, setActiveTab] = useState("today");
  const [dialog, setDialog] = useState(null);

  const selectedPlan = state.plans[selectedDate] ?? createPlan(state.settings.defaultTargetKcal);
  const foodById = useMemo(
    () => Object.fromEntries(state.foods.map((food) => [food.id, food])),
    [state.foods],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (state.plans[selectedDate]) return;
    setState((current) => ({
      ...current,
      plans: {
        ...current.plans,
        [selectedDate]: createPlan(current.settings.defaultTargetKcal),
      },
    }));
  }, [selectedDate, state.plans]);

  function updateSelectedPlan(updater) {
    setState((current) => {
      const currentPlan = current.plans[selectedDate] ?? createPlan(current.settings.defaultTargetKcal);
      const nextPlan = updater(currentPlan);
      return {
        ...current,
        plans: { ...current.plans, [selectedDate]: nextPlan },
      };
    });
  }

  function updateMeal(mealId, updater) {
    updateSelectedPlan((plan) => ({
      ...plan,
      meals: plan.meals.map((meal) => (meal.id === mealId ? updater(meal) : meal)),
    }));
  }

  function saveMeal(values) {
    if (dialog?.mealId) {
      updateMeal(dialog.mealId, (meal) => ({ ...meal, ...values }));
    } else {
      updateSelectedPlan((plan) => ({
        ...plan,
        meals: [
          ...plan.meals.map((meal) => ({ ...meal, expanded: false })),
          { id: createId("meal"), ...values, expanded: true, items: [] },
        ],
      }));
    }
    setDialog(null);
  }

  function saveDailyTemplate() {
    const templateMeals = [...selectedPlan.meals]
      .sort((first, second) => first.time.localeCompare(second.time))
      .slice(0, 6)
      .map(({ name, time, type, items }) => ({
        name,
        time,
        type,
        items: items.map(({ foodId, unitOptionId, grams }) => ({ foodId, unitOptionId, grams })),
      }));
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        dailyTemplate: { savedAt: new Date().toISOString(), meals: templateMeals },
      },
    }));
  }

  function importDailyTemplate() {
    const template = state.settings.dailyTemplate;
    if (!template?.meals?.length) return;
    updateSelectedPlan((plan) => ({
      ...plan,
      meals: template.meals.map((meal) => ({
        id: createId("meal"),
        name: meal.name,
        time: meal.time,
        type: meal.type,
        expanded: false,
        items: (meal.items ?? []).map(({ foodId, unitOptionId, grams }) => ({
          id: createId("item"),
          foodId,
          unitOptionId,
          grams,
        })),
      })),
    }));
  }

  function toggleMeal(mealId) {
    updateSelectedPlan((plan) => ({
      ...plan,
      meals: plan.meals.map((meal) => ({
        ...meal,
        expanded: meal.id === mealId ? !meal.expanded : false,
      })),
    }));
  }

  function addRecord(values) {
    updateSelectedPlan((plan) => ({
      ...plan,
      records: [
        ...(Array.isArray(plan.records) ? plan.records : []),
        { id: createId("record"), ...values },
      ],
    }));
    setDialog(null);
  }

  function deleteRecord(recordId) {
    updateSelectedPlan((plan) => ({
      ...plan,
      records: (Array.isArray(plan.records) ? plan.records : []).filter(
        (record) => record.id !== recordId,
      ),
    }));
  }

  function toggleMedication(medicationId, doseIndex) {
    updateSelectedPlan((plan) => {
      const currentChecks = plan.medicationChecks ?? createDefaultMedicationChecks();
      const medicationChecks = [...(currentChecks[medicationId] ?? [])];
      medicationChecks[doseIndex] = !medicationChecks[doseIndex];
      return {
        ...plan,
        medicationChecks: {
          ...currentChecks,
          [medicationId]: medicationChecks,
        },
      };
    });
  }

  function saveWeight(weightKg) {
    updateSelectedPlan((plan) => ({ ...plan, weightKg }));
  }

  function addExistingFood(mealId, foodId, unitOptionId) {
    updateMeal(mealId, (meal) => ({
      ...meal,
      expanded: true,
      items: [
        ...meal.items,
        { id: createId("item"), foodId, unitOptionId },
      ],
    }));
  }

  function handleVoiceCommand(transcript) {
    const parsed = parseVoiceCommand(transcript, state.foods);
    if (!parsed.ok) return `识别到“${transcript || "空白"}”。${parsed.message}`;

    updateSelectedPlan((plan) => {
      const existingMeal = plan.meals.find((meal) => meal.time === parsed.time);
      const mealId = existingMeal?.id ?? createId("meal");
      const nextItems = parsed.selections.map((selection) => ({
        id: createId("item"),
        foodId: selection.foodId,
        unitOptionId: selection.unitOptionId,
      }));
      if (existingMeal) {
        return {
          ...plan,
          meals: plan.meals.map((meal) =>
            meal.id === mealId
              ? { ...meal, expanded: true, items: [...meal.items, ...nextItems] }
              : { ...meal, expanded: false },
          ),
        };
      }
      const mealMeta = getMealMetaByTime(parsed.time);
      return {
        ...plan,
        meals: [
          ...plan.meals.map((meal) => ({ ...meal, expanded: false })),
          { id: mealId, ...mealMeta, time: parsed.time, expanded: true, items: nextItems },
        ],
      };
    });
    return `已添加到${parsed.time}：${parsed.selections.map((selection) => selection.label).join("、")}。`;
  }

  function updateItemUnit(mealId, itemId, unitOptionId) {
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.map((item) => {
        if (item.id !== itemId) return item;
        const { grams, ...nextItem } = item;
        return { ...nextItem, unitOptionId };
      }),
    }));
    setDialog(null);
  }

  function updateItemUnitInDialog(mealId, itemId, unitOptionId) {
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.map((item) => {
        if (item.id !== itemId) return item;
        const { grams, ...nextItem } = item;
        return { ...nextItem, unitOptionId };
      }),
    }));
  }

  function removeItemFromMeal(mealId, itemId) {
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.filter((item) => item.id !== itemId),
    }));
  }

  function createFood(draft) {
    const food = {
      id: createId("food"),
      name: draft.name.trim(),
      variant: draft.variant.trim(),
      category: draft.category,
      unitName: draft.unitName.trim(),
      gramsPerUnit: Number(draft.gramsPerUnit),
      unitOptions: draft.unitOptions,
      kcalPerGram: Number(draft.kcalPerGram),
      sourceBasis: draft.sourceBasis.trim(),
      sourceUrl: draft.sourceUrl.trim(),
      archived: false,
    };
    setState((current) => ({ ...current, foods: [...current.foods, food] }));
    return food;
  }

  function saveFoodFromLibrary(draft) {
    const savedUnitOptions = dialog?.foodId && SINGLE_UNIT_FOOD_IDS.has(dialog.foodId)
      ? SEED_FOOD_BY_ID[dialog.foodId].unitOptions
      : draft.unitOptions;
    if (dialog?.foodId) {
      setState((current) => ({
        ...current,
        foods: current.foods.map((food) =>
          food.id === dialog.foodId
            ? {
                ...food,
                name: draft.name.trim(),
                variant: draft.variant.trim(),
                category: draft.category,
                unitName: draft.unitName.trim(),
                gramsPerUnit: Number(draft.gramsPerUnit),
                unitOptions: savedUnitOptions,
                kcalPerGram: Number(draft.kcalPerGram),
                sourceBasis: draft.sourceBasis.trim(),
                sourceUrl: draft.sourceUrl.trim(),
              }
            : food,
        ),
      }));
    } else {
      createFood(draft);
    }
    setDialog(null);
  }

  const editingMeal = dialog?.mealId
    ? selectedPlan.meals.find((meal) => meal.id === dialog.mealId)
    : null;
  const editingFood = dialog?.foodId ? foodById[dialog.foodId] : null;
  const editingItem = dialog?.itemId
    ? editingMeal?.items.find((item) => item.id === dialog.itemId)
    : null;
  const dayTheme = new Date(`${selectedDate}T12:00:00`).getDay();

  return (
    <div className={`prototype-stage day-theme-${dayTheme}`}>
      <main className="mobile-prototype">
        <div className="screen-stack">
          {activeTab === "today" && (
            <TodayScreen
              dateKey={selectedDate}
              plan={selectedPlan}
              foods={state.foods}
              onChangeDate={setSelectedDate}
              onEditTarget={() => setActiveTab("settings")}
              onToggleMeal={toggleMeal}
              onAdjustMealTime={(mealId) => setDialog({ type: "meal", mealId })}
              onEditUnit={(mealId, itemId) =>
                setDialog({ type: "edit-food-unit", mealId, itemId })
              }
              onRemoveItem={(mealId, itemId) =>
                updateMeal(mealId, (meal) => ({
                  ...meal,
                  items: meal.items.filter((item) => item.id !== itemId),
                }))
              }
              onAddFood={(mealId) => setDialog({ type: "add-food", mealId })}
              onAddMeal={() => setDialog({ type: "meal" })}
              onOpenSummary={() => setDialog({ type: "summary" })}
              onVoiceCommand={handleVoiceCommand}
              hasDailyTemplate={Boolean(state.settings.dailyTemplate)}
              onImportTemplate={importDailyTemplate}
            />
          )}

          {activeTab === "foods" && (
            <FoodLibraryScreen
              foods={state.foods}
              onAddFood={() => setDialog({ type: "food-editor" })}
              onEditFood={(foodId) => setDialog({ type: "food-editor", foodId })}
              onToggleArchive={(foodId) =>
                setState((current) => ({
                  ...current,
                  foods: current.foods.map((food) =>
                    food.id === foodId ? { ...food, archived: !food.archived } : food,
                  ),
                }))
              }
            />
          )}

          {activeTab === "records" && (
            <HealthScreen
              dateKey={selectedDate}
              records={selectedPlan.records ?? []}
              medicationChecks={selectedPlan.medicationChecks ?? createDefaultMedicationChecks()}
              weightKg={selectedPlan.weightKg}
              onToggleMedication={toggleMedication}
              onSaveWeight={saveWeight}
              onAddRecord={() => setDialog({ type: "record" })}
              onDeleteRecord={deleteRecord}
            />
          )}

          {activeTab === "settings" && (
            <SettingsScreen
              dateKey={selectedDate}
              plan={selectedPlan}
              defaultTarget={state.settings.defaultTargetKcal}
              onUpdatePlanTarget={(targetKcal) =>
                updateSelectedPlan((plan) => ({
                  ...plan,
                  targetKcal: Math.max(Number(targetKcal) || 0, 0),
                }))
              }
              onUpdateDefaultTarget={(defaultTargetKcal) =>
                setState((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    defaultTargetKcal: Math.max(Number(defaultTargetKcal) || 0, 0),
                  },
                }))
              }
              onConfirm={() => setActiveTab("today")}
              dailyTemplate={state.settings.dailyTemplate}
              onSaveTemplate={saveDailyTemplate}
              onImportTemplate={importDailyTemplate}
            />
          )}
        </div>

        <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />

        {dialog?.type === "meal" && (
          <MealDialog
            initialMeal={editingMeal}
            onSave={saveMeal}
            onClose={() => setDialog(null)}
          />
        )}

        {dialog?.type === "record" && (
          <RecordDialog onSave={addRecord} onClose={() => setDialog(null)} />
        )}

        {dialog?.type === "summary" && (
          <DailySummaryDialog
            plan={selectedPlan}
            foods={state.foods}
            onClose={() => setDialog(null)}
          />
        )}

        {dialog?.type === "food-editor" && (
          <FoodEditorDialog
            food={editingFood}
            onSave={saveFoodFromLibrary}
            onClose={() => setDialog(null)}
          />
        )}

        {dialog?.type === "add-food" && (
          <AddFoodDialog
            foods={state.foods}
            meal={editingMeal}
            keepOpen
            onSelectUnit={(foodId, unitOptionId) =>
              addExistingFood(dialog.mealId, foodId, unitOptionId)
            }
            onUpdateItemUnit={(itemId, unitOptionId) =>
              updateItemUnitInDialog(dialog.mealId, itemId, unitOptionId)
            }
            onRemoveItem={(itemId) => removeItemFromMeal(dialog.mealId, itemId)}
            onConfirm={() => setDialog(null)}
            onManageFoods={() => {
              setDialog(null);
              setActiveTab("foods");
            }}
            onClose={() => setDialog(null)}
          />
        )}

        {dialog?.type === "edit-food-unit" && editingItem && (
          <AddFoodDialog
            foods={state.foods}
            meal={editingMeal}
            initialFoodId={editingItem.foodId}
            onSelectUnit={(_foodId, unitOptionId) =>
              updateItemUnit(dialog.mealId, dialog.itemId, unitOptionId)
            }
            onClose={() => setDialog(null)}
          />
        )}
      </main>
    </div>
  );
}
