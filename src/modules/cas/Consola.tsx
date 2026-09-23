import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Card, download } from '../../components/ui'
import { Session, texOf, prep, type Out } from './engine'
import { HELP } from './help'
import './cas.css'

const DEFAULT_HISTORY = ['f(x) = x^3 - 2x - 5', 'derivada(f(x), x)', 'raices(f(x), -5, 5)', 'integrar(f(x), x, 0, 3)', 'graficar(f(x), derivada(f(x), x), -3, 3)']

/** Ejecuta todas las líneas en una sesión nueva. */
function runAll(lines: string[]): { session: Session; outs: Out[] } {
  const session = new Session()
  const outs = lines.map((l) => session.run(l))
  return { session, outs }
}

export function Consola() {
  const [history, setHistory] = useLocalState<string[]>('cas:historial', DEFAULT_HISTORY)
  const [draft, setDraft] = useLocalState<string>('cas:borrador', '')
  const [state, setState] = useState(() => runAll(history))
  const [cursor, setCursor] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // graficar(f, derivada(f)) → el comando derivada no se puede anidar en graficar; se permite igual vía mathjs si falla.
  const submit = (text?: string) => {
    const src = (text ?? draft).trim()
    if (!src) return
    const lines = src.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 1 && /^(limpiar|clear|clc)$/i.test(lines[0])) {
      setHistory([])
      setState(runAll([]))
      setDraft('')
      return
    }
    const outs = lines.map((l) => state.session.run(l))
    setHistory((h) => [...h, ...lines])
    setState((st) => ({ session: st.session, outs: [...st.outs, ...outs] }))
    if (text === undefined) setDraft('')
    setCursor(null)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30)
  }

  const remove = (i: number) => {
    const h = history.filter((_, k) => k !== i)
    setHistory(h)
    setState(runAll(h))
  }

  const rerun = () => setState(runAll(history))

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
      return
    }
    const ta = e.currentTarget
    const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0
    const atEnd = ta.selectionStart === ta.value.length
    if (e.key === 'ArrowUp' && (atStart || !draft.includes('\n')) && history.length) {
      e.preventDefault()
      const c = cursor === null ? history.length - 1 : Math.max(0, cursor - 1)
      setCursor(c)
      setDraft(history[c])
    } else if (e.key === 'ArrowDown' && (atEnd || !draft.includes('\n')) && cursor !== null) {
      e.preventDefault()
      const c = cursor + 1
      if (c >= history.length) {
        setCursor(null)
        setDraft('')
      } else {
        setCursor(c)
        setDraft(history[c])
      }
    }
  }

  const insert = (ex: string) => {
    setDraft(ex)
    inputRef.current?.focus()
  }

  const preview = useMemo(() => {
    const t = draft.trim()
    if (!t || t.includes('\n')) return null
    try {
      return texOf(prep(t.replace(/^[A-Za-z_]\w*\s*=(?!=)/, '')))
    } catch {
      return null
    }
  }, [draft])

  const help = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return HELP
    return HELP.map((g) => ({ ...g, items: g.items.filter((it) => (it.cmd + ' ' + it.desc + ' ' + it.ex.join(' ')).toLowerCase().includes(q)) })).filter((g) => g.items.length)
  }, [filter])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="method">
      <header className="method-head">
        <div className="eyebrow">Herramientas</div>
        <h1>Calculadora simbólica (CAS)</h1>
        <p className="lead">
          Consola simbólica y numérica: derivadas, integrales, límites, Taylor, ecuaciones, matrices y gráficas. Escribe un comando y presiona <span className="kbd">Enter</span> (
          <span className="kbd">Shift</span>+<span className="kbd">Enter</span> para varias líneas, <span className="kbd">↑</span>/<span className="kbd">↓</span> para el historial). Acepta sintaxis tipo
          Scilab (<span className="mono">%pi</span>, <span className="mono">[1 2; 3 4]</span>, <span className="mono">A'</span>).
        </p>
      </header>
      <div className="cas-grid">
        <Card
          title="Cuaderno"
          actions={
            <div className="nb-toolbar">
              <button className="btn ghost sm" onClick={rerun} title="Volver a ejecutar todas las líneas">
                ↻ Re-ejecutar
              </button>
              <button className="btn ghost sm" onClick={() => download('numlab_cas.txt', history.join('\n'))}>
                ⬇ .txt
              </button>
              <button
                className="btn ghost sm"
                onClick={() => {
                  setHistory([])
                  setState(runAll([]))
                }}
              >
                ✕ Limpiar
              </button>
            </div>
          }
        >
          <div className="nb">
            {history.length === 0 && <div className="nb-empty">Cuaderno vacío. Prueba un ejemplo del panel de la derecha o escribe “ayuda”.</div>}
            {history.map((line, i) => (
              <div key={i} className="cell">
                <div className="cell-n">[{i + 1}]</div>
                <div className="cell-in" title="Clic para editar" onClick={() => insert(line)}>
                  {line}
                </div>
                <div className="cell-actions">
                  <button title="Eliminar" onClick={() => remove(i)}>
                    ✕
                  </button>
                </div>
                <div className="cell-out">
                  <OutView out={state.outs[i]} onPick={insert} />
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="prompt">
            <span className="prompt-sign">›</span>
            <textarea
              ref={inputRef}
              className="input"
              rows={Math.min(6, draft.split('\n').length)}
              value={draft}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="derivada(sin(x)^2, x)"
              onChange={(e) => {
                setDraft(e.target.value)
                setCursor(null)
              }}
              onKeyDown={onKey}
            />
            <button className="btn primary" onClick={() => submit()}>
              Ejecutar
            </button>
          </div>
          <div className="prompt-preview">{preview && <Tex>{preview}</Tex>}</div>
        </Card>
        <Card title="Comandos" className="cas-help">
          <input className="input help-search" placeholder="Buscar comando…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <HelpList groups={help} onPick={insert} onRun={(ex) => submit(ex)} />
        </Card>
      </div>
    </div>
  )
}

function HelpList({ groups, onPick, onRun }: { groups: typeof HELP; onPick: (s: string) => void; onRun?: (s: string) => void }) {
  return (
    <>
      <p className="muted" style={{ fontSize: 11.5, margin: '0 0 10px' }}>
        Clic en un ejemplo para copiarlo al editor{onRun ? '; doble clic para ejecutarlo' : ''}.
      </p>
      {groups.map((g) => (
        <div key={g.title} className="help-group">
          <h4>{g.title}</h4>
          {g.items.map((it) => (
            <div key={it.cmd} className="help-item">
              <div className="help-cmd">{it.cmd}</div>
              <div className="help-desc">{it.desc}</div>
              <div className="help-ex">
                {it.ex.map((ex) => (
                  <button key={ex} onClick={() => onPick(ex)} onDoubleClick={() => onRun?.(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function OutView({ out, onPick }: { out: Out | undefined; onPick: (s: string) => void }) {
  if (!out) return null
  switch (out.kind) {
    case 'none':
      return null
    case 'error':
      return <div className="cell-err">✕ {out.text}</div>
    case 'text':
      return <div className="cell-text">{out.text}</div>
    case 'help':
      return (
        <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 6 }}>
          <HelpList groups={HELP} onPick={onPick} />
        </div>
      )
    case 'tex':
      return (
        <>
          <Tex block>{out.tex}</Tex>
          {out.extra?.map((t, i) => (
            <Tex key={i} block>
              {t}
            </Tex>
          ))}
          {out.note && <div className="cell-note">{out.note}</div>}
        </>
      )
    case 'plot':
      return <InlinePlot out={out} />
  }
}

function InlinePlot({ out }: { out: Extract<Out, { kind: 'plot' }> }) {
  const data = useMemo(
    () =>
      out.fns.map((fn, i) => {
        const s = sample(fn.f, out.a, out.b, 600)
        return { ...s, type: 'scatter', mode: 'lines', name: fn.label, line: { color: SERIES[i % SERIES.length], width: 2.2 } } as Trace
      }),
    [out],
  )
  return (
    <>
      {out.tex && <Tex block>{out.tex}</Tex>}
      <Plot data={data} height={320} layout={{ xaxis: { title: { text: 'x' } }, hovermode: 'x unified', showlegend: out.fns.length > 1 }} />
    </>
  )
}
