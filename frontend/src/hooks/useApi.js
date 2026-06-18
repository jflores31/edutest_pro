import { useState, useEffect, useCallback, useRef } from 'react'

// Runs an async api call on mount (and when deps change). Returns { data, loading, error, reload }.
export function useApi(apiCall, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const callRef = useRef(apiCall)
  callRef.current = apiCall

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await callRef.current()
      setData(result)
      return result
    } catch (e) {
      setError(e)
      return null
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    callRef.current()
      .then((r) => { if (active) setData(r) })
      .catch((e) => { if (active) setError(e) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload: run }
}
