import { TOPIC } from './theory'
import { useMemo } from 'react'
import { Tex } from '../../components/Tex'
import { Alert, Card, Examples, FieldRow, IntField, MethodPage, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { KV, TextField } from './components'
import './errores.css'
import * as F from './float'
import * as Q from './palabra'

type Mode = 'almacenar' | 'leer' | 'operar'
type Layout = '1-7-8' | '1-5-10' | 'custom'
type Op = '+' | '-' | '*' | '/'

interface S {
  mode: Mode
  layout: Layout
  w: number
  m: number
  expMode: Q.ExpMode
  round: Q.RoundMode
  x: string
  bits: string
  u: string
  v: string
  op: Op
}

const DEFAULT: S = { mode: 'almacenar', layout: '1-7-8', w: 7, m: 8, expMode: 'ieee', round: 'par', x: '-6.2945e-3', bits: '0000111111010101', u: '77.74', v: '69.91', op: '-' }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 1.9: −6.2945·10⁻³', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'ieee', round: 'par', x: '-6.2945e-3' } },
  { label: 'Ej. 1.6: 74.89 (truncado)', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'signo', round: 'truncado', x: '74.89' } },
  { label: 'Ej. 1.6: 74.89 (redondeo)', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'signo', round: 'redondeo', x: '74.89' } },
  { label: 'Ej. 1.7: −237.69 (bias 64)', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'bias-peq', round: 'redondeo', x: '-237.69' } },
  { label: 'Ej. 1.8: leer 0000111111010101', value: { mode: 'leer', layout: '1-7-8', expMode: 'bias-peq', bits: '0000111111010101' } },
  { label: 'Ej. 1.10: 77.74 − 69.91', value: { mode: 'operar', layout: '1-7-8', expMode: 'ieee', round: 'par', u: '77.74', v: '69.91', op: '-' } },
  { label: 'Subnormal: 10⁻²⁰', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'ieee', round: 'par', x: '1e-20' } },
  { label: 'Overflow: 10²⁰', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'ieee', round: 'par', x: '1e20' } },
  { label: 'binary16: −6.2945·10⁻³', value: { mode: 'almacenar', layout: '1-5-10', expMode: 'ieee', round: 'par', x: '-6.2945e-3' } },
]

const EXP_LABEL: Record<Q.ExpMode, string> = {
  ieee: 'IEEE 754: sesgo 2^(w−1)−1, E=0 subnormal, E=1…1 ∞/NaN',
  'bias-gra': 'Texto: bias 2^(w−1)−1 (favorece exponentes grandes)',
  'bias-peq': 'Texto: bias 2^(w−1) (favorece exponentes pequeños)',
  signo: 'Texto: bit de signo del exponente + magnitud',
}
const ROUND_LABEL: Record<Q.RoundMode, string> = {
  par: 'IEEE 754: al más cercano, empate a par',
  redondeo: 'Texto: si el bit m+1 es 1, sumar 1',
  truncado: 'Truncado (cortado)',
}

function machineOf(s: S): Q.Machine {
  const [w, m] = s.layout === '1-7-8' ? [7, 8] : s.layout === '1-5-10' ? [5, 10] : [s.w, s.m]
  return { w, m, expMode: s.expMode, round: s.round }
}

/* ─────────────── formato ─────────────── */

const sci = (r: F.Rational, d = 13) => {
  const v = Q.ratToNum(r)
  if (v === 0) return '0'
  const s = v.toExponential(d - 1).replace(/\.?0+e/, 'e')
  return s.replace(/e([+-])(\d+)/, (_, sg, ex) => ` × 10${sg === '-' ? '⁻' : ''}${[...ex].map((c: string) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('')}`)
}
const texSci = (r: F.Rational, d = 13) => {
  const v = Q.ratToNum(r)
  if (v === 0) return '0'
  const [mm, ex] = v.toExponential(d - 1).replace(/\.?0+e/, 'e').split('e')
  return Number(ex) === 0 ? mm : `${mm}\\times 10^{${Number(ex)}}`
}
/** agrupa bits de 4 en 4 (como el texto) */
const grp = (b: string) => b.replace(/(.{4})(?=.)/g, '$1\\,')
const absR = (r: F.Rational): F.Rational => ({ num: r.num < 0n ? -r.num : r.num, den: r.den })

