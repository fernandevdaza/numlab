// Selector de idioma (ES | EN). Cambiar el idioma guarda la preferencia y recarga la app (ver i18n.ts).
import { L, LANG, setLang, type Lang } from '../i18n'

const OPTIONS: { id: Lang; short: string; name: string }[] = [
  { id: 'es', short: 'ES', name: 'Español' },
  { id: 'en', short: 'EN', name: 'English' },
]

/** Control segmentado compacto. `full` muestra el nombre completo del idioma (p. ej. en la ayuda). */
export function LangSwitch({ full, className }: { full?: boolean; className?: string }) {
  return (
    <div className={'lang-switch' + (full ? ' full' : '') + (className ? ' ' + className : '')} role="group" aria-label={L('Idioma', 'Language')}>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          lang={o.id}
          aria-pressed={LANG === o.id}
          title={o.id === LANG ? o.name : o.id === 'en' ? 'Switch to English' : 'Cambiar a español'}
          onClick={() => o.id !== LANG && setLang(o.id)}
        >
          {full ? o.name : o.short}
        </button>
      ))}
    </div>
  )
}
