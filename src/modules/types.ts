import type { ComponentType } from 'react'

export interface MethodDef {
  /** slug para la URL: #/<topic>/<id> */
  id: string
  title: string
  /** palabras clave extra para el buscador */
  keywords?: string
  /**
   * Subgrupo dentro del tema (p. ej. "Métodos cerrados", "Métodos abiertos").
   * Los métodos consecutivos con el mismo `group` se muestran bajo un subtítulo en el menú.
   */
  group?: string
  /** Descripción corta (una línea) para tarjetas y el buscador. */
  summary?: string
  component: ComponentType
}

export interface TopicDef {
  id: string
  /** número de tema del sílabo (0 = herramientas) */
  num: number
  title: string
  /** una línea de descripción */
  blurb: string
  /** símbolo decorativo corto (TeX o texto) */
  glyph: string
  /** Título corto para el menú lateral (si el título completo es largo). */
  shortTitle?: string
  methods: MethodDef[]
}