/* ─────────────── página ─────────────── */

export function Maquina() {
  const [s, setS] = useLocalState<S>('errores:maquina', DEFAULT)
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 200)
  const M = machineOf(d)
  const total = Q.totalBits(M)

  const inputs = (
    <>
      <SelectField
        label="¿Qué hacer?"
        value={s.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'almacenar', label: 'Almacenar un número decimal' },
          { value: 'leer', label: 'Leer una palabra de bits' },
          { value: 'operar', label: 'Operar u ∘ v en la máquina' },
        ]}
      />
      {s.mode === 'almacenar' && <TextField label="Número x" value={s.x} onChange={(x) => set({ x })} hint="Decimal exacto: −6.2945e-3, 74.89, 1/3" invalid={!F.parseRational(s.x)} />}
      {s.mode === 'leer' && <TextField palette="off" label={`Palabra de ${total} bits`} value={s.bits} onChange={(bits) => set({ bits })} hint="Ceros y unos (se ignoran espacios)" invalid={s.bits.replace(/\s+/g, '').length !== total || /[^01\s]/.test(s.bits)} />}
      {s.mode === 'operar' && (
        <>
          <FieldRow>
            <TextField label="u" value={s.u} onChange={(u) => set({ u })} invalid={!F.parseRational(s.u)} />
            <TextField label="v" value={s.v} onChange={(v) => set({ v })} invalid={!F.parseRational(s.v)} />
          </FieldRow>
          <SelectField label="Operación" value={s.op} onChange={(op) => set({ op })} options={[{ value: '+', label: 'u + v' }, { value: '-', label: 'u − v' }, { value: '*', label: 'u × v' }, { value: '/', label: 'u ÷ v' }]} />
        </>
      )}
      <SelectField
        label="Palabra"
        value={s.layout}
        onChange={(layout) => set({ layout })}
        options={[
          { value: '1-7-8', label: '16 bits del texto: 1 signo · 7 exp · 8 mantisa' },
          { value: '1-5-10', label: 'IEEE binary16: 1 signo · 5 exp · 10 mantisa' },
          { value: 'custom', label: 'Personalizada' },
        ]}
      />
      {s.layout === 'custom' && (
        <FieldRow>
          <IntField label="Bits exponente" value={s.w} onChange={(w) => set({ w })} min={2} max={11} />
          <IntField label="Bits mantisa" value={s.m} onChange={(m) => set({ m })} min={1} max={52} />
        </FieldRow>
      )}
      <SelectField label="Exponente" value={s.expMode} onChange={(expMode) => set({ expMode })} options={(Object.keys(EXP_LABEL) as Q.ExpMode[]).map((k) => ({ value: k, label: EXP_LABEL[k] }))} />
      <SelectField label="Redondeo de la mantisa" value={s.round} onChange={(round) => set({ round })} options={(Object.keys(ROUND_LABEL) as Q.RoundMode[]).map((k) => ({ value: k, label: ROUND_LABEL[k] }))} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage
      title="Máquina binaria de 16 bits"
      topic={TOPIC}
      description="La palabra de 16 bits del texto de la materia (1 bit de signo, 7 de exponente, 8 de mantisa) con las reglas de IEEE 754, o con las convenciones alternativas del Cap. 1. Paso a paso de almacenamiento, lectura, vecinos y operaciones."
      theory={THEORY}
      inputs={inputs}
    >
      {d.mode === 'almacenar' && <Almacenar s={d} M={M} />}
      {d.mode === 'leer' && <Leer s={d} M={M} />}
      {d.mode === 'operar' && <Operar s={d} M={M} />}
      <Propiedades M={M} />
      <ScilabCode code={scilab(d, M)} filename="maquina_16bits" />
    </MethodPage>
  )
}

/* ─────────────── palabra ─────────────── */

function Word({ bits, M }: { bits: string; M: Q.Machine }) {
  const cls = (i: number) => (i === 0 ? 'err-sign' : i <= M.w ? 'err-exp' : 'err-man')
  return (
    <div className="word">
      {[...bits].map((b, i) => (
        <div key={i} className={'word-cell ' + cls(i)}>
          <span className="word-idx">{i + 1}</span>
          <span className={'bit ' + cls(i) + (b === '1' ? ' on' : '')}>{b}</span>
        </div>
      ))}
      <div className="word-legend">
        <span className="err-sign">■ signo</span>
        <span className="err-exp">■ exponente ({M.w} bits{M.expMode === 'signo' ? ': signo + magnitud' : ''})</span>
        <span className="err-man">■ mantisa ({M.m} bits, 1 implícito)</span>
      </div>
    </div>
  )
}

