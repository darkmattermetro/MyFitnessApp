export function calcularIMC(pesoKg, alturaCm) {
  const peso = Number(pesoKg);
  const altura = Number(alturaCm);
  if (!Number.isFinite(peso) || peso <= 0) return null;
  if (!Number.isFinite(altura) || altura <= 0) return null;
  const m = altura / 100;
  return peso / (m * m);
}

export function clasificarIMC(imc) {
  if (imc == null || Number.isNaN(imc)) return null;
  if (imc < 18.5) return { categoria: 'Underweight', color: '#D97706' };
  if (imc < 25) return { categoria: 'Healthy weight', color: '#16A34A' };
  if (imc < 30) return { categoria: 'Overweight', color: '#D97706' };
  return { categoria: 'Obese', color: '#DC2626' };
}

// Adult screening bands; Asian thresholds are lower and are reported as an
// informational alternative rather than silently changing the default BMI band.
export function bmiInterpretation(imc, isAsianBackground = false) {
  const value = Number(imc);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 18.5) return {
    category: 'Below the usual adult range',
    detail: 'BMI is below 18.5. If this is unexpected, you have lost weight without trying, or you are concerned about nutrition, speak with a healthcare professional.',
    action: 'Consider discussing your weight and nutrition with a healthcare professional.',
    tone: 'warning',
  };
  if (!isAsianBackground && value < 23) return {
    category: 'Within the standard adult range',
    detail: 'BMI is within the standard adult range. For many Asian populations, health risks can begin at a lower BMI; selecting the Asian screening option shows that alternative context.',
    action: 'For a broader picture, add waist circumference and track trends over time.',
    tone: 'success',
  };
  if (isAsianBackground && value < 23) return {
    category: 'Within the standard range',
    detail: 'BMI is within the standard adult range. Some Asian populations may have increased health risk at lower BMI values, so waist measurement and other health factors can add context.',
    action: 'For a broader picture, add waist circumference and track trends over time.',
    tone: 'success',
  };
  if (value < (isAsianBackground ? 23 : 25)) return {
    category: 'Within the standard adult range',
    detail: 'BMI is within the standard adult range. BMI is a screening measure and does not directly measure body fat or overall health.',
    action: 'Maintain sustainable activity, balanced meals, and regular health checkups.',
    tone: 'success',
  };
  if (value < (isAsianBackground ? 27.5 : 30)) return {
    category: isAsianBackground ? 'Above the Asian screening threshold' : 'Above the standard adult range',
    detail: isAsianBackground
      ? 'For many Asian populations, a BMI of 23 or higher can signal increased health risk. This is a screening threshold, not a diagnosis.'
      : 'BMI is between 25 and 29.9. BMI alone cannot tell how much weight comes from muscle or where body fat is stored.',
    action: 'If appropriate, measure your waist and discuss your overall risk with a healthcare professional.',
    tone: 'warning',
  };
  return {
    category: 'Above the adult screening range',
    detail: isAsianBackground
      ? 'For many Asian populations, a BMI of 27.5 or higher is a higher screening threshold. BMI alone cannot diagnose a condition or assess your full health.'
      : 'BMI is 30 or higher. This screening result needs context such as waist size, medical history, muscle mass, and other health measures.',
    action: 'Consider a non-urgent health review to discuss personal measurements and supportive next steps.',
    tone: 'warning',
  };
}

export function healthyWeightRange(heightCm) {
  const height = Number(heightCm);
  if (!Number.isFinite(height) || height <= 0) return null;
  const heightM = height / 100;
  return {
    minKg: Math.round(18.5 * heightM * heightM * 10) / 10,
    maxKg: Math.round(24.9 * heightM * heightM * 10) / 10,
  };
}

export function waistToHeightRatio(waistCm, heightCm) {
  const waist = Number(waistCm);
  const height = Number(heightCm);
  if (![waist, height].every(Number.isFinite) || waist <= 0 || height <= 0 || waist > 300 || height > 250) return null;
  const ratio = waist / height;
  return {
    value: Math.round(ratio * 100) / 100,
    category: ratio < 0.5 ? 'Below 0.5' : ratio < 0.6 ? 'Increased central adiposity range' : 'Higher central adiposity range',
  };
}

export function calcularBMR(pesoKg, alturaCm, edad, sexo) {
  const peso = Number(pesoKg);
  const altura = Number(alturaCm);
  const anos = Number(edad);
  if (![peso, altura, anos].every(Number.isFinite)) return null;
  if (peso <= 0 || altura <= 0 || anos <= 0 || anos > 120) return null;
  const base = 10 * peso + 6.25 * altura - 5 * anos;
  return sexo === 'female' ? base - 161 : base + 5;
}

