// Componentes visuales propios del Tema 1.
import type { ReactNode } from 'react'
import './errores.css'
import { FORMATS, type Prec } from './float'

/** Cajas de bits coloreadas (signo / exponente / fracción). Clic para invertir un bit. */
export function Bits({ bits, prec, onToggle, labels }: { bits: string; prec: Prec; onToggle?: (i: number) => void; labels?: { sign?: ReactNode; exp?: ReactNode; man?: ReactNode } }) {
  const F = FORMATS[prec]
  const compact = prec === 64
  const cell = (i: number, cls: string, weight: string, nib = false) => (
    <button
      key={i}
      type="button"
      className={'bit ' + cls + (bits[i] === '1' ? ' on' : '') + (nib ? ' nib' : '')}
      title={`bit ${F.bits - 1 - i} · ${weight}${onToggle ? ' · clic para invertir' : ''}`}
      onClick={() => onToggle?.(i)}
      disabled={!onToggle}
    >
      {bits[i]}
    </button>
  )
  const exp = Array.from({ length: F.w }, (_, k) => cell(1 + k, 'err-exp', `exponente, peso 2^${F.w - 1 - k}`, (F.w - k - 1) % 4 === 0 && k < F.w - 1))
  const man = Array.from({ length: F.m }, (_, k) => cell(1 + F.w + k, 'err-man', `fracción, peso 2^-${k + 1}`, (F.m - k - 1) % 4 === 0 && k < F.m - 1))
  return (
    <div className="bitrow">
      <div className="bitgroup err-sign">
        <div className={'bitcells' + (compact ? ' compact' : '')}>{cell(0, 'err-sign', 'signo')}</div>
        <div className="bitlabel">Signo {labels?.sign && <span className="sub">{labels.sign}</span>}</div>
      </div>
      <div className="bitgroup err-exp">
        <div className={'bitcells' + (compact ? ' compact' : '')}>{exp}</div>
        <div className="bitlabel">
          Exponente ({F.w} bits) {labels?.exp && <span className="sub">{labels.exp}</span>}
        </div>
      </div>
      <div className="bitgroup grow err-man">
        <div className={'bitcells' + (compact ? ' compact' : '')}>{man}</div>
        <div className="bitlabel">
          Fracción / mantisa ({F.m} bits) {labels?.man && <span className="sub">{labels.man}</span>}
        </div>
      </div>
    </div>
  )
}

/** Control segmentado simple. */
export function Seg<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Muestra la expansión decimal exacta coloreando en verde los dígitos que coinciden con el valor
 * pretendido y en rojo desde el primero que difiere.
 */
export function ExactDigits({ exact, intended, max = 400 }: { exact: string; intended?: string | null; max?: number }) {
  let shown = exact
  let cut = false
  if (shown.length > max) {
    shown = shown.slice(0, max)
    cut = true
  }
  if (!intended) return <div className="exact">{shown}{cut && <span className="dim">… ({exact.length} caracteres)</span>}</div>
  // alinear: comparar carácter a carácter (ambos en notación posicional)
  const a = shown
  const b = intended.includes('.') || !a.includes('.') ? intended : intended + '.'
  let k = 0
  while (k < a.length && (a[k] === b[k] || (b[k] === undefined && a[k] === '0'))) k++
  // si todo el sobrante son ceros coinciden
  return (
    <div className="exact">
      <span className="ok">{a.slice(0, k)}</span>
      <span className="bad">{a.slice(k)}</span>
      {cut && <span className="dim">… ({exact.length} caracteres)</span>}
    </div>
  )
}

/** Lista clave-valor compacta. */
export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <div className="kv">
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div className="k">{k}</div>
          <div className="v">{v}</div>
        </div>
      ))}
    </div>
  )
}

/** Campo de texto libre (para números especiales como NaN, Infinity, -0 que NumField no acepta). */
export function TextField({ label, value, onChange, hint, invalid, placeholder, preview, palette = 'num' }: { label: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode; invalid?: boolean; placeholder?: string; preview?: ReactNode; palette?: 'num' | 'off' }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className={'input mono' + (invalid ? ' invalid' : '')} data-palette={palette} value={value} placeholder={placeholder} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(e) => onChange(e.target.value)} />
      {preview && <span className="field-preview mono">{preview}</span>}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function LostDigits({ d }: { d: number }) {
  if (!Number.isFinite(d) || d < 0.5) return <span className="lost lo">0</span>
  return <span className={'lost ' + (d >= 8 ? 'hi' : d >= 3 ? 'mid' : 'lo')}>{d.toFixed(1)}</span>
}
