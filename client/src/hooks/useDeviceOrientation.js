import { useState, useEffect } from 'react';

// Возвращает heading в градусах (0..360, 0=север). null если не поддерживается.
// На iOS требует requestPermission().
export const useDeviceOrientation = (enabled = true) => {
  const [heading, setHeading] = useState(null);
  const [permission, setPermission] = useState(
    typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
      ? 'pending'
      : 'granted'
  );

  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    const handler = (e) => {
      // iOS: webkitCompassHeading даёт реальный compass heading
      const h =
        typeof e.webkitCompassHeading === 'number'
          ? e.webkitCompassHeading
          : e.alpha != null
          ? 360 - e.alpha
          : null;
      if (h != null && !isNaN(h)) {
        setHeading(h);
      }
    };

    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }, [enabled, permission]);

  const requestPermission = async () => {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        setPermission(r);
        return r === 'granted';
      } catch {
        setPermission('denied');
        return false;
      }
    }
    return true;
  };

  return { heading, permission, requestPermission };
};
