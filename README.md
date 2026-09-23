# NumLab · Laboratorio de Métodos Numéricos

Aplicación web interactiva para estudiar **Métodos Numéricos**: cada método del curso con su tabla de iteraciones,
gráficas, análisis de error y convergencia, **desarrollo paso a paso con los números sustituidos** (como se escribe
en un examen) y el **código Scilab** equivalente listo para descargar.

Nació para el curso MA1007 de la Universidad Privada Boliviana (UPB) y sigue la notación y los ejemplos del texto
de la materia, pero sirve para cualquier curso introductorio de análisis numérico.

## Características

- **57 páginas** que cubren todo el programa: representación de números y errores, ecuaciones no lineales,
  sistemas lineales, interpolación, derivación e integración numérica y ecuaciones diferenciales ordinarias.
- **Paso a paso** con fórmulas en KaTeX y los valores sustituidos en las primeras iteraciones.
- **Ejemplos del texto** en un clic ("Ej. 2.8", "Ej. 4.12", …) que reproducen sus tablas.
- **Código Scilab** generado con los datos que ingresaste (`.sce`) y exportación de tablas a CSV.
- **Gráficas fieles**: muestreo adaptativo que no pierde picos ni oscilaciones y que corta las asíntotas y los
  saltos en lugar de dibujar líneas falsas.
- **Calculadora simbólica (CAS)** y **graficador** con raíces, extremos e intersecciones.
- **Teclado de símbolos** para escribir funciones, **ayuda** integrada (`?`) y búsqueda (`⌘K` / `Ctrl+K`).
- Tema claro y oscuro, diseño adaptable a celulares, todo en español.

## Contenido

| Tema | Métodos |
|---|---|
| 1 · Representación de números y errores | Conversión entre bases · Máquina binaria de 16 bits · Estándar IEEE 754 · Sistema flotante F(β, t, L, U) · Épsilon de máquina · Error absoluto y relativo · Computadora decimal de 7 dits · Propagación de errores · Cancelación catastrófica · Número de condición · Estabilidad numérica · Series de Taylor |
| 2 · Ecuaciones no lineales | Bisección · Punto fijo · Aitken (Δ²) · Steffensen · Newton-Raphson · Secante · Posición falsa · Newton modificado (raíces múltiples) · Comparación |
| 3 · Sistemas de ecuaciones lineales | Eliminación de Gauss · Thomas · Factorización LU · Gauss-Jacobi · Gauss-Seidel y SOR · Número de condición · Newton para sistemas · Punto fijo para sistemas · Método de la potencia |
| 4 · Interpolación | Lagrange · Diferencias divididas · Diferencias finitas · Estimación del error · Fenómeno de Runge · Splines cúbicas |
| 5 · Derivación e integración numérica | Diferencias finitas · Trapecio · Simpson · Newton-Cotes · Romberg-Richardson · Gauss-Legendre · Integrales dobles · Comparación |
| 6 · Ecuaciones diferenciales ordinarias | Euler · Punto medio · Trapecio / Euler modificado · Trapecio implícito · Adams-Moulton · Taylor · Runge-Kutta · Sistemas de primer orden · Orden superior · Comparación · Misil de persecución en R³ |
| Herramientas | Calculadora simbólica (CAS) · Graficador de funciones |

## Uso

Requisitos: [Node.js](https://nodejs.org) 22 o superior y [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Otros comandos:

```bash
pnpm build          # comprueba tipos y genera la versión de producción en dist/
pnpm test           # todas las pruebas
pnpm test:metodos   # verificación numérica de los métodos contra resultados conocidos
pnpm test:graficas  # fidelidad del muestreo de gráficas
```

## Verificación

La fidelidad es la prioridad. `pnpm test:metodos` ejecuta más de 800 comprobaciones que reproducen los ejemplos
resueltos del texto de la materia, tablas de Burden & Faires y formas cerradas. Cuando un libro trae un error
aritmético, la aplicación usa el valor correcto y la prueba correspondiente lo documenta.

## Adaptarlo a tu curso

Los datos del curso (nombre, código, universidad, fechas de exámenes, enlace al repositorio) están en
[`src/config.ts`](src/config.ts). Si no configuras fechas de exámenes, la cuenta regresiva no se muestra.

## Estructura

```
src/
  modules/<tema>/     un módulo por tema: algoritmos puros, páginas, teoría e index.ts (registro)
  components/         interfaz compartida (MethodPage, DataTable, ScilabCode, Plot, ayuda, teclado…)
  lib/                expresiones (mathjs), formato de números, muestreo de gráficas
  config.ts           datos del curso
scripts/              pruebas numéricas que se ejecutan con Node
```

## Contribuir

¡Las contribuciones son bienvenidas! Lee [CONTRIBUTING.md](CONTRIBUTING.md).

## Tecnologías

React · TypeScript · Vite · [mathjs](https://mathjs.org) · [nerdamer](https://nerdamer.com) ·
[KaTeX](https://katex.org) · [Plotly](https://plotly.com/javascript/)

## Licencia

[MIT](LICENSE)
