import { useMemo } from 'react'
import { texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, IntField, MethodPage, SelectField, Stats, Steps } from '../../components/ui'
import { Bits, Seg, TextField, kindLabel } from './components'
import * as F from './float'
import { ieeeSteps } from './ieeeSteps'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

type Mode = 'dec2base' | 'base2dec' | 'ieee' | 'bits2dec'

interface S {
  mode: Mode
  dec: string
  beta: number
  digits: string
  maxFrac: number
  prec: F.Prec
  bits: string
}

const EX: Record<Mode, { label: string; value: Partial<S> }[]> = {
  dec2base: [
    { label: L('Ej. 1.1 · 74.38 → base 2', 'Ex. 1.1 · 74.38 → base 2'), value: { dec: '74.38', beta: 2 } },
    { label: L('Ej. 1.1 · 74.38 → base 8', 'Ex. 1.1 · 74.38 → base 8'), value: { dec: '74.38', beta: 8 } },
    { label: L('Ej. 1.1 · 74.38 → base 16', 'Ex. 1.1 · 74.38 → base 16'), value: { dec: '74.38', beta: 16 } },
    { label: '0.1 → base 2', value: { dec: '0.1', beta: 2 } },
    { label: '12.375 → base 2', value: { dec: '12.375', beta: 2 } },
    { label: '1/3 → base 2', value: { dec: '1/3', beta: 2 } },
    { label: '255.5 → base 16', value: { dec: '255.5', beta: 16 } },
    { label: '0.7 → base 8', value: { dec: '0.7', beta: 8 } },
    { label: '−45.8125 → base 2', value: { dec: '-45.8125', beta: 2 } },
  ],
  base2dec: [
    { label: '(1011.011)₂', value: { digits: '1011.011', beta: 2 } },
    { label: '(0.0001100110011)₂', value: { digits: '0.0001100110011', beta: 2 } },
    { label: '(FF.8)₁₆', value: { digits: 'FF.8', beta: 16 } },
    { label: '(777.4)₈', value: { digits: '777.4', beta: 8 } },
  ],
  ieee: [
    { label: L('−118.625 (media)', '−118.625 (half)'), value: { dec: '-118.625', prec: 16 } },
    { label: L('0.1 (media)', '0.1 (half)'), value: { dec: '0.1', prec: 16 } },
    { label: L('2049 (media, empate a par)', '2049 (half, tie to even)'), value: { dec: '2049', prec: 16 } },
    { label: L('−118.625 (simple)', '−118.625 (single)'), value: { dec: '-118.625', prec: 32 } },
    { label: L('0.1 (simple)', '0.1 (single)'), value: { dec: '0.1', prec: 32 } },
    { label: L('12.375 (simple)', '12.375 (single)'), value: { dec: '12.375', prec: 32 } },
    { label: L('0.1 (doble)', '0.1 (double)'), value: { dec: '0.1', prec: 64 } },
    { label: L('1/3 (doble)', '1/3 (double)'), value: { dec: '1/3', prec: 64 } },
    { label: L('16777217 (simple)', '16777217 (single)'), value: { dec: '16777217', prec: 32 } },
    { label: L('1e-40 (subnormal simple)', '1e-40 (single subnormal)'), value: { dec: '1e-40', prec: 32 } },
  ],
  bits2dec: [
    { label: L('0x3C00 (media)', '0x3C00 (half)'), value: { bits: '3C00', prec: 16 } },
    { label: L('0x7BFF (máx. media)', '0x7BFF (max. half)'), value: { bits: '7BFF', prec: 16 } },
    { label: L('0x0001 (media)', '0x0001 (half)'), value: { bits: '0001', prec: 16 } },
    { label: '0xC2ED4000', value: { bits: 'C2ED4000', prec: 32 } },
    { label: '0x3DCCCCCD', value: { bits: '3DCCCCCD', prec: 32 } },
    { label: '0x3FB999999999999A', value: { bits: '3FB999999999999A', prec: 64 } },
    { label: '0x7F800000 (∞)', value: { bits: '7F800000', prec: 32 } },
    { label: '0x00000001', value: { bits: '00000001', prec: 32 } },
  ],
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'dec2base', label: 'Decimal → base β' },
  { value: 'base2dec', label: 'Base β → decimal' },
  { value: 'ieee', label: L('Decimal → IEEE 754 (paso a paso)', 'Decimal → IEEE 754 (step by step)') },
  { value: 'bits2dec', label: 'IEEE 754 (hex/bits) → decimal' },
]

