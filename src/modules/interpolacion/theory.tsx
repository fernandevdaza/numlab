import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'

export type InterpKind = 'lagrange' | 'diferencias-divididas' | 'diferencias-finitas' | 'error-interpolacion' | 'runge' | 'splines'

export const TOPIC = L('Tema 4 · Interpolación', 'Topic 4 · Interpolation')

export const TITLES: Record<InterpKind, string> = {
  lagrange: L('Polinomio de interpolación de Lagrange', 'Lagrange interpolating polynomial'),
  'diferencias-divididas': L('Polinomio de Newton: diferencias divididas', 'Newton polynomial: divided differences'),
  'diferencias-finitas': L('Polinomio de Newton: diferencias finitas', 'Newton polynomial: finite differences'),
  'error-interpolacion': L('Estimación del error de interpolación', 'Interpolation error estimate'),
  runge: L('Fenómeno de Runge', 'Runge phenomenon'),
  splines: L('Interpolación segmentaria: splines cúbicas', 'Piecewise interpolation: cubic splines'),
}

/** Títulos del menú lateral (≤ 32 caracteres). */
export const SHORT: Record<InterpKind, string> = {
  lagrange: L('Polinomio de Lagrange', 'Lagrange polynomial'),
  'diferencias-divididas': L('Diferencias divididas', 'Divided differences'),
  'diferencias-finitas': L('Diferencias finitas', 'Finite differences'),
  'error-interpolacion': L('Estimación del error', 'Error estimate'),
  runge: L('Fenómeno de Runge', 'Runge phenomenon'),
  splines: L('Splines cúbicas', 'Cubic splines'),
}

/** Descripción de una línea (menú, tarjetas y buscador). */
export const SUMMARY: Record<InterpKind, string> = {
  lagrange: L('Polinomio interpolante como combinación de los polinomios base L_i(x).', 'Interpolating polynomial as a combination of the basis polynomials L_i(x).'),
  'diferencias-divididas': L(
    'Polinomio de Newton de avance o retroceso con la tabla de diferencias divididas.',
    'Forward or backward Newton polynomial from the divided-difference table.',
  ),
  'diferencias-finitas': L(
    'Nodos equiespaciados: fórmulas de avance (Δ) y retroceso (∇) en la variable s.',
    'Equally spaced nodes: forward (Δ) and backward (∇) formulas in the variable s.',
  ),
  'error-interpolacion': L('Error con un punto adicional y cota con el máximo de |f⁽ⁿ⁺¹⁾|.', 'Error from an extra point and bound from the maximum of |f⁽ⁿ⁺¹⁾|.'),
  runge: L('Oscilaciones del polinomio de grado alto con nodos equiespaciados.', 'Oscillations of high-degree polynomials on equally spaced nodes.'),
  splines: L(
    'Cúbicas por tramos con condición natural (M₀ = Mₙ = 0) o forzada (f′ en los extremos).',
    'Piecewise cubics with natural (M₀ = Mₙ = 0) or clamped (f′ at the endpoints) conditions.',
  ),
}

const ERROR_FORMULA = 'R_n(x) = f(x) - P_n(x) = \\prod_{i=0}^{n}(x-x_i)\\,\\frac{f^{(n+1)}(\\eta)}{(n+1)!},\\qquad \\eta\\in[\\min\\{x, x_i\\},\\max\\{x, x_i\\}]'

const APOYO = L(
  <p>
    <b>Polinomio «apoyado» en <Tex>x_k</Tex>:</b> con la misma tabla se pueden construir polinomios de menor grado <Tex>m</Tex> que usan sólo parte de los datos. El de
    avance apoyado en <Tex>x_k</Tex> usa <Tex>{'x_k, x_{k+1}, \\dots, x_{k+m}'}</Tex>; el de retroceso apoyado en <Tex>x_k</Tex> usa <Tex>{'x_k, x_{k-1}, \\dots, x_{k-m}'}</Tex>. Si
    faltan datos en esa dirección, el polinomio no se puede construir. Conviene elegir el apoyo de modo que <Tex>x</Tex> quede rodeado de nodos cercanos.
  </p>,
  <p>
    <b>Polynomial “based at” <Tex>x_k</Tex>:</b> the same table yields lower-degree polynomials of degree <Tex>m</Tex> that use only part of the data. The forward
    polynomial based at <Tex>x_k</Tex> uses <Tex>{'x_k, x_{k+1}, \\dots, x_{k+m}'}</Tex>; the backward one based at <Tex>x_k</Tex> uses <Tex>{'x_k, x_{k-1}, \\dots, x_{k-m}'}</Tex>. If
    there are not enough data in that direction, the polynomial cannot be built. Choose the base point so that <Tex>x</Tex> is surrounded by nearby nodes.
  </p>,
)

