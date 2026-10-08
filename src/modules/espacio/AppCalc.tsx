// App de calculadora: líneas del CAS editables en su lugar, con el resultado debajo.
import { useEffect, useRef, useState } from 'react'
import { L } from '../../i18n'
import type { Out } from '../cas/engine'
import { OutView } from '../cas/Consola'
import type { Pane } from './doc'

type CalcPane = Extract<Pane, { kind: 'calc' }>

export function AppCalc({ pane, outs, onChange }: { pane: CalcPane; outs: Out[] | undefined; onChange: (p: CalcPane) => void }) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  // la línea que se está editando se confirma con Enter o al salir (no en cada tecla)
  const [draft, setDraft] = useState<{ i: number; text: string } | null>(null)
  const [focusLine, setFocusLine] = useState<number | null>(null)

  useEffect(() => {
    if (focusLine === null) return
    const el = refs.current[focusLine]
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
    setFocusLine(null)
  }, [focusLine])

  const setLines = (lines: string[]) => onChange({ ...pane, lines: lines.length ? lines : [''] })
  const commit = (i: number, text: string) => {
    if (pane.lines[i] !== text) setLines(pane.lines.map((l, k) => (k === i ? text : l)))
    setDraft(null)
  }

  return (
    <div className="cx">
      {pane.lines.map((line, i) => {
        const value = draft?.i === i ? draft.text : line
        const out = draft?.i === i && draft.text !== line ? undefined : outs?.[i]
        return (
          <div key={i} className="cx-line">
            <div className="cx-in">
              <span className="cx-prompt">›</span>
              <textarea
                ref={(el) => {
                  refs.current[i] = el
                }}
                rows={Math.max(1, value.split('\n').length)}
                className="input mono cx-input"
                data-palette="expr"
                data-paste="cas"
                value={value}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={i === pane.lines.length - 1 ? L('derivada(sin(x)^2, x), a = 3, linreg(t, v)…', 'diff(sin(x)^2, x), a = 3, linreg(t, v)…') : ''}
                onChange={(e) => setDraft({ i, text: e.target.value })}
                onBlur={() => draft?.i === i && commit(i, draft.text)}
                onKeyDown={(e) => {
                  const text = (e.target as HTMLTextAreaElement).value
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const lines = pane.lines.map((l, k) => (k === i ? text : l))
                    // en la última línea con contenido: abrir una nueva
                    if (i === lines.length - 1 && text.trim()) lines.push('')
                    setDraft(null)
                    setLines(lines)
                    setFocusLine(Math.min(i + 1, lines.length - 1))
                  } else if (e.key === 'Backspace' && !text && pane.lines.length > 1) {
                    e.preventDefault()
                    setDraft(null)
                    setLines(pane.lines.filter((_, k) => k !== i))
                    setFocusLine(Math.max(0, i - 1))
                  } else if (e.key === 'ArrowUp' && i > 0 && !text.slice(0, (e.target as HTMLTextAreaElement).selectionStart).includes('\n')) {
                    e.preventDefault()
                    commit(i, text)
                    setFocusLine(i - 1)
                  } else if (e.key === 'ArrowDown' && i < pane.lines.length - 1 && !text.slice((e.target as HTMLTextAreaElement).selectionEnd).includes('\n')) {
                    e.preventDefault()
                    commit(i, text)
                    setFocusLine(i + 1)
                  }
                }}
              />
            </div>
            {out && out.kind !== 'none' && (
              <div className="cx-out">
                <OutView out={out} onPick={(s) => setDraft({ i: pane.lines.length - 1, text: s })} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
