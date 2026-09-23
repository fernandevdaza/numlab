import { useMemo, useState } from 'react'
import { evalNumber } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, MethodPage, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import { Bits, ExactDigits, KV, Seg, TextField } from './components'
import * as F from './float'
import { ieeeSteps, ratOfDouble } from './ieeeSteps'
import { absErrBig, bigFixed, evalBig, relErrBig } from './numeric'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  src: string
  prec: F.Prec
  /** bits fijados manualmente (al hacer clic en un bit o escribir hex) */
  bits: string | null
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: '0.1', value: { src: '0.1' } },
  { label: '1/3', value: { src: '1/3' } },
  { label: 'π', value: { src: 'pi' } },
  { label: '0.1 + 0.2', value: { src: '0.1 + 0.2' } },
  { label: '−118.625', value: { src: '-118.625' } },
  { label: '1', value: { src: '1' } },
  { label: '−0', value: { src: '-0' } },
  { label: '2⁵³ + 1', value: { src: '2^53 + 1' } },
  { label: 'menor normal', value: { src: '2^-1022', prec: 64 } },
  { label: 'menor subnormal', value: { src: '2^-1074', prec: 64 } },
  { label: 'máximo doble', value: { src: '(2 - 2^-52) * 2^1023', prec: 64 } },
  { label: 'máximo media (65504)', value: { src: '65504', prec: 16 } },
  { label: '65520 → ∞ (media)', value: { src: '65520', prec: 16 } },
  { label: '2049 en media', value: { src: '2049', prec: 16 } },
  { label: 'menor subnormal media', value: { src: '2^-24', prec: 16 } },
  { label: '∞', value: { src: 'Infinity' } },
  { label: 'NaN', value: { src: 'NaN' } },
]

/** Valor numérico de la entrada (acepta -0, Infinity, NaN). */
function parseInput(src: string): number {
  const t = src.trim()
  if (/^[+-]?inf(inity)?$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity
  if (/^nan$/i.test(t)) return NaN
  if (/^-0+(\.0*)?$/.test(t)) return -0
  return evalNumber(t)
}

export function Ieee754() {
  const [s, setS] = useLocalState<S>('errores:ieee754', { src: '0.1', prec: 64, bits: null })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 150)

  const calc = useMemo(() => {
    const p = d.prec
    const Fm = F.FORMATS[p]
    const manual = d.bits && d.bits.length === Fm.bits ? d.bits : null
    const x = parseInput(d.src)
    const parsedOk = manual !== null || !Number.isNaN(x) || /^\s*nan\s*$/i.test(d.src)
    if (!parsedOk) return { error: 'No se pudo interpretar el número. Usa decimales, fracciones (1/3) o expresiones (pi, sqrt(2), 2^-10).' }
    const rat = !manual ? F.parseRational(d.src) : null
    let stored: number
    if (manual) stored = F.fromBits(manual, p)
    else if (rat) stored = F.encodeIeee(rat, p).value
    else stored = F.roundP(x, p)
    if (!manual && Object.is(x, -0)) stored = -0
    const dec = F.decompose(stored, p)
    const exact = F.exactDecimal(stored)
    const finite = Number.isFinite(stored)
    // valor pretendido con 100 dígitos
    const intended = !manual && Number.isFinite(x) ? evalBig(d.src.trim().replace(/^-0+$/, '0')) : null
    const intendedStr = intended ? bigFixed(intended) : null
    const relErr = intended && finite ? relErrBig(stored, intended) : NaN
    const absErr = intended && finite ? absErrBig(stored, intended) : NaN
    const up = F.nextUp(stored, p), down = F.nextDown(stored, p)
    const ulp = finite ? F.ulp(stored, p) : NaN
    const steps = rat ? ieeeSteps(rat, p) : finite ? ieeeSteps(ratOfDouble(manual ? stored : x), p) : null
    return { p, stored, dec, exact, intended, intendedStr, relErr, absErr, up, down, ulp, steps, manual: !!manual, x, rat }
  }, [d])

  const toggle = (i: number) => {
    if ('error' in calc) return
    const b = calc.dec.bits
    const nb = b.slice(0, i) + (b[i] === '1' ? '0' : '1') + b.slice(i + 1)
    const v = F.fromBits(nb, s.prec)
    set({ bits: nb, src: F.shortest(v, s.prec) })
  }

  const hexVal = 'error' in calc ? '' : calc.dec.hex
  const setHex = (h: string) => {
    const clean = h.replace(/^0x/i, '').replace(/\s+/g, '')
    const len = F.FORMATS[s.prec].bits / 4
    if (!/^[0-9a-f]*$/i.test(clean) || clean.length !== len) return
    const bits = [...clean].map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('')
    set({ bits, src: F.shortest(F.fromBits(bits, s.prec), s.prec) })
  }

  const inputs = (
    <>
      <TextField
        label="Número o expresión"
        value={s.src}
        onChange={(src) => set({ src, bits: null })}
        hint="Ej.: 0.1, 1/3, pi, sqrt(2), 1e-310, -0, Infinity, NaN"
        invalid={'error' in calc}
        preview={!('error' in calc) && !/^[-+]?\d*\.?\d+$/.test(s.src.trim()) && Number.isFinite(calc.x) ? '= ' + fmt(calc.x, 17) : undefined}
      />
      <div className="field">
        <span className="field-label">Precisión</span>
        <Seg
          value={s.prec}
          onChange={(prec) => set({ prec, bits: null })}
          options={[
            { value: 16, label: 'binary16' },
            { value: 32, label: 'Simple · 32' },
            { value: 64, label: 'Doble · 64' },
          ]}
        />
      </div>
      <HexField key={s.prec + hexVal} initial={hexVal} len={F.FORMATS[s.prec].bits / 4} onCommit={setHex} />
      <Examples items={EXAMPLES} onPick={(v) => set({ ...v, bits: null })} />
    </>
  )

  return (
    <MethodPage title={TITLES.ieee754} topic={TOPIC} theory={THEORY.ieee754} inputs={inputs} description="Cómo se guarda realmente un número real en simple y doble precisión: bits, exponente sesgado, mantisa, valor exacto almacenado y error de representación.">
      {d.prec === 16 && (
        <Alert kind="info">
          Esto es IEEE 754 <b>binary16</b> (1 · 5 · 10 bits). La palabra de 16 bits del texto de la materia usa 1 · 7 · 8 bits: para los ejercicios del Cap. 1 usa{' '}
          <a href="#/errores/maquina-16" style={{ color: 'var(--accent)' }}>Máquina de 16 bits (texto)</a>.
        </Alert>
      )}
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} onToggle={toggle} />}
    </MethodPage>
  )
}