export const THEORY: Record<InterpKind, ReactNode> = {
  lagrange: L(
    <>
      <p>
        Dados <Tex>n+1</Tex> datos <Tex>{'(x_i, f(x_i))'}</Tex>, <Tex>{'i=0,\\dots,n'}</Tex>, con abscisas distintas, existe un <b>único</b> polinomio <Tex>P_n</Tex> de grado{' '}
        <Tex>{'\\le n'}</Tex> con <Tex>{'P_n(x_i)=f(x_i)'}</Tex>: el sistema de las condiciones tiene la matriz de Vandermonde, cuyo determinante{' '}
        <Tex>{'\\prod_{i<j}(x_j-x_i)'}</Tex> no se anula. Lagrange lo construye con <Tex>n+1</Tex> polinomios base de grado <Tex>n</Tex> que valen 1 en su nodo y 0 en los demás (
        <Tex>{'L_i(x_k)=\\delta_{ik}'}</Tex>):
      </p>
      <Tex block>{'L_i(x) = \\frac{\\prod_{k\\ne i}(x - x_k)}{\\prod_{k\\ne i}(x_i - x_k)},\\qquad P_n(x) = \\sum_{i=0}^{n} f(x_i)\\,L_i(x)'}</Tex>
      <p>
        Para estimar <Tex>f(x)</Tex> basta evaluar cada <Tex>{'L_i'}</Tex> en ese punto y sumar <Tex>{'f(x_i)L_i(x)'}</Tex> (así lo hace el texto en el Ej. 4.2). Desventaja: si se
        agrega un dato hay que rehacer todas las bases; el polinomio de Newton evita ese problema. Con «Grado m» y «desde x_k» se interpola sólo con los nodos{' '}
        <Tex>{'x_k,\\dots,x_{k+m}'}</Tex>.
      </p>
      <p>Error (si los datos provienen de una función <Tex>{'f\\in C^{n+1}'}</Tex>):</p>
      <Tex block>{ERROR_FORMULA}</Tex>
    </>,
    <>
      <p>
        Given <Tex>n+1</Tex> data points <Tex>{'(x_i, f(x_i))'}</Tex>, <Tex>{'i=0,\\dots,n'}</Tex>, with distinct abscissas, there is a <b>unique</b> polynomial <Tex>P_n</Tex> of
        degree <Tex>{'\\le n'}</Tex> with <Tex>{'P_n(x_i)=f(x_i)'}</Tex>: the system of conditions has the Vandermonde matrix, whose determinant{' '}
        <Tex>{'\\prod_{i<j}(x_j-x_i)'}</Tex> is nonzero. Lagrange builds it from <Tex>n+1</Tex> basis polynomials of degree <Tex>n</Tex> that equal 1 at their own node and 0 at
        the others (<Tex>{'L_i(x_k)=\\delta_{ik}'}</Tex>):
      </p>
      <Tex block>{'L_i(x) = \\frac{\\prod_{k\\ne i}(x - x_k)}{\\prod_{k\\ne i}(x_i - x_k)},\\qquad P_n(x) = \\sum_{i=0}^{n} f(x_i)\\,L_i(x)'}</Tex>
      <p>
        To estimate <Tex>f(x)</Tex> it is enough to evaluate each <Tex>{'L_i'}</Tex> at that point and add up <Tex>{'f(x_i)L_i(x)'}</Tex> (this is what the textbook does in Ex. 4.2).
        Drawback: adding a data point means recomputing every basis polynomial; the Newton polynomial avoids this. With “Degree m” and “from x_k” only the nodes{' '}
        <Tex>{'x_k,\\dots,x_{k+m}'}</Tex> are used.
      </p>
      <p>Error (if the data come from a function <Tex>{'f\\in C^{n+1}'}</Tex>):</p>
      <Tex block>{ERROR_FORMULA}</Tex>
    </>,
  ),
  'diferencias-divididas': L(
    <>
      <p>
        Newton construye <Tex>P_n</Tex> agregando un dato a la vez: <Tex>{'P_n(x) = P_{n-1}(x) + a_n(x-x_0)\\cdots(x-x_{n-1})'}</Tex>, y los coeficientes resultan ser las{' '}
        <b>diferencias divididas</b>, definidas por recurrencia:
      </p>
      <Tex block>{'f[x_i] = f(x_i),\\qquad f[x_i,\\dots,x_{i+k}] = \\frac{f[x_{i+1},\\dots,x_{i+k}] - f[x_i,\\dots,x_{i+k-1}]}{x_{i+k}-x_i}'}</Tex>
      <p>
        <b>De avance</b> (apoyado en <Tex>x_0</Tex>): usa la primera fila de la tabla.
      </p>
      <Tex block>{'P_n(x) = f(x_0) + \\sum_{i=1}^{n} f[x_0,\\dots,x_i]\\,(x-x_0)\\cdots(x-x_{i-1})'}</Tex>
      <p>
        <b>De retroceso</b> (apoyado en <Tex>x_n</Tex>): los datos se toman en orden inverso; es la misma tabla, pero se usa el <b>último</b> valor de cada columna.
      </p>
      <Tex block>{'P_n(x) = f(x_n) + \\sum_{i=1}^{n} f[x_{n-i},\\dots,x_n]\\,(x-x_n)\\cdots(x-x_{n-i+1})'}</Tex>
      <p>
        Numéricamente conviene la <b>forma anidada</b>: <Tex>{'P_n(x) = a_0 + (x-x_0)\\big[a_1 + (x-x_1)\\big[a_2 + \\cdots\\big]\\big]'}</Tex>, que necesita <Tex>n</Tex> sumas y{' '}
        <Tex>n</Tex> multiplicaciones.
      </p>
      {APOYO}
      <p>
        Si sobra un dato <Tex>{'x_{m+1}'}</Tex> fuera del polinomio, el siguiente término estima el error (4.31):{' '}
        <Tex>{'R_m(x)\\approx f[x_0,\\dots,x_m,x_{m+1}]\\prod_{i=0}^{m}(x-x_i)'}</Tex>.
      </p>
    </>,
    <>
      <p>
        Newton builds <Tex>P_n</Tex> by adding one data point at a time: <Tex>{'P_n(x) = P_{n-1}(x) + a_n(x-x_0)\\cdots(x-x_{n-1})'}</Tex>, and the coefficients turn out to be
        the <b>divided differences</b>, defined recursively:
      </p>
      <Tex block>{'f[x_i] = f(x_i),\\qquad f[x_i,\\dots,x_{i+k}] = \\frac{f[x_{i+1},\\dots,x_{i+k}] - f[x_i,\\dots,x_{i+k-1}]}{x_{i+k}-x_i}'}</Tex>
      <p>
        <b>Forward</b> (based at <Tex>x_0</Tex>): uses the first row of the table.
      </p>
      <Tex block>{'P_n(x) = f(x_0) + \\sum_{i=1}^{n} f[x_0,\\dots,x_i]\\,(x-x_0)\\cdots(x-x_{i-1})'}</Tex>
      <p>
        <b>Backward</b> (based at <Tex>x_n</Tex>): the data are taken in reverse order; it is the same table, but the <b>last</b> value of each column is used.
      </p>
      <Tex block>{'P_n(x) = f(x_n) + \\sum_{i=1}^{n} f[x_{n-i},\\dots,x_n]\\,(x-x_n)\\cdots(x-x_{n-i+1})'}</Tex>
      <p>
        Numerically, the <b>nested form</b> is preferable: <Tex>{'P_n(x) = a_0 + (x-x_0)\\big[a_1 + (x-x_1)\\big[a_2 + \\cdots\\big]\\big]'}</Tex>, which needs <Tex>n</Tex>{' '}
        additions and <Tex>n</Tex> multiplications.
      </p>
      {APOYO}
      <p>
        If there is a spare data point <Tex>{'x_{m+1}'}</Tex> outside the polynomial, the next term estimates the error (4.31):{' '}
        <Tex>{'R_m(x)\\approx f[x_0,\\dots,x_m,x_{m+1}]\\prod_{i=0}^{m}(x-x_i)'}</Tex>.
      </p>
    </>,
  ),
  'diferencias-finitas': L(
    <>
      <p>
        Si los nodos están <b>equiespaciados</b>, <Tex>{'x_i = x_0 + ih'}</Tex>, se escribe <Tex>{'x = x_0 + sh'}</Tex> (así <Tex>{'x-x_i = (s-i)h'}</Tex>) y las diferencias
        divididas se reemplazan por diferencias finitas, que sólo requieren restas.
      </p>
      <p>
        <b>De avance</b>: <Tex>{'\\Delta^1 f(x) = f(x+h)-f(x)'}</Tex>, <Tex>{'\\Delta^k f(x) = \\Delta^{k-1}f(x+h)-\\Delta^{k-1}f(x)'}</Tex>, con{' '}
        <Tex>{'f[x_0,\\dots,x_k] = \\dfrac{\\Delta^k f(x_0)}{k!\\,h^k}'}</Tex>. Con <Tex>{'s = (x-x_0)/h'}</Tex>:
      </p>
      <Tex block>{'P_n(s) = f(x_0) + \\sum_{k=1}^{n}\\binom{s}{k}\\Delta^k f(x_0),\\qquad \\binom{s}{k} = \\frac{s(s-1)\\cdots(s-k+1)}{k!}'}</Tex>
      <Tex block>{'P_n(s) = f(x_0) + \\frac{s}{1}\\Big[\\Delta^1 f(x_0) + \\frac{s-1}{2}\\Big[\\Delta^2 f(x_0) + \\frac{s-2}{3}\\Big[\\cdots\\Big]\\Big]\\Big]'}</Tex>
      <p>
        <b>De retroceso</b>: <Tex>{'\\nabla^1 f(x) = f(x)-f(x-h)'}</Tex>, <Tex>{'\\nabla^k f(x) = \\nabla^{k-1}f(x)-\\nabla^{k-1}f(x-h)'}</Tex>. Con{' '}
        <Tex>{'s = (x-x_n)/h \\le 0'}</Tex>:
      </p>
      <Tex block>{'P_n(s) = f(x_n) + \\sum_{k=1}^{n}(-1)^k\\binom{|s|}{k}\\nabla^k f(x_n) = f(x_n) - \\frac{|s|}{1}\\Big[\\nabla^1 f(x_n) - \\frac{|s|-1}{2}\\Big[\\nabla^2 f(x_n) - \\cdots\\Big]\\Big]'}</Tex>
      <p>
        (equivale a <Tex>{'\\sum \\frac{s(s+1)\\cdots(s+k-1)}{k!}\\nabla^k f(x_n)'}</Tex>, la forma que se usa si <Tex>s&gt;0</Tex>). La tabla de retroceso es la <b>misma</b> que la
        de avance, porque <Tex>{'\\nabla^k f(x_{i+k}) = \\Delta^k f(x_i)'}</Tex>: el avance usa la primera fila y el retroceso el último valor de cada columna.
      </p>
      {APOYO}
      <p>
        Estimación del error con el dato siguiente (4.32): <Tex>{'R_m(x)\\approx \\binom{s}{m+1}\\Delta^{m+1}f(x_0)'}</Tex> (avance). Error teórico:{' '}
        <Tex>{'R_n = \\frac{s(s-1)\\cdots(s-n)}{(n+1)!}h^{n+1}f^{(n+1)}(\\eta)'}</Tex>.
      </p>
    </>,
    <>
      <p>
        If the nodes are <b>equally spaced</b>, <Tex>{'x_i = x_0 + ih'}</Tex>, we write <Tex>{'x = x_0 + sh'}</Tex> (so <Tex>{'x-x_i = (s-i)h'}</Tex>) and the divided differences
        are replaced by finite differences, which only require subtractions.
      </p>
      <p>
        <b>Forward</b>: <Tex>{'\\Delta^1 f(x) = f(x+h)-f(x)'}</Tex>, <Tex>{'\\Delta^k f(x) = \\Delta^{k-1}f(x+h)-\\Delta^{k-1}f(x)'}</Tex>, with{' '}
        <Tex>{'f[x_0,\\dots,x_k] = \\dfrac{\\Delta^k f(x_0)}{k!\\,h^k}'}</Tex>. With <Tex>{'s = (x-x_0)/h'}</Tex>:
      </p>
      <Tex block>{'P_n(s) = f(x_0) + \\sum_{k=1}^{n}\\binom{s}{k}\\Delta^k f(x_0),\\qquad \\binom{s}{k} = \\frac{s(s-1)\\cdots(s-k+1)}{k!}'}</Tex>
      <Tex block>{'P_n(s) = f(x_0) + \\frac{s}{1}\\Big[\\Delta^1 f(x_0) + \\frac{s-1}{2}\\Big[\\Delta^2 f(x_0) + \\frac{s-2}{3}\\Big[\\cdots\\Big]\\Big]\\Big]'}</Tex>
      <p>
        <b>Backward</b>: <Tex>{'\\nabla^1 f(x) = f(x)-f(x-h)'}</Tex>, <Tex>{'\\nabla^k f(x) = \\nabla^{k-1}f(x)-\\nabla^{k-1}f(x-h)'}</Tex>. With{' '}
        <Tex>{'s = (x-x_n)/h \\le 0'}</Tex>:
      </p>
      <Tex block>{'P_n(s) = f(x_n) + \\sum_{k=1}^{n}(-1)^k\\binom{|s|}{k}\\nabla^k f(x_n) = f(x_n) - \\frac{|s|}{1}\\Big[\\nabla^1 f(x_n) - \\frac{|s|-1}{2}\\Big[\\nabla^2 f(x_n) - \\cdots\\Big]\\Big]'}</Tex>
      <p>
        (equivalent to <Tex>{'\\sum \\frac{s(s+1)\\cdots(s+k-1)}{k!}\\nabla^k f(x_n)'}</Tex>, the form used when <Tex>s&gt;0</Tex>). The backward table is the <b>same</b> as the
        forward one, because <Tex>{'\\nabla^k f(x_{i+k}) = \\Delta^k f(x_i)'}</Tex>: the forward formula uses the first row and the backward formula the last value of each column.
      </p>
      {APOYO}
      <p>
        Error estimate from the next data point (4.32): <Tex>{'R_m(x)\\approx \\binom{s}{m+1}\\Delta^{m+1}f(x_0)'}</Tex> (forward). Theoretical error:{' '}
        <Tex>{'R_n = \\frac{s(s-1)\\cdots(s-n)}{(n+1)!}h^{n+1}f^{(n+1)}(\\eta)'}</Tex>.
      </p>
    </>,
  ),
  'error-interpolacion': L(
    <>
      <p>
        El error del polinomio de interpolación es <Tex>{'R_n(x) = f(x) - P_n(x)'}</Tex>. Usando diferencias divididas se obtiene la expresión exacta{' '}
        <Tex>{'R_n(x) = \\prod_{i=0}^{n}(x-x_i)\\,f[x_0,\\dots,x_n,x]'}</Tex>, que no se puede evaluar porque contiene <Tex>f(x)</Tex>. El texto propone dos salidas:
      </p>
      <p>
        <b>1. Añadir un punto</b> <Tex>{'(x_{n+1}, f(x_{n+1}))'}</Tex> y reemplazar <Tex>x</Tex> por <Tex>{'x_{n+1}'}</Tex> en la diferencia dividida (4.31):
      </p>
      <Tex block>{'R_n(x) \\approx \\prod_{i=0}^{n}(x-x_i)\\;f[x_0,\\dots,x_n,x_{n+1}]'}</Tex>
      <p>
        <b>2. Usar la derivada.</b> Como <Tex>{'f[x_0,\\dots,x_k] = f^{(k)}(\\eta)/k!'}</Tex> para algún <Tex>\eta</Tex> entre los nodos (para <Tex>k=1</Tex> es el teorema del valor
        medio):
      </p>
      <Tex block>{ERROR_FORMULA}</Tex>
      <p>
        Como <Tex>\eta</Tex> es desconocido, se <b>mayora</b> reemplazando la derivada por el máximo de su valor absoluto (4.35):
      </p>
      <Tex block>{'|R_n(x)| \\le \\Big|\\prod_{i=0}^{n}(x-x_i)\\Big|\\,\\frac{\\max|f^{(n+1)}(\\eta)|}{(n+1)!},\\qquad \\eta\\in[\\min\\{x_i\\},\\max\\{x_i\\}]'}</Tex>
      <p>
        Esto exige conocer <Tex>f</Tex> para derivarla. Aquí la derivada de orden <Tex>n+1</Tex> se calcula exactamente (diferenciación automática) y su máximo se busca muestreando
        densamente el intervalo (que incluye a <Tex>x</Tex> si se extrapola). Con <Tex>{'\\min|f^{(n+1)}|'}</Tex> se obtiene además una cota inferior cuando la derivada no cambia de
        signo. El factor <Tex>{'\\prod(x-x_i)'}</Tex> explica por qué el error es menor cerca del centro de los datos y mayor cerca de los bordes.
      </p>
    </>,
    <>
      <p>
        The error of the interpolating polynomial is <Tex>{'R_n(x) = f(x) - P_n(x)'}</Tex>. Divided differences give the exact expression{' '}
        <Tex>{'R_n(x) = \\prod_{i=0}^{n}(x-x_i)\\,f[x_0,\\dots,x_n,x]'}</Tex>, which cannot be evaluated because it contains <Tex>f(x)</Tex>. The textbook offers two ways out:
      </p>
      <p>
        <b>1. Add a point</b> <Tex>{'(x_{n+1}, f(x_{n+1}))'}</Tex> and replace <Tex>x</Tex> with <Tex>{'x_{n+1}'}</Tex> in the divided difference (4.31):
      </p>
      <Tex block>{'R_n(x) \\approx \\prod_{i=0}^{n}(x-x_i)\\;f[x_0,\\dots,x_n,x_{n+1}]'}</Tex>
      <p>
        <b>2. Use the derivative.</b> Since <Tex>{'f[x_0,\\dots,x_k] = f^{(k)}(\\eta)/k!'}</Tex> for some <Tex>\eta</Tex> between the nodes (for <Tex>k=1</Tex> this is the mean value
        theorem):
      </p>
      <Tex block>{ERROR_FORMULA}</Tex>
      <p>
        Since <Tex>\eta</Tex> is unknown, the error is <b>bounded</b> by replacing the derivative with the maximum of its absolute value (4.35):
      </p>
      <Tex block>{'|R_n(x)| \\le \\Big|\\prod_{i=0}^{n}(x-x_i)\\Big|\\,\\frac{\\max|f^{(n+1)}(\\eta)|}{(n+1)!},\\qquad \\eta\\in[\\min\\{x_i\\},\\max\\{x_i\\}]'}</Tex>
      <p>
        This requires knowing <Tex>f</Tex> in order to differentiate it. Here the derivative of order <Tex>n+1</Tex> is computed exactly (automatic differentiation) and its maximum
        is found by densely sampling the interval (which includes <Tex>x</Tex> when extrapolating). With <Tex>{'\\min|f^{(n+1)}|'}</Tex> one also obtains a lower bound when the
        derivative does not change sign. The factor <Tex>{'\\prod(x-x_i)'}</Tex> explains why the error is smaller near the center of the data and larger near the ends.
      </p>
    </>,
  ),
  runge: L(
    <>
      <p>
        Aumentar el grado del polinomio de interpolación <b>no</b> basta para que el error tienda a cero en todo el intervalo. El ejemplo del texto (Figura 4.1) interpola{' '}
        <Tex>{'f(x)=\\frac{1}{1+x^2}'}</Tex> en <Tex>[-5,5]</Tex> con un polinomio de grado 10 y nodos equiespaciados: la aproximación es buena en el centro pero oscila fuertemente
        cerca de los extremos. Es el <b>fenómeno de Runge</b>, y empeora al subir el grado.
      </p>
      <p>
        La causa es el factor <Tex>{'\\prod(x-x_i)'}</Tex> de la fórmula del error, que con nodos equiespaciados es enorme cerca de los bordes. Dos remedios: la interpolación
        segmentaria (splines, Figura 4.2 del texto) y, como complemento (no está en el texto), los <b>nodos de Chebyshev</b>, que minimizan <Tex>{'\\max|\\prod(x-x_i)|'}</Tex>:
      </p>
      <Tex block>{'x_k = \\frac{a+b}{2} + \\frac{b-a}{2}\\cos\\!\\left(\\frac{(2k+1)\\pi}{2(n+1)}\\right),\\quad k=0,\\dots,n \\quad\\Rightarrow\\quad \\max_{[a,b]}\\Big|\\prod_{k=0}^n (x-x_k)\\Big| = 2\\Big(\\frac{b-a}{4}\\Big)^{n+1}'}</Tex>
    </>,
    <>
      <p>
        Increasing the degree of the interpolating polynomial is <b>not</b> enough to make the error go to zero over the whole interval. The textbook example (Figure 4.1)
        interpolates <Tex>{'f(x)=\\frac{1}{1+x^2}'}</Tex> on <Tex>[-5,5]</Tex> with a degree-10 polynomial and equally spaced nodes: the approximation is good in the middle but
        oscillates wildly near the endpoints. This is the <b>Runge phenomenon</b>, and it gets worse as the degree increases.
      </p>
      <p>
        The cause is the factor <Tex>{'\\prod(x-x_i)'}</Tex> in the error formula, which for equally spaced nodes is huge near the ends. Two remedies: piecewise interpolation
        (splines, Figure 4.2 of the textbook) and, as a complement (not in the textbook), <b>Chebyshev nodes</b>, which minimize <Tex>{'\\max|\\prod(x-x_i)|'}</Tex>:
      </p>
      <Tex block>{'x_k = \\frac{a+b}{2} + \\frac{b-a}{2}\\cos\\!\\left(\\frac{(2k+1)\\pi}{2(n+1)}\\right),\\quad k=0,\\dots,n \\quad\\Rightarrow\\quad \\max_{[a,b]}\\Big|\\prod_{k=0}^n (x-x_k)\\Big| = 2\\Big(\\frac{b-a}{4}\\Big)^{n+1}'}</Tex>
    </>,
  ),
  splines: L(
    <>
      <p>
        En vez de un polinomio de grado alto, se usa una cúbica distinta <Tex>{'S_i(x) = a_i + b_i x + c_i x^2 + d_i x^3'}</Tex> en cada subintervalo{' '}
        <Tex>{'[x_i,x_{i+1}]'}</Tex>, <Tex>{'i=0,\\dots,n-1'}</Tex>. Las <Tex>4n</Tex> incógnitas se fijan con: interpolación en los extremos de cada tramo y continuidad de{' '}
        <Tex>{"S'"}</Tex> y <Tex>{"S''"}</Tex> en los nodos interiores (<Tex>4n-2</Tex> condiciones), más <b>dos condiciones en los extremos</b>.
      </p>
      <p>
        <b>Construcción del texto.</b> Las incógnitas son las segundas derivadas <Tex>{"M_i = S''(x_i)"}</Tex>, con <Tex>{'h_i = x_{i+1}-x_i'}</Tex>. Como{' '}
        <Tex>{"S_i''"}</Tex> es una recta entre <Tex>{'(x_i,M_i)'}</Tex> y <Tex>{'(x_{i+1},M_{i+1})'}</Tex>, integrando dos veces y usando{' '}
        <Tex>{'S_i(x_i)=y_i'}</Tex>, <Tex>{'S_i(x_{i+1})=y_{i+1}'}</Tex>:
      </p>
      <Tex block>{'S_i(x) = \\frac{(x_{i+1}-x)^3M_i + (x-x_i)^3M_{i+1}}{6h_i} + \\frac{(x_{i+1}-x)\\,y_i + (x-x_i)\\,y_{i+1}}{h_i} - \\frac{h_i}{6}\\big[(x_{i+1}-x)M_i + (x-x_i)M_{i+1}\\big]'}</Tex>
      <p>
        La continuidad de <Tex>{"S'"}</Tex> en los nodos interiores da un sistema <b>tridiagonal</b> (se resuelve con el método de Thomas):
      </p>
      <Tex block>{'\\frac{h_{i-1}}{6}M_{i-1} + \\frac{h_{i-1}+h_i}{3}M_i + \\frac{h_i}{6}M_{i+1} = \\frac{y_{i+1}-y_i}{h_i} - \\frac{y_i-y_{i-1}}{h_{i-1}},\\qquad i=1,\\dots,n-1'}</Tex>
      <p>
        <b>Spline natural</b> (condición sobre la segunda derivada): <Tex>{'M_0 = M_n = 0'}</Tex>; quedan <Tex>n-1</Tex> ecuaciones. <b>Spline forzada</b> (condición sobre la
        primera derivada, <Tex>{"S'(x_0)=y'_0"}</Tex>, <Tex>{"S'(x_n)=y'_n"}</Tex>): se añaden
      </p>
      <Tex block>{"\\frac{h_0}{3}M_0 + \\frac{h_0}{6}M_1 = \\frac{y_1-y_0}{h_0} - y'_0,\\qquad \\frac{h_{n-1}}{6}M_{n-1} + \\frac{h_{n-1}}{3}M_n = y'_n - \\frac{y_n-y_{n-1}}{h_{n-1}}"}</Tex>
      <p>
        y el sistema es de <Tex>n+1</Tex> ecuaciones. El error de las splines cúbicas decrece como la cuarta potencia del tamaño de los subintervalos (para la forzada,{' '}
        <Tex>{'|f-S| \\le \\frac{5}{384}\\max|f^{(4)}|\\,\\max h_i^4'}</Tex>).
      </p>
      <p>
        <b>Opción «a, b, c, d (Burden)».</b> Burden & Faires escribe cada tramo como <Tex>{'a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3'}</Tex> y plantea el sistema para los{' '}
        <Tex>{'c_i'}</Tex>. Es la misma spline: <Tex>{'a_i = y_i'}</Tex>, <Tex>{'c_i = M_i/2'}</Tex>, <Tex>{'d_i = (M_{i+1}-M_i)/(6h_i)'}</Tex>.
      </p>
    </>,
    <>
      <p>
        Instead of a single high-degree polynomial, a different cubic <Tex>{'S_i(x) = a_i + b_i x + c_i x^2 + d_i x^3'}</Tex> is used on each subinterval{' '}
        <Tex>{'[x_i,x_{i+1}]'}</Tex>, <Tex>{'i=0,\\dots,n-1'}</Tex>. The <Tex>4n</Tex> unknowns are determined by: interpolation at both ends of each piece and continuity of{' '}
        <Tex>{"S'"}</Tex> and <Tex>{"S''"}</Tex> at the interior nodes (<Tex>4n-2</Tex> conditions), plus <b>two endpoint conditions</b>.
      </p>
      <p>
        <b>Textbook construction.</b> The unknowns are the second derivatives <Tex>{"M_i = S''(x_i)"}</Tex>, with <Tex>{'h_i = x_{i+1}-x_i'}</Tex>. Since{' '}
        <Tex>{"S_i''"}</Tex> is a straight line between <Tex>{'(x_i,M_i)'}</Tex> and <Tex>{'(x_{i+1},M_{i+1})'}</Tex>, integrating twice and using{' '}
        <Tex>{'S_i(x_i)=y_i'}</Tex>, <Tex>{'S_i(x_{i+1})=y_{i+1}'}</Tex>:
      </p>
      <Tex block>{'S_i(x) = \\frac{(x_{i+1}-x)^3M_i + (x-x_i)^3M_{i+1}}{6h_i} + \\frac{(x_{i+1}-x)\\,y_i + (x-x_i)\\,y_{i+1}}{h_i} - \\frac{h_i}{6}\\big[(x_{i+1}-x)M_i + (x-x_i)M_{i+1}\\big]'}</Tex>
      <p>
        Continuity of <Tex>{"S'"}</Tex> at the interior nodes gives a <b>tridiagonal</b> system (solved with the Thomas algorithm):
      </p>
      <Tex block>{'\\frac{h_{i-1}}{6}M_{i-1} + \\frac{h_{i-1}+h_i}{3}M_i + \\frac{h_i}{6}M_{i+1} = \\frac{y_{i+1}-y_i}{h_i} - \\frac{y_i-y_{i-1}}{h_{i-1}},\\qquad i=1,\\dots,n-1'}</Tex>
      <p>
        <b>Natural spline</b> (condition on the second derivative): <Tex>{'M_0 = M_n = 0'}</Tex>; <Tex>n-1</Tex> equations remain. <b>Clamped spline</b> (condition on the first
        derivative, <Tex>{"S'(x_0)=y'_0"}</Tex>, <Tex>{"S'(x_n)=y'_n"}</Tex>): the following are added
      </p>
      <Tex block>{"\\frac{h_0}{3}M_0 + \\frac{h_0}{6}M_1 = \\frac{y_1-y_0}{h_0} - y'_0,\\qquad \\frac{h_{n-1}}{6}M_{n-1} + \\frac{h_{n-1}}{3}M_n = y'_n - \\frac{y_n-y_{n-1}}{h_{n-1}}"}</Tex>
      <p>
        and the system has <Tex>n+1</Tex> equations. The error of cubic splines decreases like the fourth power of the subinterval length (for the clamped spline,{' '}
        <Tex>{'|f-S| \\le \\frac{5}{384}\\max|f^{(4)}|\\,\\max h_i^4'}</Tex>).
      </p>
      <p>
        <b>Option “a, b, c, d (Burden)”.</b> Burden & Faires writes each piece as <Tex>{'a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3'}</Tex> and sets up the system for the{' '}
        <Tex>{'c_i'}</Tex>. It is the same spline: <Tex>{'a_i = y_i'}</Tex>, <Tex>{'c_i = M_i/2'}</Tex>, <Tex>{'d_i = (M_{i+1}-M_i)/(6h_i)'}</Tex>.
      </p>
    </>,
  ),
}