export function Conversion() {
  const [s, setS] = useLocalState<S>('errores:conversion', { mode: 'dec2base', dec: '0.1', beta: 2, digits: '1011.011', maxFrac: 40, prec: 32, bits: 'C2ED4000' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 200)

  const inputs = (
    <>
      <SelectField label={L('Tipo de conversión', 'Conversion type')} value={s.mode} onChange={(mode) => set({ mode })} options={MODES} />
      {(s.mode === 'dec2base' || s.mode === 'ieee') && <TextField label={L('Número decimal (o fracción p/q)', 'Decimal number (or fraction p/q)')} value={s.dec} onChange={(dec) => set({ dec })} hint={L('Se trabaja con aritmética racional EXACTA: 0.1, -12.375, 1/3, 2.5e-3', 'EXACT rational arithmetic is used: 0.1, -12.375, 1/3, 2.5e-3')} invalid={!F.parseRational(s.dec)} />}
      {s.mode === 'base2dec' && <TextField label={L('Número en base β', 'Number in base β')} value={s.digits} onChange={(digits) => set({ digits })} hint={L('Dígitos 0-9 y A-F, con punto opcional', 'Digits 0-9 and A-F, with an optional point')} invalid={!F.parseInBase(s.digits, s.beta)} />}
      {(s.mode === 'dec2base' || s.mode === 'base2dec') && (
        <>
          <IntField label="Base β" value={s.beta} onChange={(beta) => set({ beta })} min={2} max={16} />
          {s.mode === 'dec2base' && <IntField label={L('Máx. dígitos fraccionarios', 'Max. fractional digits')} value={s.maxFrac} onChange={(maxFrac) => set({ maxFrac })} min={1} max={200} hint={L('Se detiene antes si termina o se detecta el período', 'Stops earlier if it terminates or the period is detected')} />}
        </>
      )}
      {(s.mode === 'ieee' || s.mode === 'bits2dec') && (
        <div className="field">
          <span className="field-label">{L('Precisión', 'Precision')}</span>
          <Seg
            value={s.prec}
            onChange={(prec) => set({ prec })}
            options={[
              { value: 16, label: L('Media (16)', 'Half (16)') },
              { value: 32, label: L('Simple (32)', 'Single (32)') },
              { value: 64, label: L('Doble (64)', 'Double (64)') },
            ]}
          />
        </div>
      )}
      {s.mode === 'bits2dec' && <TextField palette="off" label={L('Hexadecimal o bits', 'Hexadecimal or bits')} value={s.bits} onChange={(bits) => set({ bits })} hint={L(`${s.prec / 4} dígitos hex o ${s.prec} bits (0/1). Se ignoran espacios.`, `${s.prec / 4} hex digits or ${s.prec} bits (0/1). Spaces are ignored.`)} invalid={!parseBits(s.bits, s.prec)} />}
      <Examples items={EX[s.mode]} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.conversion} topic={TOPIC} theory={THEORY.conversion} inputs={inputs} description={L('Cambio de base con el procedimiento completo de examen: divisiones sucesivas, multiplicaciones sucesivas, detección de período y codificación IEEE 754.', 'Base conversion with the full exam-style procedure: repeated division, repeated multiplication, period detection and IEEE 754 encoding.')}>
      {d.mode === 'dec2base' && <Dec2Base s={d} />}
      {d.mode === 'base2dec' && <Base2Dec s={d} />}
      {d.mode === 'ieee' && <ToIeee s={d} />}
      {d.mode === 'bits2dec' && <FromBits s={d} />}
    </MethodPage>
  )
}

