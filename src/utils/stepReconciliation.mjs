export function getEffectiveSteps({ stepsProvider, stepsManual = 0, stepsAdjustment = 0 } = {}) {
  const provider = stepsProvider == null ? null : Number(stepsProvider);
  const fallback = Number(stepsManual) || 0;
  const adjustment = Number(stepsAdjustment) || 0;
  const base = Number.isFinite(provider) ? Math.max(0, provider) : Math.max(0, fallback);
  return Math.max(0, Math.round(base + adjustment));
}
