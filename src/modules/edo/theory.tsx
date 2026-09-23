import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'

export type OdeKind = 'euler' | 'punto-medio' | 'heun' | 'trapecio' | 'adams-moulton' | 'taylor' | 'runge-kutta'
export type PageId = OdeKind | 'sistemas-edo' | 'orden-superior' | 'comparar-edo' | 'misil'

export const TOPIC = L('Tema 6 · Ecuaciones diferenciales ordinarias', 'Topic 6 · Ordinary differential equations')

/** Títulos de página (coinciden con el menú o son un poco más largos). */
export const TITLES: Record<PageId, string> = {
  euler: L('Método de Euler', "Euler's method"),
  'punto-medio': L('Método del punto medio', 'Midpoint method'),
  heun: L('Método del trapecio o Euler modificado', 'Trapezoidal method or modified Euler'),
  trapecio: L('Trapecio implícito (corrector iterado)', 'Implicit trapezoidal (iterated corrector)'),
  'adams-moulton': L('Método de Adams-Moulton', 'Adams-Moulton method'),
  taylor: L('Métodos de Taylor', 'Taylor methods'),
  'runge-kutta': L('Métodos de Runge-Kutta', 'Runge-Kutta methods'),
  'sistemas-edo': L('Sistemas de EDO de primer orden', 'Systems of first-order ODEs'),
  'orden-superior': L('Ecuaciones de orden superior', 'Higher-order equations'),
  'comparar-edo': L('Comparación de métodos (orden)', 'Comparison of methods (order)'),
  misil: L('Misil de persecución en R³', 'Pursuit missile in R³'),
}

/** Títulos del menú (≤ 32 caracteres). */
export const SHORT: Record<PageId, string> = {
  euler: L('Método de Euler', "Euler's method"),
  'punto-medio': L('Método del punto medio', 'Midpoint method'),
  heun: L('Trapecio o Euler modificado', 'Trapezoidal / modified Euler'),
  trapecio: L('Trapecio implícito iterado', 'Iterated implicit trapezoidal'),
  'adams-moulton': L('Método de Adams-Moulton', 'Adams-Moulton method'),
  taylor: L('Métodos de Taylor', 'Taylor methods'),
  'runge-kutta': L('Métodos de Runge-Kutta', 'Runge-Kutta methods'),
  'sistemas-edo': L('Sistemas de primer orden', 'First-order systems'),
  'orden-superior': L('Ecuaciones de orden superior', 'Higher-order equations'),
  'comparar-edo': L('Comparación de métodos', 'Comparison of methods'),
  misil: L('Misil de persecución en R³', 'Pursuit missile in R³'),
}

/** Resumen de una línea (menú, tarjetas y buscador). */
export const SUMMARY: Record<PageId, string> = {
  euler: L('Integral aproximada por un rectángulo: yₙ₊₁ = yₙ + h f(xₙ, yₙ). Orden 1.', 'Integral approximated by a rectangle: yₙ₊₁ = yₙ + h f(xₙ, yₙ). Order 1.'),
  'punto-medio': L('Método explícito de 2 pasos: yₙ₊₁ = yₙ₋₁ + 2h f(xₙ, yₙ). Orden 2.', 'Explicit two-step method: yₙ₊₁ = yₙ₋₁ + 2h f(xₙ, yₙ). Order 2.'),
  heun: L('Regla del trapecio con predictor de Euler y un corrector. Orden 2.', 'Trapezoidal rule with an Euler predictor and one corrector. Order 2.'),
  trapecio: L('Trapecio sin predictor: la ecuación implícita se resuelve con Newton o punto fijo.', 'Trapezoidal rule without a predictor: the implicit equation is solved with Newton or fixed-point iteration.'),
  'adams-moulton': L('Predictor de Adams-Bashforth y corrector de Adams-Moulton de 4 pasos. Orden 4.', 'Four-step Adams-Bashforth predictor and Adams-Moulton corrector. Order 4.'),
  taylor: L('Serie de Taylor de la solución con y″ = ∂f/∂x + (∂f/∂y)·f (orden 1 a 4).', 'Taylor series of the solution with y″ = ∂f/∂x + (∂f/∂y)·f (order 1 to 4).'),
  'runge-kutta': L('RK2 del texto (γ₂ = 3/4), RK4 clásico y otras variantes, incluido RKF45 adaptativo.', 'Textbook RK2 (γ₂ = 3/4), classical RK4 and other variants, including adaptive RKF45.'),
  'sistemas-edo': L('Y′ = F(x, Y): los mismos métodos en forma vectorial; plano de fase y 3D.', 'Y′ = F(x, Y): the same methods in vector form; phase plane and 3D.'),
  'orden-superior': L('Reducción de y⁽ᵐ⁾ = f(x, y, …, y⁽ᵐ⁻¹⁾) a un sistema de primer orden.', 'Reduction of y⁽ᵐ⁾ = f(x, y, …, y⁽ᵐ⁻¹⁾) to a first-order system.'),
  'comparar-edo': L('Mismo PVI con todos los métodos: error global vs h en escala log-log.', 'Same IVP with every method: global error vs h on a log-log scale.'),
  misil: L('Curva de persecución en R³: sistema no lineal de 3 EDO resuelto con RK4.', 'Pursuit curve in R³: nonlinear system of 3 ODEs solved with RK4.'),
}

