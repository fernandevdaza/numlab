import { TOPIC } from './theory'
import { L } from '../../i18n'
import { useMemo } from 'react'
import { Tex } from '../../components/Tex'
import { Alert, Card, Examples, FieldRow, IntField, MethodPage, ScilabCode, SelectField, Stats, Tabs } from '../../components/ui'
import { compile, compileDerivative } from '../../lib/expr'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import './errores.css'
import * as T from './decimal'

interface S {
  vars: string
  exprs: string
  t: number
  k: number
  round: T.DitRound
  norm?: T.DitNorm
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 1.15: √π', 'Ex. 1.15: √π'), value: { vars: 'x = pi', exprs: 'sqrt(x)' } },
  { label: L('Ej. 1.16: a / b', 'Ex. 1.16: a / b'), value: { vars: 'a = 3.2789e-4\nb = 4.07546e-5', exprs: 'a/b' } },
  { label: L('Ej. 1.17: (a·b)·c vs a·(b·c)', 'Ex. 1.17: (a·b)·c vs a·(b·c)'), value: { vars: 'a = 1.2789e-6\nb = 2.07546e-5\nc = 0.99917e5', exprs: '(a*b)*c\na*(b*c)' } },
  { label: L('Ej. 1.17: norma de un vector', 'Ex. 1.17: norm of a vector'), value: { vars: 'x = 1.2789e6\ny = 6.07546e4', exprs: 'sqrt(x^2 + y^2)\nabs(x)*sqrt(1 + (y/x)^2)' } },
  { label: L('Ej. 1.18: (eˣ − 1)/x', 'Ex. 1.18: (eˣ − 1)/x'), value: { vars: 'x = 1.4e-4', exprs: '(exp(x) - 1)/x\n1 + x/2' } },
  { label: L('Ej. 1.19: (sen x − x)/x²', 'Ex. 1.19: (sin x − x)/x²'), value: { vars: 'x = 1.4e-4', exprs: '(sin(x) - x)/x^2\n-x/6' } },
  { label: L('Ej. 1.20: raíces de x² − 26.075x + 0.99917', 'Ex. 1.20: roots of x² − 26.075x + 0.99917'), value: { vars: 'a = 1\nb = -26.075\nc = 0.99917', exprs: '(-b + sqrt(b^2 - 4*a*c))/(2*a)\n(-b - sqrt(b^2 - 4*a*c))/(2*a)\n(2*c)/(-b + sqrt(b^2 - 4*a*c))' } },
]

/* ─────────────── formato ─────────────── */

const num = (v: T.D, sd = 16): string => {
  if (v.isZero()) return '0'
  const s = v.toSignificantDigits(sd).toString()
  return s
}
const texNumD = (v: T.D, sd = 10): string => {
  if (v.isZero()) return '0'
  const [m, e] = v.toSignificantDigits(sd).toExponential().split('e')
  const ex = Number(e)
  return Math.abs(ex) <= 3 ? v.toSignificantDigits(sd).toString() : `${m}\\times 10^{${ex}}`
}
const relOf = (exact: T.D, approx: T.D): number => (exact.isZero() ? (approx.isZero() ? 0 : Infinity) : exact.minus(approx).abs().div(exact.abs()).toNumber())
const pct = (r: number) => (Number.isFinite(r) ? (r * 100).toPrecision(4).replace(/\.?0+$/, '') + ' %' : '—')

/* ─────────────── cálculo ─────────────── */

interface VarRow {
  name: string
  src: string
  value: T.D
  stored: T.StoredD
  rel: number
}

interface ExprRes {
  src: string
  tex: string
  error?: string
  trace: T.TraceRow[]
  machine?: T.D
  exact?: T.D
  withData?: T.D
  estProp?: number | null
}

