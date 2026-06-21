/**
 * useApi.js — Hook genérico para llamadas a la API
 * Maneja loading, error, data y cancelación
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetchFn, deps = [], options = {}) {
  const { immediate = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  const execute = useCallback(async (...args) => {
    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(...args, { signal: controller.signal });
      if (mountedRef.current && !controller.signal.aborted) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
      throw err;
    }
  }, [fetchFn]);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
      execute();
    }
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally constrained
  }, deps);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { data, loading, error, execute, setData, cancel };
}

export default useApi;
