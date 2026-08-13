# OpenFit

App de nutrición para registrar comidas y peso. Disponible para Android, iOS y web con un solo código base (React Native + Expo).

## Funcionalidades

- **Registro de comidas por IA**: escribís lo que comiste en lenguaje cotidiano ("dos huevos revueltos y café con leche") y la IA lo convierte en datos nutricionales (kcal, proteínas, grasas, carbohidratos) antes de guardarlo.
- **Dashboard**: calorías del día vs. objetivo y último peso registrado.
- **Historial**: comidas agrupadas por día.
- **Peso**: registro con fecha y hora + gráfica de evolución.
- **Perfil**: objetivo calórico, meta de peso, datos personales y API key de Gemini (modelo BYOK: cada usuario usa su propia clave).

## Stack

- **Frontend**: React Native con Expo SDK 54, react-native-web (web), React Navigation.
- **Backend**: Supabase (Auth + PostgreSQL con Row Level Security).
- **IA**: Gemini API, llamada directo desde la app con la API key del usuario.

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Expo Go en tu teléfono (opcional, para desarrollo en dispositivo)

## Configuración

1. Cloná el repo e instalá dependencias:

   ```bash
   npm install
   ```

2. Creá tu archivo `.env` a partir de la plantilla:

   ```bash
   copy .env.example .env
   ```

   Completá los valores con los de tu proyecto de Supabase (Project Settings > API):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

3. Aplicá las migraciones de la base de datos (requiere un access token de Supabase):

   ```bash
   setx SUPABASE_ACCESS_TOKEN "sbp_tu_token"
   node scripts/run-migration.js
   ```

## Scripts

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor de desarrollo Expo |
| `npm run web` | Abre la app en el navegador |
| `npm run android` | Corre en Android (Expo Go / emulador) |
| `npm run ios` | Corre en iOS (Expo Go / simulador) |
| `npm run export:web` | Genera el build estático para web (`dist/`) |
| `npm run logo` | Regenera los íconos de la app desde `assets/logo2.svg` |
| `npm run build:apk` | Build de APK de preview con EAS |
| `npm run build:android` | Build de producción Android con EAS |
| `npm run build:ios` | Build de producción iOS con EAS |

## Estructura

```
src/
  screens/       Dashboard, RegistrarComida, Historial, Peso, Perfil, Auth
  components/    Componentes reutilizables (UI, gráfica, diálogos, etc.)
  services/      Cliente de Supabase, auth, API y almacenamiento
  theme/         Colores y estilos globales
  navigation/    Navegación por pestañas
  utils/         Helpers de nutrición
supabase/
  migrations/    SQL de esquema, auth (RLS) y métricas
scripts/         Utilidades (migraciones, generación de íconos)
```

## Despliegue web

El build web es una app estática generada con `expo export --platform web`, lista para hosting estático (Vercel, Netlify, etc.).

En Vercel:

1. Configurá `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` como variables de entorno.
2. Usá `npm run export:web` como build command y `dist/` como output directory.
3. Agregá la URL del dominio a los redirects de Auth en Supabase.

## Seguridad

- Las migraciones activan Row Level Security: cada usuario solo accede a sus propios datos.
- La `service_role` key de Supabase no se usa ni se guarda en el repo.
- La API key de Gemini es de cada usuario (BYOK) y se almacena cifrada en su fila de la tabla `users`.