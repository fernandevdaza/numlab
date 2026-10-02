import { TOPIC } from './theory'
import { L } from '../../i18n'
import { useMemo } from 'react'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, FieldRow, IntField, MethodPage, ScilabCode, SelectField, Stats, Steps, Tabs, type Column } from '../../components/ui'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { KV, TextField, kindLabel } from './components'
import './errores.css'
import * as F from './float'
import * as Q from './palabra'
import * as I from './incognitas'

type Mode = 'almacenar' | 'leer' | 'operar' | 'incognitas'
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
  /** plantilla con incógnitas: 0, 1 o letras */
  pattern: string
  /** condiciones sobre el valor, separadas por ; */
  conds: string
}

const DEFAULT: S = { mode: 'almacenar', layout: '1-7-8', w: 7, m: 8, expMode: 'ieee', round: 'par', x: '-6.2945e-3', bits: '0000111111010101', u: '77.74', v: '69.91', op: '-', pattern: '0 1000101 001a0b11', conds: '74 < x < 77' }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 1.9: −6.2945·10⁻³', 'Ex. 1.9: −6.2945·10⁻³'), value: { mode: 'almacenar', layout: '1-7-8', expMode: 'ieee', round: 'par', x: '-6.2945e-3' } },
  { label: L('Ej. 1.6: 74.89 (truncado)', 'Ex. 1.6: 74.89 (chopped)'), value: { mode: 'almacenar', layout: '1-7-8', expMode: 'signo', round: 'truncado', x: '74.89' } },
  { label: L('Ej. 1.6: 74.89 (redondeo)', 'Ex. 1.6: 74.89 (rounded)'), value: { mode: 'almacenar', layout: '1-7-8', expMode: 'signo', round: 'redondeo', x: '74.89' } },
  { label: L('Ej. 1.7: −237.69 (bias 64)', 'Ex. 1.7: −237.69 (bias 64)'), value: { mode: 'almacenar', layout: '1-7-8', expMode: 'bias-peq', round: 'redondeo', x: '-237.69' } },
  { label: L('Ej. 1.8: leer 0000111111010101', 'Ex. 1.8: read 0000111111010101'), value: { mode: 'leer', layout: '1-7-8', expMode: 'bias-peq', bits: '0000111111010101' } },
  { label: L('Ej. 1.10: 77.74 − 69.91', 'Ex. 1.10: 77.74 − 69.91'), value: { mode: 'operar', layout: '1-7-8', expMode: 'ieee', round: 'par', u: '77.74', v: '69.91', op: '-' } },
  { label: 'Subnormal: 10⁻²⁰', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'ieee', round: 'par', x: '1e-20' } },
  { label: 'Overflow: 10²⁰', value: { mode: 'almacenar', layout: '1-7-8', expMode: 'ieee', round: 'par', x: '1e20' } },
  { label: L('Incógnitas: 74 < x < 77', 'Unknowns: 74 < x < 77'), value: { mode: 'incognitas', layout: '1-7-8', expMode: 'ieee', pattern: '0 1000101 001a0b11', conds: '74 < x < 77' } },
  { label: L('Incógnita en el exponente: x < 100', 'Unknown exponent bit: x < 100'), value: { mode: 'incognitas', layout: '1-7-8', expMode: 'ieee', pattern: '0 10001a1 00110111', conds: 'x < 100' } },
  { label: L('Ej. 1.9: ¿qué vecino es ≥ w?', 'Ex. 1.9: which neighbor is ≥ w?'), value: { mode: 'incognitas', layout: '1-7-8', expMode: 'ieee', pattern: '1 0110111 1001110a', conds: 'x >= -6.2945e-3' } },
  { label: 'binary16: −6.2945·10⁻³', value: { mode: 'almacenar', layout: '1-5-10', expMode: 'ieee', round: 'par', x: '-6.2945e-3' } },
]

