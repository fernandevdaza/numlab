import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'

export type OdeKind = 'euler' | 'punto-medio' | 'heun' | 'trapecio' | 'adams-moulton' | 'taylor' | 'runge-kutta'
export type PageId = OdeKind | 'sistemas-edo' | 'orden-superior' | 'comparar-edo' | 'misil'

export const TOPIC = 'Tema 6 · Ecuaciones diferenciales ordinarias'

/** Títulos de página (coinciden con el menú o son un poco más largos). */
export const TITLES: Record<PageId, string> = {
  euler: 'Método de Euler',
  'punto-medio': 'Método del punto medio',
  heun: 'Método del trapecio o Euler modificado',
  trapecio: 'Trapecio implícito (corrector iterado)',
  'adams-moulton': 'Método de Adams-Moulton',
  taylor: 'Métodos de Taylor',
  'runge-kutta': 'Métodos de Runge-Kutta',
  'sistemas-edo': 'Sistemas de EDO de primer orden',
  'orden-superior': 'Ecuaciones de orden superior',
  'comparar-edo': 'Comparación de métodos (orden)',
  misil: 'Misil de persecución en R³',
}

/** Títulos del menú (≤ 32 caracteres). */
export const SHORT: Record<PageId, string> = {
  euler: 'Método de Euler',
  'punto-medio': 'Método del punto medio',
  heun: 'Trapecio o Euler modificado',
  trapecio: 'Trapecio implícito iterado',
  'adams-moulton': 'Método de Adams-Moulton',
  taylor: 'Métodos de Taylor',
  'runge-kutta': 'Métodos de Runge-Kutta',
  'sistemas-edo': 'Sistemas de primer orden',
  'orden-superior': 'Ecuaciones de orden superior',
  'comparar-edo': 'Comparación de métodos',
  misil: 'Misil de persecución en R³',
}

/** Resumen de una línea (menú, tarjetas y buscador). */
export const SUMMARY: Record<PageId, string> = {
  euler: 'Integral aproximada por un rectángulo: yₙ₊₁ = yₙ + h f(xₙ, yₙ). Orden 1.',
  'punto-medio': 'Método explícito de 2 pasos: yₙ₊₁ = yₙ₋₁ + 2h f(xₙ, yₙ). Orden 2.',
  heun: 'Regla del trapecio con predictor de Euler y un corrector. Orden 2.',
  trapecio: 'Trapecio sin predictor: la ecuación implícita se resuelve con Newton o punto fijo.',
  'adams-moulton': 'Predictor de Adams-Bashforth y corrector de Adams-Moulton de 4 pasos. Orden 4.',
  taylor: 'Serie de Taylor de la solución con y″ = ∂f/∂x + (∂f/∂y)·f (orden 1 a 4).',
  'runge-kutta': 'RK2 del texto (γ₂ = 3/4), RK4 clásico y otras variantes, incluido RKF45 adaptativo.',
  'sistemas-edo': 'Y′ = F(x, Y): los mismos métodos en forma vectorial; plano de fase y 3D.',
  'orden-superior': 'Reducción de y⁽ᵐ⁾ = f(x, y, …, y⁽ᵐ⁻¹⁾) a un sistema de primer orden.',
  'comparar-edo': 'Mismo PVI con todos los métodos: error global vs h en escala log-log.',
  misil: 'Curva de persecución en R³: sistema no lineal de 3 EDO resuelto con RK4.',
}

