// Componentes de interfaz compartidos por todos los módulos.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react'
import { Tex } from './Tex'
import { compile, evalNumber, type CompileResult } from '../lib/expr'
import { fmt } from '../lib/format'
import { useTheme } from './theme'
import { IconCheck, IconChevronRight, IconCopy, IconDownload } from './icons'

/* ───────────────────────── Layout ───────────────────────── */

interface MethodPageProps {
  title: string
  /** Etiqueta corta del tema, p.ej. "Tema 2 · Ecuaciones no lineales" */
  topic?: string
  description?: ReactNode
  /** Teoría: fórmulas, hipótesis de convergencia, error. Se muestra plegable. */
  theory?: ReactNode
  /** Formulario de parámetros (columna izquierda). */
  inputs: ReactNode
  /** Resultados (columna derecha). */
  children: ReactNode
}

export function MethodPage({ title, topic, description, theory, inputs, children }: MethodPageProps) {
  return (
    <div className="method">
      <header className="method-head">
        {topic && <div className="eyebrow">{topic}</div>}
        <h1>{title}</h1>
        {description && <p className="lead">{description}</p>}
      </header>
      {theory && <Theory>{theory}</Theory>}
      <div className="method-grid">
        <aside className="inputs card">
          <div className="card-title">Parámetros</div>
          <div className="fields">{inputs}</div>
        </aside>
        <section className="results">{children}</section>
      </div>
    </div>
  )
}

export function Theory({ children, title = 'Teoría y fórmulas', defaultOpen = false }: { children: ReactNode; title?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section className={'theory card' + (open ? ' open' : '')} aria-label={title}>
      <button type="button" className="theory-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="chev" aria-hidden="true">
          <IconChevronRight size={15} />
        </span>
        <span className="theory-icon" aria-hidden="true">
          ƒ
        </span>
        <span>{title}</span>
        <span className="theory-hint">{open ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      {open && (
        <div className="theory-body" id={id}>
          {children}
        </div>
      )}
    </section>
  )
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={'card ' + (className ?? '')}>
      {(title || actions) && (
        <div className="card-head">
          {title && <div className="card-title">{title}</div>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const icon = { info: 'ℹ', warn: '⚠', error: '✕', ok: '✓' }[kind]
  return (
    <div className={'alert ' + kind}>
      <span className="alert-icon" aria-hidden="true">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  )
}

/** Fila de indicadores grandes (resultado principal, iteraciones, error...). */
export function Stats({ items }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }[] }) {
  return (
    <div className="stats">
      {items.map((it, i) => (
        <div key={i} className={'stat' + (it.accent ? ' accent' : '')}>
          <div className="stat-label">{it.label}</div>
          <StatValue>{it.value}</StatValue>
          {it.hint && <div className="stat-hint">{it.hint}</div>}
        </div>
      ))}
    </div>
  )
}

const STAT_SIZES = ['', 'long', 'xlong'] as const

/**
 * Valor de un indicador que reduce su tamaño de letra si no cabe en una línea
 * (números largos como -1.23456789012e-15 o fórmulas TeX). Si ni el tamaño menor
 * cabe, se permite el salto de línea (overflow-wrap en CSS).
 */
function StatValue({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)
  const fit = () => {
    const el = ref.current
    if (!el || !el.clientWidth) return
    const prevWS = el.style.whiteSpace
    el.style.whiteSpace = 'nowrap'
    let k = 0
    for (; k < STAT_SIZES.length; k++) {
      el.classList.remove('long', 'xlong')
      if (STAT_SIZES[k]) el.classList.add(STAT_SIZES[k])
      if (el.scrollWidth <= el.clientWidth + 1) break
    }
    el.style.whiteSpace = prevWS
    setSize(Math.min(k, STAT_SIZES.length - 1))
  }
  // Re-medir cuando cambia el contenido…
  useLayoutEffect(fit)
  // …o el ancho de la tarjeta.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let w = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth
        fit()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={ref} className={'stat-value' + (STAT_SIZES[size] ? ' ' + STAT_SIZES[size] : '')}>
      {children}
    </div>
  )
}

/** Desarrollo paso a paso: lista de líneas en TeX con texto opcional. */
export function Steps({ steps }: { steps: { text?: ReactNode; tex?: string }[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          {s.text && <div className="step-text">{s.text}</div>}
          {s.tex && <Tex block>{s.tex}</Tex>}
        </li>
      ))}
    </ol>
  )
}

