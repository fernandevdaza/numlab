// App de notas: texto con un Markdown mínimo y fórmulas $…$ / $$…$$.
import { useState, type ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'
import type { Pane } from './doc'

type NotesPane = Extract<Pane, { kind: 'notes' }>

/** Negritas, cursivas, código y fórmulas en línea. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    const id = `${key}-${k++}`
    if (t.startsWith('$')) out.push(<Tex key={id}>{t.slice(1, -1)}</Tex>)
    else if (t.startsWith('**')) out.push(<strong key={id}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={id} className="mono">{t.slice(1, -1)}</code>)
    else out.push(<em key={id}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderNotes(src: string): ReactNode[] {
  const blocks: ReactNode[] = []
  // $$ … $$ puede ocupar varias líneas
  const parts = src.split(/(\$\$[\s\S]+?\$\$)/g)
  parts.forEach((part, pi) => {
    if (part.startsWith('$$')) {
      blocks.push(<Tex key={'d' + pi} block>{part.slice(2, -2).trim()}</Tex>)
      return
    }
    const paras = part.split(/\n\s*\n/)
    paras.forEach((p, i) => {
      const key = `${pi}-${i}`
      const t = p.trim()
      if (!t) return
      const h = t.match(/^(#{1,3})\s+(.*)$/)
      if (h && !t.includes('\n')) {
        const Tag = (['h3', 'h4', 'h5'] as const)[h[1].length - 1]
        blocks.push(<Tag key={key}>{inline(h[2], key)}</Tag>)
      } else if (t.split('\n').every((l) => /^\s*[-*]\s+/.test(l))) {
        blocks.push(
          <ul key={key}>
            {t.split('\n').map((l, j) => (
              <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ''), `${key}-${j}`)}</li>
            ))}
          </ul>,
        )
      } else
        blocks.push(
          <p key={key}>
            {t.split('\n').flatMap((l, j) => (j ? [<br key={'br' + j} />, ...inline(l, `${key}-${j}`)] : inline(l, `${key}-${j}`)))}
          </p>,
        )
    })
  })
  return blocks
}

export function AppNotas({ pane, onChange }: { pane: NotesPane; onChange: (p: NotesPane) => void }) {
  const [editing, setEditing] = useState(!pane.text.trim())
  return (
    <div className="nx">
      <div className="nx-tools">
        <button className={'btn ghost sm' + (editing ? ' active' : '')} onClick={() => setEditing(true)}>
          ✎ {L('Editar', 'Edit')}
        </button>
        <button className={'btn ghost sm' + (!editing ? ' active' : '')} onClick={() => setEditing(false)}>
          👁 {L('Ver', 'View')}
        </button>
        <span className="muted">{L('**negrita**, *cursiva*, # título, - lista, $x^2$ y $$\\int f$$', '**bold**, *italic*, # heading, - list, $x^2$ and $$\\int f$$')}</span>
      </div>
      {editing ? (
        <textarea className="input nx-text" value={pane.text} spellCheck autoFocus onChange={(e) => onChange({ ...pane, text: e.target.value })} placeholder={L('Escribe tus notas…', 'Write your notes…')} />
      ) : (
        <div className="nx-view" onDoubleClick={() => setEditing(true)}>
          {pane.text.trim() ? renderNotes(pane.text) : <p className="muted">{L('Nota vacía. Doble clic para escribir.', 'Empty note. Double-click to write.')}</p>}
        </div>
      )}
    </div>
  )
}
