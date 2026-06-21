import { useState, useEffect } from 'react';

export function useCountUp(target, { duration = 600, decimals = 0 } = {}) {
  const [value, setValue] = useState(0);
  const num = Number(target) || 0;
  useEffect(() => {
    if (num === 0) { setValue(0); return; }
    const start = Date.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const factor = Math.pow(10, decimals);
    let rafId;
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setValue(Math.round(num * easeOut(p) * factor) / factor);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [num, decimals, duration]);
  return value;
}