export const NIVELES_ACTIVIDAD = [
  { value: 1.2, label: 'Sedentary', hint: 'Little or no exercise' },
  { value: 1.375, label: 'Lightly active', hint: '1-3 times a week' },
  { value: 1.55, label: 'Moderately active', hint: '3-5 times a week' },
  { value: 1.725, label: 'Very active', hint: '6-7 times a week' },
  { value: 1.9, label: 'Athlete', hint: 'Physical job / training twice a day' },
];

export function calcularCaloriasRecomendadas(pesoKg, alturaCm, edad, sexo, factor) {
  const bmr = calcularBMR(pesoKg, alturaCm, edad, sexo);
  if (bmr == null) return null;
  const f = Number(factor);
  if (!Number.isFinite(f) || f <= 0) return null;
  return bmr * f;
}

// Totals for a list of meal items. Accepts both the current English keys and
// the old Spanish ones used by early demo data.
export function itemTotals(items) {
  return (items || []).reduce(
    (acc, item) => {
      const raw = item || {};
      acc.kcal += Number(raw.kcal) || 0;
      acc.protein += Number(raw.protein ?? raw.prot) || 0;
      acc.fat += Number(raw.fat ?? raw.grasa) || 0;
      acc.carbs += Number(raw.carbs ?? raw.carb) || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

// ---- Meals by category ----
export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { value: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
  { value: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { value: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

export const MEAL_LABEL = MEAL_TYPES.reduce((acc, m) => {
  acc[m.value] = m.label;
  return acc;
}, {});

// Some rows may come from older builds or from FitAI's capitalised values.
export function normalizeMealType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'breakfast' || raw === 'lunch' || raw === 'dinner' || raw === 'snack') {
    return raw;
  }
  if (raw === 'brunch' || raw === 'morning') return 'breakfast';
  if (raw === 'afternoon') return 'lunch';
  if (raw === 'evening' || raw === 'supper') return 'dinner';
  return 'snack';
}

// Best guess for a meal logged without a category (e.g. seeded or old rows).
export function guessMealType(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'snack';
  const hour = d.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function mealTypeOf(entry) {
  if (entry?.meal_type) return normalizeMealType(entry.meal_type);
  return guessMealType(entry?.fecha);
}

// "30% protein / 45% carbs / 25% fat" of the daily calorie goal.
export function macroTargets(kcal) {
  const total = Number(kcal);
  if (!Number.isFinite(total) || total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((total * 0.3) / 4),
    carbs: Math.round((total * 0.45) / 4),
    fat: Math.round((total * 0.25) / 9),
  };
}

// Groups meal rows into the four categories, keeping the original order.
export function groupMealsByType(entries) {
  const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const entry of entries || []) {
    groups[mealTypeOf(entry)].push(entry);
  }
  return MEAL_TYPES.map((type) => ({
    ...type,
    entries: groups[type.value],
    kcal: groups[type.value].reduce((s, e) => s + (Number(e.total_kcal) || 0), 0),
  }));
}

// ---- Weight transformation ----
// Returns null until there is a starting weight, a current weight and a goal.
export function weightProgress({ start, current, goal, goalType = 'maintain' }) {
  const s = Number(start);
  const c = Number(current);
  const g = Number(goal);
  if (![s, c, g].every(Number.isFinite) || s <= 0 || c <= 0 || g <= 0) return null;

  const direction =
    goalType === 'lose' ? 'lose' : goalType === 'gain' ? 'gain' : 'maintain';
  const plus = (v) => Math.round(v * 10) / 10;

  let pct = 0;
  let reached = false;

  if (direction === 'maintain') {
    reached = Math.abs(c - g) <= 0.5;
    const spread = Math.max(1, Math.abs(s - g));
    pct = reached ? 1 : Math.max(0, Math.min(0.99, 1 - Math.abs(c - g) / spread));
  } else {
    const total = direction === 'lose' ? s - g : g - s;
    const done = direction === 'lose' ? s - c : c - s;
    pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
    reached = direction === 'lose' ? c <= g : c >= g;
    if (reached) pct = 1;
  }

  return {
    start: plus(s),
    current: plus(c),
    goal: plus(g),
    direction,
    pct,
    reached,
    // Absolute distance still to travel toward the goal.
    toGo: plus(Math.abs(c - g)),
    // How much has changed since the first entry.
    changed: plus(Math.abs(c - s)),
  };
}