function parseBits(src: string, p: F.Prec): string | null {
  const t = src.replace(/\s+/g, '').replace(/^0x/i, '')
  if (/^[01]+$/.test(t) && t.length === p) return t
  if (/^[0-9a-f]+$/i.test(t) && t.length === p / 4) return [...t].map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('')
  return null
}

function Dec2Base({ s }: { s: S }) {
  const r = useMemo(() => F.parseRational(s.dec), [s.dec])
  const c = useMemo(() => (r ? F.toBase(r, s.beta, s.maxFrac) : null), [r, s.beta, s.maxFrac])
  if (!r || !c) return <Alert kind="error">{L('Número inválido. Usa un decimal (−12.375, 1.5e-3) o una fracción (1/3).', 'Invalid number. Use a decimal (−12.375, 1.5e-3) or a fraction (1/3).')}</Alert>
  const beta = s.beta
  const D = (q: F.Rational, n = 12) => F.ratToDecimal(F.reduce(q), n)
  const fracR = F.reduce({ num: (r.num < 0n ? -r.num : r.num) % r.den, den: r.den })
  return (
    <>
      <Stats
        items={[
          { label: L('Resultado', 'Result'), value: <Tex>{F.baseTex(c, beta)}</Tex>, accent: true },
          { label: L('Parte entera', 'Integer part'), value: `(${c.intDigits})${sub(beta)}`, hint: L(`${c.intSteps.length} división(es)`, `${c.intSteps.length} division(s)`) },
          { label: L('Parte fraccionaria', 'Fractional part'), value: c.fracDigits ? L(`${c.fracDigits.length} dígito(s)`, `${c.fracDigits.length} digit(s)`) : '—', hint: c.terminates ? L('expansión finita', 'finite expansion') : c.periodStart >= 0 ? L(`periódica, período ${c.fracDigits.length - c.periodStart}`, `repeating, period ${c.fracDigits.length - c.periodStart}`) : L('cortada (máx. dígitos)', 'cut off (max. digits)') },
        ]}
      />
      {!c.terminates && (
        <Alert kind={c.periodStart >= 0 ? 'warn' : 'info'}>
          {c.periodStart >= 0 ? (
            L(
              <>
                El resto se repite: la expansión en base {beta} es <b>periódica</b> e infinita. En la computadora se tiene que cortar/redondear ⇒ <b>error de representación</b>. Un racional reducido p/q es finito
                en base β sólo si todos los factores primos de q dividen a β (q = {r.den.toString()}).
              </>,
              <>
                The remainder repeats: the base-{beta} expansion is <b>repeating</b> and infinite. The computer has to chop/round it ⇒ <b>representation error</b>. A reduced rational p/q is finite in base
                β only if every prime factor of q divides β (q = {r.den.toString()}).
              </>,
            )
          ) : (
            <>{L('Se alcanzó el máximo de dígitos sin terminar ni repetir.', 'The maximum number of digits was reached without terminating or repeating.')}</>
          )}
        </Alert>
      )}
      <div className="grid-2">
        <Card title={L('Parte entera: divisiones sucesivas', 'Integer part: repeated division')}>
          <DataTable
            filename="divisiones"
            columns={[
              { key: 'n', label: L('Dividendo', 'Dividend'), get: (x) => x.n.toString() },
              { key: 'q', label: L(`Cociente (÷${beta})`, `Quotient (÷${beta})`), get: (x) => x.q.toString() },
              { key: 'r', label: L('Residuo', 'Remainder'), get: (x) => <b>{F.DIGITS[x.r]}</b> },
            ]}
            rows={c.intSteps}
          />
          <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
            {L(<>Se leen los residuos de <b>abajo hacia arriba</b>: </>, <>Read the remainders from <b>bottom to top</b>: </>)}
            {c.intPart.toString()} = ({c.intDigits}){sub(beta)}
          </p>
        </Card>
        <Card title={L('Parte fraccionaria: multiplicaciones sucesivas', 'Fractional part: repeated multiplication')}>
          {c.fracSteps.length ? (
            <DataTable
              filename="multiplicaciones"
              columns={[
                { key: 'k', label: 'k', get: (_, i) => String(i + 1) },
                { key: 'f', label: L('Fracción rₖ', 'Fraction rₖ'), get: (x) => D({ num: x.num, den: x.den }) },
                { key: 'p', label: `rₖ × ${beta}`, get: (x) => D({ num: x.prodNum, den: x.den }) },
                { key: 'd', label: L('Dígito', 'Digit'), get: (x) => <b>{F.DIGITS[x.digit]}</b> },
              ]}
              rows={c.fracSteps}
              highlight={(_, i) => c.periodStart >= 0 && i >= c.periodStart}
            />
          ) : (
            <p className="muted">{L('Sin parte fraccionaria.', 'No fractional part.')}</p>
          )}
          <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
            {L(<>Se leen los dígitos de <b>arriba hacia abajo</b>.</>, <>Read the digits from <b>top to bottom</b>.</>)}{' '}
            {c.periodStart >= 0 && L('Las filas resaltadas forman el período.', 'The highlighted rows form the period.')}
          </p>
        </Card>
      </div>
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps
          steps={[
            { text: L('Separar parte entera y fraccionaria:', 'Split into integer and fractional parts:'), tex: `${c.neg ? '-' : ''}${D({ num: r.num < 0n ? -r.num : r.num, den: r.den }, 20)} = ${c.intPart} + ${D(fracR, 20)}` },
            { text: L(`Parte entera: dividir entre ${beta} hasta obtener cociente 0 y leer los residuos al revés:`, `Integer part: divide by ${beta} until the quotient is 0 and read the remainders in reverse:`), tex: `${c.intPart} = (${c.intDigits})_{${beta}}` },
            ...(c.fracSteps.length
              ? [
                  { text: L(`Parte fraccionaria: multiplicar por ${beta}, anotar la parte entera y seguir con la fracción:`, `Fractional part: multiply by ${beta}, write down the integer part and continue with the fraction:`), tex: `\\begin{array}{l}${c.fracSteps.slice(0, 8).map((x) => `${D({ num: x.num, den: x.den }, 10)} \\times ${beta} = ${D({ num: x.prodNum, den: x.den }, 10)} \\rightarrow ${F.DIGITS[x.digit]}`).join('\\\\ ')}${c.fracSteps.length > 8 ? '\\\\ \\vdots' : ''}\\end{array}` },
                ]
              : []),
            { text: L('Resultado:', 'Result:'), tex: `${D(r, 20)} = ${F.baseTex(c, beta)}` },
          ]}
        />
      </Card>
    </>
  )
}

