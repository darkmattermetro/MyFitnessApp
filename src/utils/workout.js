// Helpers shared by the workout screen. A workout is stored as a list of
// exercises, and each exercise holds its own list of sets.

import { addDays, dayKey } from './dates';

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function setVolume(set) {
  return toNumber(set.weight) * toNumber(set.reps);
}

export function exerciseVolume(exercise) {
  return (exercise.sets || []).reduce((sum, s) => sum + setVolume(s), 0);
}

export function sessionVolume(exercises) {
  return (exercises || []).reduce((sum, ex) => sum + exerciseVolume(ex), 0);
}

export function sessionSetCount(exercises) {
  return (exercises || []).reduce(
    (sum, ex) => sum + (ex.sets || []).filter((s) => toNumber(s.reps) > 0).length,
    0,
  );
}

export function elapsedSeconds(startedAt, now = Date.now()) {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

// 1h 05m · 12m 30s · 45s
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

// Stopwatch style: 12:34 or 1:12:34
export function formatStopwatch(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function roundVolume(value) {
  return Math.round(toNumber(value));
}

// Most recent recorded set for each exercise: { name: { weight, reps, date } }
export function lastPerformance(sessions) {
  const map = new Map();
  const ordered = [...(sessions || [])].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
  for (const session of ordered) {
    for (const exercise of session.exercises || []) {
      if (map.has(exercise.name)) continue;
      const done = [...(exercise.sets || [])]
        .reverse()
        .find((s) => toNumber(s.reps) > 0);
      if (!done) continue;
      map.set(exercise.name, {
        weight: toNumber(done.weight),
        reps: toNumber(done.reps),
        date: session.started_at,
      });
    }
  }
  return map;
}

// Heaviest set ever recorded for each exercise.
export function personalRecords(sessions) {
  const map = new Map();
  for (const session of sessions || []) {
    for (const exercise of session.exercises || []) {
      for (const set of exercise.sets || []) {
        const weight = toNumber(set.weight);
        const reps = toNumber(set.reps);
        if (reps <= 0 || weight <= 0) continue;
        const current = map.get(exercise.name);
        if (!current || weight > current.weight) {
          map.set(exercise.name, {
            name: exercise.name,
            muscle: exercise.muscle,
            weight,
            reps,
            date: session.started_at,
          });
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Monday as the first day of the week.
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return d;
}

export function weekStats(sessions, now = new Date()) {
  const from = startOfWeek(now).getTime();
  const rows = (sessions || []).filter(
    (s) => new Date(s.started_at).getTime() >= from,
  );
  return {
    count: rows.length,
    volume: rows.reduce((sum, s) => sum + toNumber(s.total_volume_kg), 0),
    sets: rows.reduce((sum, s) => sum + toNumber(s.total_sets), 0),
    minutes: rows.reduce((sum, s) => sum + toNumber(s.duration_min), 0),
  };
}

// Consecutive days with at least one workout. A missing workout today does not
// break the streak yet (the day is not over), but yesterday must be covered.
export function trainingStreak(sessions, now = new Date()) {
  const days = new Set(
    (sessions || []).map((s) => dayKey(new Date(s.started_at))).filter(Boolean),
  );
  if (days.size === 0) return 0;

  let cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function summarizeExercises(exercises) {
  return (exercises || [])
    .filter((ex) => (ex.sets || []).some((s) => toNumber(s.reps) > 0))
    .map((ex) => {
      const done = (ex.sets || []).filter((s) => toNumber(s.reps) > 0);
      const top = done.reduce(
        (best, s) => (toNumber(s.weight) > toNumber(best?.weight ?? -1) ? s : best),
        done[0],
      );
      return {
        name: ex.name,
        sets: done.length,
        topWeight: top ? toNumber(top.weight) : 0,
        topReps: top ? toNumber(top.reps) : 0,
      };
    });
}