export const DESCRIPTIONS: Record<PageId, ReactNode> = {
  euler: 'Se integra la EDO entre dos nodos y la integral se aproxima por un rectángulo de altura f(xₙ, yₙ): avanzar por la recta tangente. Error local ∝ h², error global ∝ h.',
  'punto-medio': 'La integral sobre [xₙ₋₁, xₙ₊₁] se aproxima con la regla del punto medio (rectángulo de altura f(xₙ, yₙ) y base 2h). Explícito de 2 pasos; y₁ se obtiene con Euler.',
  heun: 'La integral se aproxima con la regla del trapecio; como yₙ₊₁ aparece en ambos lados, se predice con Euler y se corrige una vez (técnica predictor-corrector).',
  trapecio: 'La misma fórmula del trapecio, pero repitiendo la corrección hasta que converja (o con Newton): se resuelve la ecuación implícita en cada paso. A-estable.',
  'adams-moulton': 'Interpola f con un polinomio de diferencias regresivas de grado 3 e integra: predictor de Adams-Bashforth y corrector de Adams-Moulton. Necesita y₁, y₂, y₃ previos.',
  taylor: 'Se trunca la serie de Taylor de la solución; las derivadas y″, y‴… se obtienen derivando f(x, y) a lo largo de la solución (aquí, simbólicamente).',
  'runge-kutta': 'Fórmulas de un paso que combinan varias evaluaciones de f para tener la misma precisión que Taylor de orden N sin derivar f.',
  'sistemas-edo': 'Y′ = F(x, Y) con m ecuaciones: los métodos de una ecuación se aplican igual, con vectores (Ej. 6.8 y 6.9 del texto). Gráficas, plano de fase y trayectorias 3D.',
  'orden-superior': 'Una EDO de orden m se transforma en un sistema de m ecuaciones de primer orden tomando como incógnitas y, y′, …, y⁽ᵐ⁻¹⁾ (Ej. 6.10 del texto).',
  'comparar-edo': 'Resuelve el mismo PVI con todos los métodos y estima experimentalmente el orden de cada uno en una gráfica log-log del error frente a h.',
  misil: 'Curva de persecución pura: un misil de rapidez constante apunta siempre hacia un blanco que se mueve por una trayectoria dada. Sistema no lineal en R³ resuelto con RK4 (sesión 30 del sílabo).',
}

const pvi = <Tex block>{"y'(x) = f(x, y),\\qquad y(x_0) = y_0,\\qquad x_n = x_0 + nh"}</Tex>

/** Nota de notación: el texto usa x, y_n; la aplicación, t, w_i (Burden). */
const notacion = (
  <p className="muted">
    <b>Notación.</b> El texto escribe la variable independiente como <Tex>x</Tex> y la aproximación como <Tex>{'y_n \\approx y(x_n)'}</Tex>. En los cálculos de la aplicación la variable
    independiente se llama <Tex>t</Tex> y la aproximación <Tex>{'w_i \\approx y(t_i)'}</Tex> (como en Burden & Faires); en los campos puedes escribir <Tex>x</Tex> en lugar de <Tex>t</Tex>.
  </p>
)

const errOrden = (p: number, extra?: ReactNode) => (
  <p>
    <b>Error:</b> el error cometido en un paso (error local) es proporcional a <Tex>{`h^{${p + 1}}`}</Tex>; al acumularse sobre los <Tex>{'N \\propto 1/h'}</Tex> pasos, el error global es
    proporcional a <Tex>{p === 1 ? 'h' : `h^{${p}}`}</Tex>: el método es de <b>orden {p}</b>
    {p > 1 ? <> (al dividir h entre 2 el error global se divide aproximadamente entre {2 ** p})</> : <> (al dividir h entre 2 el error global se divide aproximadamente entre 2)</>}.
    {extra}
  </p>
)

