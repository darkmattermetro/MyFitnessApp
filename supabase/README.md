# Supabase (base de datos)

Supabase se usa **solo como base de datos**. La IA (Gemini) se llama directo
desde la app con la **API key del usuario**, guardada en su fila de la tabla
`users` (modelo BYOK: cada uno usa su propia clave).

Tablas: `migrations/0001_init.sql`. Config del app en `src/config.js`.