const sub = (b: number) => String(b).split('').map((ch) => '₀₁₂₃₄₅₆₇₈₉'[Number(ch)]).join('')

function Base2Dec({ s }: { s: S }) {
  const r = useMemo(() => F.parseInBase(s.digits, s.beta), [s.digits, s.beta])
  if (!r) return <Alert kind="error">{L(`Número inválido para base ${s.beta}: usa sólo dígitos menores que ${s.beta}.`, `Invalid number for base ${s.beta}: use only digits less than ${s.beta}.`)}</Alert>
  const t = s.digits.trim().toUpperCase().replace(/^[+-]/, '')
  const [ip, fp = ''] = t.split('.')
  const terms: string[] = []
  ;[...ip].forEach((ch, i) => {
    const k = ip.length - 1 - i
    if (ch !== '0') terms.push(`${F.DIGITS.indexOf(ch)}\\cdot ${s.beta}^{${k}}`)
  })
  ;[...fp].forEach((ch, i) => {
    if (ch !== '0') terms.push(`${F.DIGITS.indexOf(ch)}\\cdot ${s.beta}^{-${i + 1}}`)
  })
  const vals: string[] = []
  ;[...ip].forEach((ch, i) => {
    const k = ip.length - 1 - i
    if (ch !== '0') vals.push(String(F.DIGITS.indexOf(ch) * s.beta ** k))
  })
  ;[...fp].forEach((ch, i) => {
    if (ch !== '0') vals.push(F.ratToDecimal(F.reduce({ num: BigInt(F.DIGITS.indexOf(ch)), den: BigInt(s.beta) ** BigInt(i + 1) }), 30))
  })
  const dec = F.ratToDecimal(r, 60)
  return (
    <>
      <Stats
        items={[
          { label: L('Valor decimal', 'Decimal value'), value: dec, accent: true },
          { label: L('Como fracción', 'As a fraction'), value: <Tex>{F.ratToTex(r)}</Tex> },
        ]}
      />
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps
          steps={[
            { text: L('Cada dígito se multiplica por la potencia de la base según su posición (positivas a la izquierda del punto, negativas a la derecha):', 'Each digit is multiplied by the power of the base given by its position (positive to the left of the point, negative to the right):'), tex: `(${t})_{${s.beta}} = ${terms.join(' + ') || '0'}` },
            { tex: `= ${vals.join(' + ') || '0'}` },
            { tex: `= ${s.digits.trim().startsWith('-') ? '-' : ''}${dec.replace('…', '\\ldots')}` },
          ]}
        />
      </Card>
    </>
  )
}

