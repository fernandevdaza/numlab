// Idioma de la interfaz (español / inglés).
//
// Uso en cualquier parte del código, también fuera de React y a nivel de módulo:
//   L('Iteraciones', 'Iterations')
//   L(<>Texto con <b>JSX</b></>, <>Text with <b>JSX</b></>)
//
// El idioma se fija al cargar la página (localStorage → idioma del navegador → español) y cambiarlo
// recarga la página; por eso L() puede usarse en constantes, registros de métodos y algoritmos.

export type Lang = 'es' | 'en'

const KEY = 'numlab:lang'

function detect(): Lang {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (v === 'es' || v === 'en') return v
    }
    // Sólo en el navegador: fuera de él (pruebas con Node) se usa español, el idioma original.
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.language)
      return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
  } catch {
    /* sin almacenamiento */
  }
  return 'es'
}

export const LANG: Lang = detect()

if (typeof document !== 'undefined') document.documentElement.lang = LANG

/** Devuelve la versión del texto (o nodo JSX) en el idioma actual. */
export function L<T>(es: T, en: T): T {
  return LANG === 'en' ? en : es
}

/** Cambia el idioma y recarga la aplicación. */
export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lang))
  } catch {
    /* sin almacenamiento */
  }
  if (typeof window !== 'undefined') window.location.reload()
}

/** Configuración regional para fechas y números con separadores (p. ej. toLocaleDateString). */
export const LOCALE = LANG === 'en' ? 'en-US' : 'es-BO'
