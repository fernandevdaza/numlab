import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'

export type InterpKind = 'lagrange' | 'diferencias-divididas' | 'diferencias-finitas' | 'error-interpolacion' | 'runge' | 'splines'

export const TOPIC = 'Tema 4 · Interpolación'

export const TITLES: Record<InterpKind, string> = {
  lagrange: 'Polinomio de interpolación de Lagrange',
  'diferencias-divididas': 'Polinomio de Newton: diferencias divididas',
  'diferencias-finitas': 'Polinomio de Newton: diferencias finitas',
  'error-interpolacion': 'Estimación del error de interpolación',
  runge: 'Fenómeno de Runge',
  splines: 'Interpolación segmentaria: splines cúbicas',
}

/** Títulos del menú lateral (≤ 32 caracteres). */
export const SHORT: Record<InterpKind, string> = {
  lagrange: 'Polinomio de Lagrange',
  'diferencias-divididas': 'Diferencias divididas',
  'diferencias-finitas': 'Diferencias finitas',
  'error-interpolacion': 'Estimación del error',
  runge: 'Fenómeno de Runge',
  splines: 'Splines cúbicas',
}

/** Descripción de una línea (menú, tarjetas y buscador). */
export const SUMMARY: Record<InterpKind, string> = {
  lagrange: 'Polinomio interpolante como combinación de los polinomios base L_i(x).',
  'diferencias-divididas': 'Polinomio de Newton de avance o retroceso con la tabla de diferencias divididas.',
  'diferencias-finitas': 'Nodos equiespaciados: fórmulas de avance (Δ) y retroceso (∇) en la variable s.',
  'error-interpolacion': 'Error con un punto adicional y cota con el máximo de |f⁽ⁿ⁺¹⁾|.',
  runge: 'Oscilaciones del polinomio de grado alto con nodos equiespaciados.',
  splines: 'Cúbicas por tramos con condición natural (M₀ = Mₙ = 0) o forzada (f′ en los extremos).',
}

const ERROR_FORMULA = 'R_n(x) = f(x) - P_n(x) = \\prod_{i=0}^{n}(x-x_i)\\,\\frac{f^{(n+1)}(\\eta)}{(n+1)!},\\qquad \\eta\\in[\\min\\{x, x_i\\},\\max\\{x, x_i\\}]'

const APOYO = (
  <p>
    <b>Polinomio «apoyado» en <Tex>x_k</Tex>:</b> con la misma tabla se pueden construir polinomios de menor grado <Tex>m</Tex> que usan sólo parte de los datos. El de
    avance apoyado en <Tex>x_k</Tex> usa <Tex>{'x_k, x_{k+1}, \\dots, x_{k+m}'}</Tex>; el de retroceso apoyado en <Tex>x_k</Tex> usa <Tex>{'x_k, x_{k-1}, \\dots, x_{k-m}'}</Tex>. Si
    faltan datos en esa dirección, el polinomio no se puede construir. Conviene elegir el apoyo de modo que <Tex>x</Tex> quede rodeado de nodos cercanos.
  </p>
)

export const THEORY: Record<InterpKind, ReactNode> = {
  lagrange: (
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
    </>
  ),
  'diferencias-divididas': (
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
    </>
  ),
  'diferencias-finitas': (
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
    </>
  ),
  'error-interpolacion': (
    <>
      <p>
        El error del polinomio de interpolación es <Tex>{'R_n(x) = f(x) - P_n(x)'}</Tex>. Usando diferencias divididas se obtiene la expresión exacta{' '}
        <Tex>{'R_n(x) = \\prod_{i=0}^{n}(x-x_i)\\,f[x_0,\\dots,x_n,x]'}</Tex>, que no se puede evaluar porque contiene <Tex>f(x)</Tex>. El texto propone dos salidas:
      </p>
      <p>
        <b>1. Añadir un punto</b> <Tex>{'(x_{n+1}, f(x_{n+1}))'}</Tex> y reemplazar <Tex>x</Tex> por <Tex>{'x_{n+1}'}</Tex> en la diferencia dividida (4.31):
      </p>
      <Tex block>{'R_n(x) \\approx \\prod_{i=0}^{n}(x-x_i)\;f[x_0,\\dots,x_n,x_{n+1}]'}</Tex>
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
    </>
  ),
  runge: (
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
    </>
  ),
  splines: (
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
    </>
  ),
}