function expTex(e: number, M: Q.Machine, bits: string): string {
  const b = Q.bias(M)
  if (b === null) return `e = ${e} \\;\\Rightarrow\\; \\underbrace{${e < 0 ? 1 : 0}}_{\\text{signo exp.}}\\ \\underbrace{${bits.slice(1)}}_{|e| = ${Math.abs(e)}}`
  return `E = e + \\text{sesgo} = ${e} + ${b} = ${e + b} = (${bits})_2`
}

/* ─────────────── almacenar ─────────────── */

function Almacenar({ s, M }: { s: S; M: Q.Machine }) {
  const r = useMemo(() => F.parseRational(s.x), [s.x])
  const st = useMemo(() => (r ? Q.store(r, M) : null), [r, M.w, M.m, M.expMode, M.round])
  if (!r || !st) return <Alert kind="error">Número inválido. Escribe un decimal (−6.2945e-3, 74.89) o una fracción (1/3).</Alert>
  if (st.zero) return <Alert kind="info">x = 0 se almacena con todos los bits en cero.</Alert>
  const failed = (st.overflow && !st.infinite) || st.underflow
  const err = failed || st.infinite ? null : Q.add(st.value, Q.neg(r))
  const rel = err ? Q.div(absR(err), absR(r)) : null
  return (
    <>
      <Stats
        items={[
          { label: 'Valor almacenado', value: st.infinite ? (st.sign ? '−∞' : '+∞') : failed ? (st.overflow ? 'overflow' : 'underflow → 0') : sci(st.value), accent: true, hint: st.subnormal ? 'subnormal' : st.exact ? 'representación exacta' : st.roundedUp ? 'mantisa redondeada hacia arriba' : 'mantisa truncada' },
          { label: 'Palabra (hex)', value: failed ? '—' : '0x' + F.bitsToHex(st.bits.padStart(Math.ceil(st.bits.length / 4) * 4, '0')) },
          { label: 'Error absoluto', value: err ? sci(absR(err), 4) : '—' },
          { label: 'Error relativo', value: rel ? sci(rel, 4) : '—', hint: `cota: δ = ${sci(Q.props(M).delta, 4)}` },
        ]}
      />
      {st.overflow && <Alert kind={st.infinite ? 'warn' : 'error'}>{st.infinite ? 'El exponente supera el máximo: IEEE 754 almacena ±∞ (exponente todo unos, mantisa cero).' : 'Overflow: el exponente no cabe en la palabra; la computadora deja de calcular.'}</Alert>}
      {st.underflow && <Alert kind="warn">Underflow: el número es menor que el más pequeño representable y se asimila a cero.</Alert>}
      {!failed && (
        <Card title={`Palabra de ${Q.totalBits(M)} bits`}>
          <Word bits={st.bits} M={M} />
        </Card>
      )}
      <Tabs
        tabs={[
          { label: 'Paso a paso', content: <Card><Steps steps={storeSteps(r, st, M)} /></Card> },
          {
            label: 'Justo más grande / pequeño',
            content: (
              <Card>
                <KV
                  items={[
                    ['x', <Tex>{texSci(r, 10)}</Tex>],
                    ['Justo más pequeño (≤ x)', st.below ? <>{sci(st.below)}<br /><span className="muted">{F.ratToDecimal(st.below, 40)}</span></> : '— (fuera de rango)'],
                    ['Justo más grande (≥ x)', st.above ? <>{sci(st.above)}<br /><span className="muted">{F.ratToDecimal(st.above, 40)}</span></> : '— (fuera de rango)'],
                    ['Almacenado', failed || st.infinite ? '—' : <b>{sci(st.value)}</b>],
                  ]}
                />
                <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>
                  Los vecinos se obtienen truncando la mantisa en el bit {M.m} y sumándole una unidad al último bit. Para un número negativo, el “justo más pequeño” es el de mayor valor absoluto.
                  Entre ellos dos la computadora no puede representar ningún otro número.
                </p>
              </Card>
            ),
          },
        ]}
      />
    </>
  )
}

