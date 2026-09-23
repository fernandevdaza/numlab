import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TOPICS, findMethod } from './modules/registry'
import type { MethodDef, TopicDef } from './modules/types'
import { useTheme } from './components/theme'
import { HelpDialog, MOD_KEY, type HelpTab } from './components/Help'
import { SymbolPalette } from './components/SymbolPalette'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IconChevron, IconGithub, IconHelp, IconKeyboard, IconMenu, IconMoon, IconSearch, IconSun } from './components/icons'
import { useLocalState } from './lib/useLocalState'
import { CONFIG } from './config'
import { Home } from './Home'
import { LangSwitch } from './components/LangSwitch'
import { L } from './i18n'

const LOGO = import.meta.env.BASE_URL + 'favicon.svg'

function useHashRoute(): [string[], (p: string) => void] {
  const parse = () =>
    window.location.hash
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map((s) => decodeURIComponent(s))
  const [parts, setParts] = useState(parse)
  useEffect(() => {
    const on = () => setParts(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [parts, (p: string) => (window.location.hash = '/' + p)]
}

/** minúsculas y sin tildes, para buscar "biseccion" = "Bisección" */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** ¿El foco está en un campo de texto? (para no robar teclas como "/" o "?") */
function isTyping(el: Element | null) {
  if (!el) return false
  const t = el.tagName
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (el as HTMLElement).isContentEditable
}

/** Grupos consecutivos de métodos con el mismo `group`. */
function groupMethods(methods: MethodDef[]) {
  const out: { group?: string; methods: MethodDef[] }[] = []
  for (const m of methods) {
    const last = out[out.length - 1]
    if (last && last.group === m.group) last.methods.push(m)
    else out.push({ group: m.group, methods: [m] })
  }
  return out
}

interface Hit {
  topic: TopicDef
  method: MethodDef
  score: number
}

function search(q: string): Hit[] {
  const terms = fold(q).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const hits: Hit[] = []
  for (const t of TOPICS)
    for (const m of t.methods) {
      const title = fold(m.title)
      // "Método de la secante" → "secante" (y "The method of …" → "…") para que "sec" lo ponga primero
      const core = title
        .replace(/^(metodo|metodos|regla|reglas)\s+(de\s+)?(la\s+|las\s+|los\s+|el\s+)?/, '')
        .replace(/^(the\s+)?(method|methods|rule|rules)\s+(of\s+)?(the\s+)?/, '')
      const hay = [title, fold(m.keywords ?? ''), fold(m.summary ?? ''), fold(m.group ?? ''), fold(t.title), fold(t.shortTitle ?? '')].join(' · ')
      if (!terms.every((w) => hay.includes(w))) continue
      let score = 0
      for (const w of terms) {
        if (title.startsWith(w) || core.startsWith(w)) score += 6
        else if (new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(title)) score += 4
        else if (title.includes(w)) score += 3
        else if (fold(m.keywords ?? '').includes(w)) score += 2
        else score += 1
      }
      hits.push({ topic: t, method: m, score })
    }
  return hits.sort((a, b) => b.score - a.score)
}

/** Resalta las coincidencias de la búsqueda en un texto. */
function Highlight({ text, q }: { text: string; q: string }) {
  const terms = fold(q).split(/\s+/).filter(Boolean)
  if (!terms.length) return <>{text}</>
  const f = fold(text)
  const mark = new Array(text.length).fill(false)
  for (const w of terms) {
    let i = f.indexOf(w)
    while (i >= 0) {
      for (let k = i; k < i + w.length; k++) mark[k] = true
      i = f.indexOf(w, i + w.length)
    }
  }
  // fold() conserva la longitud para letras latinas con tilde, así que los índices coinciden.
  if (f.length !== text.length) return <>{text}</>
  const parts: ReactNode[] = []
  let i = 0
  while (i < text.length) {
    let j = i
    while (j < text.length && mark[j] === mark[i]) j++
    parts.push(mark[i] ? <mark key={i}>{text.slice(i, j)}</mark> : text.slice(i, j))
    i = j
  }
  return <>{parts}</>
}

const topicLabel = (t: TopicDef) => t.shortTitle || t.title

export function App() {
  const [route, go] = useHashRoute()
  const { dark, toggle, digits, setDigits } = useTheme()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useLocalState<string[]>('nav-collapsed', [])
  const [palette, setPalette] = useLocalState<boolean>('palette', true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpTab, setHelpTab] = useState<HelpTab>('sintaxis')
  const [scrolled, setScrolled] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)

  const found = route.length === 2 ? findMethod(route[0], route[1]) : null
  const routeKey = route.join('/')

  const openHelp = useCallback((tab?: HelpTab) => {
    if (tab) setHelpTab(tab)
    setHelpOpen(true)
  }, [])

  const focusSearch = useCallback(() => {
    setNavOpen(true)
    // en móvil el menú está oculto (visibility: hidden) hasta que termina de abrirse
    requestAnimationFrame(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    })
  }, [])

  // Atajos globales
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
        return
      }
      if (mod && (e.key === '/' || e.code === 'Slash')) {
        e.preventDefault()
        setHelpOpen((o) => !o)
        return
      }
      if (mod || e.altKey || isTyping(document.activeElement) || document.querySelector('dialog[open]')) return
      if (e.key === '?') {
        e.preventDefault()
        openHelp()
      } else if (e.key === '/') {
        e.preventDefault()
        focusSearch()
      } else if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusSearch, openHelp])

  // Al navegar: cerrar el menú móvil, volver arriba, título de la pestaña, expandir el tema activo.
  useEffect(() => {
    setNavOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
    document.title = found ? `${found.method.title} · ${CONFIG.appName}` : `${CONFIG.appName} · ${CONFIG.courseName}`
    if (found && collapsed.includes(found.topic.id)) setCollapsed((c) => c.filter((x) => x !== found.topic.id))
    // llevar el método activo a la vista dentro del menú
    requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>('.nav-item.active')?.scrollIntoView({ block: 'center' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const on = () => setScrolled(el.scrollTop > 4)
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [])

  const hits = useMemo(() => search(query), [query])
  const searching = query.trim().length > 0
  useEffect(() => setSel(0), [query])
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('.sr-item.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const openHit = (h: Hit | undefined) => {
    if (!h) return
    go(h.topic.id + '/' + h.method.id)
    setQuery('')
    searchRef.current?.blur()
  }

  const toggleTopic = (id: string) => setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  const Comp = found?.method.component
  const brandSub = [CONFIG.courseName, CONFIG.courseCode].filter(Boolean).join(' · ')

  return (
    <div className={'app' + (navOpen ? ' nav-open' : '')}>
      <a className="skip-link" href="#contenido" onClick={(e) => (e.preventDefault(), document.getElementById('contenido')?.focus())}>
        {L('Saltar al contenido', 'Skip to content')}
      </a>
      <aside className="sidebar" aria-label={L('Menú de métodos', 'Methods menu')}>
        <a className="brand" href="#/">
          <img src={LOGO} alt="" width={34} height={34} />
          <div>
            <div className="brand-name">{CONFIG.appName}</div>
            {brandSub && <div className="brand-sub">{brandSub}</div>}
          </div>
        </a>
        <div className="search" role="search">
          <span className="search-icon">
            <IconSearch size={15} />
          </span>
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder={L('Buscar método…', 'Search methods…')}
            aria-label={L('Buscar método', 'Search methods')}
            aria-controls="nav-list"
            aria-activedescendant={searching && hits[sel] ? `sr-${sel}` : undefined}
            autoComplete="off"
            spellCheck={false}
            data-palette="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && hits.length) {
                e.preventDefault()
                setSel((s) => (s + 1) % hits.length)
              } else if (e.key === 'ArrowUp' && hits.length) {
                e.preventDefault()
                setSel((s) => (s - 1 + hits.length) % hits.length)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                openHit(hits[sel] ?? hits[0])
              } else if (e.key === 'Escape') {
                if (query) {
                  e.stopPropagation()
                  setQuery('')
                } else {
                  searchRef.current?.blur()
                  setNavOpen(false)
                }
              }
            }}
          />
          {!query && <span className="kbd">{MOD_KEY === '⌘' ? '⌘K' : 'Ctrl K'}</span>}
        </div>
        <nav className="nav" id="nav-list" ref={navRef} aria-label={searching ? L('Resultados de búsqueda', 'Search results') : L('Temas', 'Topics')}>
          {searching ? (
            <div className="search-results" role="listbox" aria-label={L('Resultados', 'Results')}>
              <div className="search-count" aria-live="polite">
                {hits.length === 0
                  ? L('Sin resultados', 'No results')
                  : hits.length === 1
                    ? L('1 resultado', '1 result')
                    : L(`${hits.length} resultados`, `${hits.length} results`)}
              </div>
              {hits.map((h, i) => (
                <a
                  key={h.topic.id + '/' + h.method.id}
                  id={`sr-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  href={`#/${h.topic.id}/${h.method.id}`}
                  className={'sr-item' + (i === sel ? ' sel' : '')}
                  onMouseMove={() => i !== sel && setSel(i)}
                  onClick={() => setQuery('')}
                >
                  <div className="sr-title">
                    <Highlight text={h.method.title} q={query} />
                  </div>
                  <div className="sr-meta">
                    {h.topic.num > 0 ? `${L('Tema', 'Topic')} ${h.topic.num} · ` : ''}
                    {topicLabel(h.topic)}
                    {h.method.group ? ` · ${h.method.group}` : ''}
                  </div>
                  {h.method.summary && <div className="sr-sum">{h.method.summary}</div>}
                </a>
              ))}
              {hits.length === 0 && (
                <div className="nav-empty">
                  {L(
                    <>
                      Prueba con otra palabra (p. ej. <i>newton</i>, <i>simpson</i>, <i>error</i>).
                    </>,
                    <>
                      Try another word (e.g. <i>newton</i>, <i>simpson</i>, <i>error</i>).
                    </>,
                  )}
                </div>
              )}
            </div>
          ) : (
            TOPICS.filter((t) => t.methods.length).map((t) => {
              const current = found?.topic.id === t.id
              const isCollapsed = collapsed.includes(t.id)
              const listId = 'nav-t-' + t.id
              return (
                <div key={t.id} className={'nav-topic' + (current ? ' current' : '') + (isCollapsed ? ' collapsed' : '')}>
                  <button type="button" className="nav-topic-title" aria-expanded={!isCollapsed} aria-controls={listId} title={t.title} onClick={() => toggleTopic(t.id)}>
                    <span className="nav-num" aria-hidden="true">
                      {t.num > 0 ? t.num : '★'}
                    </span>
                    <span className="label">{topicLabel(t)}</span>
                    <span className="nav-caret" aria-hidden="true">
                      <IconChevron size={14} />
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="nav-methods" id={listId}>
                      {groupMethods(t.methods).map((g, gi) => (
                        <Fragment key={gi}>
                          {g.group && <div className="nav-group">{g.group}</div>}
                          {g.methods.map((m) => {
                            const active = current && found?.method.id === m.id
                            return (
                              <a key={m.id} href={`#/${t.id}/${m.id}`} className={'nav-item' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined} title={m.summary}>
                                {m.title}
                              </a>
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </nav>
        <div className="sidebar-foot">
          <label className="digits-ctl" title={L('Cifras significativas en tablas y resultados', 'Significant digits in tables and results')}>
            {L('Cifras', 'Digits')}
            <select className="input sm" value={digits} onChange={(e) => setDigits(Number(e.target.value))}>
              {[4, 6, 8, 10, 12, 15].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <span className="spacer" />
          {CONFIG.repoUrl && (
            <a className="icon-btn sm" href={CONFIG.repoUrl} target="_blank" rel="noopener noreferrer" aria-label={L('Código fuente en GitHub', 'Source code on GitHub')} title={L('Código fuente', 'Source code')}>
              <IconGithub size={15} />
            </a>
          )}
          <button type="button" className="icon-btn sm" onClick={() => openHelp('acerca')} aria-label={L('Acerca de', 'About')} title={L('Acerca de', 'About')}>
            <span style={{ font: '600 13px var(--display)', fontStyle: 'italic' }}>i</span>
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <main className={'main' + (scrolled ? ' scrolled' : '')} ref={mainRef}>
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label={L('Abrir el menú', 'Open the menu')} aria-expanded={navOpen}>
            <IconMenu size={17} />
          </button>
          <nav className="crumbs" aria-label={L('Ruta', 'Breadcrumb')}>
            {found ? (
              <>
                <a href="#/">{L('Inicio', 'Home')}</a>
                <span className="sep" aria-hidden="true">
                  /
                </span>
                <span className="crumb-topic">{topicLabel(found.topic)}</span>
                <span className="sep" aria-hidden="true">
                  /
                </span>
                <b aria-current="page">{found.method.title}</b>
              </>
            ) : route.length ? (
              <a href="#/">{L('Inicio', 'Home')}</a>
            ) : null}
          </nav>
          <div className="topbar-actions">
            <button type="button" className="icon-btn" onClick={focusSearch} aria-label={L('Buscar método', 'Search methods')} title={`${L('Buscar', 'Search')} (${MOD_KEY === '⌘' ? '⌘K' : 'Ctrl+K'})`}>
              <IconSearch size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-pressed={palette}
              onClick={() => setPalette(!palette)}
              aria-label={L('Teclado de símbolos', 'Symbol keyboard')}
              title={
                palette
                  ? L('Teclado de símbolos: activado (aparece al escribir una expresión)', 'Symbol keyboard: on (shows up while typing an expression)')
                  : L('Teclado de símbolos: desactivado', 'Symbol keyboard: off')
              }
            >
              <IconKeyboard size={17} />
            </button>
            <LangSwitch />
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={dark ? L('Cambiar a tema claro', 'Switch to light theme') : L('Cambiar a tema oscuro', 'Switch to dark theme')}
              title={dark ? L('Tema claro', 'Light theme') : L('Tema oscuro', 'Dark theme')}
            >
              {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <button type="button" className="icon-btn" onClick={() => openHelp()} aria-label={L('Ayuda', 'Help')} aria-haspopup="dialog" title={`${L('Ayuda', 'Help')} (? ${L('o', 'or')} ${MOD_KEY}/)`}>
              <IconHelp size={17} />
            </button>
          </div>
        </header>
        <div className="content" id="contenido" tabIndex={-1}>
          {Comp ? (
            <ErrorBoundary resetKey={routeKey} storagePrefix={found?.topic.id}>
              <Comp key={routeKey} />
            </ErrorBoundary>
          ) : route.length ? (
            <NotFound />
          ) : (
            <Home onSearch={focusSearch} onHelp={openHelp} />
          )}
        </div>
      </main>
      <SymbolPalette enabled={palette} setEnabled={setPalette} onHelp={() => openHelp('sintaxis')} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} tab={helpTab} setTab={setHelpTab} paletteEnabled={palette} setPaletteEnabled={setPalette} />
    </div>
  )
}

function NotFound() {
  return (
    <div className="card" style={{ marginTop: 24, maxWidth: 560 }}>
      <div className="card-title">{L('Página no encontrada', 'Page not found')}</div>
      <p className="muted">
        {L('Este enlace no corresponde a ningún método (quizá cambió de nombre).', 'This link does not match any method (it may have been renamed).')}
      </p>
      <a className="btn" href="#/">
        {L('Volver al inicio', 'Back to home')}
      </a>
    </div>
  )
}
