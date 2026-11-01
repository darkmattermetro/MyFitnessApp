// Date helpers shared by the Today, Food, History and Weight screens.
// Everything here works with the device's local timezone: a "day" is the
// calendar day the user is living in, not a UTC day.

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// YYYY-MM-DD in local time. Used as the key for daily_activity rows.
export function dayKey(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Inverse of dayKey. Parses as local midnight (new Date('YYYY-MM-DD') is UTC).
export function parseDayKey(key) {
  if (!key) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  return dayKey(a) === dayKey(b);
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function startOfDayIso(date = new Date()) {
  return startOfDay(date).toISOString();
}

export function endOfDayIso(date = new Date()) {
  return endOfDay(date).toISOString();
}

// "Today", "Yesterday", "Monday, Oct 26"
export function formatDayTitle(date) {
  if (!date) return '';
  if (isToday(date)) return 'Today';
  if (isSameDay(date, addDays(new Date(), -1))) return 'Yesterday';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

// "Monday, October 26"
export function formatDayLong(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// "Oct 26"
export function formatMonthDay(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "08:30"
export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
