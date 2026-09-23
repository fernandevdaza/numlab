<p align="right"><a href="CONTRIBUTING.md">English</a> · <b>Español</b></p>

# Cómo contribuir a NumLab

¡Gracias por querer mejorar NumLab! Es una herramienta hecha por y para estudiantes de Métodos Numéricos.

## Preparar el entorno

Requisitos: Node.js 22 o superior y [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # abre http://localhost:5173
```

Antes de enviar cambios:

```bash
pnpm build          # comprueba tipos (tsc) y compila
pnpm test           # fórmulas TeX, fidelidad de gráficas y verificación numérica
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/modules/<tema>/` | Un módulo por tema del curso. Cada uno exporta un `topic` (ver `src/modules/types.ts`) con sus métodos. |
| `src/modules/<tema>/algorithms.ts` | Algoritmos **puros** (sin React): fáciles de probar con Node. |
| `src/components/` | Componentes compartidos de interfaz (`MethodPage`, `DataTable`, `ScilabCode`, `Plot`…). |
| `src/lib/` | Utilidades: expresiones (mathjs), formato de números, muestreo de gráficas. |
| `scripts/` | Pruebas de verificación numérica que se ejecutan con Node. |

## Agregar un método

1. Escribe el algoritmo como función pura en `algorithms.ts` y verifícalo contra un resultado conocido (libro, forma
   cerrada) con una prueba en `scripts/verificar/<tema>.ts`.
2. Crea la página con `MethodPage`: parámetros, resultados, tabla de iteraciones, **paso a paso** con los números sustituidos y el código **Scilab** equivalente.
3. Regístrala en el `index.ts` del tema (con `group`, `summary` y `keywords`).

## Criterios

- **Fidelidad primero:** cada resultado debe poder comprobarse a mano o con Scilab. Si una definición varía entre libros, indica cuál se usa y, si es posible, ofrece la otra como opción.
- **Bilingüe:** todo texto visible va con `L('texto en español', 'English text')` (ver `src/i18n.ts`); también sirve
  con JSX: `L(<>…</>, <>…</>)`. Notación matemática en KaTeX.
- **Derechos de autor:** no copies texto de libros; explica con tus palabras. Citar el número de un ejemplo y usar sus datos numéricos está bien.

## Reportar errores

Abre un *issue* con: la página (URL con `#/tema/metodo`), los datos que ingresaste, el resultado que obtuviste y el que esperabas (con la fuente, si es de un libro).