export const DESCRIPTIONS: Record<PageId, ReactNode> = {
  euler: L('Se integra la EDO entre dos nodos y la integral se aproxima por un rectángulo de altura f(xₙ, yₙ): avanzar por la recta tangente. Error local ∝ h², error global ∝ h.', 'The ODE is integrated between two nodes and the integral is approximated by a rectangle of height f(xₙ, yₙ): advance along the tangent line. Local error ∝ h², global error ∝ h.'),
  'punto-medio': L('La integral sobre [xₙ₋₁, xₙ₊₁] se aproxima con la regla del punto medio (rectángulo de altura f(xₙ, yₙ) y base 2h). Explícito de 2 pasos; y₁ se obtiene con Euler.', 'The integral over [xₙ₋₁, xₙ₊₁] is approximated with the midpoint rule (rectangle of height f(xₙ, yₙ) and base 2h). Explicit two-step method; y₁ is obtained with Euler.'),
  heun: L('La integral se aproxima con la regla del trapecio; como yₙ₊₁ aparece en ambos lados, se predice con Euler y se corrige una vez (técnica predictor-corrector).', 'The integral is approximated with the trapezoidal rule; since yₙ₊₁ appears on both sides, it is predicted with Euler and corrected once (predictor-corrector technique).'),
  trapecio: L('La misma fórmula del trapecio, pero repitiendo la corrección hasta que converja (o con Newton): se resuelve la ecuación implícita en cada paso. A-estable.', 'The same trapezoidal formula, but the correction is repeated until it converges (or Newton is used): the implicit equation is solved at every step. A-stable.'),
  'adams-moulton': L('Interpola f con un polinomio de diferencias regresivas de grado 3 e integra: predictor de Adams-Bashforth y corrector de Adams-Moulton. Necesita y₁, y₂, y₃ previos.', 'Interpolates f with a degree-3 backward-difference polynomial and integrates it: Adams-Bashforth predictor and Adams-Moulton corrector. Needs y₁, y₂, y₃ beforehand.'),
  taylor: L('Se trunca la serie de Taylor de la solución; las derivadas y″, y‴… se obtienen derivando f(x, y) a lo largo de la solución (aquí, simbólicamente).', 'The Taylor series of the solution is truncated; the derivatives y″, y‴… are obtained by differentiating f(x, y) along the solution (here, symbolically).'),
  'runge-kutta': L('Fórmulas de un paso que combinan varias evaluaciones de f para tener la misma precisión que Taylor de orden N sin derivar f.', 'One-step formulas that combine several evaluations of f to achieve the same accuracy as Taylor of order N without differentiating f.'),
  'sistemas-edo': L('Y′ = F(x, Y) con m ecuaciones: los métodos de una ecuación se aplican igual, con vectores (Ej. 6.8 y 6.9 del texto). Gráficas, plano de fase y trayectorias 3D.', 'Y′ = F(x, Y) with m equations: the single-equation methods apply in the same way, with vectors (Ex. 6.8 and 6.9 of the textbook). Plots, phase plane and 3D trajectories.'),
  'orden-superior': L('Una EDO de orden m se transforma en un sistema de m ecuaciones de primer orden tomando como incógnitas y, y′, …, y⁽ᵐ⁻¹⁾ (Ej. 6.10 del texto).', 'An ODE of order m is transformed into a system of m first-order equations by taking y, y′, …, y⁽ᵐ⁻¹⁾ as unknowns (Ex. 6.10 of the textbook).'),
  'comparar-edo': L('Resuelve el mismo PVI con todos los métodos y estima experimentalmente el orden de cada uno en una gráfica log-log del error frente a h.', 'Solves the same IVP with every method and estimates the order of each one experimentally from a log-log plot of the error versus h.'),
  misil: L('Curva de persecución pura: un misil de rapidez constante apunta siempre hacia un blanco que se mueve por una trayectoria dada. Sistema no lineal en R³ resuelto con RK4 (sesión 30 del sílabo).', 'Pure pursuit curve: a missile with constant speed always points toward a target moving along a given trajectory. Nonlinear system in R³ solved with RK4 (session 30 of the syllabus).'),
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

const THEORY_ES: Record<PageId, ReactNode> = {
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

/* ───────────────────────── English ───────────────────────── */

const notationEn = (
  <p className="muted">
    <b>Notation.</b> The textbook writes the independent variable as <Tex>x</Tex> and the approximation as <Tex>{'y_n \\approx y(x_n)'}</Tex>. In the app's computations the independent
    variable is called <Tex>t</Tex> and the approximation <Tex>{'w_i \\approx y(t_i)'}</Tex> (as in Burden & Faires); in the input fields you may type <Tex>x</Tex> instead of <Tex>t</Tex>.
  </p>
)

const errOrderEn = (p: number, extra?: ReactNode) => (
  <p>
    <b>Error:</b> the error made in one step (local error) is proportional to <Tex>{`h^{${p + 1}}`}</Tex>; as it accumulates over the <Tex>{'N \\propto 1/h'}</Tex> steps, the global error is
    proportional to <Tex>{p === 1 ? 'h' : `h^{${p}}`}</Tex>: the method is of <b>order {p}</b> (halving h divides the global error by roughly {2 ** p}).
    {extra}
  </p>
)

const THEORY_EN: Record<PageId, ReactNode> = {
  euler: (
    <>
      {pvi}
      <p>
        <b>Idea (methods based on numerical integration):</b> since the unknown is given through its derivative, the ODE is integrated between two consecutive nodes. Euler's method approximates the
        integral by the area of a rectangle of height <Tex>{'f(x_n, y_n)'}</Tex> (left endpoint) and base <Tex>h</Tex>:
      </p>
      <Tex block>{'y(x_{n+1}) = y(x_n) + \\int_{x_n}^{x_{n+1}} f(x, y(x))\\,dx \\;\\approx\\; y_n + h\\,f(x_n, y_n)'}</Tex>
      <Tex block>{'\\boxed{y_{n+1} = y_n + h\\,f(x_n, y_n),\\qquad n \\ge 0}'}</Tex>
      <p>
        The same formula is obtained by truncating the Taylor series after the first-order term (“Taylor of order 1”). Each value is computed from the previous one, which is already an approximation, so the
        error <b>accumulates</b> as we move away from <Tex>x_0</Tex> (Ex. 6.1 of the textbook).
      </p>
      {errOrderEn(
        1,
        <>
          {' '}
          Classical bound (Burden & Faires, Theorem 5.9): if <Tex>f</Tex> is Lipschitz with constant <Tex>L</Tex> and <Tex>{"|y''|\\le M"}</Tex>, then{' '}
          <Tex>{'|y(x_n) - y_n| \\le \\frac{hM}{2L}\\left[e^{L(x_n - x_0)} - 1\\right]'}</Tex>.
        </>,
      )}
      <p>
        <b>Stability</b> (test equation <Tex>{"y' = \\lambda y"}</Tex>, <Tex>{'\\lambda<0'}</Tex>): <Tex>{'y_{n+1} = (1 + h\\lambda)\\,y_n'}</Tex>. The numerical solution decays only if{' '}
        <Tex>{'|1 + h\\lambda| < 1'}</Tex>, that is, <Tex>{'h < 2/|\\lambda|'}</Tex>. Try the “stiff” example with h = 0.12.
      </p>
      {notationEn}
    </>
  ),
  'punto-medio': (
    <>
      {pvi}
      <p>
        The textbook approximates the integral with the <b>midpoint rule</b>. For the midpoint of the integration interval to be a node <Tex>{'x_n'}</Tex>, the integration is carried out over{' '}
        <Tex>{'[x_{n-1}, x_{n+1}]'}</Tex> (base <Tex>2h</Tex>) with a rectangle of height <Tex>{'f(x_n, y_n)'}</Tex>:
      </p>
      <Tex block>{'y(x_{n+1}) = y(x_{n-1}) + \\int_{x_{n-1}}^{x_{n+1}} f(x, y(x))\\,dx \\;\\approx\\; y_{n-1} + 2h\\,f(x_n, y_n)'}</Tex>
      <Tex block>{'\\boxed{y_1 = y_0 + h\\,f(x_0, y_0)\\;\\text{(Euler)},\\qquad y_{n+1} = y_{n-1} + 2h\\,f(x_n, y_n),\\quad n \\ge 1}'}</Tex>
      <p>
        It is an <b>explicit two-step</b> method: computing <Tex>{'y_{n+1}'}</Tex> requires <Tex>{'(x_{n-1}, y_{n-1})'}</Tex> and <Tex>{'(x_n, y_n)'}</Tex>; that is why the first value{' '}
        <Tex>{'y_1'}</Tex> is obtained with another method (Euler). It uses a single evaluation of <Tex>f</Tex> per step.
      </p>
      {errOrderEn(2)}
      <p>
        <b>Caution:</b> for <Tex>{"y' = \\lambda y"}</Tex> with <Tex>{'\\lambda < 0'}</Tex> the recurrence <Tex>{'y_{n+1} = y_{n-1} + 2h\\lambda y_n'}</Tex> has a “parasitic” root of modulus greater
        than 1: a growing oscillation appears (weak instability). With small h and on short intervals, as in Ex. 6.2, the method is very accurate; on long intervals with decaying solutions another
        method is preferable (try the “stiff” example).
      </p>
      <p>
        <b>Another variant (Burden & Faires):</b> the one-step “midpoint method”, a second-order Runge-Kutta method that estimates <Tex>{'y(x_n + h/2)'}</Tex> with half an Euler step:{' '}
        <Tex>{'V_1 = f(x_n, y_n),\\; V_2 = f(x_n + \\tfrac h2, y_n + \\tfrac h2 V_1),\\; y_{n+1} = y_n + h V_2'}</Tex>. It can be chosen in the “Variant” selector.
      </p>
      {notationEn}
    </>
  ),
  heun: (
    <>
      {pvi}
      <p>
        The integral is approximated with the <b>trapezoidal rule</b>:
      </p>
      <Tex block>{'y(x_{n+1}) = y(x_n) + \\int_{x_n}^{x_{n+1}} f(x, y(x))\\,dx \\;\\approx\\; y_n + \\frac h2\\left[f(x_n, y_n) + f(x_{n+1}, y_{n+1})\\right]'}</Tex>
      <p>
        This relation cannot be used directly because <Tex>{'y_{n+1}'}</Tex> appears on both sides. The <b>predictor-corrector technique</b> resolves this: <Tex>{'y_{n+1}'}</Tex> is{' '}
        <i>predicted</i> with Euler and <i>corrected</i> with the trapezoidal formula:
      </p>
      <Tex block>{'\\boxed{\\begin{aligned} &\\text{Predictor: } && \\tilde y_{n+1} = y_n + h\\,f(x_n, y_n)\\\\ &\\text{Corrector: } && y_{n+1} = y_n + \\frac h2\\left[f(x_n, y_n) + f(x_{n+1}, \\tilde y_{n+1})\\right]\\end{aligned}\\qquad n \\ge 0}'}</Tex>
      {errOrderEn(2)}
      <p>
        This is the method Burden & Faires call <i>modified Euler</i> and Chapra calls <i>Heun's method</i>; it is also a second-order Runge-Kutta method with <Tex>{'\\gamma_1 = \\gamma_2 = \\tfrac12'}</Tex>.
        For the linear equation of the textbook examples it gives the same numbers as Taylor of order 2 and the RK2 with <Tex>{'\\gamma_2 = \\tfrac34'}</Tex> (Ex. 6.3, 6.5 and 6.6). The textbook classifies
        it as an implicit method because the trapezoidal formula is implicit; repeating the correction until it converges gives the <b>implicit trapezoidal</b> method (next page).
      </p>
      {notationEn}
    </>
  ),
  trapecio: (
    <>
      {pvi}
      <p>
        This is the trapezoidal formula <b>without</b> replacing <Tex>{'y_{n+1}'}</Tex> by a predictor: an <b>implicit</b> method.
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + \\frac{h}{2}\\left[f(x_n, y_n) + f(x_{n+1}, y_{n+1})\\right]}'}</Tex>
      <p>
        At every step the (generally nonlinear) equation <Tex>{'g(w) = w - y_n - \\frac{h}{2}[f(x_n,y_n) + f(x_{n+1}, w)] = 0'}</Tex> must be solved, starting from the Euler predictor{' '}
        <Tex>{'w^{(0)} = y_n + h f(x_n, y_n)'}</Tex>:
      </p>
      <ul>
        <li>
          <b>Fixed point</b> (repeating the modified Euler corrector): <Tex>{'w^{(m+1)} = y_n + \\frac{h}{2}[f(x_n,y_n) + f(x_{n+1}, w^{(m)})]'}</Tex>; it converges if{' '}
          <Tex>{'\\frac{h}{2}|f_y| < 1'}</Tex>. Stopping after the first iteration is exactly the textbook's predictor-corrector method.
        </li>
        <li>
          <b>Newton:</b> <Tex>{"w^{(m+1)} = w^{(m)} - \\dfrac{g(w^{(m)})}{1 - \\frac{h}{2} f_y(x_{n+1}, w^{(m)})}"}</Tex> (the derivative <Tex>f_y</Tex> is computed symbolically). Quadratic
          convergence.
        </li>
      </ul>
      <p>
        Global error <Tex>{'O(h^2)'}</Tex>, the same as the predictor-corrector. <b>Stability:</b> with <Tex>{'z = h\\lambda'}</Tex>, <Tex>{'R(z) = \\dfrac{1 + z/2}{1 - z/2}'}</Tex> satisfies{' '}
        <Tex>{'|R(z)|<1'}</Tex> for every <Tex>{'\\operatorname{Re} z < 0'}</Tex>: the method is <b>A-stable</b>, useful for stiff problems (try the stiff example with a large h and compare it with Euler).
      </p>
      {notationEn}
    </>
  ),
  'adams-moulton': (
    <>
      {pvi}
      <p>
        This is the most elaborate of the methods based on numerical integration: the integrand <Tex>{'f(x, y(x))'}</Tex> is replaced by a <b>degree-3 backward finite-difference interpolating
        polynomial</b>, which is then integrated. With the notation <Tex>{'f_n = f(x_n, y_n)'}</Tex>:
      </p>
      <ul>
        <li>
          <b>Predictor (Adams-Bashforth):</b> polynomial through <Tex>{'(x_{n-3}, f_{n-3}), \\dots, (x_n, f_n)'}</Tex> integrated over <Tex>{'[x_n, x_{n+1}]'}</Tex> (extrapolation).
        </li>
        <li>
          <b>Corrector (Adams-Moulton):</b> polynomial through <Tex>{'(x_{n-2}, f_{n-2}), \\dots, (x_{n+1}, f_{n+1})'}</Tex>, where <Tex>{'f_{n+1}'}</Tex> is evaluated at the predicted value.
        </li>
      </ul>
      <Tex block>{'\\boxed{\\begin{aligned} \\tilde y_{n+1} &= y_n + \\frac{h}{24}\\left[55 f_n - 59 f_{n-1} + 37 f_{n-2} - 9 f_{n-3}\\right]\\\\ y_{n+1} &= y_n + \\frac{h}{24}\\left[9 f(x_{n+1}, \\tilde y_{n+1}) + 19 f_n - 5 f_{n-1} + f_{n-2}\\right]\\end{aligned}\\qquad n \\ge 3}'}</Tex>
      <p>
        It is a <b>four-step</b> method: it needs <Tex>{'y_1, y_2, y_3'}</Tex> computed beforehand with another method of comparable accuracy. The textbook recommends RK4 (Practice 3); Ex. 6.4 uses the
        trapezoidal method (modified Euler). Both options are available in the “Starting values” selector. It uses only 2 new evaluations of <Tex>f</Tex> per step (RK4 uses 4).
      </p>
      <p>
        <b>Error:</b> local error <Tex>{'O(h^5)'}</Tex> and global error <Tex>{'O(h^4)'}</Tex> (order 4), provided the starting values have error <Tex>{'O(h^4)'}</Tex> or smaller; with the second-order
        start the global error is limited by that of the first three values.
      </p>
      {notationEn}
    </>
  ),
  taylor: (
    <>
      {pvi}
      <p>
        <b>One-step methods based on the Taylor series:</b> the solution is expanded about <Tex>{'x_n'}</Tex> and truncated at the desired order:
      </p>
      <Tex block>{"y(x_n + h) = y(x_n) + h\\,y'(x_n) + \\frac{h^2}{2}\\,y''(x_n) + \\dots + \\frac{h^N}{N!}\\,y^{(N)}(x_n) + \\frac{h^{N+1}}{(N+1)!}\\,y^{(N+1)}(\\xi)"}</Tex>
      <p>
        The derivatives are obtained from the ODE by differentiating <Tex>{'f(x, y(x))'}</Tex> with the chain rule, since <Tex>f</Tex> depends on <Tex>x</Tex> directly and through <Tex>{'y(x)'}</Tex>:
      </p>
      <Tex block>{"y' = f,\\qquad y'' = \\frac{\\partial f}{\\partial x} + \\frac{\\partial f}{\\partial y}\\,f,\\qquad y''' = \\frac{\\partial y''}{\\partial x} + \\frac{\\partial y''}{\\partial y}\\,f,\\;\\dots"}</Tex>
      <p>
        <b>Order 1:</b> <Tex>{'y_{n+1} = y_n + h\\,f(x_n, y_n)'}</Tex>, identical to Euler. <b>Order 2</b> (the one developed in the textbook):
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + h\\,f(x_n, y_n) + \\frac{h^2}{2}\\left[\\frac{\\partial f}{\\partial x} + \\frac{\\partial f}{\\partial y}\\,f\\right]_{(x_n, y_n)},\\qquad n\\ge 0}'}</Tex>
      <p>
        The method of order <Tex>N</Tex> has local error <Tex>{'O(h^{N+1})'}</Tex> and global error <Tex>{'O(h^N)'}</Tex>. Orders higher than 2 are rarely used by hand because the derivatives have
        more and more terms; here they are computed symbolically (order 1 to 4). Runge-Kutta methods achieve the same accuracy without differentiating <Tex>f</Tex>.
      </p>
      {notationEn}
    </>
  ),
  'runge-kutta': (
    <>
      {pvi}
      <p>
        <b>General form (textbook, relation 6.12):</b> one-step formulas with <Tex>N</Tex> evaluations of <Tex>f</Tex>,
      </p>
      <Tex block>{'y_{n+1} = y_n + h\\sum_{k=1}^{N}\\gamma_k V_k,\\qquad V_1 = f(x_n, y_n),\\qquad V_k = f\\Big(x_n + \\alpha_k h,\\; y_n + h\\sum_{j=1}^{k-1}\\beta_{kj}V_j\\Big),\\; k = 2,\\dots,N'}</Tex>
      <p>
        whose parameters <Tex>{'\\gamma_k, \\alpha_k, \\beta_{kj}'}</Tex> are chosen, once and for all, so that the formula has the same accuracy as Taylor of order <Tex>N</Tex>. In Butcher's
        notation (Burden): <Tex>{'b_k = \\gamma_k'}</Tex>, <Tex>{'c_k = \\alpha_k'}</Tex>, <Tex>{'a_{kj} = \\beta_{kj}'}</Tex>, and the stages <Tex>{'V_k'}</Tex> are called <Tex>{'k_j'}</Tex>.
      </p>
      <p>
        <b>Order 2.</b> Expanding <Tex>{'V_2'}</Tex> in a two-variable Taylor series and comparing with Taylor of order 2 gives 3 conditions for 4 unknowns:{' '}
        <Tex>{'\\gamma_1 + \\gamma_2 = 1,\\; \\gamma_2\\alpha_2 = \\tfrac12,\\; \\gamma_2\\beta_{21} = \\tfrac12'}</Tex>. The textbook chooses <Tex>{'\\gamma_2 = \\tfrac34'}</Tex> (it minimizes the
        difference with Taylor at the next order), which gives <Tex>{'\\gamma_1 = \\tfrac14,\\; \\alpha_2 = \\beta_{21} = \\tfrac23'}</Tex>:
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + \\frac h4\\left[V_1 + 3V_2\\right],\\qquad V_1 = f(x_n, y_n),\\quad V_2 = f\\!\\left(x_n + \\tfrac23 h,\\; y_n + \\tfrac23 h V_1\\right)}'}</Tex>
      <p>
        (Other books call it Ralston's method.) Other choices: <Tex>{'\\gamma_2 = \\tfrac12'}</Tex> gives the trapezoidal method or modified Euler; <Tex>{'\\gamma_2 = 1'}</Tex>, the midpoint RK2.
      </p>
      <p>
        <b>Order 4</b> (the most widely used because of its accuracy):
      </p>
      <Tex block>{'\\boxed{y_{n+1} = y_n + \\frac h6\\left[V_1 + 2V_2 + 2V_3 + V_4\\right]}\\qquad \\begin{aligned} V_1 &= f(x_n, y_n) & V_2 &= f(x_n + \\tfrac h2,\\, y_n + \\tfrac h2 V_1)\\\\ V_3 &= f(x_n + \\tfrac h2,\\, y_n + \\tfrac h2 V_2) & V_4 &= f(x_n + h,\\, y_n + h V_3)\\end{aligned}'}</Tex>
      <p>
        An RK method of order <Tex>p</Tex> has local error <Tex>{'O(h^{p+1})'}</Tex> and global error <Tex>{'O(h^p)'}</Tex>. Evaluations per step vs. order: 1→1, 2→2, 3→3, 4→4, but order 5 requires 6
        (Butcher barrier): that is why RK4 is the “workhorse”. In “Step by step” the stages are shown as <Tex>{'k_j'}</Tex> (= <Tex>{'V_j'}</Tex>).
      </p>
      <p>
        <b>Other variants included:</b> Kutta's RK3, RK4 with the 3/8 rule and <b>RKF45</b> (Runge-Kutta-Fehlberg, Burden Alg. 5.3): with 6 evaluations it obtains approximations of order 4 (
        <Tex>w</Tex>) and 5 (<Tex>{'\\tilde w'}</Tex>); their difference estimates the local error and allows the step size to be adapted:
      </p>
      <Tex block>{'R = \\frac{|\\tilde w_{i+1} - w_{i+1}|}{h},\\qquad \\text{accepted if } R \\le \\text{TOL},\\qquad h_{\\text{new}} = \\delta h,\\quad \\delta = 0.84\\left(\\frac{\\text{TOL}}{R}\\right)^{1/4}'}</Tex>
      {notationEn}
    </>
  ),
  'sistemas-edo': (
    <>
      <p>
        A system of <Tex>m</Tex> first-order differential equations with initial conditions is written in matrix notation (textbook, 6.16–6.17):
      </p>
      <Tex block>{"\\begin{cases}Y'(x) = F(x, Y)\\\\ Y(x_0) = Y_0\\end{cases}\\qquad Y = \\begin{bmatrix} y_1\\\\ \\vdots\\\\ y_m\\end{bmatrix},\\; F(x, Y) = \\begin{bmatrix} f_1(x, y_1, \\dots, y_m)\\\\ \\vdots\\\\ f_m(x, y_1, \\dots, y_m)\\end{bmatrix},\\; Y_0 = \\begin{bmatrix} y_{10}\\\\ \\vdots\\\\ y_{m0}\\end{bmatrix}"}</Tex>
      <p>
        Formally it is identical to the first-order equation, so <b>all</b> the methods apply by replacing scalars with vectors. For example, the trapezoidal method or modified Euler (Ex. 6.8):
      </p>
      <Tex block>{'\\text{Predictor: } \\tilde Y_{n+1} = Y_n + h\\,F(x_n, Y_n),\\qquad \\text{Corrector: } Y_{n+1} = Y_n + \\frac h2\\left[F(x_n, Y_n) + F(x_{n+1}, \\tilde Y_{n+1})\\right]'}</Tex>
      <p>
        In Runge-Kutta methods each stage <Tex>{'V_k'}</Tex> is a vector, and <b>all</b> its components must be computed before moving on to the next stage.
      </p>
      <p>
        <b>Taylor of order 2 for systems</b> (Ex. 6.9): since each <Tex>{'f_k'}</Tex> depends on <Tex>x</Tex> directly and through all the <Tex>{'y_j'}</Tex>, the second derivative uses the{' '}
        <b>Jacobian</b> <Tex>{'J = \\partial F/\\partial Y'}</Tex>:
      </p>
      <Tex block>{"Y'' = \\frac{\\partial F}{\\partial x} + J\\,F,\\qquad \\boxed{Y_{n+1} = Y_n + h\\,F(x_n, Y_n) + \\frac{h^2}{2}\\left[\\frac{\\partial F}{\\partial x} + J\\,F\\right]_{(x_n, Y_n)}}"}</Tex>
      <p>
        The order of each method is preserved. Stability depends on the eigenvalues of <Tex>J</Tex>: if they differ widely from one another the system is <b>stiff</b> and explicit methods require a very
        small h. The <b>phase plane</b> shows one component against another, eliminating the independent variable.
      </p>
      <p className="muted">
        <b>Notation.</b> The textbook writes <Tex>{'x, Y_n'}</Tex>; in the app the independent variable is <Tex>t</Tex> and the approximation <Tex>{'\\mathbf W_i \\approx Y(t_i)'}</Tex>.
      </p>
    </>
  ),
  'orden-superior': (
    <>
      <p>An ODE of order <Tex>m</Tex> with its initial conditions (textbook, 6.20)</p>
      <Tex block>{"y^{(m)} = f\\big(x, y, y', \\dots, y^{(m-1)}\\big),\\qquad y(x_0) = y_{10},\\; y'(x_0) = y_{20},\\;\\dots,\\; y^{(m-1)}(x_0) = y_{m0}"}</Tex>
      <p>
        is transformed into a system of <Tex>m</Tex> first-order equations: i) define the new functions <Tex>{"y_1 = y,\\; y_2 = y',\\; \\dots,\\; y_m = y^{(m-1)}"}</Tex>; ii) differentiate them; iii)
        substitute the definitions, and the ODE in the last one:
      </p>
      <Tex block>{"\\begin{cases} y_1' = y_2\\\\ y_2' = y_3\\\\ \\quad\\vdots\\\\ y_{m-1}' = y_m\\\\ y_m' = f(x, y_1, y_2, \\dots, y_m)\\end{cases}\\qquad y_k(x_0) = y_{k0}"}</Tex>
      <p>
        The resulting system is solved with any of the methods for systems; the textbook uses the second-order Runge-Kutta method with <Tex>{'\\gamma_2 = \\tfrac34'}</Tex> (Ex. 6.10). For a{' '}
        <b>system</b> of higher-order equations the same is done with each unknown (e.g. the Kepler problem: <Tex>{"x'' = -x/r^3,\\; y'' = -y/r^3"}</Tex> gives 4 first-order
        equations). The number of initial conditions needed is the sum of the orders.
      </p>
      <p className="muted">
        In the app the new unknowns are called <Tex>{'u_1, u_2, \\dots'}</Tex> (the textbook calls them <Tex>{'y_1, y_2, \\dots'}</Tex>) and the independent variable is <Tex>t</Tex>.
      </p>
    </>
  ),
  'comparar-edo': (
    <>
      <p>
        If a method has order <Tex>p</Tex> (local error <Tex>{'O(h^{p+1})'}</Tex>), its global error at a fixed point <Tex>{'t = b'}</Tex> behaves like
      </p>
      <Tex block>{'E(h) = |y(b) - w_N| \\approx C\\,h^p \\quad\\Longrightarrow\\quad \\log E \\approx \\log C + p\\,\\log h'}</Tex>
      <p>
        On a log-log plot the error forms a straight line of slope <Tex>p</Tex>: Euler 1; midpoint, trapezoidal or modified Euler, implicit trapezoidal, Taylor 2 and RK2 slope 2; RK3 slope 3; RK4 and
        Adams-Moulton slope 4. Halving <Tex>h</Tex> divides the error by roughly <Tex>{'2^p'}</Tex>. The observed order is estimated with the ratio
      </p>
      <Tex block>{'p \\approx \\log_2 \\frac{E(h)}{E(h/2)}'}</Tex>
      <p>
        To compare efficiency the cost must be taken into account: RK4 uses 4 evaluations of <Tex>f</Tex> per step, Euler and the midpoint method 1, Adams-Moulton 2. For the same number of evaluations,
        high-order methods usually win by a wide margin. For very small <Tex>h</Tex> round-off error eventually dominates and the line bends.
      </p>
    </>
  ),
  misil: (
    <>
      <p>
        A target moves along a known trajectory <Tex>{'\\mathbf r_T(t)'}</Tex>. The missile moves with constant speed <Tex>{'v_M'}</Tex> and its velocity <b>always</b> points toward the
        current position of the target (pure pursuit):
      </p>
      <Tex block>{"\\mathbf r_M'(t) = v_M\\,\\frac{\\mathbf r_T(t) - \\mathbf r_M(t)}{\\lVert \\mathbf r_T(t) - \\mathbf r_M(t)\\rVert},\\qquad \\mathbf r_M(t_0) = \\mathbf r_{M,0}"}</Tex>
      <p>
        It is a nonlinear, non-autonomous system of 3 first-order ODEs (<Tex>x_M, y_M, z_M</Tex>), of the form <Tex>{"Y' = F(t, Y)"}</Tex> studied in Section 6.2 of the textbook (the
        syllabus proposes it as a presentation in session 30; the textbook does not develop it). It is integrated with RK4 and stops when the distance falls below the capture radius{' '}
        <Tex>{'\\varepsilon'}</Tex>; the capture time is refined by linearly interpolating the distance over the last step.
      </p>
      <p>
        <b>Validation (Bouguer, 1732):</b> in the plane, if the target starts at the origin and moves in a straight line perpendicular to the line of sight with speed <Tex>{'v_T < v_M'}</Tex>, and the missile
        starts at distance <Tex>a</Tex>, the exact capture time is
      </p>
      <Tex block>{'T = \\frac{a\\,v_M}{v_M^2 - v_T^2}'}</Tex>
      <p>
        (“Bouguer” example: <Tex>{'a = 10,\\; v_T = 1,\\; v_M = 2 \\Rightarrow T = 20/3 \\approx 6.6667'}</Tex>). If <Tex>{'v_M \\le v_T'}</Tex> there is in general no capture. Near capture the
        direction changes very quickly: choose <Tex>{'h\\,v_M < \\varepsilon'}</Tex>.
      </p>
    </>
  ),
}

export const THEORY: Record<PageId, ReactNode> = L(THEORY_ES, THEORY_EN)
