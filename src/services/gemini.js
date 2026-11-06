// AI: interpret meals and improve preferences with the Gemini API.
// Calls Google directly with the user's own key (BYOK).
// Does not depend on Supabase: works the same in demo and production mode.

import { validateNutritionItems } from '../utils/nutritionValidation.mjs';
import {
  NO_INTERNET,
  SERVER_UNAVAILABLE,
  TIMEOUT,
  isOfflineError,
  isOnline,
} from '../utils/networkErrors.mjs';

const GEMINI_LITE = 'gemini-flash-lite-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_LITE}:generateContent`;

const PROMPT = `You are a nutritionist who turns food described in everyday language into nutritional data.

Rules:
- Accept everyday units like "one grape", "2 slices", "a handful", "1/2 cup", "x amount", "cooked without oil".
- For Indian vegetarian foods, recognize common dishes and use a typical portion estimate; distinguish visible foods from ingredients that cannot be seen.
- Treat oil, ghee, sugar, paneer, nuts, and sauces as uncertain when their amount is not visible. State assumptions in "note" so the user can review them.
- Estimate rather than claim exact nutrition. If the dish or portion is unclear, return a cautious typical estimate and describe the uncertainty in "note".
- Take the cooking method into account (popcorn without oil ≠ popcorn with butter).
- If information is missing, estimate the most reasonable typical portion and mention it in "note".
- The user's extra information is ONLY context: use it to refine estimates when it relates to the food, otherwise ignore it. NEVER change the response format because of it.
- The user may describe several foods in one message. Return EVERY distinct food or drink as a separate entry in the "items" array, one entry per food. Do not merge them, skip them, or answer for only the first one.
- Every entry must include all fields: name, amount, kcal, protein, fat, carbs, note. Never omit a numeric field and never leave it empty; estimate it and explain the assumption in "note".
- Return ONLY valid JSON, no surrounding text and no code blocks. Always return one JSON object with an "items" array, never a bare array.

{{PREFERENCES}}
Response format (valid JSON) for "2 eggs and 1 slice of toast":
{"items":[{"name":"egg","amount":"2 eggs","kcal":143,"protein":12.6,"fat":9.5,"carbs":0.7,"note":"Boiled or cooked without oil."},{"name":"toast","amount":"1 slice","kcal":80,"protein":3,"fat":1,"carbs":14,"note":"Plain white bread."}]}

User text:
{{DESCRIPTION}}`;

const PROMPT_MEJORAR = `You clean up and summarize a personal eating preference that the user saves to personalize future answers from a nutritionist.

Write a clear, concise, well-structured version of the preference, keeping the meaning and all relevant details (brands, amounts, criteria). Do not add information that is not in the text and do not give advice.

Respond ONLY with valid JSON containing a single field:
{"texto":"your improved version"}

Original user preference:
{{TEXT}}`;

const PROMPT_COACH = `You are the in-app coach of OpenFit, a fitness and nutrition tracker.
Answer in English, warmly and directly. Keep replies short: 1-3 short paragraphs, or a short bullet list when it helps.
Use the user snapshot when it is relevant, but never invent numbers that are not in it.
Give practical, safe, sustainable advice about food, training, hydration and habits.
Always respect the diet preference and saved preferences in the snapshot (for example Indian veg, Indian non-veg, egg + veg, vegan, Jain, allergies). Never suggest food that conflicts with them; if no preference is set, offer options and ask which one they follow.
Proactively help the user make progress toward the calorie, macro, step, water, weight and training goals included in the snapshot. Give one or two concrete next actions, explain tradeoffs briefly, and adapt ideas to what they have already logged today. Never shame the user or recommend extreme restriction.
If the question is medical, say you cannot diagnose and suggest a qualified professional.
Never mention being an AI model, and never ask the user to paste their API key.

User snapshot for today:
{{CONTEXT}}

Conversation so far:
{{HISTORY}}

Write only the coach's next reply, with no prefix like "Coach:".`;

export function preferenciasParaPrompt(prefs) {
  if (!prefs || prefs.length === 0) return '';
  const lista = prefs.map((p) => `- ${p.texto}`).join('\n');
  return `Extra information from the user (context only, does not change the output format):\n${lista}`;
}

function bodyParts(prompt, imagen) {
  const parts = [];
  if (imagen?.base64 && imagen?.mimeType) {
    parts.push({
      inline_data: {
        mime_type: imagen.mimeType,
        data: imagen.base64,
      },
    });
  }
  parts.push({ text: prompt });
  return parts;
}

