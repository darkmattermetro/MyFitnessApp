// Connectivity errors: turn transport failures into short, standard messages.
// Screens, the Supabase client and Gemini all use this so users never see raw
// text such as "TypeError: fetch failed" or "Failed to fetch".

export const NO_INTERNET =
  'No internet connection. Check your network and try again.';
export const TIMEOUT =
  'The connection timed out. Check your internet and try again.';
export const SERVER_UNAVAILABLE =
  'The service is temporarily unavailable. Please try again in a moment.';

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

// Fragments produced by browsers, React Native, Node/undici, DNS resolvers and
// Supabase when the device cannot reach the network.
const OFFLINE_PATTERNS = [
  /failed to fetch/,
  /network request failed/,
  /fetch failed/,
  /network error/,
  /networkerror/,
  /load failed/,
  /enotfound/,
  /econnrefused/,
  /econnreset/,
  /econnaborted/,
  /ehostunreach/,
  /enetunreach/,
  /eai_again/,
  /getaddrinfo/,
  /unknownhost/,
  /unable to resolve host/,
  /no address associated with hostname/,
  /nodename nor servname/,
  /network is unreachable/,
  /connection abort/,
  /could not connect/,
  /connection (?:refused|reset|closed|aborted|failed)/,
  /server not found/,
  /internet connection appears to be offline/,
  /no internet/,
  /not connected to the internet/,
  /offline/,
];

const TIMEOUT_PATTERNS = [
  /timed out/,
  /timeout/,
  /took too long/,
  /etimedout/,
];

const UNAVAILABLE_PATTERNS = [
  /service unavailable/,
  /temporarily unavailable/,
  /bad gateway/,
  /gateway timeout/,
  /project is paused/,
  /project is being restored/,
  /connection pool/,
];

function collectText(error) {
  if (!error) return '';
  const parts = [];
  const seen = new Set();
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current === 'string' || typeof current === 'number') {
      parts.push(String(current));
      break;
    }
    if (typeof current !== 'object' || seen.has(current)) break;
    seen.add(current);
    parts.push(
      current.name,
      current.message,
      current.details,
      current.hint,
      current.code,
      current.status,
    );
    // fetch implementations hide the useful cause one level down.
    current = current.cause || current.error || null;
  }
  try {
    parts.push(JSON.stringify(error));
  } catch {
    // Ignore values that cannot be serialized (circular or DOM objects).
  }
  return parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(' ')
    .toLowerCase();
}

export function isOfflineError(error) {
  if (!error) return false;
  if (error.name === 'FunctionsFetchError') return true;
  if (error.name === 'AuthRetryableFetchError' && Number(error.status || 0) === 0) return true;
  if (Number(error.status || 0) === 0 && error.status !== undefined) return true;
  if (typeof error === 'string' && OFFLINE_PATTERNS.some((pattern) => pattern.test(error.toLowerCase()))) {
    return true;
  }
  const text = collectText(error);
  return OFFLINE_PATTERNS.some((pattern) => pattern.test(text));
}

export function isTimeoutError(error) {
  if (!error || error.name === 'AbortError') return false;
  const text = collectText(error);
  return TIMEOUT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isUnavailableError(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || 0);
  if (status >= 500 && status <= 599) return true;
  const text = collectText(error);
  return UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(text));
}

// Web browsers expose a reliable flag. React Native does not, so native keeps
// trying the request and lets isOfflineError classify the failure.
export function isOnline() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
  } catch {
    // Access can throw in exotic sandboxes; assume online.
  }
  return true;
}

export function friendlyError(error, fallback = DEFAULT_FALLBACK) {
  // Timeouts first: auth transport errors also report status 0, which looks
  // like an offline error even when the request reached the server too slowly.
  if (isTimeoutError(error)) return TIMEOUT;
  if (isOfflineError(error)) return NO_INTERNET;
  if (isUnavailableError(error)) return SERVER_UNAVAILABLE;
  const message = error?.message;
  const raw =
    typeof message === 'string' ? message.trim() : typeof error === 'string' ? error.trim() : '';
  const cleaned = raw.replace(
    /^(?:error|typeerror|fetcherror|networkerror|authretryablefetcherror|authapierror|functionsfetcherror|functionshttperror|functionsrelayerror):\s*/i,
    '',
  );
  return cleaned || fallback;
}
