import { TOPIC } from './theory'
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
  { label: 'Ej. 1.15: √π', value: { vars: 'x = pi', exprs: 'sqrt(x)' } },
  { label: 'Ej. 1.16: a / b', value: { vars: 'a = 3.2789e-4\nb = 4.07546e-5', exprs: 'a/b' } },
  { label: 'Ej. 1.17: (a·b)·c vs a·(b·c)', value: { vars: 'a = 1.2789e-6\nb = 2.07546e-5\nc = 0.99917e5', exprs: '(a*b)*c\na*(b*c)' } },
  { label: 'Ej. 1.17: norma de un vector', value: { vars: 'x = 1.2789e6\ny = 6.07546e4', exprs: 'sqrt(x^2 + y^2)\nabs(x)*sqrt(1 + (y/x)^2)' } },
  { label: 'Ej. 1.18: (eˣ − 1)/x', value: { vars: 'x = 1.4e-4', exprs: '(exp(x) - 1)/x\n1 + x/2' } },
  { label: 'Ej. 1.19: (sen x − x)/x²', value: { vars: 'x = 1.4e-4', exprs: '(sin(x) - x)/x^2\n-x/6' } },
  { label: 'Ej. 1.20: raíces de x² − 26.075x + 0.99917', value: { vars: 'a = 1\nb = -26.075\nc = 0.99917', exprs: '(-b + sqrt(b^2 - 4*a*c))/(2*a)\n(-b - sqrt(b^2 - 4*a*c))/(2*a)\n(2*c)/(-b + sqrt(b^2 - 4*a*c))' } },
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
    if (!m) return { error: `Línea inválida: "${line}". Usa el formato  x = 3.2789e-4` }
    try {
      const v = T.dm.evaluate(T.parseExpr(m[2]).toString(), vars)
      if (!v || !v.isFinite?.()) return { error: `Valor inválido para ${m[1]}` }
      vars[m[1]] = v
      const st = T.storeD(v, M)
      varRows.push({ name: m[1], src: m[2], value: v, stored: st, rel: relOf(v, st.value) })
    } catch {
      return { error: `No se pudo evaluar ${m[2]}` }
    }
  }
  const exprs: ExprRes[] = []
  for (const src of s.exprs.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6)) {
    let node
    try {
      node = T.parseExpr(src)
    } catch {
      exprs.push({ src, tex: src, error: 'Expresión inválida', trace: [] })
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
        <span className="field-label">Datos (uno por línea)</span>
        <textarea className="input mono" rows={4} value={s.vars} spellCheck={false} onChange={(e) => set({ vars: e.target.value })} />
        <span className="field-hint">x = 1.4e-4, a = pi, b = -26.075 … (valores exactos)</span>
      </label>
      <label className="field">
        <span className="field-label">Expresiones a calcular (una por línea)</span>
        <textarea className="input mono" rows={4} value={s.exprs} spellCheck={false} onChange={(e) => set({ exprs: e.target.value })} />
        <span className="field-hint">Se evalúan de izquierda a derecha como la máquina: cada resultado intermedio se almacena. Usa paréntesis para cambiar el orden.</span>
      </label>
      <FieldRow>
        <IntField label="Dits de mantisa t" value={s.t} onChange={(t) => set({ t })} min={1} max={16} />
        <IntField label="Dits de exponente" value={s.k} onChange={(k) => set({ k })} min={1} max={3} />
      </FieldRow>
      <SelectField
        label="Normalización de la mantisa"
        value={s.norm ?? '0.d'}
        onChange={(norm) => set({ norm })}
        options={[
          { value: '0.d', label: '0.d₁d₂d₃d₄ × 10ᵉ  (texto: punto antes del 1.er dígito)' },
          { value: 'd.d', label: 'd₁.d₂d₃d₄ × 10ᵉ  (punto después; t cifras en total)' },
          { value: 'd.d+', label: 'd₀.d₁d₂d₃d₄ × 10ᵉ  (punto después; t dits tras el punto)' },
        ]}
        hint={
          (s.norm ?? '0.d') === '0.d'
            ? 'Ejemplo: π → 0.3142 × 10¹ (4 cifras)'
            : s.norm === 'd.d'
              ? 'Ejemplo: π → 3.142 × 10⁰ (4 cifras; mismo valor, el exponente baja en 1)'
              : 'Ejemplo: π → 3.1416 × 10⁰ (5 cifras: el dígito entero usa un dit extra)'
        }
      />
      <SelectField
        label="Almacenamiento"
        value={s.round}
        onChange={(round) => set({ round })}
        options={[
          { value: 'redondeo', label: 'Redondeo (dígito t+1 ≥ 5 ⇒ sube)' },
          { value: 'truncado', label: 'Truncado (cortado)' },
        ]}
      />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage
      title="Computadora decimal de 7 dits"
      topic={TOPIC}
      description="El modelo de computadora decimal del texto: 2 dits para los signos, 1 para el exponente y 4 para la mantisa (±0.d₁d₂d₃d₄ × 10^±e). Cada operación se almacena; se separan el error propagado y el de redondeo."
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
        <Card title="Comparación">
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Expresión</th>
                    <th>Máquina</th>
                    <th>Exacto</th>
                    <th>Error relativo</th>
                    <th style={{ textAlign: 'center' }}>Cifras sig. m</th>
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

      <Card title="Datos almacenados en la máquina">
        <div style={{ display: 'grid', gap: 14 }}>
          {varRows.map((v) => (
            <div key={v.name} className="dit-var">
              <div>
                <Tex>{`${v.name} = ${texNumD(v.value, 12)} \\;\\to\\; ${v.name}_A = ${T.texStored(v.stored)}`}</Tex>
                <div className="muted" style={{ fontSize: 12 }}>
                  {v.stored.status === 'overflow' ? 'overflow: no se puede almacenar' : v.stored.status === 'underflow' ? 'underflow: se almacena como 0' : `Eᵣ = ${v.rel === 0 ? '0 (exacto)' : v.rel.toExponential(3)} · m = ${v.rel === 0 ? '∞' : T.sigTexto(v.rel)} cifras significativas`}
                </div>
              </div>
              <DitWord s={v.stored} M={M} />
            </div>
          ))}
          {varRows.length === 0 && <span className="muted">Sin datos.</span>}
        </div>
      </Card>

      {exprs.map((r, i) => (
        <ExprCard key={i} r={r} M={M} single={exprs.length === 1} />
      ))}

      <Card title="Propiedades de esta máquina">
        <div className="kv">
          <div className="k">Palabra</div>
          <div className="v">{T.totalDits(M)} dits = 2 signos + {M.k} exponente + {T.sigOf(M)} mantisa{M.norm === 'd.d+' ? ` (1 entero + ${M.t} tras el punto)` : ''}</div>
          <div className="k">Forma normalizada</div>
          <div className="v">{M.norm === '0.d' ? `±0.d₁…d${sub(M.t)} × 10^±e, d₁ ≠ 0` : M.norm === 'd.d' ? `±d₁.d₂…d${sub(M.t)} × 10^±e, d₁ ≠ 0` : `±d₀.d₁…d${sub(M.t)} × 10^±e, d₀ ≠ 0`}</div>
          <div className="k">Rango del exponente</div>
          <div className="v">−{mx} ≤ e ≤ {mx}</div>
          <div className="k">Número positivo más grande</div>
          <div className="v">{M.norm === '0.d' ? '0.' + '9'.repeat(M.t) : '9.' + '9'.repeat(T.sigOf(M) - 1)} × 10^{mx}</div>
          <div className="k">Número positivo más pequeño</div>
          <div className="v">{M.norm === '0.d' ? '0.1' + '0'.repeat(M.t - 1) : '1.' + '0'.repeat(T.sigOf(M) - 1)} × 10^−{mx}</div>
          <div className="k">Error relativo máximo al almacenar</div>
          <div className="v">{M.round === 'redondeo' ? `½·10^(1−${T.sigOf(M)}) = 5 × 10^−${T.sigOf(M)}` : `10^(1−${T.sigOf(M)}) = 10^−${T.sigOf(M) - 1}`}  (cifras guardadas: {T.sigOf(M)})</div>
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
              <th style={{ textAlign: 'left' }}>Se almacena</th>
              <th>Valor exacto</th>
              <th>Almacenado</th>
            </tr>
          </thead>
          <tbody>
            {r.trace.map((t, i) => (
              <tr key={i} className={t.stored.status !== 'ok' && t.stored.status !== 'cero' ? 'hl' : ''}>
                <td className="mono" style={{ textAlign: 'center' }}>{i + 1}</td>
                <td style={{ textAlign: 'left' }}>
                  <Tex>{(t.kind === 'dato' ? '' : '') + t.tex}</Tex>
                  {t.kind === 'dato' && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>dato</span>}
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
      {r.error && <div style={{ marginBottom: 10 }}><Alert kind="error">{r.error} {r.error.startsWith('Overflow') ? 'La máquina deja de calcular.' : ''}</Alert></div>}
      {machine && exact && (
        <>
          <Stats
            items={[
              { label: 'Resultado de la máquina f_A', value: T.plainStored(T.storeD(machine, M)), accent: true },
              { label: 'Valor exacto f(x)', value: num(exact, 10) },
              { label: 'Error relativo', value: pct(rel), hint: rel === 0 ? undefined : `m = ${T.sigTexto(rel)} cifras significativas` },
            ]}
          />
          {rel > 0.01 && <div style={{ marginTop: 10 }}><Alert kind="warn">Error relativo grande: la forma de calcular (no la máquina) es la que pierde las cifras. Prueba una expresión equivalente más estable.</Alert></div>}
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <Tabs
          tabs={[
            { label: 'Operaciones paso a paso', content: traceView },
            {
              label: 'Errores',
              content:
                total && prop && red ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Tex block>{`\\text{Error} = f(x) - f_A = ${texNumD(total, 8)}`}</Tex>
                    <Tex block>{`\\text{Error propagado} = f(x) - f(x_A) = ${texNumD(prop, 8)}`}</Tex>
                    <Tex block>{`\\text{Error de redondeo} = f(x_A) - f_A = ${texNumD(red, 8)}`}</Tex>
                    {r.estProp !== undefined && r.estProp !== null && <Tex block>{`\\text{Estimación: } f'(x_A)\\,(x - x_A) = ${texNumD(T.dm.bignumber(r.estProp), 6)}`}</Tex>}
                    <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                      f(x_A) se calcula con los datos almacenados pero sin redondear las operaciones: la diferencia con f(x) es el error que traen los datos; la diferencia con f_A es el que agregan las operaciones.
                    </p>
                  </div>
                ) : (
                  <span className="muted">No disponible (la máquina no terminó el cálculo).</span>
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

const THEORY = (
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
  return `// Computadora decimal: ${s.t} dits de mantisa, exponente de ${s.k} dit(s) — generado por NumLab
// fl(x) almacena x como ${forma} (${s.round}); cada operacion se almacena.
clear; clc;
function y = fl(x)
  t = ${sig}; emax = ${10 ** s.k - 1};       // t = cifras significativas guardadas
  if x == 0 then y = 0; return; end
  e = floor(log10(abs(x)))${norm === '0.d' ? ' + 1;              // exponente de 0.d1d2... x 10^e' : ';                  // exponente de d.dd... x 10^e'}
  m = abs(x) / 10^e * 10^t${norm === '0.d' ? '' : ' / 10'};
  ${s.round === 'redondeo' ? 'm = floor(m + 0.5);                       // redondeo' : 'm = floor(m);                             // truncado'}
  if m >= 10^t then m = m/10; e = e + 1; end  // acarreo: 9.999|5 -> 1.000 x 10^(e+1)
  if e > emax then error('overflow'); end
  if e < -emax then y = 0; return; end        // underflow
  y = sign(x) * m / 10^t * 10^e${norm === '0.d' ? '' : ' * 10'};
endfunction

${lines}
${exprs}
`
}
