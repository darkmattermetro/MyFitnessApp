export function createDeadlineFetch({
  timeoutMs = 20000,
  timeoutMessage = 'The server took too long to respond. Check your connection and try again.',
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return async function fetchWithDeadline(input, init = {}) {
    const controller = new AbortController();
    const callerSignal = init.signal;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    };

    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      for (const method of ['json', 'text', 'arrayBuffer', 'blob', 'formData']) {
        if (typeof response[method] !== 'function') continue;
        const original = response[method].bind(response);
        try {
          Object.defineProperty(response, method, {
            configurable: true,
            value: (...args) => original(...args)
              .catch((error) => {
                if (timedOut) throw new Error(timeoutMessage);
                throw error;
              })
              .finally(cleanup),
          });
        } catch {
          cleanup();
          break;
        }
      }
      if (!response.body) cleanup();
      return response;
    } catch (error) {
      cleanup();
      if (timedOut) throw new Error(timeoutMessage);
      throw error;
    }
  };
}
