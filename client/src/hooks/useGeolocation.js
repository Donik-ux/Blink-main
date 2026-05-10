import { useEffect, useRef } from 'react';
import { useLocationStore } from '../store/locationStore.js';
import { useFriendStore } from '../store/friendStore.js';
import { useBatterySaver } from './useBatterySaver.js';
import { calculateDistance } from '../utils/geo.js';

const MIN_DELTA_M = 15;
const MIN_EMIT_INTERVAL_MS = 3000;
const SAVER_DELTA_M = 100;
const SAVER_EMIT_INTERVAL_MS = 30000;

export const useGeolocation = (socket) => {
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(null);
  const setMyLocation = useLocationStore((state) => state.setMyLocation);
  const ghostMode = useFriendStore((state) => state.ghostMode);
  const batterySaver = useBatterySaver();

  useEffect(() => {
    if (!navigator.geolocation) return;

    const minDelta = batterySaver ? SAVER_DELTA_M : MIN_DELTA_M;
    const minInterval = batterySaver ? SAVER_EMIT_INTERVAL_MS : MIN_EMIT_INTERVAL_MS;

    const onPosition = (position) => {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;

      setMyLocation({ lat: latitude, lng: longitude, accuracy, speed, heading });

      const last = lastSentRef.current;
      const now = Date.now();
      const dist = calculateDistance(last?.lat, last?.lng, latitude, longitude);
      const movedEnough = !last || !dist || dist.unit === 'км' || dist.value >= minDelta;
      const timeEnough = !last || now - last.t >= minInterval;

      if (!movedEnough && !timeEnough) return;

      if (socket && socket.connected) {
        lastSentRef.current = { lat: latitude, lng: longitude, t: now };
        socket.emit('update-location', {
          lat: latitude,
          lng: longitude,
          accuracy,
          speed: typeof speed === 'number' ? speed : null,
          heading: typeof heading === 'number' ? heading : null,
          ghostMode,
          batterySaver,
        });
      }
    };

    const onError = (error) => {
      console.error('Ошибка геолокации:', error.message || error);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: !batterySaver,
      timeout: 15000,
      maximumAge: batterySaver ? 30000 : 2000,
    });

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [socket, setMyLocation, ghostMode, batterySaver]);
};
