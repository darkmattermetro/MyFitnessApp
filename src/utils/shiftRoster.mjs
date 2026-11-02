const REQUIRED_REST_MS = 12 * 60 * 60 * 1000;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseCsvRow(line) {
  return line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
}

export function parseShiftRoster(csv, now = Date.now()) {
  const lines = String(csv || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Paste a header row and at least one shift row.');
  const headers = parseCsvRow(lines[0]).map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  const signOffIndex = headers.findIndex((value) => ['sign_off', 'signoff', 'off_duty'].includes(value));
  const signOnIndex = headers.findIndex((value) => ['next_sign_on', 'next_signon', 'next_on_duty'].includes(value));
  if (signOffIndex < 0 || signOnIndex < 0) throw new Error('Use CSV headers sign_off and next_sign_on.');

  const eligible = [];
  let ignoredShort = 0;
  let skippedPast = 0;
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const columns = parseCsvRow(lines[lineIndex]);
    const signOffText = columns[signOffIndex] || '';
    const signOnText = columns[signOnIndex] || '';
    if (!ISO_WITH_ZONE.test(signOffText) || !ISO_WITH_ZONE.test(signOnText)) {
      throw new Error('Row ' + (lineIndex + 1) + ': use ISO 8601 timestamps with a time zone, for example 2026-11-02T19:00:00+05:30.');
    }
    const signOff = Date.parse(signOffText);
    const nextSignOn = Date.parse(signOnText);
    if (!Number.isFinite(signOff) || !Number.isFinite(nextSignOn) || nextSignOn <= signOff) {
      throw new Error('Row ' + (lineIndex + 1) + ': next_sign_on must be after sign_off.');
    }
    if (nextSignOn - signOff < REQUIRED_REST_MS) {
      ignoredShort += 1;
      continue;
    }
    const workoutAt = new Date(signOff + 60 * 60 * 1000);
    if (workoutAt.getTime() <= now || workoutAt.getTime() >= nextSignOn - 60 * 60 * 1000) {
      skippedPast += 1;
      continue;
    }
    eligible.push({
      signOff: new Date(signOff).toISOString(),
      nextSignOn: new Date(nextSignOn).toISOString(),
      workoutAt: workoutAt.toISOString(),
    });
  }
  return { eligible: eligible.slice(0, 30), ignoredShort, skippedPast, truncated: eligible.length > 30 };
}
