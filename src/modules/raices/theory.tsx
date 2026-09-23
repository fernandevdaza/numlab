import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'
import type { RootKind } from './RootSolver'

// Notación del texto de la materia (Cap. 2): α es la raíz buscada, EPS la precisión, x_I / x_D los extremos
// izquierdo y derecho de un intervalo con cambio de signo y x_M su punto medio.

export const TOPIC = L('Tema 2 · Ecuaciones no lineales', 'Topic 2 · Nonlinear equations')

export const TITLES: Record<RootKind, string> = {
  biseccion: L('Método de la bisección', 'Bisection method'),
  'punto-fijo': L('Método del punto fijo', 'Fixed-point iteration'),
  aitken: L('Método de Aitken (Δ²)', "Aitken's Δ² method"),
  steffensen: L('Método de Steffensen', "Steffensen's method"),
  newton: L('Método de Newton-Raphson', 'Newton–Raphson method'),
  secante: L('Método de la secante', 'Secant method'),
  'posicion-falsa': L('Método de la posición falsa', 'False position method (regula falsi)'),
  'newton-mod': L('Método de Newton modificado (raíces múltiples)', 'Modified Newton method (multiple roots)'),
}

export const DESCRIPTIONS: Record<RootKind, string> = {
  biseccion: L(
    'Parte a la mitad un intervalo con cambio de signo hasta encerrar la raíz con la precisión EPS pedida.',
    'Repeatedly halves an interval with a sign change until the root is bracketed to the requested precision EPS.',
  ),
  'punto-fijo': L(
    'Reescribe f(x) = 0 como x = g(x) e itera xₙ₊₁ = g(xₙ); converge si |g′| < 1 cerca de la raíz.',
    'Rewrites f(x) = 0 as x = g(x) and iterates xₙ₊₁ = g(xₙ); converges if |g′| < 1 near the root.',
  ),
  aitken: L(
    'Acelera una sucesión de punto fijo de convergencia lineal usando tres términos consecutivos.',
    'Accelerates a linearly convergent fixed-point sequence using three consecutive terms.',
  ),
  steffensen: L(
    'Punto fijo + Aitken, reiniciando con cada valor acelerado: convergencia cuadrática sin derivadas.',
    'Fixed point + Aitken, restarting from each accelerated value: quadratic convergence without derivatives.',
  ),
  newton: L(
    'Sigue la recta tangente hasta el eje x; convergencia cuadrática cerca de una raíz simple.',
    'Follows the tangent line down to the x-axis; quadratic convergence near a simple root.',
  ),
  secante: L(
    'Como Newton, pero la tangente se reemplaza por la secante que pasa por las dos últimas aproximaciones.',
    'Like Newton, but the tangent is replaced by the secant line through the last two approximations.',
  ),
  'posicion-falsa': L(
    'Variante de la secante que conserva siempre un intervalo [x_I, x_D] con cambio de signo.',
    'A variant of the secant method that always keeps an interval [x_I, x_D] with a sign change.',
  ),
  'newton-mod': L(
    'Recupera la convergencia cuadrática de Newton en raíces de multiplicidad m > 1.',
    "Restores Newton's quadratic convergence at roots of multiplicity m > 1.",
  ),
}

/** Criterio de parada común (relación 2.3 del texto). */
const Parada = ({ x = 'x_n' }: { x?: string }) =>
  L(
    <p>
      <b>Criterio de parada (2.3):</b> se detiene en la iteración <Tex>n</Tex> si <Tex>{`|f(${x})| \\le EPS`}</Tex> <b>o</b>{' '}
      <Tex>{`|x_n - x_{n-1}| \\le EPS`}</Tex> (basta una de las dos; la primera pide que la ecuación se cumpla casi exactamente, la segunda que dos aproximaciones sucesivas estén a distancia
      menor que EPS). Es la opción por defecto; también puedes usar una sola de ellas.
    </p>,
    <p>
      <b>Stopping criterion (2.3):</b> stop at iteration <Tex>n</Tex> if <Tex>{`|f(${x})| \\le EPS`}</Tex> <b>or</b>{' '}
      <Tex>{`|x_n - x_{n-1}| \\le EPS`}</Tex> (either one suffices; the first requires the equation to hold almost exactly, the second that two successive approximations be closer than
      EPS). This is the default option; you can also use just one of them.
    </p>,
  )

