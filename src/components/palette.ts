// Colores de series para gráficas (Plotly) y leyendas.
// Mismo tono en ambos temas; en claro se usan variantes más oscuras para contraste ≥ 3:1 sobre blanco.
// SERIES es un arreglo compartido que ThemeProvider actualiza (in situ) al cambiar el tema, así los
// módulos que usan SERIES[i] al construir sus trazas obtienen el color adecuado sin cambiar nada.

/** teal, ámbar, violeta, rosa, azul, verde, rojo, amarillo */
export const SERIES_DARK = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#f87171', '#facc15'] as const
export const SERIES_LIGHT = ['#0d9488', '#d97706', '#7c3aed', '#db2777', '#2563eb', '#059669', '#dc2626', '#a16207'] as const

const initialDark = typeof document === 'undefined' || document.documentElement.dataset.theme !== 'light'

export const SERIES: string[] = [...(initialDark ? SERIES_DARK : SERIES_LIGHT)]

export function applySeriesTheme(dark: boolean) {
  const src = dark ? SERIES_DARK : SERIES_LIGHT
  for (let i = 0; i < src.length; i++) SERIES[i] = src[i]
}
