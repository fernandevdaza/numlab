// Espacio de trabajo: un documento con páginas; cada página tiene una o dos apps (calculadora,
// gráficas, hoja de cálculo, notas) que comparten variables. Inspirado en TI-Nspire y GeoGebra.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { download } from '../../components/ui'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'
import { texOf, valuePlain } from '../cas/engine'
import { AppCalc } from './AppCalc'
import { AppGrafica } from './AppGrafica'
import { AppHoja } from './AppHoja'
import { AppNotas } from './AppNotas'
import { APP_ICON, APP_LABEL, blankDoc, evaluateDoc, exampleDoc, newPage, newPane, type AppKind, type Doc, type Page, type Pane } from './doc'
import './espacio.css'

const KINDS: AppKind[] = ['calc', 'graph', 'sheet', 'notes']

/** Documento guardado válido (para abrir archivos y estados de versiones anteriores). */
function validDoc(d: any): d is Doc {
  return d && d.version === 1 && Array.isArray(d.pages) && d.pages.length > 0 && d.pages.every((p: any) => Array.isArray(p.panes) && p.panes.length > 0)
}

export function Espacio() {
  const [stored, setDoc] = useLocalState<Doc>('espacio:doc', exampleDoc())
  const doc = validDoc(stored) ? stored : exampleDoc()
  const active = Math.min(doc.active, doc.pages.length - 1)
  const page = doc.pages[active]
  const evalDoc = useDebounced(doc, 90)
  const ev = useMemo(() => evaluateDoc(evalDoc), [evalDoc])
  const [menu, setMenu] = useState<null | 'page' | 'split'>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [showVars, setShowVars] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const update = (fn: (d: Doc) => Doc) => setDoc((d) => fn(validDoc(d) ? d : exampleDoc()))
  const setPage = (id: string, p: Partial<Page>) => update((d) => ({ ...d, pages: d.pages.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  const setPane = (pageId: string, pane: Pane) => update((d) => ({ ...d, pages: d.pages.map((x) => (x.id === pageId ? { ...x, panes: x.panes.map((q) => (q.id === pane.id ? pane : q)) } : x)) }))

  const addPage = (kind: AppKind) => {
    update((d) => ({ ...d, pages: [...d.pages, newPage(kind)], active: d.pages.length }))
    setMenu(null)
  }
  const removePage = (id: string) => {
    if (doc.pages.length === 1) return
    const p = doc.pages.find((x) => x.id === id)
    if (!confirm(L(`¿Eliminar la página «${p?.title}»?`, `Delete page “${p?.title}”?`))) return
    update((d) => {
      const pages = d.pages.filter((x) => x.id !== id)
      return { ...d, pages, active: Math.min(d.active, pages.length - 1) }
    })
  }
  const split = (kind: AppKind) => {
    setPage(page.id, { panes: [page.panes[0], newPane(kind)] })
    setMenu(null)
  }
  const unsplit = (paneId: string) => setPage(page.id, { panes: page.panes.filter((p) => p.id !== paneId) })

  // recordar el último campo usado para insertar variables desde el panel
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const on = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (t.matches?.('input[data-palette], textarea[data-palette], textarea.nx-text')) lastField.current = t as HTMLInputElement
    }
    el.addEventListener('focusin', on)
    return () => el.removeEventListener('focusin', on)
  }, [])
  const insertVar = (name: string) => {
    const f = lastField.current
    if (!f || !document.contains(f)) return
    f.focus()
    document.execCommand('insertText', false, name)
  }

  // arrastrar el divisor entre dos apps
  const dragSplit = (e: RPointerEvent<HTMLDivElement>) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const vertical = window.matchMedia('(max-width: 900px)').matches
    const move = (ev: PointerEvent) => {
      const r = vertical ? (ev.clientY - box.top) / box.height : (ev.clientX - box.left) / box.width
      setPage(page.id, { split: Math.max(0.25, Math.min(0.75, r)) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const openFile = async (file: File) => {
    try {
      const d = JSON.parse(await file.text())
      if (!validDoc(d)) throw new Error()
      setDoc({ ...d, active: 0 })
    } catch {
      alert(L('El archivo no es un documento de NumLab válido.', 'The file is not a valid NumLab document.'))
    }
  }

  const renderPane = (pane: Pane) => {
    switch (pane.kind) {
      case 'calc':
        return <AppCalc pane={pane} outs={ev.calc[pane.id]} onChange={(p) => setPane(page.id, p)} />
      case 'graph':
        return <AppGrafica pane={pane} session={ev.session} onChange={(p) => setPane(page.id, p)} />
      case 'sheet':
        return <AppHoja pane={pane} result={ev.sheets[pane.id]} onChange={(p) => setPane(page.id, p)} />
      case 'notes':
        return <AppNotas pane={pane} onChange={(p) => setPane(page.id, p)} />
    }
  }

  const two = page.panes.length > 1
  return (
    <div className="method ws" ref={rootRef}>
      <header className="ws-head">
        <div>
          <div className="eyebrow">{L('Herramientas', 'Tools')}</div>
          <input className="ws-name" value={doc.name} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} aria-label={L('Nombre del documento', 'Document name')} />
        </div>
        <div className="ws-actions">
          <button className={'btn ghost sm' + (showVars ? ' active' : '')} onClick={() => setShowVars((v) => !v)}>
            𝑥 {L('Variables', 'Variables')}
          </button>
          <button className="btn ghost sm" onClick={() => download(`${doc.name || 'numlab'}.numlab.json`, JSON.stringify(doc, null, 1), 'application/json')}>
            ⬇ {L('Guardar', 'Save')}
          </button>
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            ⬆ {L('Abrir', 'Open')}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
          <button className="btn ghost sm" onClick={() => confirm(L('¿Empezar un documento nuevo? El actual se reemplaza (guárdalo antes si lo necesitas).', 'Start a new document? The current one is replaced (save it first if you need it).')) && setDoc(blankDoc())}>
            ＋ {L('Nuevo', 'New')}
          </button>
          <button className="btn ghost sm" onClick={() => confirm(L('¿Cargar el documento de ejemplo? El actual se reemplaza.', 'Load the example document? The current one is replaced.')) && setDoc(exampleDoc())}>
            ★ {L('Ejemplo', 'Example')}
          </button>
        </div>
      </header>

      <nav className="ws-tabs" role="tablist">
        {doc.pages.map((p, i) => (
          <div key={p.id} role="tab" aria-selected={i === active} className={'ws-tab' + (i === active ? ' on' : '')} onClick={() => update((d) => ({ ...d, active: i }))} onDoubleClick={() => setRenaming(p.id)}>
            <span className="ws-tab-n">{i + 1}</span>
            {renaming === p.id ? (
              <input
                className="ws-tab-edit"
                autoFocus
                defaultValue={p.title}
                onBlur={(e) => (setPage(p.id, { title: e.target.value.trim() || p.title }), setRenaming(null))}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <span className="ws-tab-t">{p.title}</span>
            )}
            <span className="ws-tab-apps">{p.panes.map((q) => APP_ICON[q.kind]).join(' ')}</span>
            {doc.pages.length > 1 && (
              <button className="ws-tab-x" title={L('Eliminar página', 'Delete page')} onClick={(e) => (e.stopPropagation(), removePage(p.id))}>
                ✕
              </button>
            )}
          </div>
        ))}
        <div className="ws-menu-wrap">
          <button className="btn ghost sm" onClick={() => setMenu(menu === 'page' ? null : 'page')}>
            ＋ {L('Página', 'Page')}
          </button>
          {menu === 'page' && <AppMenu onPick={addPage} onClose={() => setMenu(null)} />}
        </div>
        {!two && (
          <div className="ws-menu-wrap">
            <button className="btn ghost sm" onClick={() => setMenu(menu === 'split' ? null : 'split')} title={L('Poner una segunda app al lado', 'Put a second app beside it')}>
              ◫ {L('Dividir', 'Split')}
            </button>
            {menu === 'split' && <AppMenu onPick={split} onClose={() => setMenu(null)} />}
          </div>
        )}
      </nav>

      <div className={'ws-body' + (showVars ? ' with-vars' : '')}>
        <div className={'ws-page' + (two ? ' two' : '')} style={two ? ({ '--split': `${page.split * 100}%` } as any) : undefined}>
          {page.panes.map((pane, k) => [
            k === 1 && <div key="div" className="ws-divider" onPointerDown={dragSplit} title={L('Arrastra para cambiar el tamaño', 'Drag to resize')} />,
            <section key={pane.id} className={'ws-pane ws-' + pane.kind}>
              <div className="ws-pane-head">
                <span>
                  {APP_ICON[pane.kind]} {APP_LABEL[pane.kind]}
                </span>
                {two && (
                  <button className="ws-tab-x" title={L('Quitar esta app de la página', 'Remove this app from the page')} onClick={() => unsplit(pane.id)}>
                    ✕
                  </button>
                )}
              </div>
              <div className="ws-pane-body">{renderPane(pane)}</div>
            </section>,
          ])}
        </div>
        {showVars && <VarsPanel ev={ev} onInsert={insertVar} />}
      </div>
    </div>
  )
}

function AppMenu({ onPick, onClose }: { onPick: (k: AppKind) => void; onClose: () => void }) {
  useEffect(() => {
    const on = (e: MouseEvent) => !(e.target as HTMLElement).closest('.ws-menu-wrap') && onClose()
    const t = setTimeout(() => window.addEventListener('mousedown', on))
    return () => (clearTimeout(t), window.removeEventListener('mousedown', on))
  }, [onClose])
  return (
    <div className="ws-menu" role="menu">
      {KINDS.map((k) => (
        <button key={k} role="menuitem" onClick={() => onPick(k)}>
          <span className="ws-menu-ic">{APP_ICON[k]}</span>
          {APP_LABEL[k]}
        </button>
      ))}
    </div>
  )
}

/** Variables compartidas del documento: clic para insertarlas en el último campo usado. */
function VarsPanel({ ev, onInsert }: { ev: ReturnType<typeof evaluateDoc>; onInsert: (s: string) => void }) {
  const s = ev.session
  const rows: { name: string; insert: string; tex: string; kind: string }[] = []
  for (const [k, f] of Object.entries(s.fns)) {
    let tex = ''
    try {
      tex = `${k}(${f.params.join(', ')}) = ${texOf(f.body)}`
    } catch {
      tex = k
    }
    rows.push({ name: k, insert: `${k}(${f.params.join(', ')})`, tex, kind: L('función', 'function') })
  }
  for (const [k, v] of Object.entries(s.vars)) {
    if (k === 'ans' || typeof v === 'function') continue
    const list = Array.isArray(v)
    const plain = valuePlain(v)
    rows.push({ name: k, insert: k, tex: `${k} = ${plain.length > 60 ? plain.slice(0, 57) + '…' : plain}`, kind: list ? L(`lista · ${v.length}`, `list · ${v.length}`) : L('valor', 'value') })
  }
  for (const [k, e] of Object.entries(s.exprs)) {
    let tex = ''
    try {
      tex = `${k} = ${texOf(e)}`
    } catch {
      tex = k
    }
    rows.push({ name: k, insert: k, tex, kind: L('expresión', 'expression') })
  }
  return (
    <aside className="ws-vars">
      <h4>{L('Variables del documento', 'Document variables')}</h4>
      {!rows.length && <p className="muted">{L('Todavía no hay variables. Define f(x) = …, a = 2 o pon nombre a una columna de la hoja.', 'No variables yet. Define f(x) = …, a = 2 or name a spreadsheet column.')}</p>}
      {rows.map((r) => (
        <button key={r.kind + r.name} className="ws-var" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(r.insert)} title={L('Insertar en el campo activo', 'Insert into the active field')}>
          <span className="ws-var-k">{r.kind}</span>
          {r.kind.startsWith(L('lista', 'list')) || r.kind === L('valor', 'value') ? <span className="mono">{r.tex}</span> : <Tex>{r.tex}</Tex>}
        </button>
      ))}
    </aside>
  )
}
