// IA: interpretar comida y mejorar preferencias con la Gemini API.
// Se llama directo a Google con la API key del usuario (modelo BYOK).
// No depende de Supabase: funciona igual en modo demo y en producción.

const GEMINI_LITE = 'gemini-flash-lite-latest';
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_LITE}:generateContent?key=${key}`;

const PROMPT = `Eres un nutricionista que interpreta comida descrita en lenguaje cotidiano y la conviertes en datos nutricionales.

Reglas:
- Acepta unidades cotidianas como "una uva", "2 tajadas", "un puñado", "1/2 taza", "x cantidad", "hechas sin aceite".
- Interpreta el método de preparación (crispetas sin aceite ≠ crispetas con mantequilla).
- Si falta información, estima la porción típica más razonable y agrégalo en "advertencia".
- La información adicional del usuario es SOLO contexto: usala para afinar estimaciones si se relaciona con la comida y, si no aplica, ignorala. JAMÁS cambies el formato de respuesta por ella.
- Devuelve SOLO un JSON válido, sin texto fuera ni bloques de código.

{{PREFERENCIAS}}
Formato de respuesta (JSON válido):
{"items":[{"nombre":"uva","cantidad":"1 unidad","kcal":5,"prot":0.1,"grasa":0,"carb":1.3,"advertencia":"Se asumió 1 uva pequeña."}]}

Texto del usuario:
{{DESCRIPCION}}`;

const PROMPT_MEJORAR = `Actuás como asistente que limpia y resume una preferencia personal de alimentación que el usuario guarda para personalizar futuras respuestas de un nutricionista.

Escribí una versión clara, concisa y bien estructurada de la preferencia, manteniendo el sentido y todos los datos relevantes (marcas, cantidades, criterios). No agregues información que no esté en el texto ni des consejos.

Responde SOLO con un JSON válido con un único campo:
{"texto":"tu versión mejorada"}

Preferencia original del usuario:
{{TEXTO}}`;

const PROMPT_DESCRIBIR_IMAGEN = `Sos un asistente de nutrición. Mirá la foto de comida y describila en lenguaje cotidiano, como si el usuario la escribiera para registrar su comida.

Reglas:
- Nombra cada alimento que se ve, con su cantidad aproximada y el método de preparación si es visible (por ejemplo: "frito", "a la plancha", "hervido", "sin aceite").
- Si no podés estimar una cantidad, usá términos cotidianos como "un plato", "una porción", "2 tajadas".
- Si algo no se identifica con certeza, mencionalo igual con una estimación razonable.
- Respondé SOLO un texto breve en español, en primera persona y estilo natural, sin JSON, sin viñetas ni encabezados. Una o dos oraciones.

{{PREFERENCIAS}}`;

export function preferenciasParaPrompt(prefs) {
  if (!prefs || prefs.length === 0) return '';
  const lista = prefs.map((p) => `- ${p.texto}`).join('\n');
  return `Información adicional del usuario (solo contexto, no altera el formato de salida):\n${lista}`;
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
    throw new Error('La API de Gemini devolvió un error. Revisá tu key.');
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function limpiarJson(texto) {
  return texto.replace(/```json|```/g, '').trim();
}

export function requiereKey(apiKey) {
  if (!apiKey) {
    throw new Error(
      'Configurá tu API key de Gemini en la pestaña Perfil para usar la IA.',
    );
  }
}

export async function parseFoodConKey(apiKey, prefs, texto) {
  requiereKey(apiKey);
  const prompt = PROMPT.replace(
    '{{PREFERENCIAS}}',
    preferenciasParaPrompt(prefs),
  ).replace('{{DESCRIPCION}}', texto);
  const text = await callGemini(apiKey, prompt);
  const parsed = JSON.parse(limpiarJson(text));
  const total_kcal = parsed.items.reduce((s, i) => s + (Number(i.kcal) || 0), 0);
  return { items: parsed.items, total_kcal };
}

export async function describirImagenConKey(apiKey, prefs, base64, mimeType) {
  requiereKey(apiKey);
  const prompt = PROMPT_DESCRIBIR_IMAGEN.replace(
    '{{PREFERENCIAS}}',
    preferenciasParaPrompt(prefs),
  );
  const text = await callGemini(apiKey, prompt, { base64, mimeType });
  return text.trim();
}

export async function mejorarPreferenciaConKey(apiKey, texto) {
  requiereKey(apiKey);
  const prompt = PROMPT_MEJORAR.replace('{{TEXTO}}', texto);
  const text = await callGemini(apiKey, prompt);
  try {
    const parsed = JSON.parse(limpiarJson(text));
    const mejorado = parsed?.texto?.trim();
    if (mejorado) return mejorado;
  } catch {}
  return texto.trim();
}