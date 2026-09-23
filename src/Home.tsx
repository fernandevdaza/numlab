import { Fragment } from 'react'
import { TOPICS } from './modules/registry'
import type { MethodDef } from './modules/types'
import { CONFIG, type ExamDef } from './config'
import { MOD_KEY, type HelpTab } from './components/Help'
import { IconGithub, IconHelp, IconSearch } from './components/icons'

/** Días completos hasta la fecha (0 = hoy, negativo = ya pasó). Compara fechas de calendario locales. */
function daysUntil(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, (m || 1) - 1, d || 1)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function examDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return Number.isNaN(dt.getTime()) ? iso : dt.toLocaleDateString(CONFIG.locale || undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function Exams({ exams }: { exams: ExamDef[] }) {
  const valid = exams.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
  if (!valid.length) return null
  const next = valid.find((e) => daysUntil(e.date) >= 0)
  return (
    <div className="exams" aria-label="Próximas evaluaciones">
      {valid.map((e) => {
        const d = daysUntil(e.date)
        return (
          <div key={e.label + e.date} className={'exam' + (e === next ? ' next' : '') + (d < 0 ? ' past' : '')}>
            <div className="exam-days" aria-hidden="true">
              {d < 0 ? '✓' : d === 0 ? '¡Hoy!' : (
                <span>
                  {d}
                  <small> {d === 1 ? 'día' : 'días'}</small>
                </span>
              )}
            </div>
            <div>
              <div className="exam-label">{e.label}</div>
              <div className="exam-sub">
                <span className="sr-only">{d < 0 ? 'Ya rendido. ' : d === 0 ? 'Es hoy. ' : `Faltan ${d} ${d === 1 ? 'día' : 'días'}. `}</span>
                {examDate(e.date)}
                {e.topics ? ` · ${e.topics}` : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Ilustración: f(x) con las tangentes del método de Newton. SVG decorativo, usa los colores del tema. */
function HeroArt() {
  // curva exponencial en coordenadas del viewBox (y crece hacia abajo); el eje x está en y = 150
  const f = (x: number) => 250 - 12 * Math.exp((x - 40) / 110)
  const df = (x: number) => (f(x + 0.01) - f(x - 0.01)) / 0.02
  const pts: string[] = []
  for (let x = 20; x <= 372; x += 4) pts.push(`${x},${f(x).toFixed(1)}`)
  const axisY = 150
  // tres pasos de Newton desde x0 = 360 (raíz donde f = axisY)
  const steps: { x0: number; x1: number }[] = []
  let x = 360
  for (let k = 0; k < 3; k++) {
    const x1 = x - (f(x) - axisY) / df(x)
    steps.push({ x0: x, x1 })
    x = x1
  }
  return (
    <svg className="hero-art" viewBox="0 0 420 300" aria-hidden="true" focusable="false">
      <line x1="10" y1={axisY} x2="410" y2={axisY} stroke="var(--border-2)" strokeWidth="1.5" />
      <line x1="40" y1="20" x2="40" y2="280" stroke="var(--border-2)" strokeWidth="1.5" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {steps.map((s, i) => (
        <g key={i} opacity={1 - i * 0.18}>
          <line x1={s.x0} y1={axisY} x2={s.x0} y2={f(s.x0)} stroke="var(--faint)" strokeDasharray="3 4" strokeWidth="1.3" />
          <line x1={s.x0} y1={f(s.x0)} x2={s.x1} y2={axisY} stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" />
          <circle cx={s.x0} cy={f(s.x0)} r="4.5" fill="var(--panel)" stroke="var(--accent-2)" strokeWidth="2" />
          {i < 2 && (
          <text x={s.x0} y={axisY + 20} textAnchor="middle" fontSize="13" fontStyle="italic" fontFamily="var(--display)" fill="var(--muted)">
            x{String.fromCharCode(0x2080 + i)}
          </text>
          )}
        </g>
      ))}
      <circle cx={steps[2].x1} cy={axisY} r="5" fill="var(--accent)" />
    </svg>
  )
}

function methodGroups(methods: MethodDef[]) {
  const out: { group?: string; methods: MethodDef[] }[] = []
  for (const m of methods) {
    const last = out[out.length - 1]
    if (last && last.group === m.group) last.methods.push(m)
    else out.push({ group: m.group, methods: [m] })
  }
  return out
}

export function Home({ onSearch, onHelp }: { onSearch?: () => void; onHelp?: (tab?: HelpTab) => void }) {
  const topics = TOPICS.filter((t) => t.methods.length)
  const total = topics.reduce((s, t) => s + t.methods.length, 0)
  const eyebrow = [CONFIG.courseCode, CONFIG.institution, CONFIG.term].filter(Boolean).join(' · ')
  const first = topics.find((t) => t.num > 0) ?? topics[0]
  return (
    <div className="home">
      <section className="hero">
        <HeroArt />
        <div className="hero-text">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>
            Tu laboratorio de <em>{CONFIG.courseName ? CONFIG.courseName.toLowerCase() : 'métodos numéricos'}</em>
          </h1>
          <p className="lead">
            Cada método del sílabo con tabla de iteraciones, gráficas interactivas, análisis de error, desarrollo paso a paso y exportación a
            Scilab. Escribe tu función y todo se recalcula al instante.
          </p>
          <div className="hero-actions">
            {first?.methods[0] && (
              <a className="btn primary" href={`#/${first.id}/${first.methods[0].id}`}>
                Empezar por {first.shortTitle || first.title}
              </a>
            )}
            {onSearch && (
              <button type="button" className="btn" onClick={onSearch}>
                <IconSearch size={15} /> Buscar un método <span className="kbd">{MOD_KEY === '⌘' ? '⌘K' : 'Ctrl K'}</span>
              </button>
            )}
            {onHelp && (
              <button type="button" className="btn ghost" onClick={() => onHelp('sintaxis')}>
                <IconHelp size={15} /> Cómo escribir funciones
              </button>
            )}
          </div>
          <Exams exams={CONFIG.exams} />
        </div>
      </section>

      <div className="section-head">
        <h2>Temas</h2>
        <span className="muted">
          {topics.length} temas · {total} páginas
        </span>
      </div>
      <section className="topic-grid">
        {topics.map((t) => (
          <article key={t.id} className="topic-card card">
            <div className="topic-head">
              <span className="topic-num">{t.num > 0 ? `Tema ${t.num}` : 'Herramientas'}</span>
              <span className="topic-glyph" aria-hidden="true">
                {t.glyph}
              </span>
            </div>
            <h3>
              <a href={`#/${t.id}/${t.methods[0].id}`}>{t.title}</a>
            </h3>
            <p>{t.blurb}</p>
            {methodGroups(t.methods).map((g, i) => (
              <Fragment key={i}>
                {g.group && <div className="topic-group">{g.group}</div>}
                <div className="topic-links">
                  {g.methods.map((m) => (
                    <a key={m.id} href={`#/${t.id}/${m.id}`} className="chip" title={m.summary}>
                      {m.title}
                    </a>
                  ))}
                </div>
              </Fragment>
            ))}
          </article>
        ))}
      </section>

      <footer className="home-foot">
        <span>
          {CONFIG.appName}
          {CONFIG.license ? ` · Código abierto (${CONFIG.license})` : ' · Código abierto'}
          {CONFIG.repoUrl && (
            <>
              {' · '}
              <a href={CONFIG.repoUrl} target="_blank" rel="noopener noreferrer">
                <IconGithub size={13} style={{ verticalAlign: '-2px' }} /> Repositorio
              </a>
            </>
          )}
        </span>
        <span>
          Pulsa <span className="kbd">?</span> para ver la ayuda y los atajos
          {onHelp && (
            <>
              {' · '}
              <button type="button" className="link-btn" onClick={() => onHelp('acerca')}>
                Acerca de
              </button>
            </>
          )}
        </span>
      </footer>
    </div>
  )
}
