import { useEffect, useState } from 'react'

/** useState que persiste en localStorage (por clave). Útil para que cada método recuerde sus entradas. */
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const k = 'numlab:' + key
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(k)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* sin almacenamiento: ignorar */
    }
  }, [k, v])
  return [v, setV]
}

/** Valor con retardo (para no recalcular en cada tecla). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}
