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
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
  /** Locale para formatear fechas. */
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
  courseName: 'Métodos Numéricos',
  courseCode: 'MA1007',
  institution: 'UPB',
  term: 'Semestre VI',
  exams: [
    { label: 'Primer parcial', date: '2026-10-05', topics: 'Temas 1 y 2' },
    { label: 'Segundo parcial', date: '2026-10-20', topics: 'Temas 3 y 4' },
    { label: 'Examen final', date: '2026-11-04', topics: 'Temas 5 y 6' },
  ],
  locale: 'es-BO',
  repoUrl: 'https://github.com/fernandevdaza/numlab',
  license: 'MIT',
  licenseUrl: 'https://github.com/fernandevdaza/numlab/blob/main/LICENSE',
}