function storeSteps(r: F.Rational, st: Q.Stored, M: Q.Machine): { text?: string; tex?: string }[] {
  const out: { text?: string; tex?: string }[] = []
  const sg = st.sign ? '-' : '+'
  const hex = F.toBase(absR(r), 16, 8)
  const bin = F.toBase(absR(r), 2, Math.max(0, -st.e0) + M.m + 8)
  out.push({ text: 'Convertir a binario (pasando por hexadecimal):', tex: `x = (${F.ratToDecimal(r, 20)})_{10} = ${sg === '-' ? '-' : ''}${F.baseTex(hex, 16)} = ${sg === '-' ? '-' : ''}(${grp(bin.intDigits)}.${grp(bin.fracDigits)}${bin.terminates ? '' : '\\ldots'})_2` })
  const lead = st.mantBits.slice(0, M.m)
  const rest = st.mantBits.slice(M.m)
  if (st.subnormal || (M.expMode === 'ieee' && st.e0 < Q.expRange(M).emin)) {
    const { emin } = Q.expRange(M)
    out.push({ text: `El exponente ${st.e0} es menor que e_min = ${emin}: en IEEE 754 se guarda como subnormal, sin el 1 implícito y con E = 0:`, tex: `x = ${sg}0.${grp(lead)}\\,|\\,${rest}\\ldots \\times 2^{${emin}}` })
  } else {
    out.push({ text: 'Normalizar a la forma 1.b₁b₂… × 2ᵉ:', tex: `x = ${sg}1.${grp(lead)}\\,|\\,${grp(rest)}${st.moreBits ? '\\ldots' : ''} \\times 2^{${st.e0}}` })
  }
  if (!st.overflow && !st.underflow && !st.subnormal) out.push({ text: 'Exponente:', tex: expTex(st.e, M, st.expBits) })
  const why =
    M.round === 'truncado'
      ? `Truncado: se ignoran los bits a partir del ${M.m + 1}.º.`
      : M.round === 'redondeo'
        ? `Redondeo (texto): el bit ${M.m + 1} es ${st.guard} ⇒ ${st.guard ? `se suma 1 al bit ${M.m}` : 'se dejan los primeros bits sin cambio'}.`
        : `Redondeo IEEE (al más cercano, empate a par): bit ${M.m + 1} = ${st.guard}, bits siguientes ${st.sticky ? 'con algún 1' : 'todos 0'}${st.guard && !st.sticky ? ` ⇒ empate exacto: se elige la mantisa par (último bit ${(st.Ntrunc & 1n) === 1n ? '1 → sube' : '0 → se queda'})` : st.guard ? ' ⇒ más de la mitad: se suma 1' : ' ⇒ menos de la mitad: se trunca'}.`
  const Nbits = (n: bigint, sub: boolean) => (sub ? n.toString(2).padStart(M.m, '0') : n.toString(2).slice(1))
  out.push({
    text: `Mantisa de ${M.m} bits. ${why}`,
    tex: `${st.subnormal ? '0' : '1'}.${grp(lead)} ${st.roundedUp ? `+ 0.${'0'.repeat(M.m - 1)}1 = ${st.carry ? '10.' + '0'.repeat(M.m) : (st.subnormal ? '0.' : '1.') + grp(Nbits(st.N, st.subnormal))}` : ''}${st.carry ? `\\;\\Rightarrow\\; 1.${'0'.repeat(M.m)}\\times 2^{${st.e}}` : ''}`,
  })
  if (st.infinite) {
    out.push({ text: 'El exponente resultante no cabe (E sería todo unos): se almacena ±∞.', tex: `\\text{palabra} = ${st.bits}` })
    return out
  }
  if (st.overflow || st.underflow) return out
  out.push({ text: 'Palabra almacenada (signo | exponente | mantisa):', tex: `\\underbrace{${st.sign}}_{\\sigma}\\ \\underbrace{${st.expBits}}_{\\text{exponente}}\\ \\underbrace{${grp(st.manBits)}}_{\\text{mantisa}}` })
  out.push({
    text: 'Número que realmente guarda la computadora:',
    tex: `x_A = ${sg}${st.subnormal ? '0' : '1'}.${grp(st.manBits)}\\times 2^{${st.subnormal ? Q.expRange(M).emin : st.e}} = ${texSci(st.value, 13)}`,
  })
  if (!st.exact) {
    const err = Q.add(st.value, Q.neg(r))
    out.push({ text: 'Error de representación:', tex: `|x - x_A| = ${texSci(absR(err), 5)},\\qquad \\frac{|x - x_A|}{|x|} = ${texSci(Q.div(absR(err), absR(r)), 5)} \\le \\delta = ${texSci(Q.props(M).delta, 5)}` })
  }
  return out
}