export function Tabs({ tabs, initial = 0 }: { tabs: { label: string; content: ReactNode }[]; initial?: number }) {
  const [i, setI] = useState(initial)
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const cur = Math.max(0, Math.min(i, tabs.length - 1))
  const onKey = (e: RKeyboardEvent, k: number) => {
    const n = tabs.length
    const j = e.key === 'ArrowRight' ? (k + 1) % n : e.key === 'ArrowLeft' ? (k - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (j < 0) return
    e.preventDefault()
    setI(j)
    refs.current[j]?.focus()
  }
  return (
    <div className="tabs">
      <div className="tab-bar" role="tablist">
        {tabs.map((t, k) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[k] = el
            }}
            type="button"
            role="tab"
            id={`${id}-t${k}`}
            aria-selected={k === cur}
            aria-controls={`${id}-p`}
            tabIndex={k === cur ? 0 : -1}
            className={k === cur ? 'active' : ''}
            onClick={() => setI(k)}
            onKeyDown={(e) => onKey(e, k)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t${cur}`}>
        {tabs[cur]?.content}
      </div>
    </div>
  )
}

/* ───────────────────────── Campos ───────────────────────── */

interface ExprFieldProps {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  vars?: string[]
  placeholder?: string
  hint?: ReactNode
  /** prefijo TeX mostrado antes de la vista previa, p. ej. "f(x) =" */
  texPrefix?: string
}

/** Campo para una expresión en función de variables, con vista previa TeX y validación. */
export function ExprField({ label, value, onChange, vars = ['x'], placeholder, hint, texPrefix }: ExprFieldProps) {
  const res = useMemo(() => compile(value, vars), [value, vars.join(',')])
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className={'input mono' + (res.ok || !value ? '' : ' invalid')}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-invalid={!res.ok && !!value}
        data-palette="expr"
        data-vars={vars.join(',')}
        onChange={(e) => onChange(e.target.value)}
      />
      {res.ok ? (
        <span className="field-preview">
          <Tex>{(texPrefix ? texPrefix + ' ' : '') + res.tex}</Tex>
        </span>
      ) : value ? (
        <span className="field-error" role="status">
          {res.error}
        </span>
      ) : null}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Campo numérico que acepta expresiones constantes (pi/2, sqrt(3), 1e-6). */
export function NumField({ label, value, onChange, hint, placeholder }: { label: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode; placeholder?: string }) {
  const v = evalNumber(value)
  const isPlain = /^\s*-?\d*\.?\d+(e-?\d+)?\s*$/i.test(value)
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className={'input mono' + (Number.isFinite(v) || !value ? '' : ' invalid')}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        inputMode="text"
        aria-invalid={!Number.isFinite(v) && !!value}
        data-palette="num"
        onChange={(e) => onChange(e.target.value)}
      />
      {!isPlain && Number.isFinite(v) && <span className="field-preview mono">= {fmt(v, 12)}</span>}
      {!Number.isFinite(v) && value && <span className="field-error">Número inválido</span>}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function IntField({ label, value, onChange, min = 0, max = 10000, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input mono"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value))
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function SelectField<T extends string>({ label, value, onChange, options, hint }: { label: ReactNode; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function CheckField({ label, value, onChange }: { label: ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>
}

/** Ejemplos precargados: botones que rellenan el formulario. */
export function Examples<T>({ items, onPick }: { items: { label: string; value: T }[]; onPick: (v: T) => void }) {
  return (
    <div className="examples">
      <span className="field-label">Ejemplos</span>
      <div className="chips">
        {items.map((it, i) => (
          <button key={i} type="button" className="chip" onClick={() => onPick(it.value)}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────── Matrices ───────────────────────── */

/** Parsea texto "1 2 3; 4 5 6" o filas por línea. Admite expresiones (pi, sqrt(2)). */
export function parseMatrix(src: string): number[][] | null {
  const rows = src
    .trim()
    .split(/\s*[;\n]\s*/)
    .filter((r) => r.trim().length)
  if (!rows.length) return null
  const M = rows.map((r) =>
    r
      .trim()
      .replace(/^\[|\]$/g, '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((t) => evalNumber(t)),
  )
  if (M.some((r) => r.length !== M[0].length || r.some((v) => !Number.isFinite(v)))) return null
  return M
}
export function parseVector(src: string): number[] | null {
  const t = src.trim().replace(/^\[|\]$/g, '')
  if (!t) return null
  const v = t
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((s) => evalNumber(s))
  return v.some((x) => !Number.isFinite(x)) ? null : v
}
export function matrixToText(M: number[][]): string {
  return M.map((r) => r.join(' ')).join('\n')
}

/** Editor de matriz como texto: filas separadas por salto de línea o ';'. */
export function MatrixField({ label, value, onChange, hint, rows = 4 }: { label: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode; rows?: number }) {
  const M = parseMatrix(value)
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea className={'input mono matrix' + (M || !value ? '' : ' invalid')} rows={rows} value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-invalid={!M && !!value} data-palette="matrix" onChange={(e) => onChange(e.target.value)} />
      {M ? (
        <span className="field-preview">
          <Tex>{texMatrix(M)}</Tex>
        </span>
      ) : value ? (
        <span className="field-error">Matriz inválida: todas las filas deben tener el mismo número de valores</span>
      ) : null}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function VectorField({ label, value, onChange, hint }: { label: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode }) {
  const v = parseVector(value)
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className={'input mono' + (v || !value ? '' : ' invalid')} value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" aria-invalid={!v && !!value} data-palette="num" onChange={(e) => onChange(e.target.value)} />
      {!v && value && <span className="field-error">Vector inválido</span>}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Matriz (o vector columna) en TeX. */
export function texMatrix(M: number[][] | number[], digits = 6, env = 'bmatrix'): string {
  const rows = Array.isArray(M[0]) ? (M as number[][]) : (M as number[]).map((x) => [x])
  return `\\begin{${env}}` + rows.map((r) => r.map((x) => fmt(x, digits).replace('e', '\\text{e}')).join(' & ')).join(' \\\\ ') + `\\end{${env}}`
}

/* ───────────────────────── Tabla de datos ───────────────────────── */

export interface Column<R> {
  key: string
  /** Encabezado en TeX (p.ej. "x_n", "|x_{n+1}-x_n|") */
  tex?: string
  label?: string
  get?: (r: R, i: number) => ReactNode
  /** formato numérico: 'num' (cifras significativas), 'err' (científica), 'int' */
  fmt?: 'num' | 'err' | 'int' | 'raw'
  align?: 'left' | 'right' | 'center'
}

export function DataTable<R extends Record<string, any>>({ columns, rows, highlightLast = false, maxHeight = 420, filename = 'tabla', highlight }: { columns: Column<R>[]; rows: R[]; highlightLast?: boolean; maxHeight?: number; filename?: string; highlight?: (r: R, i: number) => boolean }) {
  const { digits } = useTheme()
  const cell = (c: Column<R>, r: R, i: number): ReactNode => {
    if (c.get) return c.get(r, i)
    const v = r[c.key]
    if (typeof v !== 'number') return v ?? '—'
    if (c.fmt === 'err') return v === 0 ? '0' : Number.isFinite(v) ? v.toExponential(3) : fmt(v)
    if (c.fmt === 'int') return String(v)
    if (c.fmt === 'raw') return String(v)
    return fmt(v, digits)
  }
  const csv = () => {
    const q = (s: string) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s)
    const head = columns.map((c) => q(c.label ?? c.tex ?? c.key)).join(',')
    const body = rows
      .map((r, i) =>
        columns
          .map((c) => {
            const raw = r[c.key]
            if (typeof raw === 'number') return String(raw)
            if (c.get) {
              const g = c.get(r, i)
              return typeof g === 'number' ? String(g) : typeof g === 'string' ? q(g) : ''
            }
            return q(String(raw ?? ''))
          })
          .join(','),
      )
      .join('\n')
    // BOM para que Excel detecte UTF-8 (acentos, símbolos griegos)
    download(filename + '.csv', '\ufeff' + head + '\n' + body, 'text/csv;charset=utf-8')
  }
  return (
    <div className="table-wrap">
      <div className="table-scroll" style={{ maxHeight }}>
        <table className="data">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" style={{ textAlign: c.align ?? 'right' }}>
                  {c.tex ? <Tex>{c.tex}</Tex> : c.label ?? c.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={(highlightLast && i === rows.length - 1) || highlight?.(r, i) ? 'hl' : ''}>
                {columns.map((c) => (
                  <td key={c.key} className="mono" style={{ textAlign: c.align ?? 'right' }}>
                    {cell(c, r, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>
          {rows.length} {rows.length === 1 ? 'fila' : 'filas'}
        </span>
        <button type="button" className="btn ghost sm" onClick={csv} title="Descargar la tabla como CSV (Excel)">
          <IconDownload size={14} /> CSV
        </button>
      </div>
    </div>
  )
}

/* ───────────────────────── Código Scilab ───────────────────────── */

export function download(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Bloque de código Scilab con botones copiar / descargar .sce */
export function ScilabCode({ code, filename = 'metodo' }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Card
      title={
        <>
          <span className="sci-badge">Scilab</span> Código equivalente
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(
                () => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1400)
                },
                () => {},
              )
            }}
            aria-live="polite"
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => download(filename + '.sce', code)} title="Descargar el script para Scilab">
            <IconDownload size={14} /> .sce
          </button>
        </>
      }
    >
      <pre className="code">
        <code>{highlightScilab(code)}</code>
      </pre>
    </Card>
  )
}

const SCI_KW = /\b(function|endfunction|for|end|while|if|then|else|elseif|return|break|continue|do|select|case)\b/
function highlightScilab(code: string): ReactNode[] {
  return code.split('\n').map((line, i) => {
    const ci = line.indexOf('//')
    const body = ci >= 0 ? line.slice(0, ci) : line
    const comment = ci >= 0 ? line.slice(ci) : ''
    const parts = body.split(/(\b(?:function|endfunction|for|end|while|if|then|else|elseif|return|break|continue|do|select|case)\b|'[^']*'|"[^"]*")/g)
    return (
      <span key={i}>
        {parts.map((p, k) =>
          SCI_KW.test(p) && /^\w+$/.test(p) ? (
            <span key={k} className="kw">
              {p}
            </span>
          ) : /^['"]/.test(p) ? (
            <span key={k} className="str">
              {p}
            </span>
          ) : (
            p
          ),
        )}
        {comment && <span className="com">{comment}</span>}
        {'\n'}
      </span>
    )
  })
}

/* ───────────────────────── Helpers ───────────────────────── */

/** Compila y devuelve la función o un mensaje de error; útil en useMemo. */
export function useCompiled(src: string, vars: string[] = ['x']): CompileResult {
  return useMemo(() => compile(src, vars), [src, vars.join(',')])
}
