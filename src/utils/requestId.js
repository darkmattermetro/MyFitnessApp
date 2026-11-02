export function createRequestId(prefix = 'request') {
  const random = Math.random().toString(36).slice(2, 12);
  return prefix + '-' + Date.now().toString(36) + '-' + random;
}
