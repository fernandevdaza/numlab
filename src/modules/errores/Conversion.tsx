import { useMemo } from 'react'
import { texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, IntField, MethodPage, SelectField, Stats, Steps } from '../../components/ui'
import { Bits, Seg, TextField } from './components'
import * as F from './float'
import { ieeeSteps } from './ieeeSteps'
import { THEORY, TITLES, TOPIC } from './theory'

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
    { label: 'Ej. 1.1 · 74.38 → base 2', value: { dec: '74.38', beta: 2 } },
    { label: 'Ej. 1.1 · 74.38 → base 8', value: { dec: '74.38', beta: 8 } },
    { label: 'Ej. 1.1 · 74.38 → base 16', value: { dec: '74.38', beta: 16 } },
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
    { label: '−118.625 (media)', value: { dec: '-118.625', prec: 16 } },
    { label: '0.1 (media)', value: { dec: '0.1', prec: 16 } },
    { label: '2049 (media, empate a par)', value: { dec: '2049', prec: 16 } },
    { label: '−118.625 (simple)', value: { dec: '-118.625', prec: 32 } },
    { label: '0.1 (simple)', value: { dec: '0.1', prec: 32 } },
    { label: '12.375 (simple)', value: { dec: '12.375', prec: 32 } },
    { label: '0.1 (doble)', value: { dec: '0.1', prec: 64 } },
    { label: '1/3 (doble)', value: { dec: '1/3', prec: 64 } },
    { label: '16777217 (simple)', value: { dec: '16777217', prec: 32 } },
    { label: '1e-40 (subnormal simple)', value: { dec: '1e-40', prec: 32 } },
  ],
  bits2dec: [
    { label: '0x3C00 (media)', value: { bits: '3C00', prec: 16 } },
    { label: '0x7BFF (máx. media)', value: { bits: '7BFF', prec: 16 } },
    { label: '0x0001 (media)', value: { bits: '0001', prec: 16 } },
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
  { value: 'ieee', label: 'Decimal → IEEE 754 (paso a paso)' },
  { value: 'bits2dec', label: 'IEEE 754 (hex/bits) → decimal' },
]

