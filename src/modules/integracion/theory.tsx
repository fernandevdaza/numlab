import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'

export type IntId = 'derivadas' | 'trapecio' | 'simpson' | 'newton-cotes' | 'romberg' | 'gauss-legendre' | 'integrales-dobles' | 'comparar-integracion'

export const TOPIC = 'Tema 5 · Derivación e integración numérica'

/** Títulos de página (el menú usa versiones cortas en index.ts). */
export const TITLES: Record<IntId, string> = {
  derivadas: 'Derivación por diferencias finitas',
  trapecio: 'Regla del trapecio (simple y compuesta)',
  simpson: 'Regla de Simpson (simple y compuesta)',
  'newton-cotes': 'Newton-Cotes: todas las reglas cerradas',
  romberg: 'Método de Romberg-Richardson',
  'gauss-legendre': 'Cuadratura de Gauss-Legendre',
  'integrales-dobles': 'Integrales dobles (método iterado)',
  'comparar-integracion': 'Comparar métodos de integración',
}

const NC_INTRO = (
  <p>
    Idea de Newton-Cotes (sección 5.2 del texto): se divide <Tex>[a,b]</Tex> en subintervalos de igual tamaño, se reemplaza <Tex>f</Tex> por su polinomio de interpolación de diferencias
    finitas de avance <Tex>{'P_n(x)=f(x_0)+\\sum_{i=1}^{n}\\binom{s}{i}\\Delta^i f(x_0)'}</Tex>, con <Tex>{'s=(x-x_0)/h'}</Tex>, y se integra ese polinomio en lugar de <Tex>f</Tex>.
  </p>
)