/* ─────────────── leer ─────────────── */

function Leer({ s, M }: { s: S; M: Q.Machine }) {
  const bits = s.bits.replace(/\s+/g, '')
  const total = Q.totalBits(M)
  if (bits.length !== total || /[^01]/.test(bits)) return <Alert kind="error">Escribe exactamente {total} ceros y unos.</Alert>
  const dd = Q.decode(bits, M)
  const b = Q.bias(M)
  const sg = dd.sign ? '-' : '+'
  const steps: { text?: string; tex?: string }[] = [
    { text: 'Separar los campos:', tex: `\\underbrace{${dd.sign}}_{\\sigma}\\ \\underbrace{${dd.expBits}}_{\\text{exponente}}\\ \\underbrace{${grp(dd.manBits)}}_{\\text{mantisa}}` },
  ]
  if (dd.kind === 'infinito' || dd.kind === 'NaN') steps.push({ text: 'Exponente todo unos (IEEE 754):', tex: dd.kind === 'NaN' ? '\\text{mantisa} \\ne 0 \\Rightarrow \\text{NaN}' : `\\text{mantisa} = 0 \\Rightarrow x = ${sg}\\infty` })
  else if (dd.kind === 'cero') steps.push({ text: 'Todos los bits (salvo quizá el signo) son cero:', tex: `x = ${sg}0` })
  else {
    if (dd.kind === 'subnormal') steps.push({ text: 'Exponente todo ceros con mantisa ≠ 0 (IEEE 754): subnormal, sin 1 implícito.', tex: `e = e_{\\min} = ${dd.e}` })
    else if (b === null) steps.push({ text: 'Exponente con signo:', tex: `(${dd.expBits[0] === '1' ? '-' : '+'}${dd.expBits.slice(1)})_2 = ${dd.e}` })
    else steps.push({ text: 'Exponente: convertir a decimal y restar el sesgo:', tex: `(${dd.expBits})_2 = ${parseInt(dd.expBits, 2)} \\;\\Rightarrow\\; e = ${parseInt(dd.expBits, 2)} - ${b} = ${dd.e}` })
    const lead = dd.kind === 'subnormal' ? '0' : '1'
    const terms = [...dd.manBits].map((c, i) => (c === '1' ? `2^{-${i + 1}}` : '')).filter(Boolean)
    steps.push({ text: 'Valor:', tex: `x = ${sg}(${lead}.${grp(dd.manBits)})_2\\times 2^{${dd.e}} = ${sg}\\left(${lead === '1' ? '2^0' : '0'}${terms.length ? ' + ' + terms.join(' + ') : ''}\\right)\\times 2^{${dd.e}} = ${texSci(dd.value, 16)}` })
  }
  return (
    <>
      <Stats items={[{ label: 'Valor', value: dd.kind === 'infinito' ? (dd.sign ? '−∞' : '+∞') : dd.kind === 'NaN' ? 'NaN' : sci(dd.value, 16), accent: true, hint: dd.kind }, { label: 'Exponente e', value: String(dd.e) }, { label: 'Hex', value: '0x' + F.bitsToHex(bits.padStart(Math.ceil(bits.length / 4) * 4, '0')) }]} />
      <Card title={`Palabra de ${total} bits`}>
        <Word bits={bits} M={M} />
      </Card>
      <Card title="Paso a paso">
        <Steps steps={steps} />
        {dd.kind !== 'infinito' && dd.kind !== 'NaN' && <div className="exact" style={{ marginTop: 10 }}>{F.ratToDecimal(dd.value, 120)}</div>}
      </Card>
    </>
  )
}

/* ─────────────── operar ─────────────── */