export function Conversion() {
  const [s, setS] = useLocalState<S>('errores:conversion', { mode: 'dec2base', dec: '0.1', beta: 2, digits: '1011.011', maxFrac: 40, prec: 32, bits: 'C2ED4000' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 200)

  const inputs = (
    <>
      <SelectField label="Tipo de conversión" value={s.mode} onChange={(mode) => set({ mode })} options={MODES} />
      {(s.mode === 'dec2base' || s.mode === 'ieee') && <TextField label="Número decimal (o fracción p/q)" value={s.dec} onChange={(dec) => set({ dec })} hint="Se trabaja con aritmética racional EXACTA: 0.1, -12.375, 1/3, 2.5e-3" invalid={!F.parseRational(s.dec)} />}
      {s.mode === 'base2dec' && <TextField label="Número en base β" value={s.digits} onChange={(digits) => set({ digits })} hint="Dígitos 0-9 y A-F, con punto opcional" invalid={!F.parseInBase(s.digits, s.beta)} />}
      {(s.mode === 'dec2base' || s.mode === 'base2dec') && (
        <>
          <IntField label="Base β" value={s.beta} onChange={(beta) => set({ beta })} min={2} max={16} />
          {s.mode === 'dec2base' && <IntField label="Máx. dígitos fraccionarios" value={s.maxFrac} onChange={(maxFrac) => set({ maxFrac })} min={1} max={200} hint="Se detiene antes si termina o se detecta el período" />}
        </>
      )}
      {(s.mode === 'ieee' || s.mode === 'bits2dec') && (
        <div className="field">
          <span className="field-label">Precisión</span>
          <Seg
            value={s.prec}
            onChange={(prec) => set({ prec })}
            options={[
              { value: 16, label: 'Media (16)' },
              { value: 32, label: 'Simple (32)' },
              { value: 64, label: 'Doble (64)' },
            ]}
          />
        </div>
      )}
      {s.mode === 'bits2dec' && <TextField palette="off" label="Hexadecimal o bits" value={s.bits} onChange={(bits) => set({ bits })} hint={`${s.prec / 4} dígitos hex o ${s.prec} bits (0/1). Se ignoran espacios.`} invalid={!parseBits(s.bits, s.prec)} />}
      <Examples items={EX[s.mode]} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.conversion} topic={TOPIC} theory={THEORY.conversion} inputs={inputs} description="Cambio de base con el procedimiento completo de examen: divisiones sucesivas, multiplicaciones sucesivas, detección de período y codificación IEEE 754.">
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
  if (!r || !c) return <Alert kind="error">Número inválido. Usa un decimal (−12.375, 1.5e-3) o una fracción (1/3).</Alert>
  const beta = s.beta
  const D = (q: F.Rational, n = 12) => F.ratToDecimal(F.reduce(q), n)
  const fracR = F.reduce({ num: (r.num < 0n ? -r.num : r.num) % r.den, den: r.den })
  return (
    <>
      <Stats
        items={[
          { label: 'Resultado', value: <Tex>{F.baseTex(c, beta)}</Tex>, accent: true },
          { label: 'Parte entera', value: `(${c.intDigits})${sub(beta)}`, hint: `${c.intSteps.length} división(es)` },
          { label: 'Parte fraccionaria', value: c.fracDigits ? `${c.fracDigits.length} dígito(s)` : '—', hint: c.terminates ? 'expansión finita' : c.periodStart >= 0 ? `periódica, período ${c.fracDigits.length - c.periodStart}` : 'cortada (máx. dígitos)' },
        ]}
      />
      {!c.terminates && (
        <Alert kind={c.periodStart >= 0 ? 'warn' : 'info'}>
          {c.periodStart >= 0 ? (
            <>
              El resto se repite: la expansión en base {beta} es <b>periódica</b> e infinita. En la computadora se tiene que cortar/redondear ⇒ <b>error de representación</b>. Un racional reducido p/q es finito
              en base β sólo si todos los factores primos de q dividen a β (q = {r.den.toString()}).
            </>
          ) : (
            <>Se alcanzó el máximo de dígitos sin terminar ni repetir.</>
          )}
        </Alert>
      )}
      <div className="grid-2">
        <Card title="Parte entera: divisiones sucesivas">
          <DataTable
            filename="divisiones"
            columns={[
              { key: 'n', label: 'Dividendo', get: (x) => x.n.toString() },
              { key: 'q', label: `Cociente (÷${beta})`, get: (x) => x.q.toString() },
              { key: 'r', label: 'Residuo', get: (x) => <b>{F.DIGITS[x.r]}</b> },
            ]}
            rows={c.intSteps}
          />
          <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
            Se leen los residuos de <b>abajo hacia arriba</b>: {c.intPart.toString()} = ({c.intDigits}){sub(beta)}
          </p>
        </Card>
        <Card title="Parte fraccionaria: multiplicaciones sucesivas">
          {c.fracSteps.length ? (
            <DataTable
              filename="multiplicaciones"
              columns={[
                { key: 'k', label: 'k', get: (_, i) => String(i + 1) },
                { key: 'f', label: 'Fracción rₖ', get: (x) => D({ num: x.num, den: x.den }) },
                { key: 'p', label: `rₖ × ${beta}`, get: (x) => D({ num: x.prodNum, den: x.den }) },
                { key: 'd', label: 'Dígito', get: (x) => <b>{F.DIGITS[x.digit]}</b> },
              ]}
              rows={c.fracSteps}
              highlight={(_, i) => c.periodStart >= 0 && i >= c.periodStart}
            />
          ) : (
            <p className="muted">Sin parte fraccionaria.</p>
          )}
          <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
            Se leen los dígitos de <b>arriba hacia abajo</b>. {c.periodStart >= 0 && 'Las filas resaltadas forman el período.'}
          </p>
        </Card>
      </div>
      <Card title="Paso a paso">
        <Steps
          steps={[
            { text: 'Separar parte entera y fraccionaria:', tex: `${c.neg ? '-' : ''}${D({ num: r.num < 0n ? -r.num : r.num, den: r.den }, 20)} = ${c.intPart} + ${D(fracR, 20)}` },
            { text: `Parte entera: dividir entre ${beta} hasta obtener cociente 0 y leer los residuos al revés:`, tex: `${c.intPart} = (${c.intDigits})_{${beta}}` },
            ...(c.fracSteps.length
              ? [
                  { text: `Parte fraccionaria: multiplicar por ${beta}, anotar la parte entera y seguir con la fracción:`, tex: `\\begin{array}{l}${c.fracSteps.slice(0, 8).map((x) => `${D({ num: x.num, den: x.den }, 10)} \\times ${beta} = ${D({ num: x.prodNum, den: x.den }, 10)} \\rightarrow ${F.DIGITS[x.digit]}`).join('\\\\ ')}${c.fracSteps.length > 8 ? '\\\\ \\vdots' : ''}\\end{array}` },
                ]
              : []),
            { text: 'Resultado:', tex: `${D(r, 20)} = ${F.baseTex(c, beta)}` },
          ]}
        />
      </Card>
    </>
  )
}

const sub = (b: number) => String(b).split('').map((ch) => '₀₁₂₃₄₅₆₇₈₉'[Number(ch)]).join('')

function Base2Dec({ s }: { s: S }) {
  const r = useMemo(() => F.parseInBase(s.digits, s.beta), [s.digits, s.beta])
  if (!r) return <Alert kind="error">Número inválido para base {s.beta}: usa sólo dígitos menores que {s.beta}.</Alert>
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
          { label: 'Valor decimal', value: dec, accent: true },
          { label: 'Como fracción', value: <Tex>{F.ratToTex(r)}</Tex> },
        ]}
      />
      <Card title="Paso a paso">
        <Steps
          steps={[
            { text: 'Cada dígito se multiplica por la potencia de la base según su posición (positivas a la izquierda del punto, negativas a la derecha):', tex: `(${t})_{${s.beta}} = ${terms.join(' + ') || '0'}` },
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
  if (!r || !data) return <Alert kind="error">Número inválido.</Alert>
  const { enc, steps } = data
  const Fm = F.FORMATS[s.prec]
  return (
    <>
      <Stats
        items={[
          { label: 'Hexadecimal', value: '0x' + F.bitsToHex(enc.bits), accent: true },
          { label: 'Valor almacenado', value: F.shortest(enc.value, s.prec) },
          { label: 'Exponente', value: enc.overflow ? '∞' : `E = ${enc.E}`, hint: enc.subnormal ? 'subnormal' : `e = ${enc.E - Fm.bias}` },
        ]}
      />
      <Card title="Resultado">
        <Bits bits={enc.bits} prec={s.prec} labels={{ sign: `s = ${enc.sign}`, exp: `E = ${enc.E}`, man: enc.roundedUp ? 'redondeada hacia arriba' : 'truncada (sin cambio)' }} />
      </Card>
      <Card title="Paso a paso">
        <Steps steps={steps} />
      </Card>
    </>
  )
}

function FromBits({ s }: { s: S }) {
  const bits = parseBits(s.bits, s.prec)
  if (!bits) return <Alert kind="error">Escribe {s.prec / 4} dígitos hexadecimales o {s.prec} bits.</Alert>
  const Fm = F.FORMATS[s.prec]
  const x = F.fromBits(bits, s.prec)
  const d = F.decompose(x, s.prec)
  const hexBin = [...F.bitsToHex(bits)].map((h) => `\\texttt{${h}} \\to ${parseInt(h, 16).toString(2).padStart(4, '0')}`).join(',\\ ')
  const fracTerms = [...d.manBits]
    .map((b, i) => (b === '1' ? `2^{-${i + 1}}` : null))
    .filter(Boolean)
    .slice(0, 10)
  const steps: { text?: string; tex?: string }[] = [
    { text: 'Cada dígito hexadecimal son 4 bits:', tex: `\\begin{array}{l}${hexBin}\\end{array}` },
    { text: 'Separar los campos s | E | f:', tex: `s = ${d.sign},\\quad E = (${d.expBits})_2 = ${d.E},\\quad f = (${d.manBits.replace(/0+$/, '') || '0'})_2` },
  ]
  if (d.kind === 'normal') {
    steps.push({ text: 'Exponente real (restar el sesgo):', tex: `e = E - ${Fm.bias} = ${d.E} - ${Fm.bias} = ${d.e}` })
    steps.push({ text: 'Mantisa con el 1 implícito:', tex: `1.f = 1 + ${fracTerms.join(' + ') || '0'}${[...d.manBits].filter((b) => b === '1').length > 10 ? ' + \\cdots' : ''} = ${texNum(d.significand, 17)}` })
    steps.push({ text: 'Valor:', tex: `x = (-1)^{${d.sign}} \\times ${texNum(d.significand, 17)} \\times 2^{${d.e}} = ${texNum(x, 17)}` })
  } else if (d.kind === 'subnormal') {
    steps.push({ text: 'E = 0 y f ≠ 0 ⇒ SUBNORMAL: no hay 1 implícito y el exponente es fijo:', tex: `x = (-1)^{${d.sign}} \\times 0.f \\times 2^{${1 - Fm.bias}} = (-1)^{${d.sign}} \\times ${texNum(d.significand, 17)} \\times 2^{${1 - Fm.bias}} = ${texNum(x, 17)}` })
  } else if (d.kind === 'cero') steps.push({ text: 'E = 0 y f = 0 ⇒ cero con signo.', tex: `x = ${d.sign ? '-' : '+'}0` })
  else if (d.kind === 'infinito') steps.push({ text: 'E todo unos y f = 0 ⇒ infinito.', tex: `x = ${d.sign ? '-' : '+'}\\infty` })
  else steps.push({ text: 'E todo unos y f ≠ 0 ⇒ NaN (Not a Number).' })
  const exact = F.exactDecimal(x)
  return (
    <>
      <Stats
        items={[
          { label: 'Valor', value: F.shortest(x, s.prec), accent: true },
          { label: 'Tipo', value: <span className={'pill ' + d.kind}>{d.kind}</span> },
          { label: 'Exponente', value: d.kind === 'normal' || d.kind === 'subnormal' ? `e = ${d.e}` : '—', hint: `E = ${d.E}` },
        ]}
      />
      <Card title="Campos">
        <Bits bits={bits} prec={s.prec} labels={{ sign: `s = ${d.sign}`, exp: `E = ${d.E}`, man: `f = ${d.frac}/2^${Fm.m}` }} />
      </Card>
      <Card title="Paso a paso">
        <Steps steps={steps} />
        {Number.isFinite(x) && (
          <div style={{ marginTop: 10 }}>
            <span className="field-label">Valor decimal exacto</span>
            <div className="exact" style={{ marginTop: 4 }}>
              {exact.length > 400 ? exact.slice(0, 400) + '…' : exact}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
