/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Configuración del curso
 * ─────────────────────────────────────────────────────────────────────────────
 *  Este es el ÚNICO archivo que necesitas editar para adaptar NumLab a tu
 *  materia, universidad o semestre. Todo lo demás (menú, portada, ayuda) lee
 *  estos valores.
 *
 *  - Deja un campo como cadena vacía ('') para ocultarlo.
 *  - Deja `exams` como arreglo vacío ([]) para ocultar la cuenta regresiva.
 *  - Las fechas van en formato ISO 'AAAA-MM-DD'.
 *  - Los textos visibles son bilingües: L('español', 'English'). Si tu curso
 *    usa un solo idioma, puedes poner el mismo texto en ambos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { L, LOCALE } from './i18n.ts'

export interface ExamDef {
  /** Nombre visible, p. ej. "Primer parcial". */
  label: string
  /** Fecha en formato 'AAAA-MM-DD'. */
  date: string
  /** Temas que entran (texto libre, opcional). */
  topics?: string
}

export interface CourseConfig {
  /** Nombre de la aplicación. */
  appName: string
  /** Nombre de la materia. */
  courseName: string
  /** Sigla / código de la materia (p. ej. "MA1007"). */
  courseCode: string
  /** Universidad o institución (p. ej. "UPB"). */
  institution: string
  /** Periodo, semestre o gestión (p. ej. "Semestre VI"). */
  term: string
  /** Fechas de exámenes para la cuenta regresiva de la portada. */
  exams: ExamDef[]
  /** Locale para formatear fechas (por defecto, el del idioma de la interfaz). */
  locale: string
  /** Repositorio del proyecto (enlace en la ayuda). Vacío para ocultarlo. */
  repoUrl: string
  /** Nombre de la licencia (p. ej. "MIT"). Vacío muestra un texto genérico. */
  license: string
  /** Enlace al archivo de licencia. */
  licenseUrl: string
}

export const CONFIG: CourseConfig = {
  appName: 'NumLab',
  courseName: L('Métodos Numéricos', 'Numerical Methods'),
  courseCode: 'MA1007',
  institution: 'UPB',
  term: L('Semestre VI', '6th semester'),
  exams: [
    { label: L('Primer parcial', 'First midterm'), date: '2026-10-05', topics: L('Temas 1 y 2', 'Topics 1 & 2') },
    { label: L('Segundo parcial', 'Second midterm'), date: '2026-10-20', topics: L('Temas 3 y 4', 'Topics 3 & 4') },
    { label: L('Examen final', 'Final exam'), date: '2026-11-04', topics: L('Temas 5 y 6', 'Topics 5 & 6') },
  ],
  locale: LOCALE,
  repoUrl: 'https://github.com/fernandevdaza/numlab',
  license: 'MIT',
  licenseUrl: 'https://github.com/fernandevdaza/numlab/blob/main/LICENSE',
}
