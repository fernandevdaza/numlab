// Utilidades compartidas por las páginas del Tema 5.
import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { Alert } from '../../components/ui'
import { L } from '../../i18n'
import { toScilab, toTex } from '../../lib/expr'
import { fmt, fmtErr, texNum } from '../../lib/format'
import type { Reference } from './exact'

/** Número en TeX con 10 cifras (para el paso a paso). */
export const N = (x: number, d = 10) => texNum(x, d)

/** Número dentro de una expresión TeX: entre paréntesis si es negativo. */
export const P = (x: number, d = 10) => (x < 0 ? `(${texNum(x, d)})` : texNum(x, d))

/** Límite escrito por el usuario → Scilab (pi → %pi, etc.). */
export const sci = (src: string) => toScilab(src.trim() || '0', false)

/** Límite escrito por el usuario → TeX (pi/2 → \\frac{\\pi}{2}). */
export const limTex = (src: string) => toTex(src.trim() || '0')

const cifras = (k: number) =>
  `≈ ${k} ${k === 1 ? L('cifra significativa', 'significant digit') : L('cifras significativas', 'significant digits')}`

/** Stats de valor de referencia y errores. */
export function refStats(approx: number, ref: Reference | null) {
  if (!ref || !Number.isFinite(ref.value)) return [{ label: L('Valor de referencia', 'Reference value'), value: '—', hint: ref?.label ?? L('no disponible', 'not available') }]
  const abs = Math.abs(approx - ref.value)
  const rel = ref.value !== 0 ? abs / Math.abs(ref.value) : NaN
  return [
    {
      label: ref.kind === 'simbolico' ? L('Valor exacto', 'Exact value') : L('Referencia numérica', 'Numerical reference'),
      value: fmt(ref.value, 15),
      hint: ref.kind === 'simbolico' ? L('antiderivada simbólica', 'symbolic antiderivative') : L('Gauss-Kronrod adaptativo', 'adaptive Gauss–Kronrod'),
    },
    { label: L('Error absoluto', 'Absolute error'), value: fmtErr(abs) },
    { label: L('Error relativo', 'Relative error'), value: Number.isFinite(rel) ? fmtErr(rel) : '—', hint: Number.isFinite(rel) && rel > 0 ? cifras(Math.max(0, Math.floor(-Math.log10(2 * rel)))) : undefined },
  ]
}

/** Aviso que explica de dónde sale el valor de referencia. */
export function RefNote({ ref }: { ref: Reference | null; integral?: string }) {
  if (!ref) return null
  if (ref.kind === 'ninguno') return <Alert kind="warn">{ref.label}</Alert>
  return (
    <Alert kind="info">
      <b>{ref.label}.</b>{' '}
      {ref.kind === 'simbolico' ? (
        <>
          {ref.antiTex && (
            <>
              {L('Antiderivada', 'Antiderivative')}: <Tex>{`F(x) = ${ref.antiTex}`}</Tex>.{' '}
            </>
          )}
          {ref.valueTex ? (
            <>
              {L('Valor exacto', 'Exact value')}: <Tex>{`I = F(b) - F(a) = ${ref.valueTex}${/^-?[\d.]+$/.test(ref.valueTex) ? '' : ` \\approx ${texNum(ref.value, 15)}`}`}</Tex>
            </>
          ) : (
            <>
              {L('Valor exacto', 'Exact value')} ≈ {fmt(ref.value, 15)}
            </>
          )}
        </>
      ) : (
        <>
          {L(
            'No se encontró una antiderivada elemental verificable; se usa integración adaptativa con error estimado',
            'No verifiable elementary antiderivative was found; adaptive integration is used, with estimated error',
          )}{' '}
          {fmtErr(ref.err ?? NaN)}.
        </>
      )}
    </Alert>
  )
}

/**
 * Suma ponderada en TeX: c₀·v₀ + c₁·v₁ + …, recortando el medio si hay muchos términos.
 * coefs enteros (o null para omitir el coeficiente).
 */
export function texWeightedSum(values: number[], coefs: (number | null)[], max = 9, digits = 8): string {
  const term = (i: number) => {
    const c = coefs[i]
    const v = P(values[i], digits)
    return c === null || c === 1 ? v : `${c}(${texNum(values[i], digits)})`
  }
  const idx = values.map((_, i) => i)
  const show = idx.length <= max ? idx : [...idx.slice(0, Math.ceil(max / 2)), -1, ...idx.slice(idx.length - Math.floor(max / 2))]
  return show.map((i) => (i === -1 ? '\\cdots' : term(i))).join(' + ')
}

/** Suma simbólica c₀f(x₀) + c₁f(x₁) + … recortada. */
export function texSymbolicSum(coefs: number[], max = 9, name = 'f(x_{%})'): string {
  const n = coefs.length
  const term = (i: number) => (coefs[i] === 1 ? '' : coefs[i]) + name.replace('%', String(i))
  const idx = coefs.map((_, i) => i)
  const show = n <= max ? idx : [...idx.slice(0, Math.ceil(max / 2)), -1, ...idx.slice(n - Math.floor(max / 2))]
  return show.map((i) => (i === -1 ? '\\cdots' : term(i))).join(' + ')
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
      {children}
    </p>
  )
}

