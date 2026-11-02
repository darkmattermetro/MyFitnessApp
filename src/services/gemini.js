// AI: interpret meals and improve preferences with the Gemini API.
// Calls Google directly with the user's own key (BYOK).
// Does not depend on Supabase: works the same in demo and production mode.

import { validateNutritionItems } from '../utils/nutritionValidation.mjs';

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
- Return ONLY valid JSON, no surrounding text and no code blocks.

{{PREFERENCES}}
Response format (valid JSON):
{"items":[{"name":"grape","amount":"1 unit","kcal":5,"protein":0.1,"fat":0,"carbs":1.3,"note":"Assumed 1 small grape."}]}

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
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: bodyParts(prompt, imagen) }],
        ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      try {
        await res.json();
      } catch {}
      if (res.status === 400) throw new Error('Gemini rejected the request. Check the API key and meal description.');
      if (res.status === 403) throw new Error('Gemini access is blocked for this key. Check that the Gemini API is enabled and the key is valid.');
      if (res.status === 429) throw new Error('Gemini is temporarily rate limited. Wait a moment and try again.');
      throw new Error('Gemini request failed (' + res.status + '). Try again.');
    }
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch (error) {
    if (signal?.aborted) throw new Error('AI request cancelled.');
    if (controller.signal.aborted) throw new Error('Gemini took too long to respond. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

function limpiarJson(texto) {
  const clean = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  return start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
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
  let parsed;
  try {
    parsed = JSON.parse(limpiarJson(text));
  } catch {
    throw new Error('Gemini could not format this meal. Try a shorter description with portions, such as “2 eggs and 1 slice of toast”.');
  }
  const validation = validateNutritionItems(parsed.items);
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
  let parsed;
  try {
    parsed = JSON.parse(limpiarJson(text));
  } catch {
    throw new Error('Gemini could not read nutrition from this photo. Try a clearer photo or describe the meal in text.');
  }
  const validation = validateNutritionItems(parsed.items);
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