function Operar({ s, M }: { s: S; M: Q.Machine }) {
  const u = F.parseRational(s.u), v = F.parseRational(s.v)
  if (!u || !v) return <Alert kind="error">u y v deben ser números decimales válidos.</Alert>
  if (s.op === '/' && v.num === 0n) return <Alert kind="error">División entre cero.</Alert>
  const su = Q.store(u, M), sv = Q.store(v, M)
  if (su.overflow || sv.overflow || su.underflow || sv.underflow) return <Alert kind="error">u o v no se pueden almacenar (overflow/underflow).</Alert>
  const f = (a: F.Rational, b: F.Rational) => (s.op === '+' ? Q.add(a, b) : s.op === '-' ? Q.add(a, Q.neg(b)) : s.op === '*' ? Q.mul(a, b) : Q.div(a, b))
  const zc = f(su.value, sv.value)
  const sz = Q.store(zc, M)
  const exact = f(u, v)
  const opTex = { '+': '+', '-': '-', '*': '\\times', '/': '\\div' }[s.op]
  const errZ = sz.zero ? absR(exact) : Q.add(sz.value, Q.neg(exact))
  const relZ = exact.num !== 0n ? Q.div(absR(errZ), absR(exact)) : null
  return (
    <>
      <Stats
        items={[
          { label: 'z en la máquina', value: sz.zero ? '0' : sz.infinite ? '∞' : sz.overflow ? 'overflow' : sci(sz.value), accent: true },
          { label: 'z exacto', value: sci(exact) },
          { label: 'Error absoluto', value: sci(absR(errZ), 4) },
          { label: 'Error relativo', value: relZ ? sci(relZ, 4) : '—', hint: relZ && Q.ratToNum(relZ) > 10 * Q.ratToNum(Q.props(M).delta) ? '¡mucho mayor que δ! (cancelación)' : undefined },
        ]}
      />
      <Card title="Paso a paso">
        <Steps
          steps={[
            { text: '1. Almacenar u:', tex: `u = ${texSci(u)} \\to u_C = ${su.sign ? '-' : ''}1.${grp(su.manBits)}\\times 2^{${su.e}} = ${texSci(su.value)}` },
            { text: '2. Almacenar v:', tex: `v = ${texSci(v)} \\to v_C = ${sv.sign ? '-' : ''}1.${grp(sv.manBits)}\\times 2^{${sv.e}} = ${texSci(sv.value)}` },
            { text: '3. Operar con los números almacenados (exacto):', tex: `u_C ${opTex} v_C = ${texSci(zc, 16)}` },
            { text: '4. Almacenar el resultado:', tex: sz.zero ? 'z_C = 0' : `z_C = ${sz.sign ? '-' : ''}1.${grp(sz.manBits)}\\times 2^{${sz.e}} = ${texSci(sz.value)}` },
            { text: '5. Comparar con el valor exacto:', tex: `z = u ${opTex} v = ${texSci(exact, 16)},\\qquad \\frac{|z - z_C|}{|z|} = ${relZ ? texSci(relZ, 4) : '-'}` },
          ]}
        />
      </Card>
      <Card title="Palabras almacenadas">
        <div style={{ display: 'grid', gap: 14 }}>
          <div><div className="field-label">u_C</div><Word bits={su.bits} M={M} /></div>
          <div><div className="field-label">v_C</div><Word bits={sv.bits} M={M} /></div>
          {!sz.zero && !sz.overflow && !sz.underflow && <div><div className="field-label">z_C</div><Word bits={sz.bits} M={M} /></div>}
        </div>
      </Card>
    </>
  )
}

/* ─────────────── propiedades ─────────────── */

function Propiedades({ M }: { M: Q.Machine }) {
  const P = Q.props(M)
  return (
    <Card title="Propiedades de esta máquina">
      <KV
        items={[
          ['Rango del exponente', `${P.emin} ≤ e ≤ ${P.emax}${Q.bias(M) !== null ? `  (sesgo ${Q.bias(M)})` : ''}`],
          ['Número positivo más grande', sci(P.xmax, 16)],
          ['Número positivo normal más pequeño', sci(P.xmin, 16)],
          ...(P.minSub ? ([['Subnormal más pequeño', sci(P.minSub, 16)]] as [string, string][]) : []),
          [M.round === 'truncado' ? 'Unidad de redondeo δ = 2⁻ᵐ' : 'Unidad de redondeo δ = 2⁻⁽ᵐ⁺¹⁾', sci(P.delta, 10)],
          ['Números representables (aprox.)', P.count.toString()],
        ]}
      />
    </Card>
  )
}