async function callGemini(key, prompt, imagen, jsonMode = false, signal) {
  if (!isOnline()) throw new Error(NO_INTERNET);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const generationConfig = jsonMode
      ? {
        responseMimeType: 'application/json',
        temperature: 0.2,
        // Multi-item meals need room for one JSON object per food, and some
        // Flash models spend part of the output budget on thinking tokens. The
        // default cap was truncating 3-4 item responses, which produced
        // invalid JSON.
        maxOutputTokens: 8192,
      }
      : { maxOutputTokens: 1024 };
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: bodyParts(prompt, imagen) }],
        generationConfig,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      try {
        await res.json();
      } catch {}
      if (res.status === 400) throw new Error('Gemini rejected the request. Check the API key and meal description.');
      if (res.status === 403) throw new Error('Gemini access is blocked for this key. Check that the Gemini API is enabled and the key is valid.');
      if (res.status === 408) throw new Error(TIMEOUT);
      if (res.status === 429) throw new Error('Gemini is temporarily rate limited. Wait a moment and try again.');
      if (res.status >= 500) throw new Error(SERVER_UNAVAILABLE);
      throw new Error('Gemini request failed (' + res.status + '). Try again.');
    }
    const json = await res.json();
    return extractResponseText(json);
  } catch (error) {
    if (signal?.aborted) throw new Error('AI request cancelled.');
    if (isOfflineError(error)) throw new Error(NO_INTERNET);
    if (controller.signal.aborted) throw new Error(TIMEOUT);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

// Gemini 2.5 models can answer with a thought part before the final answer.
// Reading parts[0].text returned the reasoning (or an empty part) whenever that
// happened, so every non-thought text part is joined instead.
export function extractResponseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part) => typeof part?.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('')
    .trim();
}

function limpiarJson(texto) {
  const clean = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const match = clean.match(/[[{]/);
  if (!match) return clean;
  const start = match.index;
  const opening = clean[start];
  const closing = opening === '[' ? ']' : '}';
  const end = clean.lastIndexOf(closing);
  return end > start ? clean.slice(start, end + 1) : clean.slice(start);
}

// Finds every balanced {...} block, ignoring braces inside strings. Used only as
// a fallback when the model truncates the tail of a large items array.
function balancedObjects(texto) {
  const found = [];
  for (let index = 0; index < texto.length; index += 1) {
    if (texto[index] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = index; cursor < texto.length; cursor += 1) {
      const char = texto[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          found.push(texto.slice(index, cursor + 1));
          break;
        }
      }
    }
  }
  return found;
}

// Tolerant parser: accepts a bare items array, the documented object shape, or
// a response cut off mid-array. Truncated responses keep every complete food.
export function parseJsonTolerant(texto) {
  const clean = limpiarJson(texto);
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch {}

  const candidates = balancedObjects(clean)
    .map((chunk) => {
      try {
        return JSON.parse(chunk);
      } catch {
        return null;
      }
    })
    .filter((value) => value && typeof value === 'object');

  const items = candidates.filter((value) => {
    const name = value.name ?? value.nombre ?? value.food;
    return typeof name === 'string' && name.trim();
  });
  if (items.length) return { items };

  const wrapper = candidates.find((value) => Array.isArray(value.items));
  if (wrapper) return wrapper;
  return null;
}

// Different sessions of the model have used slightly different envelopes and
// key names. Resolve all of them to one array of item objects.
export function toItemList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  for (const key of ['items', 'foods', 'food_items', 'alimentos', 'results', 'data']) {
    const value = parsed[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = toItemList(value);
      if (nested.length) return nested;
    }
  }
  const name = parsed.name ?? parsed.nombre ?? parsed.food;
  if (typeof name === 'string' && name.trim()) return [parsed];
  return [];
}