const EXP_LABEL: Record<Q.ExpMode, string> = {
  ieee: L('IEEE 754: sesgo 2^(w−1)−1, E=0 subnormal, E=1…1 ∞/NaN', 'IEEE 754: bias 2^(w−1)−1, E=0 subnormal, E=1…1 ∞/NaN'),
  'bias-gra': L('Texto: bias 2^(w−1)−1 (favorece exponentes grandes)', 'Textbook: bias 2^(w−1)−1 (favors large exponents)'),
  'bias-peq': L('Texto: bias 2^(w−1) (favorece exponentes pequeños)', 'Textbook: bias 2^(w−1) (favors small exponents)'),
  signo: L('Texto: bit de signo del exponente + magnitud', 'Textbook: exponent sign bit + magnitude'),
}
const ROUND_LABEL: Record<Q.RoundMode, string> = {
  par: L('IEEE 754: al más cercano, empate a par', 'IEEE 754: round to nearest, ties to even'),
  redondeo: L('Texto: si el bit m+1 es 1, sumar 1', 'Textbook: if bit m+1 is 1, add 1'),
  truncado: L('Truncado (cortado)', 'Chopping (truncation)'),
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
  const [stored, setS] = useLocalState<S>('errores:maquina', DEFAULT)
  // estados guardados por versiones anteriores pueden no tener los campos nuevos
  const s: S = { ...DEFAULT, ...stored }
  const set = (p: Partial<S>) => setS((v) => ({ ...DEFAULT, ...v, ...p }))
  const d = useDebounced(s, 200)
  const M = machineOf(d)
  const total = Q.totalBits(M)

  const inputs = (
    <>
      <SelectField
        label={L('¿Qué hacer?', 'What to do?')}
        value={s.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'almacenar', label: L('Almacenar un número decimal', 'Store a decimal number') },
          { value: 'leer', label: L('Leer una palabra de bits', 'Read a bit word') },
          { value: 'operar', label: L('Operar u ∘ v en la máquina', 'Compute u ∘ v on the machine') },
          { value: 'incognitas', label: L('Bits desconocidos con condiciones', 'Unknown bits with conditions') },
        ]}
      />
      {s.mode === 'almacenar' && <TextField label={L('Número x', 'Number x')} value={s.x} onChange={(x) => set({ x })} hint={L('Decimal exacto: −6.2945e-3, 74.89, 1/3', 'Exact decimal: −6.2945e-3, 74.89, 1/3')} invalid={!F.parseRational(s.x)} />}
      {s.mode === 'leer' && <TextField palette="off" label={L(`Palabra de ${total} bits`, `${total}-bit word`)} value={s.bits} onChange={(bits) => set({ bits })} hint={L('Ceros y unos (se ignoran espacios)', 'Zeros and ones (spaces are ignored)')} invalid={s.bits.replace(/\s+/g, '').length !== total || /[^01\s]/.test(s.bits)} />}
      {s.mode === 'incognitas' && (
        <>
          <TextField
            palette="off"
            label={L(`Palabra de ${total} bits con incógnitas`, `${total}-bit word with unknowns`)}
            value={s.pattern}
            onChange={(pattern) => set({ pattern })}
            hint={L('0, 1 o letras (a, b, …) en los bits desconocidos; la misma letra es el mismo bit. Se ignoran espacios.', '0, 1 or letters (a, b, …) for the unknown bits; the same letter is the same bit. Spaces are ignored.')}
            invalid={!I.parsePattern(s.pattern, total).ok}
          />
          <TextField
            palette="off"
            label={L('Condiciones sobre el valor x', 'Conditions on the value x')}
            value={s.conds}
            onChange={(conds) => set({ conds })}
            hint={L('Separadas por «;». Ej.: 74 < x < 77 · x ≥ -6.2945e-3 · |x| < 2^-8 · x != 0', 'Separated by “;”. E.g.: 74 < x < 77 · x ≥ -6.2945e-3 · |x| < 2^-8 · x != 0')}
            invalid={I.parseConds(s.conds).errors.length > 0}
          />
        </>
      )}
      {s.mode === 'operar' && (
        <>
          <FieldRow>
            <TextField label="u" value={s.u} onChange={(u) => set({ u })} invalid={!F.parseRational(s.u)} />
            <TextField label="v" value={s.v} onChange={(v) => set({ v })} invalid={!F.parseRational(s.v)} />
          </FieldRow>
          <SelectField label={L('Operación', 'Operation')} value={s.op} onChange={(op) => set({ op })} options={[{ value: '+', label: 'u + v' }, { value: '-', label: 'u − v' }, { value: '*', label: 'u × v' }, { value: '/', label: 'u ÷ v' }]} />
        </>
      )}
      <SelectField
        label={L('Palabra', 'Word')}
        value={s.layout}
        onChange={(layout) => set({ layout })}
        options={[
          { value: '1-7-8', label: L('16 bits del texto: 1 signo · 7 exp · 8 mantisa', 'Textbook 16 bits: 1 sign · 7 exp · 8 mantissa') },
          { value: '1-5-10', label: L('IEEE binary16: 1 signo · 5 exp · 10 mantisa', 'IEEE binary16: 1 sign · 5 exp · 10 mantissa') },
          { value: 'custom', label: L('Personalizada', 'Custom') },
        ]}
      />
      {s.layout === 'custom' && (
        <FieldRow>
          <IntField label={L('Bits exponente', 'Exponent bits')} value={s.w} onChange={(w) => set({ w })} min={2} max={11} />
          <IntField label={L('Bits mantisa', 'Mantissa bits')} value={s.m} onChange={(m) => set({ m })} min={1} max={52} />
        </FieldRow>
      )}
      <SelectField label={L('Exponente', 'Exponent')} value={s.expMode} onChange={(expMode) => set({ expMode })} options={(Object.keys(EXP_LABEL) as Q.ExpMode[]).map((k) => ({ value: k, label: EXP_LABEL[k] }))} />
      <SelectField label={L('Redondeo de la mantisa', 'Mantissa rounding')} value={s.round} onChange={(round) => set({ round })} options={(Object.keys(ROUND_LABEL) as Q.RoundMode[]).map((k) => ({ value: k, label: ROUND_LABEL[k] }))} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage
      title={L('Máquina binaria de 16 bits', '16-bit binary machine')}
      topic={TOPIC}
      description={L(
        'La palabra de 16 bits del texto de la materia (1 bit de signo, 7 de exponente, 8 de mantisa) con las reglas de IEEE 754, o con las convenciones alternativas del Cap. 1. Paso a paso de almacenamiento, lectura, vecinos, operaciones y bits desconocidos que deben cumplir una condición.',
        'The 16-bit word from the course textbook (1 sign bit, 7 exponent bits, 8 mantissa bits) with the IEEE 754 rules, or with the alternative conventions of Ch. 1. Step by step storing, reading, neighbors, arithmetic, and unknown bits that must satisfy a condition.',
      )}
      theory={THEORY}
      inputs={inputs}
    >
      {d.mode === 'almacenar' && <Almacenar s={d} M={M} />}
      {d.mode === 'leer' && <Leer s={d} M={M} />}
      {d.mode === 'operar' && <Operar s={d} M={M} />}
      {d.mode === 'incognitas' && <Incognitas s={d} M={M} />}
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
          <span className={'bit ' + cls(i) + (b === '1' ? ' on' : '') + (b !== '0' && b !== '1' ? ' unknown' : '')}>{b}</span>
        </div>
      ))}
      <div className="word-legend">
        <span className="err-sign">■ {L('signo', 'sign')}</span>
        <span className="err-exp">■ {L('exponente', 'exponent')} ({M.w} bits{M.expMode === 'signo' ? L(': signo + magnitud', ': sign + magnitude') : ''})</span>
        <span className="err-man">■ {L('mantisa', 'mantissa')} ({M.m} bits, {L('1 implícito', 'implicit 1')})</span>
      </div>
    </div>
  )
}

function expTex(e: number, M: Q.Machine, bits: string): string {
  const b = Q.bias(M)
  if (b === null) return `e = ${e} \\;\\Rightarrow\\; \\underbrace{${e < 0 ? 1 : 0}}_{\\text{${L('signo exp.', 'exp. sign')}}}\\ \\underbrace{${bits.slice(1)}}_{|e| = ${Math.abs(e)}}`
  return `E = e + \\text{${L('sesgo', 'bias')}} = ${e} + ${b} = ${e + b} = (${bits})_2`
}

/* ─────────────── almacenar ─────────────── */

