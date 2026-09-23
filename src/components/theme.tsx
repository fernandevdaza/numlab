import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useLocalState } from '../lib/useLocalState'
import { setDigits } from '../lib/format'
import { applySeriesTheme } from './palette'

interface ThemeCtx {
  dark: boolean
  toggle: () => void
  digits: number
  setDigits: (d: number) => void
}
const Ctx = createContext<ThemeCtx>({ dark: true, toggle: () => {}, digits: 8, setDigits: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useLocalState('dark', window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  const [digits, setD] = useLocalState('digits', 8)
  setDigits(digits)
  applySeriesTheme(dark)
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    // barra del navegador (móvil) acorde al tema elegido, no sólo al del sistema
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.content = dark ? '#0b0f14' : '#f7f6f2'
    })
  }, [dark])
  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark(!dark), digits, setDigits: setD }}>{children}</Ctx.Provider>
  )
}
export const useTheme = () => useContext(Ctx)
