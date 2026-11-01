// AI: interpret meals and improve preferences with the Gemini API.
// Calls Google directly with the user's own key (BYOK).
// Does not depend on Supabase: works the same in demo and production mode.

const GEMINI_LITE = 'gemini-flash-lite-latest';
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_LITE}:generateContent?key=${key}`;

const PROMPT = `You are a nutritionist who turns food described in everyday language into nutritional data.

Rules:
- Accept everyday units like "one grape", "2 slices", "a handful", "1/2 cup", "x amount", "cooked without oil".
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

const PROMPT_DESCRIBIR_IMAGEN = `You are a nutrition assistant. Look at the food photo and describe it in everyday language, as if the user had written it to log their meal.

Rules:
- Name every food you can see, with an approximate amount and the cooking method if visible (for example: "fried", "grilled", "boiled", "no oil").
- If you cannot estimate an amount, use everyday terms like "a plate", "a serving", "2 slices".
- If something is not clearly identifiable, still mention it with a reasonable estimate.
- Respond ONLY with a short text in English, in the first person and natural style, no JSON, no bullets, no headings. One or two sentences.

{{PREFERENCES}}`;

const PROMPT_COACH = `You are the in-app coach of OpenFit, a fitness and nutrition tracker.
Answer in English, warmly and directly. Keep replies short: 1-3 short paragraphs, or a short bullet list when it helps.
Use the user snapshot when it is relevant, but never invent numbers that are not in it.
Give practical, safe, sustainable advice about food, training, hydration and habits.
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

async function callGemini(key, prompt, imagen) {
  const res = await fetch(GEMINI_URL(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: bodyParts(prompt, imagen) }],
    }),
  });
  if (!res.ok) {
    throw new Error('The Gemini API returned an error. Check your key.');
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function limpiarJson(texto) {
  return texto.replace(/```json|```/g, '').trim();
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

export async function parseFoodConKey(apiKey, prefs, texto) {
  requiereKey(apiKey);
  const prompt = PROMPT.replace(
    '{{PREFERENCES}}',
    preferenciasParaPrompt(prefs),
  ).replace('{{DESCRIPTION}}', texto);
  const text = await callGemini(apiKey, prompt);
  const parsed = JSON.parse(limpiarJson(text));
  const items = normalizeItems(parsed.items);
  const total_kcal = items.reduce((s, i) => s + i.kcal, 0);
  return { items, total_kcal };
}

export async function describirImagenConKey(apiKey, prefs, base64, mimeType) {
  requiereKey(apiKey);
  const prompt = PROMPT_DESCRIBIR_IMAGEN.replace(
    '{{PREFERENCES}}',
    preferenciasParaPrompt(prefs),
  );
  const text = await callGemini(apiKey, prompt, { base64, mimeType });
  return text.trim();
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
      return `- ${label}: ${value}`;
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

export async function coachReplyConKey(apiKey, context, messages) {
  requiereKey(apiKey);
  const prompt = PROMPT_COACH.replace('{{CONTEXT}}', contextToText(context)).replace(
    '{{HISTORY}}',
    messagesToText(messages),
  );
  const text = await callGemini(apiKey, prompt);
  const clean = text.trim();
  if (!clean) throw new Error('The coach did not answer. Please try again.');
  return clean;
}