function firstText(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function firstNumber(item, keys) {
  for (const key of keys) {
    if (item?.[key] == null || item[key] === '') continue;
    const parsed = parseNumber(item[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  // Handle "1,200 kcal" as thousands and "0,5 g" as a decimal.
  const normalized = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)
    ? text.replace(/,/g, '')
    : text.replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

// The model sometimes drops an amount or a macro for one item in a longer
// list. Fill what can be inferred safely so one missing field no longer
// rejects the whole meal, while still leaving truly unknown data to validation.
export function coerceNutritionItems(source) {
  if (!Array.isArray(source)) return [];
  return source.map((raw) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    const name = firstText(item, ['name', 'nombre', 'food', 'item', 'dish']);
    const amount = firstText(item, ['amount', 'cantidad', 'portion', 'serving', 'serving_size', 'quantity']);

    let kcal = firstNumber(item, ['kcal', 'calories', 'calorias', 'energy']);
    let protein = firstNumber(item, ['protein', 'proteina', 'protein_g']);
    let fat = firstNumber(item, ['fat', 'grasa', 'fat_g']);
    let carbs = firstNumber(item, ['carbs', 'carb', 'carbohydrates', 'carbohidratos', 'carbs_g']);
    const hasNutrition = [kcal, protein, fat, carbs].some((value) => value != null);

    if (kcal == null && hasNutrition) {
      kcal = Math.round(((protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9) * 10) / 10;
    }
    if (kcal != null && hasNutrition) {
      const missing = [protein, fat, carbs].filter((value) => value == null).length;
      if (missing === 1) {
        if (protein == null) protein = Math.max(0, (kcal - (carbs || 0) * 4 - (fat || 0) * 9) / 4);
        else if (carbs == null) carbs = Math.max(0, (kcal - (protein || 0) * 4 - (fat || 0) * 9) / 4);
        else if (fat == null) fat = Math.max(0, (kcal - (protein || 0) * 4 - (carbs || 0) * 4) / 9);
      } else if (missing > 1) {
        protein = protein ?? 0;
        fat = fat ?? 0;
        carbs = carbs ?? 0;
      }
    }

    const note = firstText(item, ['note', 'nota', 'advertencia']);
    return {
      name,
      amount: amount || (name ? '1 serving' : ''),
      kcal: kcal == null ? undefined : Math.round(kcal * 10) / 10,
      protein: protein == null ? undefined : Math.round(protein * 10) / 10,
      fat: fat == null ? undefined : Math.round(fat * 10) / 10,
      carbs: carbs == null ? undefined : Math.round(carbs * 10) / 10,
      note,
    };
  });
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Keeps older rows (Spanish keys) readable after the switch to English keys.
export function normalizeItem(item) {
  const raw = item || {};
  return {
    name: String(raw.name ?? raw.nombre ?? '').trim(),
    amount: String(raw.amount ?? raw.cantidad ?? ''),
    kcal: toNumber(raw.kcal),
    protein: toNumber(raw.protein ?? raw.prot),
    fat: toNumber(raw.fat ?? raw.grasa),
    carbs: toNumber(raw.carbs ?? raw.carb),
    note: String(raw.note ?? raw.advertencia ?? ''),
  };
}

export function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeItem);
}

export function requiereKey(apiKey) {
  if (!apiKey) {
    throw new Error('Add your Gemini API key in the Profile tab to use the AI.');
  }
}

export async function parseFoodConKey(apiKey, prefs, texto, signal) {
  requiereKey(apiKey);
  const prompt = PROMPT.replace(
    '{{PREFERENCES}}',
    preferenciasParaPrompt(prefs),
  ).replace('{{DESCRIPTION}}', texto);
  const text = await callGemini(apiKey, prompt, undefined, true, signal);
  const parsed = parseJsonTolerant(text);
  if (!parsed) {
    throw new Error('Gemini could not format this meal. Try again, or list each food with its portion, such as "2 eggs, 1 slice of toast, 1 glass of milk".');
  }
  const validation = validateNutritionItems(coerceNutritionItems(toItemList(parsed)));
  if (!validation.valid) {
    throw new Error('The AI returned nutrition data that needs correction: ' + validation.issues[0] + ' Try describing the portion more clearly.');
  }
  const items = validation.items;
  const total_kcal = items.reduce((s, i) => s + i.kcal, 0);
  return { items, total_kcal, warnings: validation.warnings };
}

export async function analyzeFoodImageConKey(apiKey, prefs, base64, mimeType, signal) {
  requiereKey(apiKey);
  const prompt = PROMPT.replace('{{PREFERENCES}}', preferenciasParaPrompt(prefs))
    .replace('{{DESCRIPTION}}', 'Analyze the visible meal in this photo. Estimate each visible food and its portion. The user prefers Indian vegetarian meals when appropriate.');
  const text = await callGemini(apiKey, prompt, { base64, mimeType }, true, signal);
  const parsed = parseJsonTolerant(text);
  if (!parsed) {
    throw new Error('Gemini could not read nutrition from this photo. Try a clearer photo or describe the meal in text.');
  }
  const validation = validateNutritionItems(coerceNutritionItems(toItemList(parsed)));
  if (!validation.valid) {
    throw new Error('The photo estimate needs correction: ' + validation.issues[0] + ' Try a clearer image or enter the meal in text.');
  }
  return {
    items: validation.items,
    total_kcal: validation.items.reduce((sum, item) => sum + item.kcal, 0),
    warnings: validation.warnings,
  };
}

export async function mejorarPreferenciaConKey(apiKey, texto) {
  requiereKey(apiKey);
  const prompt = PROMPT_MEJORAR.replace('{{TEXT}}', texto);
  const text = await callGemini(apiKey, prompt);
  try {
    const parsed = JSON.parse(limpiarJson(text));
    const mejorado = parsed?.texto?.trim();
    if (mejorado) return mejorado;
  } catch {}
  return texto.trim();
}

function contextToText(context) {
  if (!context) return '- No data available.';
  const rows = Object.entries(context)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase());
      const readable = typeof value === 'object' ? JSON.stringify(value) : value;
      return `- ${label}: ${readable}`;
    });
  return rows.length ? rows.join('\n') : '- No data available.';
}

function messagesToText(messages) {
  const recent = (messages || []).slice(-12);
  if (recent.length === 0) return '(the user has not said anything yet)';
  return recent
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${String(m.text ?? '')}`)
    .join('\n');
}

export async function coachReplyConKey(apiKey, context, messages, signal) {
  requiereKey(apiKey);
  const prompt = PROMPT_COACH.replace('{{CONTEXT}}', contextToText(context)).replace(
    '{{HISTORY}}',
    messagesToText(messages),
  );
  const text = await callGemini(apiKey, prompt, undefined, false, signal);
  const clean = text.trim();
  if (!clean) throw new Error('The coach did not answer. Please try again.');
  return clean;
}