/* ─────────────── teoría ─────────────── */

const THEORY = (
  <>
    <p>
      El texto de la materia usa, por comodidad, palabras de <b>16 bits</b>: 1 bit para el signo, 7 para el exponente y 8 para la mantisa. El primer dígito (el 1 de <Tex>{'1.b_1b_2\\ldots'}</Tex>) no se
      almacena.
    </p>
    <Tex block>{'x = (-1)^{\\sigma}\\times 1.b_1b_2\\ldots b_8 \\times 2^{E - \\text{sesgo}}'}</Tex>
    <p>
      <b>IEEE 754</b> con 7 bits de exponente: sesgo <Tex>{'2^{6}-1 = 63'}</Tex>. <Tex>E = 0</Tex> se reserva para el cero y los subnormales, y <Tex>{'E = 127'}</Tex> para ±∞ y NaN, así que{' '}
      <Tex>{'-62 \\le e \\le 63'}</Tex>. La mantisa se redondea al más cercano; en caso de empate exacto, al par.
    </p>
    <p>
      <b>Convenciones del texto (Cap. 1):</b> exponente con bit de signo (<Tex>{'-63\\le e\\le 63'}</Tex>), con bias 64 (<Tex>{'-64\\le e\\le 63'}</Tex>) o con bias 63 (<Tex>{'-63\\le e\\le 64'}</Tex>). El
      redondeo del texto mira sólo el 9.º bit: si es 1 se suma una unidad al 8.º.
    </p>
    <p>Unidad de redondeo:</p>
    <Tex block>{'\\delta = \\begin{cases} 2^{-m} = 2^{-8} = 0.00390625 & \\text{truncado}\\\\ 2^{-(m+1)} = 2^{-9} = 0.001953125 & \\text{redondeo}\\end{cases}'}</Tex>
  </>
)

/* ─────────────── Scilab ─────────────── */

function scilab(s: S, M: Q.Machine): string {
  const b = Q.bias(M)
  const x = s.mode === 'operar' ? s.u : s.x
  const { emin, emax } = Q.expRange(M)
  return `// Almacenamiento en una palabra de ${Q.totalBits(M)} bits (1 | ${M.w} | ${M.m}) — generado por NumLab
// Exponente: ${EXP_LABEL[M.expMode]}
// Redondeo:  ${ROUND_LABEL[M.round]}
clear; clc;
m = ${M.m}; emin = ${emin}; emax = ${emax};
function xa = almacenar(x, m, emin, emax, modo)
  if x == 0 then xa = 0; return; end
  s = sign(x); a = abs(x);
  e = floor(log2(a));
  if a >= 2^(e+1) then e = e + 1; end        // correccion por redondeo de log2
  if a < 2^e then e = e - 1; end
${M.expMode === 'ieee' ? '  if e < emin then e = emin; end              // subnormal: 0.f x 2^emin\n' : ''}  y = a / 2^e * 2^m;                          // mantisa escalada: 1bbbbbbbb.resto
  select modo
  case 'truncado' then N = floor(y);
  case 'redondeo' then N = floor(y + 0.5);    // bit m+1 = 1 => sube
  else                                        // IEEE: al mas cercano, empate a par
    N = floor(y); r = y - N;
    if r > 0.5 | (r == 0.5 & modulo(N, 2) == 1) then N = N + 1; end
  end
  xa = s * N * 2^(e - m);
  if abs(xa) >= 2^(emax+1) then
    ${M.expMode === 'ieee' ? 'xa = s * %inf;  // overflow => infinito' : "error('overflow');"}
  end
endfunction

x = ${x};
xa = almacenar(x, m, emin, emax, '${M.round}');
mprintf('x  = %.15e\\n', x);
mprintf('xA = %.15e\\n', xa);
mprintf('error relativo = %.4e\\n', abs(x - xa)/abs(x));
${b !== null ? `e = floor(log2(abs(xa))); mprintf('exponente e = %d, almacenado E = e + ${b} = %d = %s\\n', e, e + ${b}, dec2bin(e + ${b}, ${M.w}));\n` : ''}`
}
