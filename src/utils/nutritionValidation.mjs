const MAX_ITEMS = 20;
const MAX_NAME_LENGTH = 100;
const MAX_AMOUNT_LENGTH = 80;
const MAX_ITEM_KCAL = 5000;
const MAX_MACRO_GRAMS = 500;

const fieldAliases = {
  name: ['name', 'nombre'],
  amount: ['amount', 'cantidad'],
  kcal: ['kcal'],
  protein: ['protein', 'prot'],
  fat: ['fat', 'grasa'],
  carbs: ['carbs', 'carb'],
  note: ['note', 'advertencia'],
};

function firstValue(item, aliases) {
  for (const key of aliases) if (item?.[key] != null) return item[key];
  return undefined;
}

function numericField(value) {
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function validateNutritionItems(source) {
  const issues = [];
  const warnings = [];
  if (!Array.isArray(source) || source.length === 0) {
    return { valid: false, items: [], issues: ['Add at least one food item.'], warnings };
  }
  if (source.length > MAX_ITEMS) {
    return { valid: false, items: [], issues: [`A meal can contain at most ${MAX_ITEMS} items.`], warnings };
  }

  const items = source.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    const name = cleanText(firstValue(item, fieldAliases.name), MAX_NAME_LENGTH);
    const amount = cleanText(firstValue(item, fieldAliases.amount), MAX_AMOUNT_LENGTH);
    const note = cleanText(firstValue(item, fieldAliases.note), 300);
    const values = {};

    if (!name) issues.push(`Item ${index + 1}: add a food name.`);
    if (!amount) issues.push(`Item ${index + 1}: add an amount.`);
    for (const field of ['kcal', 'protein', 'fat', 'carbs']) {
      const value = numericField(firstValue(item, fieldAliases[field]));
      const max = field === 'kcal' ? MAX_ITEM_KCAL : MAX_MACRO_GRAMS;
      if (value == null || value < 0 || value > max) {
        issues.push(`Item ${index + 1}: ${field} must be between 0 and ${max}${field === 'kcal' ? ' kcal' : ' g'}.`);
      } else {
        values[field] = Math.round(value * 10) / 10;
      }
    }

    if (Object.keys(values).length === 4) {
      const macroKcal = values.protein * 4 + values.carbs * 4 + values.fat * 9;
      if (values.kcal > 50 && macroKcal > 0 && Math.abs(values.kcal - macroKcal) > Math.max(250, values.kcal * 0.5)) {
        warnings.push(`Item ${index + 1}: calories and macros differ a lot; review this AI estimate.`);
      }
    }
    return { name, amount, ...values, note };
  });

  return { valid: issues.length === 0, items: issues.length === 0 ? items : [], issues, warnings };
}