function compute(s: S) {
  const M: T.DitMachine = { t: s.t, k: s.k, round: s.round, norm: s.norm ?? '0.d' }
  const vars: Record<string, T.D> = {}
  const varRows: VarRow[] = []
  for (const line of s.vars.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^([A-Za-z]\w*)\s*=\s*(.+)$/)
    if (!m) return { error: L(`Línea inválida: "${line}". Usa el formato  x = 3.2789e-4`, `Invalid line: "${line}". Use the format  x = 3.2789e-4`) }
    try {
      const v = T.dm.evaluate(T.parseExpr(m[2]).toString(), vars)
      if (!v || !v.isFinite?.()) return { error: L(`Valor inválido para ${m[1]}`, `Invalid value for ${m[1]}`) }
      vars[m[1]] = v
      const st = T.storeD(v, M)
      varRows.push({ name: m[1], src: m[2], value: v, stored: st, rel: relOf(v, st.value) })
    } catch {
      return { error: L(`No se pudo evaluar ${m[2]}`, `Could not evaluate ${m[2]}`) }
    }
  }
  const exprs: ExprRes[] = []
  for (const src of s.exprs.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6)) {
    let node
    try {
      node = T.parseExpr(src)
    } catch {
      exprs.push({ src, tex: src, error: L('Expresión inválida', 'Invalid expression'), trace: [] })
      continue
    }
    const tex = T.cleanTex(node.toTex({ parenthesis: 'auto' }))
    const r: ExprRes = { src, tex, trace: [] }
    try {
      r.exact = T.evalD(node, vars, M, 'exacto').value
      r.withData = T.evalD(node, vars, M, 'datos').value
    } catch (e: any) {
      r.error = e.message
    }
    try {
      const out = T.evalD(node, vars, M, 'maquina')
      r.trace = out.trace
      r.machine = T.storeD(out.value, M).value
    } catch (e: any) {
      r.error = e.message
      if (e instanceof T.MachineError) r.trace = e.trace
    }
    // error propagado estimado con f'(x_A)(x − x_A) para una variable
    const used = Object.keys(vars).filter((k) => new RegExp(`\\b${k}\\b`).test(src))
    if (used.length === 1 && r.withData) {
      const name = used[0]
      const c = compile(src, [name])
      const vr = varRows.find((v) => v.name === name)!
      if (c.ok && vr) {
        const d = compileDerivative(c, name)
        r.estProp = d.ok ? d.f(vr.stored.value.toNumber()) * vr.value.minus(vr.stored.value).toNumber() : null
      }
    }
    exprs.push(r)
  }
  return { M, varRows, exprs }
}

/* ─────────────── página ─────────────── */

