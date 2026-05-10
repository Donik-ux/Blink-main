import { useEffect, useRef, useState } from 'react';

// Простой pull-to-refresh для мобильных. Работает на основе touch событий + scrollTop.
// Использование:
//   const { ref, pulling, distance } = usePullToRefresh(onRefresh);
//   <div ref={ref} ...> ... </div>
export const usePullToRefresh = (onRefresh, { threshold = 70 } = {}) => {
  const ref = useRef(null);
  const startY = useRef(0);
  const [distance, setDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTouchStart = (e) => {
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      setPulling(true);
    };
    const onTouchMove = (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        // Resist progressively
        const d = Math.min(threshold * 1.5, dy * 0.5);
        setDistance(d);
      }
    };
    const onTouchEnd = async () => {
      if (!pulling) return;
      if (distance >= threshold && onRefresh) {
        setRefreshing(true);
        try { await onRefresh(); } finally { setRefreshing(false); }
      }
      setDistance(0);
      setPulling(false);
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pulling, distance, threshold, onRefresh]);

  return { ref, pulling, distance, refreshing };
};
