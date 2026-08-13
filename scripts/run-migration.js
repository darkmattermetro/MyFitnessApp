// Ejecuta migraciones SQL del proyecto contra Supabase usando la Management API.
//
// Uso:
//   1) Generá un token de acceso en https://supabase.com/dashboard/account/tokens
//   2) setx SUPABASE_ACCESS_TOKEN "sbp_..."   (en una terminal NUEVA)
//   3) node scripts/run-migration.js                -> corre todas las migraciones
//      node scripts/run-migration.js 0003_metricas  -> solo esa
//
// El token NUNCA se imprime ni se persiste en el repo (se lee de la variable de entorno).

const fs = require('fs');
const path = require('path');

// Carga mínima de .env para que los scripts Node usen las mismas vars que Expo.
(function loadDotenv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
})();

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN.');
  console.error('Generalo en https://supabase.com/dashboard/account/tokens y luego:');
  console.error('  setx SUPABASE_ACCESS_TOKEN "sbp_tu_token"');
  console.error('Abrí una terminal NUEVA y volvé a correr este script.');
  process.exit(1);
}

// Project ref = subdominio de la URL en EXPO_PUBLIC_SUPABASE_URL
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://PEGA_TU_URL.supabase.co';
if (supabaseUrl.startsWith('PEGA')) {
  console.error('Falta EXPO_PUBLIC_SUPABASE_URL.');
  console.error('Definela en el archivo .env o con setx, y abrí una terminal NUEVA.');
  process.exit(1);
}
const ref = new URL(supabaseUrl).hostname.split('.')[0];

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const quiereSolo = process.argv[2];

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => !quiereSolo || f.includes(quiereSolo))
  .sort();

if (files.length === 0) {
  console.error('No hay migraciones para ejecutar con ese filtro.');
  process.exit(1);
}

async function run(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

(async () => {
  console.log(`Proyecto: ${ref}`);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`→ ${file} ... `);
    try {
      await run(sql);
      console.log('OK');
    } catch (e) {
      console.log('ERROR');
      console.error(e.message);
      process.exitCode = 1;
      return;
    }
  }
  if (!process.exitCode) console.log('Migraciones aplicadas correctamente.');
})();