function ToIeee({ s }: { s: S }) {
  const r = useMemo(() => F.parseRational(s.dec), [s.dec])
  const data = useMemo(() => (r ? { enc: F.encodeIeee(r, s.prec), steps: ieeeSteps(r, s.prec) } : null), [r, s.prec])
  if (!r || !data) return <Alert kind="error">{L('Número inválido.', 'Invalid number.')}</Alert>
  const { enc, steps } = data
  const Fm = F.FORMATS[s.prec]
  return (
    <>
      <Stats
        items={[
          { label: L('Hexadecimal', 'Hexadecimal'), value: '0x' + F.bitsToHex(enc.bits), accent: true },
          { label: L('Valor almacenado', 'Stored value'), value: F.shortest(enc.value, s.prec) },
          { label: L('Exponente', 'Exponent'), value: enc.overflow ? '∞' : `E = ${enc.E}`, hint: enc.subnormal ? 'subnormal' : `e = ${enc.E - Fm.bias}` },
        ]}
      />
      <Card title={L('Resultado', 'Result')}>
        <Bits bits={enc.bits} prec={s.prec} labels={{ sign: `s = ${enc.sign}`, exp: `E = ${enc.E}`, man: enc.roundedUp ? L('redondeada hacia arriba', 'rounded up') : L('truncada (sin cambio)', 'chopped (unchanged)') }} />
      </Card>
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps steps={steps} />
      </Card>
    </>
  )
}