export function Dits() {
  const [s, setS] = useLocalState<S>('errores:dits', { vars: 'x = pi', exprs: 'sqrt(x)', t: 4, k: 1, round: 'redondeo' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const calc = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <label className="field">
        <span className="field-label">{L('Datos (uno por línea)', 'Data (one per line)')}</span>
        <textarea className="input mono" rows={4} value={s.vars} spellCheck={false} onChange={(e) => set({ vars: e.target.value })} />
        <span className="field-hint">{L('x = 1.4e-4, a = pi, b = -26.075 … (valores exactos)', 'x = 1.4e-4, a = pi, b = -26.075 … (exact values)')}</span>
      </label>
      <label className="field">
        <span className="field-label">{L('Expresiones a calcular (una por línea)', 'Expressions to compute (one per line)')}</span>
        <textarea className="input mono" rows={4} value={s.exprs} spellCheck={false} onChange={(e) => set({ exprs: e.target.value })} />
        <span className="field-hint">
          {L(
            'Se evalúan de izquierda a derecha como la máquina: cada resultado intermedio se almacena. Usa paréntesis para cambiar el orden.',
            'They are evaluated left to right, as the machine does: every intermediate result is stored. Use parentheses to change the order.',
          )}
        </span>
      </label>
      <FieldRow>
        <IntField label={L('Dits de mantisa t', 'Mantissa dits t')} value={s.t} onChange={(t) => set({ t })} min={1} max={16} />
        <IntField label={L('Dits de exponente', 'Exponent dits')} value={s.k} onChange={(k) => set({ k })} min={1} max={3} />
      </FieldRow>
      <SelectField
        label={L('Normalización de la mantisa', 'Mantissa normalization')}
        value={s.norm ?? '0.d'}
        onChange={(norm) => set({ norm })}
        options={[
          { value: '0.d', label: L('0.d₁d₂d₃d₄ × 10ᵉ  (texto: punto antes del 1.er dígito)', '0.d₁d₂d₃d₄ × 10ᵉ  (textbook: point before the 1st digit)') },
          { value: 'd.d', label: L('d₁.d₂d₃d₄ × 10ᵉ  (punto después; t cifras en total)', 'd₁.d₂d₃d₄ × 10ᵉ  (point after; t digits in total)') },
          { value: 'd.d+', label: L('d₀.d₁d₂d₃d₄ × 10ᵉ  (punto después; t dits tras el punto)', 'd₀.d₁d₂d₃d₄ × 10ᵉ  (point after; t dits after the point)') },
        ]}
        hint={
          (s.norm ?? '0.d') === '0.d'
            ? L('Ejemplo: π → 0.3142 × 10¹ (4 cifras)', 'Example: π → 0.3142 × 10¹ (4 digits)')
            : s.norm === 'd.d'
              ? L('Ejemplo: π → 3.142 × 10⁰ (4 cifras; mismo valor, el exponente baja en 1)', 'Example: π → 3.142 × 10⁰ (4 digits; same value, the exponent drops by 1)')
              : L('Ejemplo: π → 3.1416 × 10⁰ (5 cifras: el dígito entero usa un dit extra)', 'Example: π → 3.1416 × 10⁰ (5 digits: the integer digit uses an extra dit)')
        }
      />
      <SelectField
        label={L('Almacenamiento', 'Storage')}
        value={s.round}
        onChange={(round) => set({ round })}
        options={[
          { value: 'redondeo', label: L('Redondeo (dígito t+1 ≥ 5 ⇒ sube)', 'Rounding (digit t+1 ≥ 5 ⇒ round up)') },
          { value: 'truncado', label: L('Truncado (cortado)', 'Chopping (truncation)') },
        ]}
      />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage
      title={L('Computadora decimal de 7 dits', '7-dit decimal computer')}
      topic={TOPIC}
      description={L(
        'El modelo de computadora decimal del texto: 2 dits para los signos, 1 para el exponente y 4 para la mantisa (±0.d₁d₂d₃d₄ × 10^±e). Cada operación se almacena; se separan el error propagado y el de redondeo.',
        'The textbook model of a decimal computer: 2 dits for the signs, 1 for the exponent and 4 for the mantissa (±0.d₁d₂d₃d₄ × 10^±e). Every operation is stored; the propagated error and the round-off error are separated.',
      )}
      theory={THEORY}
      inputs={inputs}
    >
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: Exclude<ReturnType<typeof compute>, { error: string }>; s: S }) {
  const { M, varRows, exprs } = c
  const mx = T.maxExp(M)
  return (
    <>
      {exprs.length > 1 && (
        <Card title={L('Comparación', 'Comparison')}>
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>{L('Expresión', 'Expression')}</th>
                    <th>{L('Máquina', 'Machine')}</th>
                    <th>{L('Exacto', 'Exact')}</th>
                    <th>{L('Error relativo', 'Relative error')}</th>
                    <th style={{ textAlign: 'center' }}>{L('Cifras sig. m', 'Sig. digits m')}</th>
                  </tr>
                </thead>
                <tbody>
                  {exprs.map((r, i) => {
                    const rel = r.machine && r.exact ? relOf(r.exact, r.machine) : NaN
                    return (
                      <tr key={i}>
                        <td style={{ textAlign: 'left' }}>
                          <Tex>{r.tex}</Tex>
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{r.machine ? T.plainStored(T.storeD(r.machine, M)) : <span style={{ color: 'var(--danger)' }}>{r.error?.startsWith('Overflow') ? 'overflow' : 'error'}</span>}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{r.exact ? num(r.exact, 12) : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{pct(rel)}</td>
                        <td className="mono" style={{ textAlign: 'center' }}>{Number.isFinite(rel) ? (rel === 0 ? '∞' : T.sigTexto(rel)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      <Card title={L('Datos almacenados en la máquina', 'Data stored in the machine')}>
        <div style={{ display: 'grid', gap: 14 }}>
          {varRows.map((v) => (
            <div key={v.name} className="dit-var">
              <div>
                <Tex>{`${v.name} = ${texNumD(v.value, 12)} \\;\\to\\; ${v.name}_A = ${T.texStored(v.stored)}`}</Tex>
                <div className="muted" style={{ fontSize: 12 }}>
                  {v.stored.status === 'overflow'
                    ? L('overflow: no se puede almacenar', 'overflow: cannot be stored')
                    : v.stored.status === 'underflow'
                      ? L('underflow: se almacena como 0', 'underflow: stored as 0')
                      : L(
                          `Eᵣ = ${v.rel === 0 ? '0 (exacto)' : v.rel.toExponential(3)} · m = ${v.rel === 0 ? '∞' : T.sigTexto(v.rel)} cifras significativas`,
                          `Eᵣ = ${v.rel === 0 ? '0 (exact)' : v.rel.toExponential(3)} · m = ${v.rel === 0 ? '∞' : T.sigTexto(v.rel)} significant digits`,
                        )}
                </div>
              </div>
              <DitWord s={v.stored} M={M} />
            </div>
          ))}
          {varRows.length === 0 && <span className="muted">{L('Sin datos.', 'No data.')}</span>}
        </div>
      </Card>

      {exprs.map((r, i) => (
        <ExprCard key={i} r={r} M={M} single={exprs.length === 1} />
      ))}

      <Card title={L('Propiedades de esta máquina', 'Properties of this machine')}>
        <div className="kv">
          <div className="k">{L('Palabra', 'Word')}</div>
          <div className="v">
            {L(
              `${T.totalDits(M)} dits = 2 signos + ${M.k} exponente + ${T.sigOf(M)} mantisa${M.norm === 'd.d+' ? ` (1 entero + ${M.t} tras el punto)` : ''}`,
              `${T.totalDits(M)} dits = 2 signs + ${M.k} exponent + ${T.sigOf(M)} mantissa${M.norm === 'd.d+' ? ` (1 integer + ${M.t} after the point)` : ''}`,
            )}
          </div>
          <div className="k">{L('Forma normalizada', 'Normalized form')}</div>
          <div className="v">{M.norm === '0.d' ? `±0.d₁…d${sub(M.t)} × 10^±e, d₁ ≠ 0` : M.norm === 'd.d' ? `±d₁.d₂…d${sub(M.t)} × 10^±e, d₁ ≠ 0` : `±d₀.d₁…d${sub(M.t)} × 10^±e, d₀ ≠ 0`}</div>
          <div className="k">{L('Rango del exponente', 'Exponent range')}</div>
          <div className="v">−{mx} ≤ e ≤ {mx}</div>
          <div className="k">{L('Número positivo más grande', 'Largest positive number')}</div>
          <div className="v">{M.norm === '0.d' ? '0.' + '9'.repeat(M.t) : '9.' + '9'.repeat(T.sigOf(M) - 1)} × 10^{mx}</div>
          <div className="k">{L('Número positivo más pequeño', 'Smallest positive number')}</div>
          <div className="v">{M.norm === '0.d' ? '0.1' + '0'.repeat(M.t - 1) : '1.' + '0'.repeat(T.sigOf(M) - 1)} × 10^−{mx}</div>
          <div className="k">{L('Error relativo máximo al almacenar', 'Maximum relative error when storing')}</div>
          <div className="v">{M.round === 'redondeo' ? `½·10^(1−${T.sigOf(M)}) = 5 × 10^−${T.sigOf(M)}` : `10^(1−${T.sigOf(M)}) = 10^−${T.sigOf(M) - 1}`}  ({L('cifras guardadas', 'digits kept')}: {T.sigOf(M)})</div>
        </div>
      </Card>

      <ScilabCode code={scilab(s, c)} filename="maquina_dits" />
    </>
  )
}

function DitWord({ s, M }: { s: T.StoredD; M: T.DitMachine }) {
  if (s.status === 'overflow' || s.status === 'underflow') return null
  const cells: { c: string; cls: string; lab: string }[] = [
    { c: s.neg ? '−' : '+', cls: 'err-sign', lab: 'σ' },
    { c: s.E < 0 ? '−' : '+', cls: 'err-sign', lab: "σ'" },
    ...String(Math.abs(s.E)).padStart(M.k, '0').split('').map((c) => ({ c, cls: 'err-exp', lab: 'e' })),
    ...s.digits.split('').map((c, i) => ({ c, cls: 'err-man', lab: `d${s.norm === 'd.d+' ? i : i + 1}` })),
  ]
  return (
    <div className="word">
      {cells.map((x, i) => (
        <div key={i} className={'word-cell ' + x.cls}>
          <span className="word-idx">{x.lab}</span>
          <span className={'bit on ' + x.cls}>{x.c}</span>
        </div>
      ))}
    </div>
  )
}

function ExprCard({ r, M, single }: { r: ExprRes; M: T.DitMachine; single: boolean }) {
  const machine = r.machine
  const exact = r.exact
  const withData = r.withData
  const rel = machine && exact ? relOf(exact, machine) : NaN
  const total = machine && exact ? exact.minus(machine) : null
  const prop = exact && withData ? exact.minus(withData) : null
  const red = withData && machine ? withData.minus(machine) : null
  const traceView = (
    <div className="table-wrap">
      <div className="table-scroll" style={{ maxHeight: 460 }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>#</th>
              <th style={{ textAlign: 'left' }}>{L('Se almacena', 'Stored item')}</th>
              <th>{L('Valor exacto', 'Exact value')}</th>
              <th>{L('Almacenado', 'Stored')}</th>
            </tr>
          </thead>
          <tbody>
            {r.trace.map((t, i) => (
              <tr key={i} className={t.stored.status !== 'ok' && t.stored.status !== 'cero' ? 'hl' : ''}>
                <td className="mono" style={{ textAlign: 'center' }}>{i + 1}</td>
                <td style={{ textAlign: 'left' }}>
                  <Tex>{(t.kind === 'dato' ? '' : '') + t.tex}</Tex>
                  {t.kind === 'dato' && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{L('dato', 'data')}</span>}
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>{num(t.exact, 12)}</td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {t.stored.status === 'overflow' ? <span style={{ color: 'var(--danger)' }}>overflow</span> : t.stored.status === 'underflow' ? <span style={{ color: 'var(--warn)' }}>underflow → 0</span> : T.plainStored(t.stored)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
  return (
    <Card title={<Tex>{`f = ${r.tex}`}</Tex>}>
      {r.error && <div style={{ marginBottom: 10 }}><Alert kind="error">{r.error} {r.error.startsWith('Overflow') ? L('La máquina deja de calcular.', 'The machine stops calculating.') : ''}</Alert></div>}
      {machine && exact && (
        <>
          <Stats
            items={[
              { label: L('Resultado de la máquina f_A', 'Machine result f_A'), value: T.plainStored(T.storeD(machine, M)), accent: true },
              { label: L('Valor exacto f(x)', 'Exact value f(x)'), value: num(exact, 10) },
              { label: L('Error relativo', 'Relative error'), value: pct(rel), hint: rel === 0 ? undefined : L(`m = ${T.sigTexto(rel)} cifras significativas`, `m = ${T.sigTexto(rel)} significant digits`) },
            ]}
          />
          {rel > 0.01 && <div style={{ marginTop: 10 }}><Alert kind="warn">{L('Error relativo grande: la forma de calcular (no la máquina) es la que pierde las cifras. Prueba una expresión equivalente más estable.', 'Large relative error: it is the way of computing (not the machine) that loses the digits. Try a more stable equivalent expression.')}</Alert></div>}
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <Tabs
          tabs={[
            { label: L('Operaciones paso a paso', 'Operations step by step'), content: traceView },
            {
              label: L('Errores', 'Errors'),
              content:
                total && prop && red ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Tex block>{`\\text{Error} = f(x) - f_A = ${texNumD(total, 8)}`}</Tex>
                    <Tex block>{`\\text{${L('Error propagado', 'Propagated error')}} = f(x) - f(x_A) = ${texNumD(prop, 8)}`}</Tex>
                    <Tex block>{`\\text{${L('Error de redondeo', 'Round-off error')}} = f(x_A) - f_A = ${texNumD(red, 8)}`}</Tex>
                    {r.estProp !== undefined && r.estProp !== null && <Tex block>{`\\text{${L('Estimación: ', 'Estimate: ')}} f'(x_A)\\,(x - x_A) = ${texNumD(T.dm.bignumber(r.estProp), 6)}`}</Tex>}
                    <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                      {L(
                        'f(x_A) se calcula con los datos almacenados pero sin redondear las operaciones: la diferencia con f(x) es el error que traen los datos; la diferencia con f_A es el que agregan las operaciones.',
                        'f(x_A) is computed with the stored data but without rounding the operations: its difference from f(x) is the error carried by the data; its difference from f_A is the error added by the operations.',
                      )}
                    </p>
                  </div>
                ) : (
                  <span className="muted">{L('No disponible (la máquina no terminó el cálculo).', 'Not available (the machine did not finish the computation).')}</span>
                ),
            },
          ]}
        />
      </div>
      {single && null}
    </Card>
  )
}

const sub = (n: number) => String(n).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[+c])

/* ─────────────── teoría ─────────────── */

const THEORY_ES = (
  <>
    <p>
      Un <b>dit</b> es el equivalente decimal de un bit: puede guardar cualquiera de los 10 dígitos. El texto usa una computadora de <b>7 dits</b>: 2 para los signos del número y del exponente, 1 para el
      exponente y 4 para la mantisa normalizada (<Tex>d_1 \ne 0</Tex>):
    </p>
    <Tex block>{'x_A = \\pm\\,0.d_1d_2d_3d_4 \\times 10^{\\pm e},\\qquad 0 \\le e \\le 9'}</Tex>
    <p>
      <b>Otras normalizaciones</b> (selector “Normalización”): con el punto <i>después</i> del primer dígito no nulo, <Tex>{'d_1.d_2d_3d_4\\times10^{e}'}</Tex> guarda las mismas 4 cifras (sólo cambia el
      exponente: <Tex>{'0.3142\\times10^{1} = 3.142\\times10^{0}'}</Tex>). Si en cambio los 4 dits son los que van <i>después</i> del punto, <Tex>{'d_0.d_1d_2d_3d_4\\times10^{e}'}</Tex>, el dígito entero
      ocupa un dit más y se guardan 5 cifras: <Tex>{'\\pi_A = 3.1416\\times10^{0}'}</Tex>.
    </p>
    <p>
      El resultado de <b>cada operación</b> se almacena antes de usarse en la siguiente. Si el exponente pasa de 9 hay <b>overflow</b> (la máquina se detiene); si baja de −9 hay <b>underflow</b> (se
      toma 0 y sigue).
    </p>
    <p>El error total se separa en dos partes:</p>
    <Tex block>{'\\underbrace{f(x) - f_A}_{\\text{error}} = \\underbrace{f(x) - f(x_A)}_{\\text{propagado}} + \\underbrace{f(x_A) - f_A}_{\\text{de redondeo}},\\qquad f(x) - f(x_A) \\approx f\'(x_A)(x - x_A)'}</Tex>
    <p>
      Cifras significativas (texto): el mayor <Tex>m</Tex> con <Tex>{'E_r \\le 5\\times10^{-(m+1)}'}</Tex>.
    </p>
  </>
)

const THEORY_EN = (
  <>
    <p>
      A <b>dit</b> is the decimal counterpart of a bit: it can hold any of the 10 digits. The textbook uses a <b>7-dit</b> computer: 2 for the signs of the number and of the exponent, 1 for the
      exponent and 4 for the normalized mantissa (<Tex>d_1 \ne 0</Tex>):
    </p>
    <Tex block>{'x_A = \\pm\\,0.d_1d_2d_3d_4 \\times 10^{\\pm e},\\qquad 0 \\le e \\le 9'}</Tex>
    <p>
      <b>Other normalizations</b> (“Normalization” selector): with the point <i>after</i> the first nonzero digit, <Tex>{'d_1.d_2d_3d_4\\times10^{e}'}</Tex> keeps the same 4 digits (only the
      exponent changes: <Tex>{'0.3142\\times10^{1} = 3.142\\times10^{0}'}</Tex>). If instead the 4 dits are the ones <i>after</i> the point, <Tex>{'d_0.d_1d_2d_3d_4\\times10^{e}'}</Tex>, the integer digit
      takes one more dit and 5 digits are kept: <Tex>{'\\pi_A = 3.1416\\times10^{0}'}</Tex>.
    </p>
    <p>
      The result of <b>every operation</b> is stored before it is used in the next one. If the exponent goes above 9 there is <b>overflow</b> (the machine stops); if it goes below −9 there is <b>underflow</b> (0 is
      taken and it continues).
    </p>
    <p>The total error splits into two parts:</p>
    <Tex block>{'\\underbrace{f(x) - f_A}_{\\text{error}} = \\underbrace{f(x) - f(x_A)}_{\\text{propagated}} + \\underbrace{f(x_A) - f_A}_{\\text{round-off}},\\qquad f(x) - f(x_A) \\approx f\'(x_A)(x - x_A)'}</Tex>
    <p>
      Significant digits (textbook): the largest <Tex>m</Tex> with <Tex>{'E_r \\le 5\\times10^{-(m+1)}'}</Tex>.
    </p>
  </>
)

const THEORY = L(THEORY_ES, THEORY_EN)

/* ─────────────── Scilab ─────────────── */

function toSci(n: any): string {
  switch (n.type) {
    case 'ParenthesisNode':
      return toSci(n.content)
    case 'ConstantNode':
      return `fl(${n.value})`
    case 'SymbolNode':
      return n.name === 'pi' ? 'fl(%pi)' : n.name === 'e' ? 'fl(%e)' : n.name + 'A'
    case 'OperatorNode': {
      if (n.fn === 'unaryMinus') return `(-${toSci(n.args[0])})`
      if (n.fn === 'unaryPlus') return toSci(n.args[0])
      return `fl(${toSci(n.args[0])} ${n.op} ${toSci(n.args[1])})`
    }
    case 'FunctionNode': {
      const name = n.fn.name === 'ln' ? 'log' : n.fn.name
      return `fl(${name}(${toSci(n.args[0])}))`
    }
  }
  return '?'
}

function scilab(s: S, c: Exclude<ReturnType<typeof compute>, { error: string }>): string {
  const lines = c.varRows.map((v) => `${v.name} = ${v.src.replace(/\bpi\b/g, '%pi')};  ${v.name}A = fl(${v.name});`).join('\n')
  const exprs = c.exprs
    .filter((r) => !r.error || r.trace.length)
    .map((r, i) => {
      try {
        return `f${i + 1} = ${toSci(T.parseExpr(r.src))};\nmprintf('f${i + 1} = %s  ->  %.${T.sigOf(c.M) - 1}e\\n', '${r.src.replace(/'/g, "''")}', f${i + 1});`
      } catch {
        return ''
      }
    })
    .join('\n')
  const norm = c.M.norm ?? '0.d'
  const sig = T.sigOf(c.M)
  const forma = norm === '0.d' ? '0.d1...dt x 10^e' : norm === 'd.d' ? 'd1.d2...dt x 10^e' : 'd0.d1...dt x 10^e'
  return `// ${L(`Computadora decimal: ${s.t} dits de mantisa, exponente de ${s.k} dit(s) — generado por NumLab`, `Decimal computer: ${s.t} mantissa dits, ${s.k}-dit exponent — generated by NumLab`)}
// ${L(`fl(x) almacena x como ${forma} (${s.round}); cada operacion se almacena.`, `fl(x) stores x as ${forma} (${s.round === 'redondeo' ? 'rounding' : 'chopping'}); every operation is stored.`)}
clear; clc;
function y = fl(x)
  t = ${sig}; emax = ${10 ** s.k - 1};       // ${L('t = cifras significativas guardadas', 't = significant digits kept')}
  if x == 0 then y = 0; return; end
  e = floor(log10(abs(x)))${norm === '0.d' ? ` + 1;              // ${L('exponente de', 'exponent of')} 0.d1d2... x 10^e` : `;                  // ${L('exponente de', 'exponent of')} d.dd... x 10^e`}
  m = abs(x) / 10^e * 10^t${norm === '0.d' ? '' : ' / 10'};
  ${s.round === 'redondeo' ? `m = floor(m + 0.5);                       // ${L('redondeo', 'rounding')}` : `m = floor(m);                             // ${L('truncado', 'chopping')}`}
  if m >= 10^t then m = m/10; e = e + 1; end  // ${L('acarreo', 'carry')}: 9.999|5 -> 1.000 x 10^(e+1)
  if e > emax then error('overflow'); end
  if e < -emax then y = 0; return; end        // underflow
  y = sign(x) * m / 10^t * 10^e${norm === '0.d' ? '' : ' * 10'};
endfunction

${lines}
${exprs}
`
}