export const THEORY: Record<IntId, ReactNode> = {
  derivadas: (
    <>
      <p>
        <b>Método basado en la serie de Taylor</b> (sección 5.5.2). Con paso <Tex>h</Tex>:
      </p>
      <Tex block>{"f(x\\pm h) = f(x) \\pm h f'(x) + \\frac{h^2}{2!}f''(x) \\pm \\frac{h^3}{3!}f'''(x) + \\cdots \\qquad (5.43)"}</Tex>
      <p>Despejando <Tex>{"f'(x)"}</Tex> se obtienen las fórmulas del texto (a la derecha, el error de la aproximación respecto al valor exacto):</p>
      <Tex block>{"\\begin{aligned} &\\text{Avance (5.44): } & f'_a(x,h) &= \\frac{f(x+h)-f(x)}{h}, & f'_a - f' &\\approx \\tfrac{h}{2}f''(x)\\\\ &\\text{Retroceso (5.45): } & f'_r(x,h) &= \\frac{f(x)-f(x-h)}{h}, & f'_r - f' &\\approx -\\tfrac{h}{2}f''(x)\\\\ &\\text{Central (5.46): } & f'_c(x,h) &= \\frac{f(x+\\frac h2)-f(x-\\frac h2)}{h}, & f'_c - f' &\\approx \\tfrac{h^2}{24}f'''(x)\\\\ &\\text{Extrapolada (5.47): } & f'_e(x,h) &= \\frac{8[f(x+\\frac h4)-f(x-\\frac h4)]-[f(x+\\frac h2)-f(x-\\frac h2)]}{3h}, & f'_e - f' &\\approx -\\tfrac{h^4}{120\\cdot 64}f^{(5)}(x)\\end{aligned}"}</Tex>
      <p>
        Avance y retroceso tienen error proporcional a <Tex>h</Tex>; la central, a <Tex>h^2</Tex> (usa los puntos <Tex>{'x\\pm h/2'}</Tex>, simétricos respecto a <Tex>x</Tex>); la extrapolada
        combina dos centrales para cancelar el término en <Tex>h^2</Tex> y queda un error proporcional a <Tex>h^4</Tex>. Nota: en el recuadro de (5.45) del texto aparece un signo «−» delante
        de la fracción; es una errata (el Ej. 5.8 usa la fórmula sin ese signo).
      </p>
      <p>
        <b>Método basado en interpolación</b> (5.5.3): se deriva el polinomio de interpolación. Con grado 1 por <Tex>{'(x-\\frac h2, f)'}</Tex> y <Tex>{'(x+\\frac h2, f)'}</Tex>{' '}
        la derivada del polinomio es <Tex>{'f[x_0,x_1]'}</Tex>, que coincide con la fórmula central (Ej. 5.9). Conviene que <Tex>x</Tex> quede centrado en los datos.
      </p>
      <p>
        <b>Segunda derivada por coeficientes indeterminados</b> (5.5.4): se busca <Tex>{"f''(x)\\approx Af(x+h)+Bf(x)+Cf(x-h)"}</Tex> e igualando coeficientes en la serie de Taylor
        (<Tex>{'A+B+C=0'}</Tex>, <Tex>{'A-C=0'}</Tex>, <Tex>{'h^2(A+C)/2=1'}</Tex>):
      </p>
      <Tex block>{"f''(x)\\approx\\frac{f(x+h)-2f(x)+f(x-h)}{h^2}\\;(5.49),\\qquad E=-\\frac{h^2}{12}f^{(4)}(\\eta),\\quad |E|\\le\\frac{h^2}{12}\\max_{x-h\\le z\\le x+h}|f^{(4)}(z)|"}</Tex>
      <p>
        En la aplicación el término de error se escribe siempre como <Tex>{'E = \\text{exacto} - \\text{aproximado}'}</Tex> (así lo hace el texto para la segunda derivada y para las
        integrales), y la <b>mayoración</b> usa el máximo de la derivada en el intervalo que cubren los nodos, como en el Ej. 5.10. La lista incluye, como opción, otras fórmulas de
        Burden/Chapra; por ejemplo la centrada con paso <Tex>h</Tex>, <Tex>{'[f(x+h)-f(x-h)]/(2h)'}</Tex>, es la central del texto con <Tex>{'h\\to 2h'}</Tex>.
      </p>
      <p>
        <b>Truncamiento vs. redondeo.</b> La diferenciación numérica es delicada: al restar valores cercanos de <Tex>f</Tex> el error de redondeo crece como{' '}
        <Tex>{'\\varepsilon|f|/h^k'}</Tex>, así que no se puede tomar <Tex>h</Tex> arbitrariamente pequeño. Para la central, por ejemplo,
      </p>
      <Tex block>{"E(h) \\approx \\frac{h^2}{24}|f'''| + \\frac{2\\varepsilon|f|}{h} \\quad\\Longrightarrow\\quad h_{\\text{ópt}} = \\left(\\frac{24\\,\\varepsilon|f|}{|f'''|}\\right)^{1/3}"}</Tex>
      <p>Por debajo de ese valor el resultado <b>empeora</b>: en la gráfica log-log se ve una “V”.</p>
      <p>
        <b>Extrapolación de Richardson:</b> si <Tex>{'D(h)=f\'+c_1h^p+c_2h^{p+s}+\\cdots'}</Tex>, combinar <Tex>D(h)</Tex> y <Tex>D(h/2)</Tex> elimina el término dominante; aplicado a la
        central (<Tex>{'p=2'}</Tex>) da exactamente la fórmula extrapolada:
      </p>
      <Tex block>{'N_j(h) = N_{j-1}(h/2) + \\frac{N_{j-1}(h/2) - N_{j-1}(h)}{2^{p+s(j-1)}-1}'}</Tex>
    </>
  ),
  trapecio: (
    <>
      {NC_INTRO}
      <p>
        <b>Caso n = 1 (5.2.1).</b> El polinomio es la recta por <Tex>{'(a,f(a))'}</Tex> y <Tex>{'(b,f(b))'}</Tex>:
      </p>
      <Tex block>{"\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\big[f(x_0)+f(x_1)\\big],\\; h=b-a \\;\\;(5.8),\\qquad E_1=-\\frac{1}{12}(b-a)^3f''(\\eta)\\;\\;(5.9)"}</Tex>
      <p>
        El error depende del cubo del largo del intervalo, por eso en la práctica se usa la <b>fórmula compuesta</b>: se divide <Tex>[a,b]</Tex> en <Tex>N</Tex> subintervalos de tamaño{' '}
        <Tex>{'H=(b-a)/N'}</Tex> y se aplica el trapecio en cada uno:
      </p>
      <Tex block>{"\\int_a^b f(x)\\,dx \\approx \\frac{H}{2}\\Big[f(a)+2\\sum_{k=1}^{N-1}f(x_k)+f(b)\\Big]\\;\\;(5.11),\\qquad E_N=-\\frac{H^2}{12}(b-a)f''(\\eta)\\;\\;(5.12)"}</Tex>
      <p>
        Como <Tex>\eta</Tex> es desconocido se usa la <b>mayoración</b> (5.13):
      </p>
      <Tex block>{"|E_N|\\le\\frac{H^2}{12}(b-a)\\max_{x\\in[a,b]}|f''(x)|"}</Tex>
      <p>
        El error baja como <Tex>{'1/N^2'}</Tex>, a costa de más evaluaciones de <Tex>f</Tex>. La fórmula es exacta para polinomios de grado ≤ 1. Con <b>datos no equiespaciados</b> se
        suma el área de cada trapecio (5.14): <Tex>{'\\sum_{k}\\frac{x_{k+1}-x_k}{2}[f(x_k)+f(x_{k+1})]'}</Tex>.
      </p>
      <p className="muted">
        Aquí <Tex>M=\max|f''|</Tex> se estima muestreando la segunda derivada simbólica en 600 puntos.
      </p>
    </>
  ),
  simpson: (
    <>
      {NC_INTRO}
      <p>
        <b>Caso n = 2 (5.2.2).</b> Parábola por <Tex>{'a'}</Tex>, <Tex>{'(a+b)/2'}</Tex> y <Tex>b</Tex>; al integrarla con{' '}
        <Tex>{'\\Delta^2 f(x_0)=f(x_2)-2f(x_1)+f(x_0)'}</Tex> resulta
      </p>
      <Tex block>{"\\int_a^b f(x)\\,dx \\approx \\frac{h}{3}\\Big[f(a)+4f\\big(\\tfrac{a+b}{2}\\big)+f(b)\\Big],\\; h=\\frac{b-a}{2}\\;\\;(5.18),\\qquad E_2=-\\frac{1}{90}\\Big(\\frac{b-a}{2}\\Big)^5f^{(4)}(\\eta)\\;\\;(5.19)"}</Tex>
      <p>
        <b>Fórmula compuesta:</b> se divide <Tex>[a,b]</Tex> en un número <b>par</b> <Tex>2N</Tex> de subintervalos, <Tex>{'H=(b-a)/(2N)'}</Tex>, y se aplica Simpson a cada par:
      </p>
      <Tex block>{"\\int_a^b f(x)\\,dx \\approx \\frac{H}{3}\\Big[f(a)+4\\sum_{k=0}^{N-1}f(x_{2k+1})+2\\sum_{k=0}^{N-2}f(x_{2k+2})+f(b)\\Big]\\;\\;(5.21)"}</Tex>
      <Tex block>{"E_{2N}=-\\frac{H^4}{180}(b-a)f^{(4)}(\\eta)\\;\\;(5.22),\\qquad |E_{2N}|\\le\\frac{H^4}{180}(b-a)\\max_{x\\in[a,b]}|f^{(4)}(x)|\\;\\;(5.23)"}</Tex>
      <p>
        El error baja como <Tex>{'1/N^4'}</Tex> y la fórmula es exacta para polinomios de grado ≤ 3 (orden de precisión 3). Atención a la notación: en el texto <Tex>N</Tex> es el
        número de <i>pares</i> de subintervalos (el Ej. 5.2 usa <Tex>N=3</Tex>, es decir 6 subintervalos).
      </p>
    </>
  ),
  'newton-cotes': (
    <>
      {NC_INTRO}
      <p>
        El texto desarrolla los casos <Tex>n=1</Tex> (trapecio) y <Tex>n=2</Tex> (Simpson) y advierte que para <Tex>{'n>2'}</Tex> la interpolación de grado alto no es aconsejable. Como
        referencia (Burden, Chapra), las reglas cerradas simples de grado 1 a 4 y sus errores son:
      </p>
      <Tex block>{"\\begin{aligned} \\text{Trapecio: } & \\tfrac{h}{2}[f_0+f_1] & E&=-\\tfrac{h^3}{12}f''(\\eta)\\\\ \\text{Simpson 1/3: } & \\tfrac{h}{3}[f_0+4f_1+f_2] & E&=-\\tfrac{h^5}{90}f^{(4)}(\\eta)\\\\ \\text{Simpson 3/8: } & \\tfrac{3h}{8}[f_0+3f_1+3f_2+f_3] & E&=-\\tfrac{3h^5}{80}f^{(4)}(\\eta)\\\\ \\text{Boole: } & \\tfrac{2h}{45}[7f_0+32f_1+12f_2+32f_3+7f_4] & E&=-\\tfrac{8h^7}{945}f^{(6)}(\\eta)\\end{aligned}"}</Tex>
      <p>
        Las <b>compuestas</b> aplican la regla simple en cada bloque de <Tex>n</Tex> subintervalos: el número total de subintervalos debe ser múltiplo de 1, 2, 3 o 4 según la regla. Con
        paso <Tex>h=(b-a)/n</Tex> el error es <Tex>{'-C(b-a)h^p f^{(p)}(\\eta)'}</Tex> con <Tex>{'(C,p)=(\\tfrac1{12},2),(\\tfrac1{180},4),(\\tfrac1{80},4),(\\tfrac2{945},6)'}</Tex>.
      </p>
      <p>
        <b>Mayoración:</b> <Tex>{'|E| \\le C(b-a)h^p\\,M'}</Tex> con <Tex>{'M = \\max_{[a,b]}|f^{(p)}(x)|'}</Tex>, estimado muestreando la derivada simbólica.
      </p>
    </>
  ),
  romberg: (
    <>
      <p>
        <b>Idea</b> (5.2.3). El error de las fórmulas compuestas tiene la forma <Tex>{'E(h)=Ch^kf^{(k)}(\\eta)'}</Tex>, con <Tex>k=2</Tex> para el trapecio y <Tex>k=4</Tex> para
        Simpson. Si <Tex>I_1</Tex> e <Tex>I_2</Tex> se calculan con <Tex>{'h_1=2h_2'}</Tex> y <Tex>{'f^{(k)}'}</Tex> no varía bruscamente, eliminando <Tex>C</Tex> se obtiene la
        fórmula de Romberg:
      </p>
      <Tex block>{'I\\approx\\frac{2^kI_2-I_1}{2^k-1}\\;\\;(5.27)\\qquad\\xrightarrow{\\;k=2\\;}\\qquad I\\approx\\frac{4I_2-I_1}{4-1}\\;\\;(5.28)'}</Tex>
      <p>
        <b>Extrapolación de Richardson.</b> Se parte de <Tex>{'I_k^{(0)}'}</Tex>, el trapecio compuesto con <Tex>{'n=2^k'}</Tex> subintervalos (<Tex>{'h_k=(b-a)/2^k'}</Tex>),{' '}
        <Tex>{'k=0,\\dots,k_{\\max}'}</Tex>, y se generan nuevas columnas:
      </p>
      <Tex block>{'I_k^{(m)}=\\frac{4^m I_{k+1}^{(m-1)}-I_k^{(m-1)}}{4^m-1},\\qquad m=1,\\dots,k_{\\max},\\;\\;k=0,\\dots,k_{\\max}-m\\;\\;(5.29)'}</Tex>
      <p>
        La mejor estimación es <Tex>{'I_0^{(k_{\\max})}'}</Tex> y sólo cuesta las <Tex>{'2^{k_{\\max}}+1'}</Tex> evaluaciones de la última columna de trapecios. La columna{' '}
        <Tex>{'m=1'}</Tex> coincide con Simpson. Para no repetir evaluaciones, cada trapecio se obtiene del anterior sumando sólo los puntos nuevos:
      </p>
      <Tex block>{'I_k^{(0)} = \\tfrac12 I_{k-1}^{(0)} + h_k\\sum_{i=1}^{2^{k-1}} f\\big(a + (2i-1)h_k\\big)'}</Tex>
      <p>
        El texto fija <Tex>{'k_{\\max}'}</Tex>; opcionalmente se puede detener antes cuando <Tex>{'|I_0^{(k)}-I_0^{(k-1)}|<\\text{tol}'}</Tex>. Burden escribe la misma tabla como{' '}
        <Tex>{'R_{k,j}=I_{k-j}^{(j)}'}</Tex> (triangular inferior).
      </p>
    </>
  ),
  'gauss-legendre': (
    <>
      <p>
        <b>Idea</b> (5.3): en lugar de fijar los nodos en los extremos (trapecio), se eligen nodos y pesos para que la fórmula sea exacta en polinomios del mayor grado posible.
      </p>
      <p>
        <b>1) Cambio de variable</b> de <Tex>[a,b]</Tex> a <Tex>[-1,1]</Tex> (5.30):
      </p>
      <Tex block>{'\\int_a^b f(x)\\,dx=\\int_{-1}^{1}F(z)\\,dz,\\qquad x=\\frac{b-a}{2}z+\\frac{b+a}{2},\\qquad F(z)=\\frac{b-a}{2}f\\Big(\\frac{b-a}{2}z+\\frac{b+a}{2}\\Big)'}</Tex>
      <p>
        <b>2) Fórmula de orden n</b> (5.31): <Tex>{'\\int_{-1}^{1}F(z)\\,dz\\approx\\sum_{i=1}^{n}w_{n,i}F(z_{n,i})'}</Tex>, con pesos <Tex>{'w_{n,i}>0'}</Tex> y nodos{' '}
        <Tex>{'z_{n,i}'}</Tex>.
      </p>
      <p>
        <b>3) Condiciones:</b> basta exigir exactitud en los monomios <Tex>{'z^k'}</Tex>, <Tex>{'k=0,\\dots,2n-1'}</Tex> (5.37):{' '}
        <Tex>{'\\sum_i w_{n,i}z_{n,i}^k = \\frac{2}{k+1}'}</Tex> si <Tex>k</Tex> es par y <Tex>0</Tex> si es impar. Con <Tex>n=1</Tex>: <Tex>{'w=2,\\ z=0'}</Tex> (método del punto
        medio); con <Tex>n=2</Tex>: <Tex>{'w=1,\\ z=\\pm1/\\sqrt3'}</Tex>.
      </p>
      <p>
        <b>Caso general.</b> Los nodos son las raíces del polinomio de Legendre de grado <Tex>n</Tex> y los pesos salen de (5.39):
      </p>
      <Tex block>{"P_0=1,\\; P_1=z,\\; P_n(z)=\\frac{2n-1}{n}zP_{n-1}(z)-\\frac{n-1}{n}P_{n-2}(z)\\;\\;(5.38),\\qquad w_{n,i}=\\frac{-2}{(n+1)P_n'(z_{n,i})P_{n+1}(z_{n,i})}\\;\\;(5.39)"}</Tex>
      <p>
        El orden de precisión es <Tex>m=2n-1</Tex>. Como la fórmula no usa los extremos, sirve también con singularidades integrables en <Tex>a</Tex> o <Tex>b</Tex>. Como referencia
        (no aparece en el texto), el error es <Tex>{'E_n=\\frac{(b-a)^{2n+1}(n!)^4}{(2n+1)[(2n)!]^3}f^{(2n)}(\\xi)'}</Tex>.
      </p>
    </>
  ),
  'integrales-dobles': (
    <>
      <p>
        <b>Método general</b> (5.4): una integral doble se escribe como una integral simple de una función que a su vez está definida por otra integral simple:
      </p>
      <Tex block>{'\\iint_D f(x,y)\\,dx\\,dy=\\int_a^b h(x)\\,dx,\\qquad h(x)=\\int_{\\phi_1(x)}^{\\phi_2(x)}f_x(y)\\,dy,\\quad f_x(y)=f(x,y)\\;\\;(5.41)'}</Tex>
      <p>
        con <Tex>{'D=\\{a\\le x\\le b,\\ \\phi_1(x)\\le y\\le\\phi_2(x)\\}'}</Tex>. Cada integral simple se aproxima con cualquiera de los métodos del tema.
      </p>
      <p>
        <b>Con Gauss-Legendre</b> (5.42), el método que usa el texto: orden <Tex>n</Tex> en la integral exterior y orden <Tex>m</Tex> en la interior,
      </p>
      <Tex block>{'\\int_a^b h(x)\\,dx\\approx\\sum_{i=1}^{n}w_{n,i}H(z_{n,i}),\\qquad H(z)=\\frac{b-a}{2}\\,h\\Big(\\frac{b-a}{2}z+\\frac{b+a}{2}\\Big)'}</Tex>
      <Tex block>{'h(x)\\approx\\sum_{j=1}^{m}w_{m,j}F_x(z_{m,j}),\\qquad F_x(z)=\\frac{\\phi_2(x)-\\phi_1(x)}{2}\\,f_x\\Big(\\frac{\\phi_2(x)-\\phi_1(x)}{2}z+\\frac{\\phi_2(x)+\\phi_1(x)}{2}\\Big)'}</Tex>
      <p>
        El texto recomienda un orden mayor para la integral interior (la que define <Tex>h(x)</Tex>). Como opción se puede usar trapecio o Simpson compuestos en cada dirección; su
        error es <Tex>{'O(H^2+K^2)'}</Tex> y <Tex>{'O(H^4+K^4)'}</Tex> respectivamente para <Tex>f</Tex> suave.
      </p>
    </>
  ),
  'comparar-integracion': (
    <>
      <p>Resumen de órdenes de convergencia para integrandos suaves:</p>
      <Tex block>{'\\begin{array}{lcc} \\text{Método} & \\text{Error} & \\text{Orden de precisión}\\\\ \\hline \\text{Trapecio compuesto} & O(H^2) & 1\\\\ \\text{Simpson 1/3 y 3/8} & O(H^4) & 3\\\\ \\text{Boole} & O(H^6) & 5\\\\ \\text{Romberg } I_0^{(k)} & O(h_0^{2k+2}) & 2k+1\\\\ \\text{Gauss-Legendre de orden } n & \\text{exponencial en } n & 2n-1 \\end{array}'}</Tex>
      <p>En una gráfica log-log del error contra el número de evaluaciones, las fórmulas de Newton-Cotes son rectas de pendiente −p; Gauss cae mucho más rápido para funciones analíticas.</p>
    </>
  ),
}