function FromBits({ s }: { s: S }) {
  const bits = parseBits(s.bits, s.prec)
  if (!bits) return <Alert kind="error">{L(`Escribe ${s.prec / 4} dígitos hexadecimales o ${s.prec} bits.`, `Type ${s.prec / 4} hexadecimal digits or ${s.prec} bits.`)}</Alert>
  const Fm = F.FORMATS[s.prec]
  const x = F.fromBits(bits, s.prec)
  const d = F.decompose(x, s.prec)
  const hexBin = [...F.bitsToHex(bits)].map((h) => `\\texttt{${h}} \\to ${parseInt(h, 16).toString(2).padStart(4, '0')}`).join(',\\ ')
  const fracTerms = [...d.manBits]
    .map((b, i) => (b === '1' ? `2^{-${i + 1}}` : null))
    .filter(Boolean)
    .slice(0, 10)
  const steps: { text?: string; tex?: string }[] = [
    { text: L('Cada dígito hexadecimal son 4 bits:', 'Each hexadecimal digit is 4 bits:'), tex: `\\begin{array}{l}${hexBin}\\end{array}` },
    { text: L('Separar los campos s | E | f:', 'Split the fields s | E | f:'), tex: `s = ${d.sign},\\quad E = (${d.expBits})_2 = ${d.E},\\quad f = (${d.manBits.replace(/0+$/, '') || '0'})_2` },
  ]
  if (d.kind === 'normal') {
    steps.push({ text: L('Exponente real (restar el sesgo):', 'True exponent (subtract the bias):'), tex: `e = E - ${Fm.bias} = ${d.E} - ${Fm.bias} = ${d.e}` })
    steps.push({ text: L('Mantisa con el 1 implícito:', 'Mantissa with the implicit 1:'), tex: `1.f = 1 + ${fracTerms.join(' + ') || '0'}${[...d.manBits].filter((b) => b === '1').length > 10 ? ' + \\cdots' : ''} = ${texNum(d.significand, 17)}` })
    steps.push({ text: L('Valor:', 'Value:'), tex: `x = (-1)^{${d.sign}} \\times ${texNum(d.significand, 17)} \\times 2^{${d.e}} = ${texNum(x, 17)}` })
  } else if (d.kind === 'subnormal') {
    steps.push({ text: L('E = 0 y f ≠ 0 ⇒ SUBNORMAL: no hay 1 implícito y el exponente es fijo:', 'E = 0 and f ≠ 0 ⇒ SUBNORMAL: there is no implicit 1 and the exponent is fixed:'), tex: `x = (-1)^{${d.sign}} \\times 0.f \\times 2^{${1 - Fm.bias}} = (-1)^{${d.sign}} \\times ${texNum(d.significand, 17)} \\times 2^{${1 - Fm.bias}} = ${texNum(x, 17)}` })
  } else if (d.kind === 'cero') steps.push({ text: L('E = 0 y f = 0 ⇒ cero con signo.', 'E = 0 and f = 0 ⇒ signed zero.'), tex: `x = ${d.sign ? '-' : '+'}0` })
  else if (d.kind === 'infinito') steps.push({ text: L('E todo unos y f = 0 ⇒ infinito.', 'E all ones and f = 0 ⇒ infinity.'), tex: `x = ${d.sign ? '-' : '+'}\\infty` })
  else steps.push({ text: L('E todo unos y f ≠ 0 ⇒ NaN (Not a Number).', 'E all ones and f ≠ 0 ⇒ NaN (Not a Number).') })
  const exact = F.exactDecimal(x)
  return (
    <>
      <Stats
        items={[
          { label: L('Valor', 'Value'), value: F.shortest(x, s.prec), accent: true },
          { label: L('Tipo', 'Kind'), value: <span className={'pill ' + d.kind}>{kindLabel(d.kind)}</span> },
          { label: L('Exponente', 'Exponent'), value: d.kind === 'normal' || d.kind === 'subnormal' ? `e = ${d.e}` : '—', hint: `E = ${d.E}` },
        ]}
      />
      <Card title={L('Campos', 'Fields')}>
        <Bits bits={bits} prec={s.prec} labels={{ sign: `s = ${d.sign}`, exp: `E = ${d.E}`, man: `f = ${d.frac}/2^${Fm.m}` }} />
      </Card>
      <Card title={L('Paso a paso', 'Step by step')}>
        <Steps steps={steps} />
        {Number.isFinite(x) && (
          <div style={{ marginTop: 10 }}>
            <span className="field-label">{L('Valor decimal exacto', 'Exact decimal value')}</span>
            <div className="exact" style={{ marginTop: 4 }}>
              {exact.length > 400 ? exact.slice(0, 400) + '…' : exact}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
