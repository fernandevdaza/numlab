import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import type { RootKind } from './RootSolver'

// Notación del texto de la materia (Cap. 2): α es la raíz buscada, EPS la precisión, x_I / x_D los extremos
// izquierdo y derecho de un intervalo con cambio de signo y x_M su punto medio.

export const TOPIC = 'Tema 2 · Ecuaciones no lineales'

export const TITLES: Record<RootKind, string> = {
  biseccion: 'Método de la bisección',
  'punto-fijo': 'Método del punto fijo',
  aitken: 'Método de Aitken (Δ²)',
  steffensen: 'Método de Steffensen',
  newton: 'Método de Newton-Raphson',
  secante: 'Método de la secante',
  'posicion-falsa': 'Método de la posición falsa',
  'newton-mod': 'Método de Newton modificado (raíces múltiples)',
}

export const DESCRIPTIONS: Record<RootKind, string> = {
  biseccion: 'Parte a la mitad un intervalo con cambio de signo hasta encerrar la raíz con la precisión EPS pedida.',
  'punto-fijo': 'Reescribe f(x) = 0 como x = g(x) e itera xₙ₊₁ = g(xₙ); converge si |g′| < 1 cerca de la raíz.',
  aitken: 'Acelera una sucesión de punto fijo de convergencia lineal usando tres términos consecutivos.',
  steffensen: 'Punto fijo + Aitken, reiniciando con cada valor acelerado: convergencia cuadrática sin derivadas.',
  newton: 'Sigue la recta tangente hasta el eje x; convergencia cuadrática cerca de una raíz simple.',
  secante: 'Como Newton, pero la tangente se reemplaza por la secante que pasa por las dos últimas aproximaciones.',
  'posicion-falsa': 'Variante de la secante que conserva siempre un intervalo [x_I, x_D] con cambio de signo.',
  'newton-mod': 'Recupera la convergencia cuadrática de Newton en raíces de multiplicidad m > 1.',
}

/** Criterio de parada común (relación 2.3 del texto). */
const Parada = ({ x = 'x_n' }: { x?: string }) => (
  <p>
    <b>Criterio de parada (2.3):</b> se detiene en la iteración <Tex>n</Tex> si <Tex>{`|f(${x})| \\le EPS`}</Tex> <b>o</b>{' '}
    <Tex>{`|x_n - x_{n-1}| \\le EPS`}</Tex> (basta una de las dos; la primera pide que la ecuación se cumpla casi exactamente, la segunda que dos aproximaciones sucesivas estén a distancia
    menor que EPS). Es la opción por defecto; también puedes usar una sola de ellas.
  </p>
)

export const THEORY: Record<RootKind, ReactNode> = {
  biseccion: (
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
    </>
  ),
  'punto-fijo': (
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
    </>
  ),
  aitken: (
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
    </>
  ),
  steffensen: (
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
    </>
  ),
  newton: (
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
    </>
  ),
  secante: (
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
    </>
  ),
  'posicion-falsa': (
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
    </>
  ),
  'newton-mod': (
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
    </>
  ),
}