function Almacenar({ s, M }: { s: S; M: Q.Machine }) {
  const r = useMemo(() => F.parseRational(s.x), [s.x])
  const st = useMemo(() => (r ? Q.store(r, M) : null), [r, M.w, M.m, M.expMode, M.round])
  if (!r || !st) return <Alert kind="error">{L('Número inválido. Escribe un decimal (−6.2945e-3, 74.89) o una fracción (1/3).', 'Invalid number. Type a decimal (−6.2945e-3, 74.89) or a fraction (1/3).')}</Alert>
  if (st.zero) return <Alert kind="info">{L('x = 0 se almacena con todos los bits en cero.', 'x = 0 is stored with all bits set to zero.')}</Alert>
  const failed = (st.overflow && !st.infinite) || st.underflow
  const err = failed || st.infinite ? null : Q.add(st.value, Q.neg(r))
  const rel = err ? Q.div(absR(err), absR(r)) : null
  return (
    <>
      <Stats
        items={[
          { label: L('Valor almacenado', 'Stored value'), value: st.infinite ? (st.sign ? '−∞' : '+∞') : failed ? (st.overflow ? 'overflow' : 'underflow → 0') : sci(st.value), accent: true, hint: st.subnormal ? 'subnormal' : st.exact ? L('representación exacta', 'exact representation') : st.roundedUp ? L('mantisa redondeada hacia arriba', 'mantissa rounded up') : L('mantisa truncada', 'mantissa chopped') },
          { label: L('Palabra (hex)', 'Word (hex)'), value: failed ? '—' : '0x' + F.bitsToHex(st.bits.padStart(Math.ceil(st.bits.length / 4) * 4, '0')) },
          { label: L('Error absoluto', 'Absolute error'), value: err ? sci(absR(err), 4) : '—' },
          { label: L('Error relativo', 'Relative error'), value: rel ? sci(rel, 4) : '—', hint: L(`cota: δ = ${sci(Q.props(M).delta, 4)}`, `bound: δ = ${sci(Q.props(M).delta, 4)}`) },
        ]}
      />
      {st.overflow && <Alert kind={st.infinite ? 'warn' : 'error'}>{st.infinite ? L('El exponente supera el máximo: IEEE 754 almacena ±∞ (exponente todo unos, mantisa cero).', 'The exponent exceeds the maximum: IEEE 754 stores ±∞ (all-ones exponent, zero mantissa).') : L('Overflow: el exponente no cabe en la palabra; la computadora deja de calcular.', 'Overflow: the exponent does not fit in the word; the computer stops calculating.')}</Alert>}
      {st.underflow && <Alert kind="warn">{L('Underflow: el número es menor que el más pequeño representable y se asimila a cero.', 'Underflow: the number is smaller than the smallest representable one and is taken as zero.')}</Alert>}
      {!failed && (
        <Card title={L(`Palabra de ${Q.totalBits(M)} bits`, `${Q.totalBits(M)}-bit word`)}>
          <Word bits={st.bits} M={M} />
        </Card>
      )}
      <Tabs
        tabs={[
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={storeSteps(r, st, M)} /></Card> },
          {
            label: L('Justo más grande / pequeño', 'Next larger / smaller'),
            content: (
              <Card>
                <KV
                  items={[
                    ['x', <Tex>{texSci(r, 10)}</Tex>],
                    [L('Justo más pequeño (≤ x)', 'Next smaller (≤ x)'), st.below ? <>{sci(st.below)}<br /><span className="muted">{F.ratToDecimal(st.below, 40)}</span></> : L('— (fuera de rango)', '— (out of range)')],
                    [L('Justo más grande (≥ x)', 'Next larger (≥ x)'), st.above ? <>{sci(st.above)}<br /><span className="muted">{F.ratToDecimal(st.above, 40)}</span></> : L('— (fuera de rango)', '— (out of range)')],
                    [L('Almacenado', 'Stored'), failed || st.infinite ? '—' : <b>{sci(st.value)}</b>],
                  ]}
                />
                <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>
                  {L(
                    <>
                      Los vecinos se obtienen truncando la mantisa en el bit {M.m} y sumándole una unidad al último bit. Para un número negativo, el “justo más pequeño” es el de mayor valor absoluto.
                      Entre ellos dos la computadora no puede representar ningún otro número.
                    </>,
                    <>
                      The neighbors are obtained by chopping the mantissa at bit {M.m} and adding one unit to the last bit. For a negative number, the “next smaller” one is the one with the larger
                      absolute value. The computer cannot represent any other number between the two.
                    </>,
                  )}
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
  out.push({ text: L('Convertir a binario (pasando por hexadecimal):', 'Convert to binary (via hexadecimal):'), tex: `x = (${F.ratToDecimal(r, 20)})_{10} = ${sg === '-' ? '-' : ''}${F.baseTex(hex, 16)} = ${sg === '-' ? '-' : ''}(${grp(bin.intDigits)}.${grp(bin.fracDigits)}${bin.terminates ? '' : '\\ldots'})_2` })
  const lead = st.mantBits.slice(0, M.m)
  const rest = st.mantBits.slice(M.m)
  if (st.subnormal || (M.expMode === 'ieee' && st.e0 < Q.expRange(M).emin)) {
    const { emin } = Q.expRange(M)
    out.push({ text: L(`El exponente ${st.e0} es menor que e_min = ${emin}: en IEEE 754 se guarda como subnormal, sin el 1 implícito y con E = 0:`, `The exponent ${st.e0} is less than e_min = ${emin}: IEEE 754 stores it as a subnormal, without the implicit 1 and with E = 0:`), tex: `x = ${sg}0.${grp(lead)}\\,|\\,${rest}\\ldots \\times 2^{${emin}}` })
  } else {
    out.push({ text: L('Normalizar a la forma 1.b₁b₂… × 2ᵉ:', 'Normalize to the form 1.b₁b₂… × 2ᵉ:'), tex: `x = ${sg}1.${grp(lead)}\\,|\\,${grp(rest)}${st.moreBits ? '\\ldots' : ''} \\times 2^{${st.e0}}` })
  }
  if (!st.overflow && !st.underflow && !st.subnormal) out.push({ text: L('Exponente:', 'Exponent:'), tex: expTex(st.e, M, st.expBits) })
  const why =
    M.round === 'truncado'
      ? L(`Truncado: se ignoran los bits a partir del ${M.m + 1}.º.`, `Chopping: bits from the ${M.m + 1}th on are discarded.`)
      : M.round === 'redondeo'
        ? L(
            `Redondeo (texto): el bit ${M.m + 1} es ${st.guard} ⇒ ${st.guard ? `se suma 1 al bit ${M.m}` : 'se dejan los primeros bits sin cambio'}.`,
            `Rounding (textbook): bit ${M.m + 1} is ${st.guard} ⇒ ${st.guard ? `add 1 to bit ${M.m}` : 'the leading bits are left unchanged'}.`,
          )
        : L(
            `Redondeo IEEE (al más cercano, empate a par): bit ${M.m + 1} = ${st.guard}, bits siguientes ${st.sticky ? 'con algún 1' : 'todos 0'}${st.guard && !st.sticky ? ` ⇒ empate exacto: se elige la mantisa par (último bit ${(st.Ntrunc & 1n) === 1n ? '1 → sube' : '0 → se queda'})` : st.guard ? ' ⇒ más de la mitad: se suma 1' : ' ⇒ menos de la mitad: se trunca'}.`,
            `IEEE rounding (to nearest, ties to even): bit ${M.m + 1} = ${st.guard}, following bits ${st.sticky ? 'contain some 1' : 'all 0'}${st.guard && !st.sticky ? ` ⇒ exact tie: the even mantissa is chosen (last bit ${(st.Ntrunc & 1n) === 1n ? '1 → round up' : '0 → stays'})` : st.guard ? ' ⇒ more than half: add 1' : ' ⇒ less than half: chop'}.`,
          )
  const Nbits = (n: bigint, sub: boolean) => (sub ? n.toString(2).padStart(M.m, '0') : n.toString(2).slice(1))
  out.push({
    text: L(`Mantisa de ${M.m} bits. ${why}`, `${M.m}-bit mantissa. ${why}`),
    tex: `${st.subnormal ? '0' : '1'}.${grp(lead)} ${st.roundedUp ? `+ 0.${'0'.repeat(M.m - 1)}1 = ${st.carry ? '10.' + '0'.repeat(M.m) : (st.subnormal ? '0.' : '1.') + grp(Nbits(st.N, st.subnormal))}` : ''}${st.carry ? `\\;\\Rightarrow\\; 1.${'0'.repeat(M.m)}\\times 2^{${st.e}}` : ''}`,
  })
  if (st.infinite) {
    out.push({ text: L('El exponente resultante no cabe (E sería todo unos): se almacena ±∞.', 'The resulting exponent does not fit (E would be all ones): ±∞ is stored.'), tex: `\\text{${L('palabra', 'word')}} = ${st.bits}` })
    return out
  }
  if (st.overflow || st.underflow) return out
  out.push({ text: L('Palabra almacenada (signo | exponente | mantisa):', 'Stored word (sign | exponent | mantissa):'), tex: `\\underbrace{${st.sign}}_{\\sigma}\\ \\underbrace{${st.expBits}}_{\\text{${L('exponente', 'exponent')}}}\\ \\underbrace{${grp(st.manBits)}}_{\\text{${L('mantisa', 'mantissa')}}}` })
  out.push({
    text: L('Número que realmente guarda la computadora:', 'Number the computer actually stores:'),
    tex: `x_A = ${sg}${st.subnormal ? '0' : '1'}.${grp(st.manBits)}\\times 2^{${st.subnormal ? Q.expRange(M).emin : st.e}} = ${texSci(st.value, 13)}`,
  })
  if (!st.exact) {
    const err = Q.add(st.value, Q.neg(r))
    out.push({ text: L('Error de representación:', 'Representation error:'), tex: `|x - x_A| = ${texSci(absR(err), 5)},\\qquad \\frac{|x - x_A|}{|x|} = ${texSci(Q.div(absR(err), absR(r)), 5)} \\le \\delta = ${texSci(Q.props(M).delta, 5)}` })
  }
  return out
}

/* ─────────────── leer ─────────────── */

function Leer({ s, M }: { s: S; M: Q.Machine }) {
  const bits = s.bits.replace(/\s+/g, '')
  const total = Q.totalBits(M)
  if (bits.length !== total || /[^01]/.test(bits)) return <Alert kind="error">{L(`Escribe exactamente ${total} ceros y unos.`, `Type exactly ${total} zeros and ones.`)}</Alert>
  const dd = Q.decode(bits, M)
  const b = Q.bias(M)
  const sg = dd.sign ? '-' : '+'
  const steps: { text?: string; tex?: string }[] = [
    { text: L('Separar los campos:', 'Split the fields:'), tex: `\\underbrace{${dd.sign}}_{\\sigma}\\ \\underbrace{${dd.expBits}}_{\\text{${L('exponente', 'exponent')}}}\\ \\underbrace{${grp(dd.manBits)}}_{\\text{${L('mantisa', 'mantissa')}}}` },
  ]
  if (dd.kind === 'infinito' || dd.kind === 'NaN') steps.push({ text: L('Exponente todo unos (IEEE 754):', 'All-ones exponent (IEEE 754):'), tex: dd.kind === 'NaN' ? `\\text{${L('mantisa', 'mantissa')}} \\ne 0 \\Rightarrow \\text{NaN}` : `\\text{${L('mantisa', 'mantissa')}} = 0 \\Rightarrow x = ${sg}\\infty` })
  else if (dd.kind === 'cero') steps.push({ text: L('Todos los bits (salvo quizá el signo) son cero:', 'All bits (except perhaps the sign) are zero:'), tex: `x = ${sg}0` })
  else {
    if (dd.kind === 'subnormal') steps.push({ text: L('Exponente todo ceros con mantisa ≠ 0 (IEEE 754): subnormal, sin 1 implícito.', 'All-zeros exponent with mantissa ≠ 0 (IEEE 754): subnormal, no implicit 1.'), tex: `e = e_{\\min} = ${dd.e}` })
    else if (b === null) steps.push({ text: L('Exponente con signo:', 'Signed exponent:'), tex: `(${dd.expBits[0] === '1' ? '-' : '+'}${dd.expBits.slice(1)})_2 = ${dd.e}` })
    else steps.push({ text: L('Exponente: convertir a decimal y restar el sesgo:', 'Exponent: convert to decimal and subtract the bias:'), tex: `(${dd.expBits})_2 = ${parseInt(dd.expBits, 2)} \\;\\Rightarrow\\; e = ${parseInt(dd.expBits, 2)} - ${b} = ${dd.e}` })
    const lead = dd.kind === 'subnormal' ? '0' : '1'
    const terms = [...dd.manBits].map((c, i) => (c === '1' ? `2^{-${i + 1}}` : '')).filter(Boolean)
    steps.push({ text: L('Valor:', 'Value:'), tex: `x = ${sg}(${lead}.${grp(dd.manBits)})_2\\times 2^{${dd.e}} = ${sg}\\left(${lead === '1' ? '2^0' : '0'}${terms.length ? ' + ' + terms.join(' + ') : ''}\\right)\\times 2^{${dd.e}} = ${texSci(dd.value, 16)}` })
  }
  return (
    <>
      <Stats items={[{ label: L('Valor', 'Value'), value: dd.kind === 'infinito' ? (dd.sign ? '−∞' : '+∞') : dd.kind === 'NaN' ? 'NaN' : sci(dd.value, 16), accent: true, hint: kindLabel(dd.kind) }, { label: L('Exponente e', 'Exponent e'), value: String(dd.e) }, { label: 'Hex', value: '0x' + F.bitsToHex(bits.padStart(Math.ceil(bits.length / 4) * 4, '0')) }]} />
      <Card title={L(`Palabra de ${total} bits`, `${total}-bit word`)}>
        <Word bits={bits} M={M} />
      </Card>
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps steps={steps} />
        {dd.kind !== 'infinito' && dd.kind !== 'NaN' && <div className="exact" style={{ marginTop: 10 }}>{F.ratToDecimal(dd.value, 120)}</div>}
      </Card>
    </>
  )
}

/* ─────────────── operar ─────────────── */

function Operar({ s, M }: { s: S; M: Q.Machine }) {
  const u = F.parseRational(s.u), v = F.parseRational(s.v)
  if (!u || !v) return <Alert kind="error">{L('u y v deben ser números decimales válidos.', 'u and v must be valid decimal numbers.')}</Alert>
  if (s.op === '/' && v.num === 0n) return <Alert kind="error">{L('División entre cero.', 'Division by zero.')}</Alert>
  const su = Q.store(u, M), sv = Q.store(v, M)
  if (su.overflow || sv.overflow || su.underflow || sv.underflow) return <Alert kind="error">{L('u o v no se pueden almacenar (overflow/underflow).', 'u or v cannot be stored (overflow/underflow).')}</Alert>
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
          { label: L('z en la máquina', 'z on the machine'), value: sz.zero ? '0' : sz.infinite ? '∞' : sz.overflow ? 'overflow' : sci(sz.value), accent: true },
          { label: L('z exacto', 'exact z'), value: sci(exact) },
          { label: L('Error absoluto', 'Absolute error'), value: sci(absR(errZ), 4) },
          { label: L('Error relativo', 'Relative error'), value: relZ ? sci(relZ, 4) : '—', hint: relZ && Q.ratToNum(relZ) > 10 * Q.ratToNum(Q.props(M).delta) ? L('¡mucho mayor que δ! (cancelación)', 'much larger than δ! (cancellation)') : undefined },
        ]}
      />
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps
          steps={[
            { text: L('1. Almacenar u:', '1. Store u:'), tex: `u = ${texSci(u)} \\to u_C = ${su.sign ? '-' : ''}1.${grp(su.manBits)}\\times 2^{${su.e}} = ${texSci(su.value)}` },
            { text: L('2. Almacenar v:', '2. Store v:'), tex: `v = ${texSci(v)} \\to v_C = ${sv.sign ? '-' : ''}1.${grp(sv.manBits)}\\times 2^{${sv.e}} = ${texSci(sv.value)}` },
            { text: L('3. Operar con los números almacenados (exacto):', '3. Operate on the stored numbers (exactly):'), tex: `u_C ${opTex} v_C = ${texSci(zc, 16)}` },
            { text: L('4. Almacenar el resultado:', '4. Store the result:'), tex: sz.zero ? 'z_C = 0' : `z_C = ${sz.sign ? '-' : ''}1.${grp(sz.manBits)}\\times 2^{${sz.e}} = ${texSci(sz.value)}` },
            { text: L('5. Comparar con el valor exacto:', '5. Compare with the exact value:'), tex: `z = u ${opTex} v = ${texSci(exact, 16)},\\qquad \\frac{|z - z_C|}{|z|} = ${relZ ? texSci(relZ, 4) : '-'}` },
          ]}
        />
      </Card>
      <Card title={L('Palabras almacenadas', 'Stored words')}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div><div className="field-label">u_C</div><Word bits={su.bits} M={M} /></div>
          <div><div className="field-label">v_C</div><Word bits={sv.bits} M={M} /></div>
          {!sz.zero && !sz.overflow && !sz.underflow && <div><div className="field-label">z_C</div><Word bits={sz.bits} M={M} /></div>}
        </div>
      </Card>
    </>
  )
}

/* ─────────────── bits desconocidos ─────────────── */

const REL_TEX: Record<I.Rel, string> = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge', '=': '=', '!=': '\\ne' }
/** Decimal exacto si es corto (los valores de una palabra son fracciones binarias); si no, notación científica. */
const decOrSci = (r: F.Rational, tex = false) => {
  const d = F.ratToDecimal(r, 24)
  if (!d.includes('…') && d.replace(/^-?0\.0*/, '').replace('-', '').length <= 18) return tex ? d : d.replace('-', '−')
  return tex ? texSci(r, 10) : sci(r, 12)
}
const condTex = (c: I.Cond) => `${c.abs ? '|x|' : 'x'} ${REL_TEX[c.rel]} ${decOrSci(c.value, true)}`
/** palabra con espacios entre campos: σ E M */
const spaced = (b: string, M: Q.Machine) => `${b[0]} ${b.slice(1, 1 + M.w)} ${b.slice(1 + M.w)}`
const valueText = (d: Q.Decoded) => (d.kind === 'infinito' ? (d.sign ? '−∞' : '+∞') : d.kind === 'NaN' ? 'NaN' : decOrSci(d.value) + (d.kind === 'subnormal' ? ' (subnormal)' : ''))

/** Suma TeX de bits fijos + variables con su peso: «51 + 8a + 2b». */
function sumTex(fixed: string, terms: string[]): string {
  return [fixed, ...terms].filter((t, i) => i > 0 || t !== '0' || !terms.length).join(' + ') || '0'
}

const MAX_ROWS = 256

function Incognitas({ s, M }: { s: S; M: Q.Machine }) {
  const total = Q.totalBits(M)
  const p = I.parsePattern(s.pattern, total)
  if (!p.ok) return <Alert kind="error">{p.error}</Alert>
  const { conds, errors } = I.parseConds(s.conds)
  if (errors.length) return <Alert kind="error">{errors.join(' ')}</Alert>
  if (!p.vars.length) return <Alert kind="info">{L('La palabra no tiene incógnitas: escribe letras (a, b, …) en los bits desconocidos.', 'The word has no unknowns: type letters (a, b, …) for the unknown bits.')}</Alert>
  if (!conds.length) return <Alert kind="info">{L('Escribe al menos una condición sobre x, por ejemplo «x < 77» o «74 < x < 77».', 'Type at least one condition on x, e.g. “x < 77” or “74 < x < 77”.')}</Alert>

  const { chars, vars } = p
  const rows = I.solve(chars, vars, conds, M)
  const sols = rows.filter((r) => r.ok)
  const forced = I.forced(rows, vars)
  const finite = sols.filter((r) => r.d.kind !== 'infinito' && r.d.kind !== 'NaN')
  const byValue = [...finite].sort((a, b) => Q.ratToNum(a.d.value) - Q.ratToNum(b.d.value))
  const assign = (r: I.Row) => vars.map((v, i) => `${v} = ${r.values[i]}`).join(', ')
  const pinned = vars.map((v, i) => (forced[i] === 'libre' ? null : `${v} = ${forced[i]}`)).filter(Boolean)

  // expresiones de cada campo en función de las incógnitas
  const b = Q.bias(M)
  const signC = chars[0]
  const expF = I.fieldWeights(chars, 1, 1 + M.w, vars)
  const manF = I.fieldWeights(chars, 1 + M.w, total, vars)
  const expStr = chars.slice(1, 1 + M.w).join('')
  const manStr = chars.slice(1 + M.w).join('')
  const steps: { text?: string; tex?: string }[] = [
    { text: L('Separar los campos de la plantilla:', 'Split the template into fields:'), tex: `\\underbrace{${signC}}_{\\sigma}\\ \\underbrace{${expStr}}_{\\text{${L('exponente', 'exponent')}}}\\ \\underbrace{${grp(manStr)}}_{\\text{${L('mantisa', 'mantissa')}}}` },
  ]
  if (b !== null) {
    const terms = expF.weights.map((w) => `${2 ** w.pow}${w.v}`)
    steps.push(
      terms.length
        ? { text: L('Exponente en función de las incógnitas:', 'Exponent in terms of the unknowns:'), tex: `E = (${expStr})_2 = ${sumTex(String(expF.fixed), terms)} \\;\\Rightarrow\\; e = E - ${b}` }
        : { text: L('Exponente (no tiene incógnitas):', 'Exponent (no unknowns):'), tex: `E = (${expStr})_2 = ${expF.fixed} \\;\\Rightarrow\\; e = ${expF.fixed} - ${b} = ${Number(expF.fixed) - b}` },
    )
  } else {
    const mag = I.fieldWeights(chars, 2, 1 + M.w, vars)
    const terms = mag.weights.map((w) => `${2 ** w.pow}${w.v}`)
    const sg = chars[1] === '0' ? '+' : chars[1] === '1' ? '-' : `(-1)^{${chars[1]}}`
    steps.push({ text: L('Exponente con signo:', 'Signed exponent:'), tex: `e = ${sg}\\,(${expStr.slice(1)})_2 = ${sg}\\left(${sumTex(String(mag.fixed), terms)}\\right)` })
  }
  {
    const fixedMan: F.Rational = { num: (1n << BigInt(M.m)) + manF.fixed, den: 1n << BigInt(M.m) }
    const terms = manF.weights.map((w) => `2^{-${M.m - w.pow}}${w.v}`)
    steps.push({ text: L('Mantisa (con el 1 implícito):', 'Mantissa (with the implicit 1):'), tex: `m = (1.${grp(manStr)})_2 = ${sumTex(F.ratToDecimal(fixedMan, 40), terms)}` })
  }
  const sgnTex = signC === '0' ? '' : signC === '1' ? '-' : `(-1)^{${signC}}\\,`
  steps.push({ text: L('Valor representado:', 'Represented value:'), tex: `x = ${sgnTex}m \\times 2^{e}` })
  // signo y exponente fijos (y normales): x es lineal en las incógnitas de la mantisa
  const special = M.expMode === 'ieee' && (/^0+$/.test(expStr) || /^1+$/.test(expStr))
  if (/^[01]$/.test(signC) && /^[01]+$/.test(expStr) && !special && manF.weights.length) {
    const e = Q.decodeExp(expStr, M)
    const pw = (k: number): F.Rational => (k >= 0 ? { num: 1n << BigInt(k), den: 1n } : { num: 1n, den: 1n << BigInt(-k) })
    const C = Q.mul({ num: (1n << BigInt(M.m)) + manF.fixed, den: 1n << BigInt(M.m) }, pw(e))
    const coef = new Map<string, F.Rational>()
    for (const w of manF.weights) coef.set(w.v, Q.add(coef.get(w.v) ?? { num: 0n, den: 1n }, pw(e - (M.m - w.pow))))
    const lin = [decOrSci(C, true), ...[...coef].map(([v, c]) => `${c.num === c.den ? '' : decOrSci(c, true)}\\,${v}`)].join(' + ')
    steps.push({ text: L(`Con e = ${String(e).replace('-', '−')} fijo, x queda lineal en las incógnitas:`, `With e = ${String(e).replace('-', '−')} fixed, x is linear in the unknowns:`), tex: `x = ${signC === '1' ? `-\\left(${lin}\\right)` : lin}` })
  }
  if (M.expMode === 'ieee' && expF.weights.length) steps.push({ text: L('(IEEE 754: si el exponente queda todo en ceros es subnormal o cero; todo en unos es ∞ o NaN. La tabla ya lo tiene en cuenta.)', '(IEEE 754: an all-zeros exponent means subnormal or zero; all ones means ∞ or NaN. The table already accounts for it.)') })
  steps.push({ text: L(`Condiciones (deben cumplirse todas):`, 'Conditions (all must hold):'), tex: conds.map(condTex).join(',\\qquad ') })
  steps.push({ text: L(`Probar las 2^${vars.length} = ${rows.length} combinaciones de ${vars.join(', ')} (tabla de abajo).`, `Try all 2^${vars.length} = ${rows.length} combinations of ${vars.join(', ')} (table below).`) })
  steps.push({
    text: !sols.length
      ? L('Ninguna combinación cumple las condiciones.', 'No combination satisfies the conditions.')
      : sols.length === 1
        ? L(`Única solución: ${assign(sols[0])} → x = ${valueText(sols[0].d)}.`, `Unique solution: ${assign(sols[0])} → x = ${valueText(sols[0].d)}.`)
        : L(`${sols.length} soluciones.${pinned.length ? ` En todas: ${pinned.join(', ')}.` : ''}`, `${sols.length} solutions.${pinned.length ? ` In all of them: ${pinned.join(', ')}.` : ''}`),
  })

  type R = I.Row & { i: number }
  const shown: R[] = (rows.length <= MAX_ROWS ? rows : sols.slice(0, MAX_ROWS)).map((r, i) => ({ ...r, i }))
  const columns: Column<R>[] = [
    ...vars.map((v, k): Column<R> => ({ key: 'v' + k, tex: v, fmt: 'raw', align: 'center', get: (r) => r.values[k] })),
    { key: 'bits', label: L('Palabra', 'Word'), fmt: 'raw', get: (r) => <span className="mono">{spaced(r.bits, M)}</span> },
    { key: 'x', tex: 'x', fmt: 'raw', align: 'right', get: (r) => valueText(r.d) },
    ...(conds.length > 1 ? conds.map((c, k): Column<R> => ({ key: 'c' + k, tex: condTex(c), fmt: 'raw', align: 'center', get: (r) => (r.checks[k] ? '✓' : '✗') })) : []),
    { key: 'ok', label: L('Cumple', 'Holds'), fmt: 'raw', align: 'center', get: (r) => (r.ok ? '✓' : '✗') },
  ]

  return (
    <>
      <Stats
        items={[
          { label: L('Soluciones', 'Solutions'), value: `${sols.length} / ${rows.length}`, accent: true, hint: L(`${vars.length} incógnita${vars.length > 1 ? 's' : ''}: ${vars.join(', ')}`, `${vars.length} unknown${vars.length > 1 ? 's' : ''}: ${vars.join(', ')}`) },
          { label: L('Bits determinados', 'Determined bits'), value: sols.length ? (pinned.length ? pinned.join(', ') : L('ninguno', 'none')) : '—', hint: sols.length ? L('valen lo mismo en todas las soluciones', 'same value in every solution') : undefined },
          { label: L('Menor x que cumple', 'Smallest valid x'), value: byValue.length ? decOrSci(byValue[0].d.value) : '—', hint: byValue.length ? assign(byValue[0]) : undefined },
          { label: L('Mayor x que cumple', 'Largest valid x'), value: byValue.length ? decOrSci(byValue[byValue.length - 1].d.value) : '—', hint: byValue.length ? assign(byValue[byValue.length - 1]) : undefined },
        ]}
      />
      {!sols.length && <Alert kind="warn">{L('Ninguna combinación cumple todas las condiciones. Revisa los signos de las desigualdades o la plantilla.', 'No combination satisfies all the conditions. Check the inequality signs or the template.')}</Alert>}
      <Card title={L(`Plantilla de ${total} bits`, `${total}-bit template`)}>
        <Word bits={chars.join('')} M={M} />
      </Card>
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps steps={steps} />
      </Card>
      <Card title={rows.length <= MAX_ROWS ? L('Todas las combinaciones', 'All combinations') : L(`Soluciones (primeras ${Math.min(MAX_ROWS, sols.length)} de ${sols.length})`, `Solutions (first ${Math.min(MAX_ROWS, sols.length)} of ${sols.length})`)}>
        <DataTable columns={columns} rows={shown} highlight={(r) => r.ok} filename="bits_desconocidos" />
      </Card>
    </>
  )
}

function scilabIncognitas(s: S, M: Q.Machine): string {
  const total = Q.totalBits(M)
  const p = I.parsePattern(s.pattern, total)
  const { conds } = I.parseConds(s.conds)
  if (!p.ok) return `// ${L('Plantilla no válida', 'Invalid template')}`
  const b = Q.bias(M)
  const { emin } = Q.expRange(M)
  const rel: Record<I.Rel, string> = { '<': '<', '<=': '<=', '>': '>', '>=': '>=', '=': '==', '!=': '<>' }
  const cond = conds.map((c) => `${c.abs ? 'abs(x)' : 'x'} ${rel[c.rel]} ${Q.ratToNum(c.value)}`).join(' & ') || '%t'
  const expLine =
    b === null
      ? `  e = (1 - 2*strtod(part(bits, 2))) * bin2dec(part(bits, 3:${1 + M.w}));`
      : `  E = bin2dec(part(bits, 2:${1 + M.w})); e = E - ${b};`
  return `// ${L('Bits desconocidos: prueba todas las combinaciones', 'Unknown bits: try every combination')} (1 | ${M.w} | ${M.m}) — ${L('generado por NumLab', 'generated by NumLab')}
// ${L('Exponente', 'Exponent')}: ${EXP_LABEL[M.expMode]}
clear; clc;
plantilla = "${p.chars.join('')}";
vars = [${p.vars.map((v) => `"${v}"`).join(' ')}];
nv = size(vars, "*"); m = ${M.m};
for k = 0:2^nv-1
  bits = plantilla; val = [];
  for i = 1:nv
    val(i) = modulo(floor(k / 2^(nv - i)), 2);
    bits = strsubst(bits, vars(i), string(val(i)));
  end
  s = strtod(part(bits, 1));
${expLine}
  f = bin2dec(part(bits, ${2 + M.w}:${total})) / 2^m;
${
  M.expMode === 'ieee'
    ? `  if E == 0 then x = (-1)^s * f * 2^(${emin});          // ${L('subnormal o cero', 'subnormal or zero')}
  elseif E == 2^${M.w} - 1 then x = (-1)^s * %inf; if f <> 0 then x = %nan; end
  else x = (-1)^s * (1 + f) * 2^e; end`
    : `  x = (-1)^s * (1 + f) * 2^e;`
}
  ok = ${cond};
  mprintf("%s  %s  x = %.12e  %s\\n", strcat(string(val'), " "), bits, x, ${'string(ok)'});
end
`
}

/* ─────────────── propiedades ─────────────── */

function Propiedades({ M }: { M: Q.Machine }) {
  const P = Q.props(M)
  return (
    <Card title={L('Propiedades de esta máquina', 'Properties of this machine')}>
      <KV
        items={[
          [L('Rango del exponente', 'Exponent range'), `${P.emin} ≤ e ≤ ${P.emax}${Q.bias(M) !== null ? `  (${L('sesgo', 'bias')} ${Q.bias(M)})` : ''}`],
          [L('Número positivo más grande', 'Largest positive number'), sci(P.xmax, 16)],
          [L('Número positivo normal más pequeño', 'Smallest positive normal number'), sci(P.xmin, 16)],
          ...(P.minSub ? ([[L('Subnormal más pequeño', 'Smallest subnormal'), sci(P.minSub, 16)]] as [string, string][]) : []),
          [M.round === 'truncado' ? L('Unidad de redondeo δ = 2⁻ᵐ', 'Unit round-off δ = 2⁻ᵐ') : L('Unidad de redondeo δ = 2⁻⁽ᵐ⁺¹⁾', 'Unit round-off δ = 2⁻⁽ᵐ⁺¹⁾'), sci(P.delta, 10)],
          [L('Números representables (aprox.)', 'Representable numbers (approx.)'), P.count.toString()],
        ]}
      />
    </Card>
  )
}

/* ─────────────── teoría ─────────────── */

const THEORY_ES = (
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

const THEORY_EN = (
  <>
    <p>
      For convenience, the course textbook uses <b>16-bit</b> words: 1 bit for the sign, 7 for the exponent and 8 for the mantissa. The first digit (the 1 in <Tex>{'1.b_1b_2\\ldots'}</Tex>) is not
      stored.
    </p>
    <Tex block>{'x = (-1)^{\\sigma}\\times 1.b_1b_2\\ldots b_8 \\times 2^{E - \\text{bias}}'}</Tex>
    <p>
      <b>IEEE 754</b> with 7 exponent bits: bias <Tex>{'2^{6}-1 = 63'}</Tex>. <Tex>E = 0</Tex> is reserved for zero and the subnormals, and <Tex>{'E = 127'}</Tex> for ±∞ and NaN, so{' '}
      <Tex>{'-62 \\le e \\le 63'}</Tex>. The mantissa is rounded to nearest; in case of an exact tie, to even.
    </p>
    <p>
      <b>Textbook conventions (Ch. 1):</b> exponent with a sign bit (<Tex>{'-63\\le e\\le 63'}</Tex>), with bias 64 (<Tex>{'-64\\le e\\le 63'}</Tex>) or with bias 63 (<Tex>{'-63\\le e\\le 64'}</Tex>). The
      textbook's rounding looks only at the 9th bit: if it is 1, one unit is added to the 8th.
    </p>
    <p>Unit round-off:</p>
    <Tex block>{'\\delta = \\begin{cases} 2^{-m} = 2^{-8} = 0.00390625 & \\text{chopping}\\\\ 2^{-(m+1)} = 2^{-9} = 0.001953125 & \\text{rounding}\\end{cases}'}</Tex>
  </>
)

const THEORY = L(THEORY_ES, THEORY_EN)

/* ─────────────── Scilab ─────────────── */

function scilab(s: S, M: Q.Machine): string {
  if (s.mode === 'incognitas') return scilabIncognitas(s, M)
  const b = Q.bias(M)
  const x = s.mode === 'operar' ? s.u : s.x
  const { emin, emax } = Q.expRange(M)
  return `// ${L(`Almacenamiento en una palabra de ${Q.totalBits(M)} bits`, `Storing in a ${Q.totalBits(M)}-bit word`)} (1 | ${M.w} | ${M.m}) — ${L('generado por NumLab', 'generated by NumLab')}
// ${L('Exponente', 'Exponent')}: ${EXP_LABEL[M.expMode]}
// ${L('Redondeo: ', 'Rounding:')} ${ROUND_LABEL[M.round]}
clear; clc;
m = ${M.m}; emin = ${emin}; emax = ${emax};
function xa = almacenar(x, m, emin, emax, modo)
  if x == 0 then xa = 0; return; end
  s = sign(x); a = abs(x);
  e = floor(log2(a));
  if a >= 2^(e+1) then e = e + 1; end        // ${L('correccion por redondeo de log2', 'fix for log2 rounding')}
  if a < 2^e then e = e - 1; end
${M.expMode === 'ieee' ? '  if e < emin then e = emin; end              // subnormal: 0.f x 2^emin\n' : ''}  y = a / 2^e * 2^m;                          // ${L('mantisa escalada: 1bbbbbbbb.resto', 'scaled mantissa: 1bbbbbbbb.rest')}
  select modo
  case 'truncado' then N = floor(y);
  case 'redondeo' then N = floor(y + 0.5);    // ${L('bit m+1 = 1 => sube', 'bit m+1 = 1 => round up')}
  else                                        // ${L('IEEE: al mas cercano, empate a par', 'IEEE: to nearest, ties to even')}
    N = floor(y); r = y - N;
    if r > 0.5 | (r == 0.5 & modulo(N, 2) == 1) then N = N + 1; end
  end
  xa = s * N * 2^(e - m);
  if abs(xa) >= 2^(emax+1) then
    ${M.expMode === 'ieee' ? L('xa = s * %inf;  // overflow => infinito', 'xa = s * %inf;  // overflow => infinity') : "error('overflow');"}
  end
endfunction

x = ${x};
xa = almacenar(x, m, emin, emax, '${M.round}');
mprintf('x  = %.15e\\n', x);
mprintf('xA = %.15e\\n', xa);
mprintf('${L('error relativo', 'relative error')} = %.4e\\n', abs(x - xa)/abs(x));
${b !== null ? `e = floor(log2(abs(xa))); mprintf('${L('exponente e = %d, almacenado E', 'exponent e = %d, stored E')} = e + ${b} = %d = %s\\n', e, e + ${b}, dec2bin(e + ${b}, ${M.w}));\n` : ''}`
}
