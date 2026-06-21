/**
 * useMediaQuery.js — Hook para detectar media queries
 * Usa useSyncExternalStore: el patrón idiomático para suscribirse a un store
 * externo (matchMedia) sin setState dentro de un efecto.
 */
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // SSR/initial fallback
  );
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 768px)');
}

export function useIsTablet() {
  return useMediaQuery('(max-width: 1024px)');
}

export default useMediaQuery;