function HexField({ initial, len, onCommit }: { initial: string; len: number; onCommit: (h: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <TextField
      label="Hexadecimal"
      palette="off"
      value={v}
      invalid={v.replace(/^0x/i, '').length !== len}
      onChange={(h) => {
        setV(h)
        onCommit(h)
      }}
      hint={`${len} dígitos hex (${len * 4} bits). Escribe para fijar los bits directamente.`}
    />
  )
}

function Results({ c, s, onToggle }: { c: any; s: S; onToggle: (i: number) => void }) {
  const p: F.Prec = c.p
  const Fm = F.FORMATS[p]
  const dec: F.Decomposed = c.dec
  const finite = Number.isFinite(c.stored)
  const u = 2 ** -(Fm.m + 1)
  const fracTex = `\\frac{${dec.frac}}{2^{${Fm.m}}}`
  const lead = dec.kind === 'normal' ? '1' : '0'
  const decodeTex =
    dec.kind === 'normal' || dec.kind === 'subnormal'
      ? `x = (-1)^{${dec.sign}} \\times (${lead}.${dec.manBits.replace(/0+$/, '') || '0'})_2 \\times 2^{${dec.kind === 'normal' ? `${dec.E} - ${Fm.bias}` : `1 - ${Fm.bias}`}} = ${dec.sign ? '-' : ''}\\left(${lead} + ${fracTex}\\right) \\times 2^{${dec.e}} = ${texNum(c.stored, 17)}`
      : dec.kind === 'cero'
        ? `E = 0,\\ f = 0 \\Rightarrow x = ${dec.sign ? '-' : '+'}0`
        : dec.kind === 'infinito'
          ? `E = ${2 ** Fm.w - 1}\\ (\\text{todo unos}),\\ f = 0 \\Rightarrow x = ${dec.sign ? '-' : '+'}\\infty`
          : `E = ${2 ** Fm.w - 1}\\ (\\text{todo unos}),\\ f \\neq 0 \\Rightarrow \\text{NaN}`

  const neighbors = finite
    ? [
        { name: 'anterior (nextDown)', v: c.down },
        { name: 'x almacenado', v: c.stored },
        { name: 'siguiente (nextUp)', v: c.up },
      ].map((r) => ({ ...r, hex: F.decompose(r.v, p).hex, exact: F.exactDecimal(r.v) }))
    : []

  const cmp = ([16, 32, 64] as F.Prec[]).map((q) => {
    let v: number
    if (c.manual) v = F.roundP(c.stored, q)
    else if (c.rat) v = F.encodeIeee(c.rat, q).value
    else v = F.roundP(c.x, q)
    return { fmt: F.FORMATS[q].name, hex: F.decompose(v, q).hex, val: F.shortest(v, q), exact: F.exactDecimal(v), rel: c.intended ? relErrBig(v, c.intended) : NaN, u: 2 ** -(F.FORMATS[q].m + 1) }
  })

  return (
    <>
      <Stats
        items={[
          { label: 'Valor almacenado', value: F.shortest(c.stored, p), accent: true, hint: finite ? 'forma decimal más corta que lo identifica' : undefined },
          { label: 'Tipo', value: <span className={'pill ' + dec.kind}>{dec.kind}</span>, hint: Fm.name },
          { label: 'Exponente', value: dec.kind === 'normal' || dec.kind === 'subnormal' ? `e = ${dec.e}` : '—', hint: `E almacenado = ${dec.E} (sesgo ${Fm.bias})` },
          { label: 'Hexadecimal', value: '0x' + dec.hex },
        ]}
      />
      <Card title="Representación en memoria">
        <Bits
          bits={dec.bits}
          prec={p}
          onToggle={onToggle}
          labels={{ sign: `s = ${dec.sign}`, exp: `E = ${dec.E}${dec.kind === 'normal' ? ` → e = E − ${Fm.bias} = ${dec.e}` : ''}`, man: `f = ${dec.frac}/2^${Fm.m}` }}
        />
        <div className="bithint">Haz clic en cualquier bit para invertirlo y ver el número resultante. Pasa el cursor para ver su peso.</div>
        <div style={{ marginTop: 12 }}>
          <Tex block>{decodeTex}</Tex>
        </div>
      </Card>
      {finite && (
        <Card title="Valor exacto almacenado">
          <ExactDigits exact={c.exact} intended={c.intendedStr} />
          <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 10px' }}>
            Todo flotante es un racional con denominador potencia de 2, así que su expansión decimal es <b>finita</b> ({F.countSigDigits(c.exact)} cifras significativas). En verde los dígitos
            que coinciden con el valor que escribiste; en rojo, desde el primero que difiere.
          </p>
          {c.intended && (
            <KV
              items={[
                ['Valor pretendido', c.intendedStr.length > 70 ? c.intendedStr.slice(0, 70) + '…' : c.intendedStr],
                ['Error absoluto |x − fl(x)|', Number.isFinite(c.absErr) ? (c.absErr === 0 ? '0 (representable exactamente)' : c.absErr.toExponential(6)) : '—'],
                ['Error relativo', Number.isFinite(c.relErr) ? (c.relErr === 0 ? '0' : c.relErr.toExponential(6)) : '—'],
                [
                  <>
                    Cota <Tex>{`u = 2^{-${Fm.m + 1}}`}</Tex>
                  </>,
                  <>
                    {u.toExponential(6)} {Number.isFinite(c.relErr) && (c.relErr <= u * (1 + 1e-12) ? <span style={{ color: 'var(--ok)' }}>✓ error relativo ≤ u</span> : <span style={{ color: 'var(--warn)' }}>error &gt; u (subnormal / fuera de rango)</span>)}
                  </>,
                ],
              ]}
            />
          )}
          {!c.intended && c.manual && <Alert kind="info">Bits fijados manualmente: el valor almacenado es exacto por definición.</Alert>}
        </Card>
      )}
      <Tabs
        tabs={[
          {
            label: 'Vecinos y espaciado',
            content: finite ? (
              <Card>
                <DataTable
                  filename="vecinos"
                  columns={[
                    { key: 'name', label: 'Flotante', align: 'left' },
                    { key: 'hex', label: 'Hex', get: (r) => '0x' + r.hex },
                    { key: 'exact', label: 'Valor exacto', align: 'left', get: (r) => (r.exact.length > 44 ? r.exact.slice(0, 44) + '…' : r.exact) },
                  ]}
                  rows={neighbors}
                  highlight={(_, i) => i === 1}
                />
                <div style={{ marginTop: 12 }}>
                  <KV
                    items={[
                      ['ulp(x) = distancia al siguiente', fmt(c.ulp, 10) + (c.stored !== 0 ? `  = 2^${Math.round(Math.log2(c.ulp))}` : '')],
                      ['Espaciado relativo ulp(x)/|x|', c.stored !== 0 ? (c.ulp / Math.abs(c.stored)).toExponential(4) : '—'],
                      [`ε de máquina (${p === 64 ? 'doble' : p === 32 ? 'simple' : 'media'})`, `${F.EPS[p].toExponential(6)} = 2^-${Fm.m}`],
                      ['Menor subnormal', `${F.LIMITS[p].minSub.toExponential(6)}`],
                      ['Menor normal', `${F.LIMITS[p].minNormal.toExponential(6)} = 2^${1 - Fm.bias}`],
                      ['Mayor finito', `${F.LIMITS[p].max.toExponential(6)}`],
                    ]}
                  />
                </div>
              </Card>
            ) : (
              <Alert kind="info">±∞ y NaN no tienen vecinos finitos.</Alert>
            ),
          },
          {
            label: 'Paso a paso',
            content: c.steps ? (
              <Card>
                <Steps steps={c.steps} />
              </Card>
            ) : (
              <Alert kind="info">Valor especial: se codifica directamente con el exponente todo unos.</Alert>
            ),
          },
          {
            label: 'Comparar formatos',
            content: (
              <Card>
                <DataTable
                  filename="formatos_ieee"
                  columns={[
                    { key: 'fmt', label: 'Formato', align: 'left' },
                    { key: 'hex', label: 'Hex', get: (r) => '0x' + r.hex },
                    { key: 'val', label: 'Valor (corto)' },
                    { key: 'exact', label: 'Valor exacto', align: 'left', get: (r) => (r.exact.length > 40 ? r.exact.slice(0, 40) + '…' : r.exact) },
                    { key: 'rel', label: 'Error relativo', fmt: 'err' },
                    { key: 'u', label: 'u', fmt: 'err' },
                  ]}
                  rows={cmp}
                  highlight={(r) => r.fmt === F.FORMATS[p].name}
                />
                <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
                  Cada fila muestra cómo se guardaría el mismo número en cada formato. Media precisión da ≈ 3 cifras decimales; simple ≈ 7; doble ≈ 16.
                </p>
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode code={scilab(s.src, p)} filename="ieee754" />
    </>
  )
}

function scilab(src: string, p: F.Prec): string {
  const Fm = F.FORMATS[p]
  const x = src
    .trim()
    .replace(/\bpi\b/g, '%pi')
    .replace(/\bInfinity\b/gi, '%inf')
    .replace(/\bNaN\b/gi, '%nan')
  return `// Campos IEEE 754 de un número — generado por NumLab
// Scilab trabaja siempre en doble precisión (${p === 32 ? 'aquí se simula simple: m = 23, sesgo = 127;\n// ojo: los bits se TRUNCAN, no se redondean' : p === 16 ? 'aquí se simula media: m = 10, sesgo = 15;\n// ojo: los bits se TRUNCAN, no se redondean' : 'm = 52, sesgo = 1023'})
clear; clc;
x = ${x};
m = ${Fm.m}; sesgo = ${Fm.bias}; w = ${Fm.w};
s = bool2s(x < 0);
[f, e] = frexp(abs(x));     // abs(x) = f * 2^e con 0.5 <= f < 1
e = e - 1;  M = 2*f;        // abs(x) = M * 2^e con 1 <= M < 2
E = e + sesgo;              // exponente sesgado
bitsE = dec2bin(E, w);
r = M - 1; bitsF = '';
for k = 1:m
  r = 2*r;
  if r >= 1 then
    bitsF = bitsF + '1'; r = r - 1;
  else
    bitsF = bitsF + '0';
  end
end
mprintf('signo s     = %d\\n', s);
mprintf('exponente e = %d,  E = e + %d = %d = %s\\n', e, sesgo, E, bitsE);
mprintf('fraccion f  = %s\\n', bitsF);
mprintf('valor almacenado (exacto): %.60f\\n', x);
mprintf('eps = %g,  u = eps/2 = %g\\n', %eps, %eps/2);
`
}
