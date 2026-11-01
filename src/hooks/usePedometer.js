import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// expo-sensors is a native module. Loading it lazily keeps the web bundle
// working and lets us fall back to manual step entry everywhere else.
let Pedometer = null;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  Pedometer = require('expo-sensors').Pedometer ?? null;
} catch {
  Pedometer = null;
}

// Watches the phone's step counter while `enabled` is true and reports the
// number of steps taken since the watcher started. The screen adds those to
// whatever is already stored for the day.
export function usePedometer(enabled, onDelta) {
  const [status, setStatus] = useState('idle');
  const callbackRef = useRef(onDelta);
  callbackRef.current = onDelta;

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return undefined;
    }
    if (Platform.OS === 'web' || !Pedometer) {
      setStatus('unsupported');
      return undefined;
    }

    let cancelled = false;
    let subscription = null;
    let last = null;

    const start = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        if (!available) {
          setStatus('unsupported');
          return;
        }

        if (typeof Pedometer.requestPermissionsAsync === 'function') {
          const permission = await Pedometer.requestPermissionsAsync();
          if (cancelled) return;
          if (!permission?.granted) {
            setStatus('denied');
            return;
          }
        }

        setStatus('watching');
        subscription = Pedometer.watchStepCount(({ steps }) => {
          const value = Number(steps) || 0;
          if (last == null) {
            last = value;
            return;
          }
          const delta = value - last;
          last = value;
          if (delta > 0) callbackRef.current(delta);
        });
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    start();

    return () => {
      cancelled = true;
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
      subscription = null;
    };
  }, [enabled]);

  return status;
}