export const THEORY: Record<PageId, ReactNode> = {
  euler: (
    <>
      {pvi}
      <p>
        <b>Idea (métodos basados en integración numérica):</b> como la incógnita está dada por su derivada, se integra la EDO entre dos nodos consecutivos. El método de Euler aproxima la
        integral por el área de un rectángulo de altura <Tex>{'f(x_n, y_n)'}</Tex> (extremo izquierdo) y base <Tex>h</Tex>:
      </p>
      <Tex block>{'y(x_{n+1}) = y(x_n) + \\int_{x_n}^{x_{n+1}} f(x, y(x))\\,dx \\;\\approx\\; y_n + h\\,f(x_n, y_n)'}</Tex>
      <Tex block>{'\\boxed{y_{n+1} = y_n + h\\,f(x_n, y_n),\\qquad n \\ge 0}'}</Tex>
      <p>
        La misma fórmula se obtiene truncando la serie de Taylor en el primer orden (“Taylor de orden 1”). Cada valor se calcula con el anterior, que ya es aproximado, por eso el error{' '}
        <b>se acumula</b> al alejarse de <Tex>x_0</Tex> (Ej. 6.1 del texto).
      </p>
      {errOrden(
        1,
        <>
          {' '}
          Cota clásica (Burden & Faires, Teorema 5.9): si <Tex>f</Tex> es Lipschitz con constante <Tex>L</Tex> y <Tex>{"|y''|\\le M"}</Tex>, entonces{' '}
          <Tex>{'|y(x_n) - y_n| \\le \\frac{hM}{2L}\\left[e^{L(x_n - x_0)} - 1\\right]'}</Tex>.
        </>,
      )}
      <p>
        <b>Estabilidad</b> (ecuación de prueba <Tex>{"y' = \\lambda y"}</Tex>, <Tex>{'\\lambda<0'}</Tex>): <Tex>{'y_{n+1} = (1 + h\\lambda)\\,y_n'}</Tex>. La solución numérica decae sólo si{' '}
        <Tex>{'|1 + h\\lambda| < 1'}</Tex>, es decir <Tex>{'h < 2/|\\lambda|'}</Tex>. Prueba el ejemplo “rígida” con h = 0.12.
      </p>
      {notacion}
    </>
  ),
  'punto-medio': (
    <>
      {pvi}
      <p>
        El texto aproxima la integral con la <b>regla del punto medio</b>. Para que el punto medio del intervalo de integración sea un nodo <Tex>{'x_n'}</Tex>, se integra sobre{' '}
        <Tex>{'[x_{n-1}, x_{n+1}]'}</Tex> (base <Tex>2h</Tex>) con un rectángulo de altura <Tex>{'f(x_n, y_n)'}</Tex>:
      </p>
      <Tex block>{'y(x_{n+1}) = y(x_{n-1}) + \\int_{x_{n-1}}^{x_{n+1}} f(x, y(x))\\,dx \\;\\approx\\; y_{n-1} + 2h\\,f(x_n, y_n)'}</Tex>
      <Tex block>{'\\boxed{y_1 = y_0 + h\\,f(x_0, y_0)\\;\\text{(Euler)},\\qquad y_{n+1} = y_{n-1} + 2h\\,f(x_n, y_n),\\quad n \\ge 1}'}</Tex>
      <p>
        Es un método <b>explícito de 2 pasos</b>: para calcular <Tex>{'y_{n+1}'}</Tex> hacen falta <Tex>{'(x_{n-1}, y_{n-1})'}</Tex> y <Tex>{'(x_n, y_n)'}</Tex>; por eso el primer valor{' '}
        <Tex>{'y_1'}</Tex> se obtiene con otro método (Euler). Usa una sola evaluación de <Tex>f</Tex> por paso.
      </p>
      {errOrden(2)}
      <p>
        <b>Cuidado:</b> para <Tex>{"y' = \\lambda y"}</Tex> con <Tex>{'\\lambda < 0'}</Tex> la recurrencia <Tex>{'y_{n+1} = y_{n-1} + 2h\\lambda y_n'}</Tex> tiene una raíz “parásita” de módulo mayor
        que 1: aparece una oscilación que crece (inestabilidad débil). Con h pequeño y en intervalos cortos, como en el Ej. 6.2, el método es muy preciso; en intervalos largos con soluciones que
        decaen conviene otro método (prueba el ejemplo “rígida”).
      </p>
      <p>
        <b>Otra variante (Burden & Faires):</b> el “método del punto medio” de un paso, un Runge-Kutta de orden 2 que estima <Tex>{'y(x_n + h/2)'}</Tex> con medio paso de Euler:{' '}
        <Tex>{'V_1 = f(x_n, y_n),\\; V_2 = f(x_n + \\tfrac h2, y_n + \\tfrac h2 V_1),\\; y_{n+1} = y_n + h V_2'}</Tex>. Se puede elegir en el selector “Variante”.
      </p>
      {notacion}
    </>
  ),
  heun: (
    <>
      {pvi}
      <p>
        La integral se aproxima con la <b>regla del trapecio</b>:
      </p>
      <Tex block>{'y(x_{n+1}) = y(x_n) + \\int_{x_n}^{x_{n+1}} f(x, y(x))\\,dx \\;\\approx\\; y_n + \\frac h2\\left[f(x_n, y_n) + f(x_{n+1}, y_{n+1})\\right]'}</Tex>
      <p>
        Esta relación no se puede usar directamente porque <Tex>{'y_{n+1}'}</Tex> aparece en ambos lados. La <b>técnica del predictor-corrector</b> lo resuelve: se <i>predice</i>{' '}
        <Tex>{'y_{n+1}'}</Tex> con Euler y se <i>corrige</i> con la fórmula del trapecio:
      </p>
      <Tex block>{'\\boxed{\\begin{aligned} &\\text{Predictor: } && \\tilde y_{n+1} = y_n + h\\,f(x_n, y_n)\\\\ &\\text{Corrector: } && y_{n+1} = y_n + \\frac h2\\left[f(x_n, y_n) + f(x_{n+1}, \\tilde y_{n+1})\\right]\\end{aligned}\\qquad n \\ge 0}'}</Tex>
      {errOrden(2)}
      <p>
        Es el mismo método que Burden & Faires llaman <i>Euler modificado</i> y Chapra <i>método de Heun</i>; también es un Runge-Kutta de orden 2 con <Tex>{'\\gamma_1 = \\gamma_2 = \\tfrac12'}</Tex>.
        Para la ecuación lineal de los ejemplos del texto da los mismos números que Taylor de orden 2 y que el RK2 con <Tex>{'\\gamma_2 = \\tfrac34'}</Tex> (Ej. 6.3, 6.5 y 6.6). El texto lo clasifica
        como método implícito porque la fórmula del trapecio lo es; si se repite la corrección hasta converger se obtiene el <b>trapecio implícito</b> (página siguiente).
      </p>
      {notacion}
    </>
  ),
  trapecio: (
    <>
      {pvi}
      <p>
        Es la fórmula del trapecio <b>sin</b> sustituir <Tex>{'y_{n+1}'}</Tex> por un predictor: un método <b>implícito</b>.
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + \\frac{h}{2}\\left[f(x_n, y_n) + f(x_{n+1}, y_{n+1})\\right]}'}</Tex>
      <p>
        En cada paso hay que resolver la ecuación (en general no lineal) <Tex>{'g(w) = w - y_n - \\frac{h}{2}[f(x_n,y_n) + f(x_{n+1}, w)] = 0'}</Tex>, partiendo del predictor de Euler{' '}
        <Tex>{'w^{(0)} = y_n + h f(x_n, y_n)'}</Tex>:
      </p>
      <ul>
        <li>
          <b>Punto fijo</b> (repetir el corrector del Euler modificado): <Tex>{'w^{(m+1)} = y_n + \\frac{h}{2}[f(x_n,y_n) + f(x_{n+1}, w^{(m)})]'}</Tex>; converge si{' '}
          <Tex>{'\\frac{h}{2}|f_y| < 1'}</Tex>. Detenerse tras la primera iteración es exactamente el método predictor-corrector del texto.
        </li>
        <li>
          <b>Newton:</b> <Tex>{"w^{(m+1)} = w^{(m)} - \\dfrac{g(w^{(m)})}{1 - \\frac{h}{2} f_y(x_{n+1}, w^{(m)})}"}</Tex> (la derivada <Tex>f_y</Tex> se calcula simbólicamente). Convergencia
          cuadrática.
        </li>
      </ul>
      <p>
        Error global <Tex>{'O(h^2)'}</Tex>, igual que el predictor-corrector. <b>Estabilidad:</b> con <Tex>{'z = h\\lambda'}</Tex>, <Tex>{'R(z) = \\dfrac{1 + z/2}{1 - z/2}'}</Tex> cumple{' '}
        <Tex>{'|R(z)|<1'}</Tex> para todo <Tex>{'\\operatorname{Re} z < 0'}</Tex>: el método es <b>A-estable</b>, útil en problemas rígidos (prueba el ejemplo rígido con h grande y compáralo con Euler).
      </p>
      {notacion}
    </>
  ),
  'adams-moulton': (
    <>
      {pvi}
      <p>
        Es el método más elaborado de los basados en integración numérica: el integrando <Tex>{'f(x, y(x))'}</Tex> se reemplaza por un <b>polinomio de interpolación de diferencias finitas
        regresivas de grado 3</b> y se integra ese polinomio. Con la notación <Tex>{'f_n = f(x_n, y_n)'}</Tex>:
      </p>
      <ul>
        <li>
          <b>Predictor (Adams-Bashforth):</b> polinomio por <Tex>{'(x_{n-3}, f_{n-3}), \\dots, (x_n, f_n)'}</Tex> integrado sobre <Tex>{'[x_n, x_{n+1}]'}</Tex> (extrapolación).
        </li>
        <li>
          <b>Corrector (Adams-Moulton):</b> polinomio por <Tex>{'(x_{n-2}, f_{n-2}), \\dots, (x_{n+1}, f_{n+1})'}</Tex>, donde <Tex>{'f_{n+1}'}</Tex> se evalúa con el valor predicho.
        </li>
      </ul>
      <Tex block>{'\\boxed{\\begin{aligned} \\tilde y_{n+1} &= y_n + \\frac{h}{24}\\left[55 f_n - 59 f_{n-1} + 37 f_{n-2} - 9 f_{n-3}\\right]\\\\ y_{n+1} &= y_n + \\frac{h}{24}\\left[9 f(x_{n+1}, \\tilde y_{n+1}) + 19 f_n - 5 f_{n-1} + f_{n-2}\\right]\\end{aligned}\\qquad n \\ge 3}'}</Tex>
      <p>
        Es un método <b>de 4 pasos</b>: necesita <Tex>{'y_1, y_2, y_3'}</Tex> calculados antes con otro método de precisión comparable. El texto recomienda RK4 (práctica 3); en el Ej. 6.4 usa el
        trapecio (Euler modificado). Ambas opciones están en el selector “Arranque”. Sólo usa 2 evaluaciones nuevas de <Tex>f</Tex> por paso (RK4 usa 4).
      </p>
      <p>
        <b>Error:</b> error local <Tex>{'O(h^5)'}</Tex> y error global <Tex>{'O(h^4)'}</Tex> (orden 4), siempre que el arranque tenga error <Tex>{'O(h^4)'}</Tex> o menor; con el arranque de orden 2 el
        error global queda limitado por el de los tres primeros valores.
      </p>
      {notacion}
    </>
  ),
  taylor: (
    <>
      {pvi}
      <p>
        <b>Métodos a un paso basados en la serie de Taylor:</b> se desarrolla la solución alrededor de <Tex>{'x_n'}</Tex> y se trunca en el orden deseado:
      </p>
      <Tex block>{"y(x_n + h) = y(x_n) + h\\,y'(x_n) + \\frac{h^2}{2}\\,y''(x_n) + \\dots + \\frac{h^N}{N!}\\,y^{(N)}(x_n) + \\frac{h^{N+1}}{(N+1)!}\\,y^{(N+1)}(\\xi)"}</Tex>
      <p>
        Las derivadas se obtienen de la EDO derivando <Tex>{'f(x, y(x))'}</Tex> con la regla de la cadena, ya que <Tex>f</Tex> depende de <Tex>x</Tex> directamente y a través de <Tex>{'y(x)'}</Tex>:
      </p>
      <Tex block>{"y' = f,\\qquad y'' = \\frac{\\partial f}{\\partial x} + \\frac{\\partial f}{\\partial y}\\,f,\\qquad y''' = \\frac{\\partial y''}{\\partial x} + \\frac{\\partial y''}{\\partial y}\\,f,\\;\\dots"}</Tex>
      <p>
        <b>Orden 1:</b> <Tex>{'y_{n+1} = y_n + h\\,f(x_n, y_n)'}</Tex>, idéntico a Euler. <b>Orden 2</b> (el que desarrolla el texto):
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + h\\,f(x_n, y_n) + \\frac{h^2}{2}\\left[\\frac{\\partial f}{\\partial x} + \\frac{\\partial f}{\\partial y}\\,f\\right]_{(x_n, y_n)},\\qquad n\\ge 0}'}</Tex>
      <p>
        El método de orden <Tex>N</Tex> tiene error local <Tex>{'O(h^{N+1})'}</Tex> y error global <Tex>{'O(h^N)'}</Tex>. Los órdenes mayores que 2 casi no se usan a mano porque las derivadas tienen
        cada vez más términos; aquí se calculan simbólicamente (orden 1 a 4). Los métodos de Runge-Kutta logran la misma precisión sin derivar <Tex>f</Tex>.
      </p>
      {notacion}
    </>
  ),
  'runge-kutta': (
    <>
      {pvi}
      <p>
        <b>Forma general (texto, relación 6.12):</b> fórmulas a un paso con <Tex>N</Tex> evaluaciones de <Tex>f</Tex>,
      </p>
      <Tex block>{'y_{n+1} = y_n + h\\sum_{k=1}^{N}\\gamma_k V_k,\\qquad V_1 = f(x_n, y_n),\\qquad V_k = f\\Big(x_n + \\alpha_k h,\\; y_n + h\\sum_{j=1}^{k-1}\\beta_{kj}V_j\\Big),\\; k = 2,\\dots,N'}</Tex>
      <p>
        cuyos parámetros <Tex>{'\\gamma_k, \\alpha_k, \\beta_{kj}'}</Tex> se eligen, una vez por todas, para que la fórmula tenga la misma precisión que Taylor de orden <Tex>N</Tex>. En la notación de
        Butcher (Burden): <Tex>{'b_k = \\gamma_k'}</Tex>, <Tex>{'c_k = \\alpha_k'}</Tex>, <Tex>{'a_{kj} = \\beta_{kj}'}</Tex> y las etapas <Tex>{'V_k'}</Tex> se llaman <Tex>{'k_j'}</Tex>.
      </p>
      <p>
        <b>Orden 2.</b> Desarrollando <Tex>{'V_2'}</Tex> en serie de Taylor de dos variables y comparando con Taylor de orden 2 se obtienen 3 condiciones para 4 incógnitas:{' '}
        <Tex>{'\\gamma_1 + \\gamma_2 = 1,\\; \\gamma_2\\alpha_2 = \\tfrac12,\\; \\gamma_2\\beta_{21} = \\tfrac12'}</Tex>. El texto elige <Tex>{'\\gamma_2 = \\tfrac34'}</Tex> (minimiza la
        diferencia con Taylor en el orden siguiente), de donde <Tex>{'\\gamma_1 = \\tfrac14,\\; \\alpha_2 = \\beta_{21} = \\tfrac23'}</Tex>:
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + \\frac h4\\left[V_1 + 3V_2\\right],\\qquad V_1 = f(x_n, y_n),\\quad V_2 = f\\!\\left(x_n + \\tfrac23 h,\\; y_n + \\tfrac23 h V_1\\right)}'}</Tex>
      <p>
        (En otros libros se llama método de Ralston.) Otras elecciones: <Tex>{'\\gamma_2 = \\tfrac12'}</Tex> da el trapecio o Euler modificado; <Tex>{'\\gamma_2 = 1'}</Tex>, el RK2 del punto medio.
      </p>
      <p>
        <b>Orden 4</b> (el más usado por su precisión):
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + \\frac h6\\left[V_1 + 2V_2 + 2V_3 + V_4\\right]}\\qquad \\begin{aligned} V_1 &= f(x_n, y_n) & V_2 &= f(x_n + \\tfrac h2,\\, y_n + \\tfrac h2 V_1)\\\\ V_3 &= f(x_n + \\tfrac h2,\\, y_n + \\tfrac h2 V_2) & V_4 &= f(x_n + h,\\, y_n + h V_3)\\end{aligned}'}</Tex>
      <p>
        Un RK de orden <Tex>p</Tex> tiene error local <Tex>{'O(h^{p+1})'}</Tex> y error global <Tex>{'O(h^p)'}</Tex>. Evaluaciones por paso vs. orden: 1→1, 2→2, 3→3, 4→4, pero orden 5 requiere 6
        (barrera de Butcher): por eso RK4 es el “caballo de batalla”. En el “Paso a paso” las etapas se muestran como <Tex>{'k_j'}</Tex> (= <Tex>{'V_j'}</Tex>).
      </p>
      <p>
        <b>Otras variantes incluidas:</b> RK3 de Kutta, RK4 con la regla 3/8 y <b>RKF45</b> (Runge-Kutta-Fehlberg, Burden alg. 5.3): con 6 evaluaciones obtiene aproximaciones de orden 4 (
        <Tex>w</Tex>) y 5 (<Tex>{'\\tilde w'}</Tex>); su diferencia estima el error local y permite adaptar el paso:
      </p>
      <Tex block>{'R = \\frac{|\\tilde w_{i+1} - w_{i+1}|}{h},\\qquad \\text{se acepta si } R \\le \\text{TOL},\\qquad h_{\\text{nuevo}} = \\delta h,\\quad \\delta = 0.84\\left(\\frac{\\text{TOL}}{R}\\right)^{1/4}'}</Tex>
      {notacion}
    </>
  ),
  'sistemas-edo': (
    <>
      <p>
        Un sistema de <Tex>m</Tex> ecuaciones diferenciales de primer orden con condiciones iniciales se escribe en notación matricial (texto, 6.16–6.17):
      </p>
      <Tex block>{"\\begin{cases}Y'(x) = F(x, Y)\\\\ Y(x_0) = Y_0\\end{cases}\\qquad Y = \\begin{bmatrix} y_1\\\\ \\vdots\\\\ y_m\\end{bmatrix},\\; F(x, Y) = \\begin{bmatrix} f_1(x, y_1, \\dots, y_m)\\\\ \\vdots\\\\ f_m(x, y_1, \\dots, y_m)\\end{bmatrix},\\; Y_0 = \\begin{bmatrix} y_{10}\\\\ \\vdots\\\\ y_{m0}\\end{bmatrix}"}</Tex>
      <p>
        Formalmente es idéntica a la ecuación de primer orden, así que <b>todos</b> los métodos se aplican cambiando escalares por vectores. Por ejemplo, el trapecio o Euler modificado (Ej. 6.8):
      </p>
      <Tex block>{'\\text{Predictor: } \\tilde Y_{n+1} = Y_n + h\\,F(x_n, Y_n),\\qquad \\text{Corrector: } Y_{n+1} = Y_n + \\frac h2\\left[F(x_n, Y_n) + F(x_{n+1}, \\tilde Y_{n+1})\\right]'}</Tex>
      <p>
        En los Runge-Kutta cada etapa <Tex>{'V_k'}</Tex> es un vector y <b>todas</b> sus componentes deben calcularse antes de pasar a la siguiente etapa.
      </p>
      <p>
        <b>Taylor de orden 2 para sistemas</b> (Ej. 6.9): como cada <Tex>{'f_k'}</Tex> depende de <Tex>x</Tex> directamente y a través de todas las <Tex>{'y_j'}</Tex>, la segunda derivada usa el{' '}
        <b>jacobiano</b> <Tex>{'J = \\partial F/\\partial Y'}</Tex>:
      </p>
      <Tex block>{"Y'' = \\frac{\\partial F}{\\partial x} + J\\,F,\\qquad \\boxed{Y_{n+1} = Y_n + h\\,F(x_n, Y_n) + \\frac{h^2}{2}\\left[\\frac{\\partial F}{\\partial x} + J\\,F\\right]_{(x_n, Y_n)}}"}</Tex>
      <p>
        El orden de cada método se conserva. La estabilidad depende de los autovalores de <Tex>J</Tex>: si son muy distintos entre sí el sistema es <b>rígido</b> y los métodos explícitos exigen h
        muy pequeño. El <b>plano de fase</b> muestra una componente contra otra, eliminando la variable independiente.
      </p>
      <p className="muted">
        <b>Notación.</b> El texto escribe <Tex>{'x, Y_n'}</Tex>; en la aplicación la variable independiente es <Tex>t</Tex> y la aproximación <Tex>{'\\mathbf W_i \\approx Y(t_i)'}</Tex>.
      </p>
    </>
  ),
  'orden-superior': (
    <>
      <p>Una EDO de orden <Tex>m</Tex> con sus condiciones iniciales (texto, 6.20)</p>
      <Tex block>{"y^{(m)} = f\\big(x, y, y', \\dots, y^{(m-1)}\\big),\\qquad y(x_0) = y_{10},\\; y'(x_0) = y_{20},\\;\\dots,\\; y^{(m-1)}(x_0) = y_{m0}"}</Tex>
      <p>
        se transforma en un sistema de <Tex>m</Tex> ecuaciones de primer orden: i) se definen las nuevas funciones <Tex>{"y_1 = y,\\; y_2 = y',\\; \\dots,\\; y_m = y^{(m-1)}"}</Tex>; ii) se derivan; iii)
        se reemplazan las definiciones y la EDO en la última:
      </p>
      <Tex block>{"\\begin{cases} y_1' = y_2\\\\ y_2' = y_3\\\\ \\quad\\vdots\\\\ y_{m-1}' = y_m\\\\ y_m' = f(x, y_1, y_2, \\dots, y_m)\\end{cases}\\qquad y_k(x_0) = y_{k0}"}</Tex>
      <p>
        El sistema resultante se resuelve con cualquiera de los métodos para sistemas; el texto usa el Runge-Kutta de orden 2 con <Tex>{'\\gamma_2 = \\tfrac34'}</Tex> (Ej. 6.10). Para un{' '}
        <b>sistema</b> de ecuaciones de orden superior se hace lo mismo con cada incógnita (p. ej. el problema de Kepler: <Tex>{"x'' = -x/r^3,\\; y'' = -y/r^3"}</Tex> da 4 ecuaciones de primer
        orden). El número de condiciones iniciales necesarias es la suma de los órdenes.
      </p>
      <p className="muted">
        En la aplicación las nuevas incógnitas se llaman <Tex>{'u_1, u_2, \\dots'}</Tex> (el texto las llama <Tex>{'y_1, y_2, \\dots'}</Tex>) y la variable independiente es <Tex>t</Tex>.
      </p>
    </>
  ),
  'comparar-edo': (
    <>
      <p>
        Si un método tiene orden <Tex>p</Tex> (error local <Tex>{'O(h^{p+1})'}</Tex>), su error global en un punto fijo <Tex>{'t = b'}</Tex> se comporta como
      </p>
      <Tex block>{'E(h) = |y(b) - w_N| \\approx C\\,h^p \\quad\\Longrightarrow\\quad \\log E \\approx \\log C + p\\,\\log h'}</Tex>
      <p>
        En una gráfica log-log el error forma una recta de pendiente <Tex>p</Tex>: Euler 1; punto medio, trapecio o Euler modificado, trapecio implícito, Taylor 2 y RK2 pendiente 2; RK3 pendiente 3; RK4 y Adams-Moulton pendiente 4. Al
        reducir <Tex>h</Tex> a la mitad el error se divide aproximadamente entre <Tex>{'2^p'}</Tex>. El orden observado se estima con la razón
      </p>
      <Tex block>{'p \\approx \\log_2 \\frac{E(h)}{E(h/2)}'}</Tex>
      <p>
        Para comparar eficiencia hay que tener en cuenta el costo: RK4 usa 4 evaluaciones de <Tex>f</Tex> por paso, Euler y el punto medio 1, Adams-Moulton 2. A igual número de evaluaciones, los métodos de orden alto suelen ganar
        con mucha ventaja. Para <Tex>h</Tex> muy pequeño el error de redondeo acaba dominando y la recta se curva.
      </p>
    </>
  ),
  misil: (
    <>
      <p>
        Un blanco se mueve según una trayectoria conocida <Tex>{'\\mathbf r_T(t)'}</Tex>. El misil se mueve con rapidez constante <Tex>{'v_M'}</Tex> y su velocidad apunta <b>siempre</b> hacia la
        posición actual del blanco (persecución pura):
      </p>
      <Tex block>{"\\mathbf r_M'(t) = v_M\\,\\frac{\\mathbf r_T(t) - \\mathbf r_M(t)}{\\lVert \\mathbf r_T(t) - \\mathbf r_M(t)\\rVert},\\qquad \\mathbf r_M(t_0) = \\mathbf r_{M,0}"}</Tex>
      <p>
        Es un sistema no lineal y no autónomo de 3 EDO de primer orden (<Tex>x_M, y_M, z_M</Tex>), de la forma <Tex>{"Y' = F(t, Y)"}</Tex> estudiada en la sección 6.2 del texto (el
        sílabo lo propone como exposición en la sesión 30; el texto no lo desarrolla). Se integra con RK4 y se detiene cuando la distancia cae por debajo del radio de captura{' '}
        <Tex>{'\\varepsilon'}</Tex>; el instante de captura se refina interpolando linealmente la distancia en el último paso.
      </p>
      <p>
        <b>Validación (Bouguer, 1732):</b> en el plano, si el blanco parte del origen y se mueve en línea recta perpendicular a la visual con rapidez <Tex>{'v_T < v_M'}</Tex>, y el misil parte a
        distancia <Tex>a</Tex>, el tiempo de captura exacto es
      </p>
      <Tex block>{'T = \\frac{a\\,v_M}{v_M^2 - v_T^2}'}</Tex>
      <p>
        (ejemplo “Bouguer”: <Tex>{'a = 10,\\; v_T = 1,\\; v_M = 2 \\Rightarrow T = 20/3 \\approx 6.6667'}</Tex>). Si <Tex>{'v_M \\le v_T'}</Tex> en general no hay captura. Cerca de la captura la
        dirección cambia muy rápido: conviene <Tex>{'h\\,v_M < \\varepsilon'}</Tex>.
      </p>
    </>
  ),
}