export const THEORY: Record<RootKind, ReactNode> = {
  biseccion: L(
    <>
      <p>
        Si <Tex>f</Tex> es <b>continua</b> y <Tex>{'f(x_I)\\,f(x_D)<0'}</Tex> con <Tex>{'x_I<x_D'}</Tex>, hay una raíz <Tex>α</Tex> en <Tex>{']x_I,x_D['}</Tex> (I = a la izquierda de la raíz, D =
        a la derecha). En cada iteración se toma el punto medio y se reemplaza el extremo que está del mismo lado de la raíz:
      </p>
      <Tex block>{'x_M = \\frac{x_I+x_D}{2},\\qquad \\begin{cases} f(x_M)\\,f(x_I)>0 \\;\\Rightarrow\\; x_I = x_M \\\\ f(x_M)\\,f(x_I)<0 \\;\\Rightarrow\\; x_D = x_M\\end{cases}'}</Tex>
      <p>
        Se detiene cuando <Tex>{'|f(x_M)|\\le EPS'}</Tex> o <Tex>{'|x_D - x_I|\\le EPS'}</Tex> (el ancho del nuevo intervalo, que en la tabla aparece como{' '}
        <Tex>{'(x_D-x_I)/2'}</Tex> del intervalo anterior). Como el intervalo se reduce a la mitad en cada paso, después de <Tex>n</Tex> iteraciones
      </p>
      <Tex block>{'|\\alpha - x_M^{(n)}| \\le \\frac{x_D^{(0)}-x_I^{(0)}}{2^{n}} \\le EPS \\quad\\Longrightarrow\\quad n = \\left\\lceil \\frac{\\ln\\big(x_D^{(0)}-x_I^{(0)}\\big)-\\ln(EPS)}{\\ln 2}\\right\\rceil \\qquad (2.6)'}</Tex>
      <p>
        Es lento pero seguro (siempre converge, con orden 1 y constante ½). Si <Tex>f</Tex> no es continua puede haber cambio de signo sin raíz.
      </p>
    </>,
    <>
      <p>
        If <Tex>f</Tex> is <b>continuous</b> and <Tex>{'f(x_I)\\,f(x_D)<0'}</Tex> with <Tex>{'x_I<x_D'}</Tex>, there is a root <Tex>α</Tex> in <Tex>{']x_I,x_D['}</Tex> (I = to the left of the root, D =
        to the right). At each iteration we take the midpoint and replace the endpoint that lies on the same side of the root:
      </p>
      <Tex block>{'x_M = \\frac{x_I+x_D}{2},\\qquad \\begin{cases} f(x_M)\\,f(x_I)>0 \\;\\Rightarrow\\; x_I = x_M \\\\ f(x_M)\\,f(x_I)<0 \\;\\Rightarrow\\; x_D = x_M\\end{cases}'}</Tex>
      <p>
        It stops when <Tex>{'|f(x_M)|\\le EPS'}</Tex> or <Tex>{'|x_D - x_I|\\le EPS'}</Tex> (the width of the new interval, shown in the table as{' '}
        <Tex>{'(x_D-x_I)/2'}</Tex> of the previous interval). Since the interval is halved at every step, after <Tex>n</Tex> iterations
      </p>
      <Tex block>{'|\\alpha - x_M^{(n)}| \\le \\frac{x_D^{(0)}-x_I^{(0)}}{2^{n}} \\le EPS \\quad\\Longrightarrow\\quad n = \\left\\lceil \\frac{\\ln\\big(x_D^{(0)}-x_I^{(0)}\\big)-\\ln(EPS)}{\\ln 2}\\right\\rceil \\qquad (2.6)'}</Tex>
      <p>
        It is slow but safe (it always converges, with order 1 and constant ½). If <Tex>f</Tex> is not continuous there may be a sign change without a root.
      </p>
    </>
  ),
  'punto-fijo': L(
    <>
      <p>
        Se transforma <Tex>f(x)=0</Tex> en <Tex>x=g(x)</Tex> (siempre hay varias maneras de hacerlo) y, partiendo de <Tex>x_0</Tex>, se genera <Tex>{'x_{n+1} = g(x_n)'}</Tex>. Si la
        sucesión converge, su límite <Tex>α</Tex> cumple <Tex>{'g(\\alpha)=\\alpha'}</Tex> (punto fijo) y por construcción <Tex>{'f(\\alpha)=0'}</Tex>.
      </p>
      <p>
        <b>Teorema:</b> si <Tex>g</Tex> es derivable en <Tex>I=[a,b]</Tex>, <Tex>{'g(I)\\subseteq I'}</Tex> y <Tex>{"|g'(x)|\\le k<1"}</Tex> en <Tex>I</Tex>, entonces el punto fijo es único en{' '}
        <Tex>I</Tex>, la sucesión converge a él para todo <Tex>{'x_0\\in I'}</Tex> y <Tex>{"\\lim \\frac{\\alpha - x_{n+1}}{\\alpha - x_n} = g'(\\alpha)"}</Tex>. Además{' '}
        <Tex>{'|x_n - \\alpha| \\le \\frac{k^n}{1-k}|x_1-x_0|'}</Tex>.
      </p>
      <p>
        <b>Criterio práctico:</b> elegir la <Tex>g</Tex> con <Tex>{"|g'(x_0)|<1"}</Tex>; cuanto más pequeño sea ese valor, más rápida la convergencia.
      </p>
      <p>
        <b>Orden de convergencia (2.10):</b> un método tiene orden <Tex>p</Tex> si <Tex>{'|\\alpha - x_{n+1}| \\le C\\,|\\alpha - x_n|^p'}</Tex> para todo <Tex>n</Tex> (lineal si{' '}
        <Tex>p=1</Tex>, y entonces hace falta <Tex>C&lt;1</Tex>; súper lineal si <Tex>p&gt;1</Tex>). Con Taylor,{' '}
        <Tex>{"x_{n+1}-\\alpha = g'(\\alpha)(x_n-\\alpha) + \\tfrac12 g''(\\alpha)(x_n-\\alpha)^2+\\dots"}</Tex>, así que el punto fijo es de orden <Tex>p=1</Tex> si{' '}
        <Tex>{"g'(\\alpha)\\neq 0"}</Tex> (con <Tex>{"C=|g'(\\alpha)|"}</Tex>) y de orden <Tex>p=2</Tex> si <Tex>{"g'(\\alpha)=0"}</Tex> (2.13).
      </p>
      <Parada />
    </>,
    <>
      <p>
        We rewrite <Tex>f(x)=0</Tex> as <Tex>x=g(x)</Tex> (there are always several ways to do this) and, starting from <Tex>x_0</Tex>, generate <Tex>{'x_{n+1} = g(x_n)'}</Tex>. If the
        sequence converges, its limit <Tex>α</Tex> satisfies <Tex>{'g(\\alpha)=\\alpha'}</Tex> (a fixed point) and, by construction, <Tex>{'f(\\alpha)=0'}</Tex>.
      </p>
      <p>
        <b>Theorem:</b> if <Tex>g</Tex> is differentiable on <Tex>I=[a,b]</Tex>, <Tex>{'g(I)\\subseteq I'}</Tex> and <Tex>{"|g'(x)|\\le k<1"}</Tex> on <Tex>I</Tex>, then the fixed point in{' '}
        <Tex>I</Tex> is unique, the sequence converges to it for every <Tex>{'x_0\\in I'}</Tex>, and <Tex>{"\\lim \\frac{\\alpha - x_{n+1}}{\\alpha - x_n} = g'(\\alpha)"}</Tex>. Moreover{' '}
        <Tex>{'|x_n - \\alpha| \\le \\frac{k^n}{1-k}|x_1-x_0|'}</Tex>.
      </p>
      <p>
        <b>Practical criterion:</b> choose the <Tex>g</Tex> with <Tex>{"|g'(x_0)|<1"}</Tex>; the smaller that value, the faster the convergence.
      </p>
      <p>
        <b>Order of convergence (2.10):</b> a method has order <Tex>p</Tex> if <Tex>{'|\\alpha - x_{n+1}| \\le C\\,|\\alpha - x_n|^p'}</Tex> for all <Tex>n</Tex> (linear if{' '}
        <Tex>p=1</Tex>, which then requires <Tex>C&lt;1</Tex>; superlinear if <Tex>p&gt;1</Tex>). By Taylor,{' '}
        <Tex>{"x_{n+1}-\\alpha = g'(\\alpha)(x_n-\\alpha) + \\tfrac12 g''(\\alpha)(x_n-\\alpha)^2+\\dots"}</Tex>, so fixed-point iteration has order <Tex>p=1</Tex> if{' '}
        <Tex>{"g'(\\alpha)\\neq 0"}</Tex> (with <Tex>{"C=|g'(\\alpha)|"}</Tex>) and order <Tex>p=2</Tex> if <Tex>{"g'(\\alpha)=0"}</Tex> (2.13).
      </p>
      <Parada />
    </>
  ),
  aitken: L(
    <>
      <p>
        Si la sucesión de punto fijo <Tex>{'x_{n+1}=g(x_n)'}</Tex> converge linealmente, al primer orden <Tex>{"x_{n+1}-\\alpha \\approx g'(\\alpha)(x_n-\\alpha)"}</Tex> y{' '}
        <Tex>{"x_{n+2}-\\alpha \\approx g'(\\alpha)(x_{n+1}-\\alpha)"}</Tex>. Eliminando <Tex>{"g'(\\alpha)\\approx \\frac{x_{n+2}-x_{n+1}}{x_{n+1}-x_n}"}</Tex> y despejando <Tex>α</Tex> se obtiene la
        nueva sucesión (2.17):
      </p>
      <Tex block>{'y_n = x_n - \\frac{(x_{n+1}-x_n)^2}{x_{n+2}-2x_{n+1}+x_n},\\qquad n\\ge 0'}</Tex>
      <p>
        Cada <Tex>y_n</Tex> usa tres términos consecutivos de la sucesión original, que no se modifica. El error de <Tex>y_n</Tex> es del orden del <b>cuadrado</b> del error de{' '}
        <Tex>x_n</Tex>, por eso el texto la describe como cuadrática; en rigor la sucesión <Tex>{'\\{y_n\\}'}</Tex> sigue siendo lineal, pero con constante{' '}
        <Tex>{"g'(\\alpha)^2"}</Tex> en lugar de <Tex>{"g'(\\alpha)"}</Tex>, es decir, mucho más rápida (compruébalo con la columna del orden estimado en la pestaña Convergencia).
      </p>
      <Parada x="y_n" />
    </>,
    <>
      <p>
        If the fixed-point sequence <Tex>{'x_{n+1}=g(x_n)'}</Tex> converges linearly, to first order <Tex>{"x_{n+1}-\\alpha \\approx g'(\\alpha)(x_n-\\alpha)"}</Tex> and{' '}
        <Tex>{"x_{n+2}-\\alpha \\approx g'(\\alpha)(x_{n+1}-\\alpha)"}</Tex>. Eliminating <Tex>{"g'(\\alpha)\\approx \\frac{x_{n+2}-x_{n+1}}{x_{n+1}-x_n}"}</Tex> and solving for <Tex>α</Tex> gives the
        new sequence (2.17):
      </p>
      <Tex block>{'y_n = x_n - \\frac{(x_{n+1}-x_n)^2}{x_{n+2}-2x_{n+1}+x_n},\\qquad n\\ge 0'}</Tex>
      <p>
        Each <Tex>y_n</Tex> uses three consecutive terms of the original sequence, which is left unchanged. The error of <Tex>y_n</Tex> is of the order of the <b>square</b> of the error of{' '}
        <Tex>x_n</Tex>, which is why the textbook calls it quadratic; strictly speaking, <Tex>{'\\{y_n\\}'}</Tex> is still linear, but with constant{' '}
        <Tex>{"g'(\\alpha)^2"}</Tex> instead of <Tex>{"g'(\\alpha)"}</Tex>, i.e. much faster (check the estimated-order column in the Convergence tab).
      </p>
      <Parada x="y_n" />
    </>
  ),
  steffensen: L(
    <>
      <p>
        Variante de Aitken: cada valor acelerado se usa como nuevo punto de partida de la iteración de punto fijo. Dado <Tex>x_0</Tex> se calculan <Tex>{'x_1=g(x_0)'}</Tex>,{' '}
        <Tex>{'x_2=g(x_1)'}</Tex> y con ellos <Tex>y_0</Tex> por (2.17); luego se hace <Tex>{'x_1 = y_0'}</Tex>, se generan dos nuevos términos y se obtiene <Tex>y_1</Tex>, y así
        sucesivamente:
      </p>
      <Tex block>{'y_n = x_n - \\frac{\\big(g(x_n)-x_n\\big)^2}{g(g(x_n)) - 2g(x_n) + x_n},\\qquad x_{n+1} = y_n'}</Tex>
      <p>
        Si <Tex>{"g'(\\alpha)\\neq 1"}</Tex>, la convergencia es <b>cuadrática</b> sin usar derivadas (en el ejemplo del texto, 12 dígitos exactos en la segunda iteración). Incluso puede converger
        cuando el punto fijo simple diverge.
      </p>
      <Parada />
    </>,
    <>
      <p>
        A variant of Aitken: each accelerated value is used as the new starting point of the fixed-point iteration. Given <Tex>x_0</Tex> we compute <Tex>{'x_1=g(x_0)'}</Tex>,{' '}
        <Tex>{'x_2=g(x_1)'}</Tex> and from them <Tex>y_0</Tex> by (2.17); then we set <Tex>{'x_1 = y_0'}</Tex>, generate two new terms and obtain <Tex>y_1</Tex>, and so
        on:
      </p>
      <Tex block>{'y_n = x_n - \\frac{\\big(g(x_n)-x_n\\big)^2}{g(g(x_n)) - 2g(x_n) + x_n},\\qquad x_{n+1} = y_n'}</Tex>
      <p>
        If <Tex>{"g'(\\alpha)\\neq 1"}</Tex>, convergence is <b>quadratic</b> without using derivatives (in the textbook example, 12 correct digits at the second iteration). It may even converge
        when plain fixed-point iteration diverges.
      </p>
      <Parada />
    </>
  ),
  newton: L(
    <>
      <p>
        Requiere <Tex>f</Tex> derivable y una buena aproximación inicial <Tex>x_0</Tex>. Se traza la recta tangente <Tex>{"y - f(x_n) = f'(x_n)(x - x_n)"}</Tex> y se toma su raíz como
        siguiente aproximación (2.18):
      </p>
      <Tex block>{"x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)},\\qquad n\\ge 0"}</Tex>
      <p>
        Es un caso particular del punto fijo con <Tex>{"g(x)=x-f(x)/f'(x)"}</Tex>. Si <Tex>f</Tex> es dos veces derivable y <Tex>α</Tex> es raíz <b>simple</b> (<Tex>{"f'(\\alpha)\\ne0"}</Tex>),
        entonces <Tex>{"g'(\\alpha)=0"}</Tex> y la convergencia es <b>cuadrática</b> (2.19):
      </p>
      <Tex block>{"\\lim_{n\\to\\infty}\\frac{|\\alpha - x_{n+1}|}{|\\alpha - x_n|^2} = \\frac{|f''(\\alpha)|}{2|f'(\\alpha)|}"}</Tex>
      <p>Puede fallar si <Tex>{"f'(x_n)=0"}</Tex> o si <Tex>x_0</Tex> está lejos de la raíz (prueba los ejemplos “ciclo” y “diverge”).</p>
      <Parada />
    </>,
    <>
      <p>
        It requires <Tex>f</Tex> to be differentiable and a good initial approximation <Tex>x_0</Tex>. We draw the tangent line <Tex>{"y - f(x_n) = f'(x_n)(x - x_n)"}</Tex> and take its root as the
        next approximation (2.18):
      </p>
      <Tex block>{"x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)},\\qquad n\\ge 0"}</Tex>
      <p>
        It is a special case of fixed-point iteration with <Tex>{"g(x)=x-f(x)/f'(x)"}</Tex>. If <Tex>f</Tex> is twice differentiable and <Tex>α</Tex> is a <b>simple</b> root (<Tex>{"f'(\\alpha)\\ne0"}</Tex>),
        then <Tex>{"g'(\\alpha)=0"}</Tex> and convergence is <b>quadratic</b> (2.19):
      </p>
      <Tex block>{"\\lim_{n\\to\\infty}\\frac{|\\alpha - x_{n+1}|}{|\\alpha - x_n|^2} = \\frac{|f''(\\alpha)|}{2|f'(\\alpha)|}"}</Tex>
      <p>It may fail if <Tex>{"f'(x_n)=0"}</Tex> or if <Tex>x_0</Tex> is far from the root (try the “cycle” and “diverges” examples).</p>
      <Parada />
    </>
  ),
  secante: L(
    <>
      <p>
        Evita calcular <Tex>{"f'"}</Tex>: con dos aproximaciones <Tex>{'x_0, x_1'}</Tex> se traza la recta secante por <Tex>{'(x_{n-1},f(x_{n-1}))'}</Tex> y <Tex>{'(x_n,f(x_n))'}</Tex> y se toma su
        raíz:
      </p>
      <Tex block>{'x_{n+1} = x_n - \\frac{x_n - x_{n-1}}{f(x_n)-f(x_{n-1})}\\,f(x_n),\\qquad n\\ge1'}</Tex>
      <p>
        Usa una sola evaluación nueva de <Tex>f</Tex> por paso. Es algo más lento que Newton: orden <Tex>{'p = \\frac{1+\\sqrt5}{2}\\approx1.618'}</Tex> (el número áureo).
      </p>
      <Parada />
    </>,
    <>
      <p>
        Avoids computing <Tex>{"f'"}</Tex>: with two approximations <Tex>{'x_0, x_1'}</Tex> we draw the secant line through <Tex>{'(x_{n-1},f(x_{n-1}))'}</Tex> and <Tex>{'(x_n,f(x_n))'}</Tex> and take its
        root:
      </p>
      <Tex block>{'x_{n+1} = x_n - \\frac{x_n - x_{n-1}}{f(x_n)-f(x_{n-1})}\\,f(x_n),\\qquad n\\ge1'}</Tex>
      <p>
        It uses only one new evaluation of <Tex>f</Tex> per step. It is somewhat slower than Newton: order <Tex>{'p = \\frac{1+\\sqrt5}{2}\\approx1.618'}</Tex> (the golden ratio).
      </p>
      <Parada />
    </>
  ),
  'posicion-falsa': L(
    <>
      <p>
        Variante de la secante en la que las dos aproximaciones deben encerrar la raíz, como en la bisección: <Tex>{'f(x_I)\\,f(x_D)<0'}</Tex>. La raíz de la secante que pasa por{' '}
        <Tex>{'(x_I,f(x_I))'}</Tex> y <Tex>{'(x_D,f(x_D))'}</Tex> es (2.19)
      </p>
      <Tex block>{'\\alpha_S = x_D - \\frac{x_D - x_I}{f(x_D)-f(x_I)}\\,f(x_D)'}</Tex>
      <p>
        y se reemplaza el extremo del mismo lado de la raíz: si <Tex>{'f(\\alpha_S)f(x_I)>0'}</Tex> entonces <Tex>{'x_I=\\alpha_S'}</Tex>; si no, <Tex>{'x_D=\\alpha_S'}</Tex>. Así la raíz siempre queda
        encerrada.
      </p>
      <p>
        Su orden es comparable al de la secante, pero a menudo un extremo queda <b>fijo</b> durante muchas iteraciones y la convergencia se vuelve lenta (lineal).{' '}
        <b>Versión modificada del texto:</b> si un extremo no cambia en dos iteraciones sucesivas, en la siguiente se usa la <b>mitad</b> de su valor de <Tex>f</Tex> en la fórmula (2.19).
      </p>
      <p>
        <b>Criterio de parada:</b> <Tex>{'|f(\\alpha_S)|\\le EPS'}</Tex> o <Tex>{'|\\alpha_S^{(n)}-\\alpha_S^{(n-1)}|\\le EPS'}</Tex>. (El texto escribe <Tex>{'|x_D-x_I|\\le EPS'}</Tex>, pero
        sin la modificación ese ancho no tiende a cero porque un extremo queda fijo; por eso se compara la distancia entre dos aproximaciones sucesivas, como en (2.3).)
      </p>
    </>,
    <>
      <p>
        A variant of the secant method in which the two approximations must bracket the root, as in bisection: <Tex>{'f(x_I)\\,f(x_D)<0'}</Tex>. The root of the secant line through{' '}
        <Tex>{'(x_I,f(x_I))'}</Tex> and <Tex>{'(x_D,f(x_D))'}</Tex> is (2.19)
      </p>
      <Tex block>{'\\alpha_S = x_D - \\frac{x_D - x_I}{f(x_D)-f(x_I)}\\,f(x_D)'}</Tex>
      <p>
        and the endpoint on the same side of the root is replaced: if <Tex>{'f(\\alpha_S)f(x_I)>0'}</Tex> then <Tex>{'x_I=\\alpha_S'}</Tex>; otherwise <Tex>{'x_D=\\alpha_S'}</Tex>. This way the root always stays
        bracketed.
      </p>
      <p>
        Its order is comparable to that of the secant method, but often one endpoint stays <b>fixed</b> for many iterations and convergence becomes slow (linear).{' '}
        <b>The textbook's modified version:</b> if an endpoint does not change in two successive iterations, <b>half</b> of its <Tex>f</Tex> value is used in formula (2.19) at the next one.
      </p>
      <p>
        <b>Stopping criterion:</b> <Tex>{'|f(\\alpha_S)|\\le EPS'}</Tex> or <Tex>{'|\\alpha_S^{(n)}-\\alpha_S^{(n-1)}|\\le EPS'}</Tex>. (The textbook writes <Tex>{'|x_D-x_I|\\le EPS'}</Tex>, but
        without the modification that width does not tend to zero because one endpoint stays fixed; that is why the distance between two successive approximations is compared, as in (2.3).)
      </p>
    </>
  ),
  'newton-mod': L(
    <>
      <p>
        <Tex>α</Tex> es raíz de <b>multiplicidad</b> <Tex>m</Tex> si <Tex>{'f(x)=(x-\\alpha)^m h(x)'}</Tex> con <Tex>{'h(\\alpha)\\ne0'}</Tex>, o equivalentemente si{' '}
        <Tex>{"f(\\alpha)=f'(\\alpha)=\\dots=f^{(m-1)}(\\alpha)=0"}</Tex> y <Tex>{'f^{(m)}(\\alpha)\\ne0'}</Tex>. Para Newton, visto como punto fijo, resulta (2.20)
      </p>
      <Tex block>{"g'(\\alpha) = 1-\\frac1m \\quad\\Longrightarrow\\quad p=2 \\text{ si } m=1,\\qquad p=1 \\text{ si } m>1"}</Tex>
      <p>
        <b>Newton modificado (2.21):</b> con <Tex>{"g(x)=x-m\\,f(x)/f'(x)"}</Tex> se obtiene <Tex>{"g'(\\alpha)=0"}</Tex> y se recupera el orden <Tex>p=2</Tex>:
      </p>
      <Tex block>{"x_{n+1} = x_n - m\\,\\frac{f(x_n)}{f'(x_n)},\\qquad n\\ge0"}</Tex>
      <p>
        <b>Cálculo de m (2.23):</b> se hacen unas 4 iteraciones de Newton-Raphson desde <Tex>x_0</Tex> y, como <Tex>{"g'(\\alpha)=1-\\frac1m\\approx\\frac{x_{n+2}-x_{n+1}}{x_{n+1}-x_n}"}</Tex>,
      </p>
      <Tex block>{'m \\approx \\left[1-\\frac{x_{n+2}-x_{n+1}}{x_{n+1}-x_n}\\right]^{-1}'}</Tex>
      <p>se redondea al entero más cercano (tabla «Estimación de la multiplicidad» más abajo).</p>
      <p>
        <b>Método alternativo (2.4.2):</b> <Tex>{"u(x) = f(x)/f'(x)"}</Tex> tiene las mismas raíces que <Tex>f</Tex>, pero todas <b>simples</b>, así que no hace falta conocer <Tex>m</Tex>. Aplicando
        Newton-Raphson a <Tex>u</Tex>:
      </p>
      <Tex block>{"x_{n+1} = x_n - \\frac{u(x_n)}{u'(x_n)} = x_n - \\frac{f(x_n)\\,f'(x_n)}{[f'(x_n)]^2 - f(x_n)\\,f''(x_n)}"}</Tex>
      <p>
        Otra alternativa, si se conoce <Tex>m</Tex>, es buscar la raíz de <Tex>{'f^{(m-1)}(x)'}</Tex>, que es simple. Cerca de una raíz múltiple el redondeo limita la precisión alcanzable
        (≈ <Tex>{'\\varepsilon^{1/m}'}</Tex> con <Tex>ε</Tex> el épsilon de la máquina).
      </p>
      <Parada />
    </>,
    <>
      <p>
        <Tex>α</Tex> is a root of <b>multiplicity</b> <Tex>m</Tex> if <Tex>{'f(x)=(x-\\alpha)^m h(x)'}</Tex> with <Tex>{'h(\\alpha)\\ne0'}</Tex>, or equivalently if{' '}
        <Tex>{"f(\\alpha)=f'(\\alpha)=\\dots=f^{(m-1)}(\\alpha)=0"}</Tex> and <Tex>{'f^{(m)}(\\alpha)\\ne0'}</Tex>. Viewing Newton as a fixed-point iteration gives (2.20)
      </p>
      <Tex block>{"g'(\\alpha) = 1-\\frac1m \\quad\\Longrightarrow\\quad p=2 \\text{ if } m=1,\\qquad p=1 \\text{ if } m>1"}</Tex>
      <p>
        <b>Modified Newton (2.21):</b> with <Tex>{"g(x)=x-m\\,f(x)/f'(x)"}</Tex> we get <Tex>{"g'(\\alpha)=0"}</Tex> and order <Tex>p=2</Tex> is restored:
      </p>
      <Tex block>{"x_{n+1} = x_n - m\\,\\frac{f(x_n)}{f'(x_n)},\\qquad n\\ge0"}</Tex>
      <p>
        <b>Computing m (2.23):</b> run about 4 Newton–Raphson iterations from <Tex>x_0</Tex> and, since <Tex>{"g'(\\alpha)=1-\\frac1m\\approx\\frac{x_{n+2}-x_{n+1}}{x_{n+1}-x_n}"}</Tex>,
      </p>
      <Tex block>{'m \\approx \\left[1-\\frac{x_{n+2}-x_{n+1}}{x_{n+1}-x_n}\\right]^{-1}'}</Tex>
      <p>rounded to the nearest integer (see the “Multiplicity estimate” table below).</p>
      <p>
        <b>Alternative method (2.4.2):</b> <Tex>{"u(x) = f(x)/f'(x)"}</Tex> has the same roots as <Tex>f</Tex>, but all of them <b>simple</b>, so <Tex>m</Tex> need not be known. Applying
        Newton–Raphson to <Tex>u</Tex>:
      </p>
      <Tex block>{"x_{n+1} = x_n - \\frac{u(x_n)}{u'(x_n)} = x_n - \\frac{f(x_n)\\,f'(x_n)}{[f'(x_n)]^2 - f(x_n)\\,f''(x_n)}"}</Tex>
      <p>
        Another option, if <Tex>m</Tex> is known, is to look for the root of <Tex>{'f^{(m-1)}(x)'}</Tex>, which is simple. Near a multiple root, round-off limits the attainable precision
        (≈ <Tex>{'\\varepsilon^{1/m}'}</Tex>, where <Tex>ε</Tex> is machine epsilon).
      </p>
      <Parada />
    </>
  ),
}
