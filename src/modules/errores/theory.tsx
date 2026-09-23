import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'

export const TOPIC = L('Tema 1 · Representación de números y errores', 'Topic 1 · Number representation and errors')

export type ErrKind = 'ieee754' | 'conversion' | 'sistema-f' | 'epsilon' | 'errores' | 'propagacion' | 'condicion' | 'cancelacion' | 'estabilidad' | 'taylor'

export const TITLES: Record<ErrKind, string> = {
  ieee754: L('Estándar IEEE 754', 'IEEE 754 standard'),
  conversion: L('Sistemas numéricos y conversión de bases', 'Number systems and base conversion'),
  'sistema-f': L('Sistema de punto flotante F(β, t, L, U)', 'Floating-point system F(β, t, L, U)'),
  epsilon: L('Épsilon de máquina', 'Machine epsilon'),
  errores: L('Error absoluto, relativo y cifras significativas', 'Absolute and relative error, significant digits'),
  propagacion: L('Propagación de errores', 'Error propagation'),
  condicion: L('Número de condición y estabilidad matemática', 'Condition number and mathematical stability'),
  cancelacion: L('Cancelación catastrófica', 'Catastrophic cancellation'),
  estabilidad: L('Estabilidad numérica de algoritmos', 'Numerical stability of algorithms'),
  taylor: L('Series de Taylor y error de truncamiento', 'Taylor series and truncation error'),
}

const THEORY_ES: Record<ErrKind, ReactNode> = {
  ieee754: (
    <>
      <p>
        Un número en punto flotante binario se guarda como tres campos: <b>signo</b> <Tex>s</Tex>, <b>exponente sesgado</b> <Tex>E</Tex> (<Tex>w</Tex> bits) y{' '}
        <b>fracción</b> <Tex>f</Tex> (<Tex>m</Tex> bits). Para números <b>normales</b> (<Tex>{'0 < E < 2^w-1'}</Tex>) el primer bit de la mantisa es un 1 implícito que no se guarda:
      </p>
      <Tex block>{'x = (-1)^s \\times (1.f)_2 \\times 2^{E - \\text{sesgo}}, \\qquad \\text{sesgo} = 2^{w-1}-1'}</Tex>
      <table className="err-mini">
        <thead>
          <tr>
            <th>Formato</th>
            <th>Total</th>
            <th>Signo</th>
            <th>Exponente w</th>
            <th>Fracción m</th>
            <th>Sesgo</th>
            <th>ε = 2^(−m)</th>
            <th>Cifras decimales ≈</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Media (float16, GPUs / IA)</td>
            <td>16</td>
            <td>1</td>
            <td>5</td>
            <td>10</td>
            <td>15</td>
            <td>9.77 × 10⁻⁴</td>
            <td>3</td>
          </tr>
          <tr>
            <td>Simple (float32)</td>
            <td>32</td>
            <td>1</td>
            <td>8</td>
            <td>23</td>
            <td>127</td>
            <td>1.19 × 10⁻⁷</td>
            <td>7</td>
          </tr>
          <tr>
            <td>Doble (float64, Scilab)</td>
            <td>64</td>
            <td>1</td>
            <td>11</td>
            <td>52</td>
            <td>1023</td>
            <td>2.22 × 10⁻¹⁶</td>
            <td>15–16</td>
          </tr>
        </tbody>
      </table>
      <p>Valores especiales según el campo de exponente:</p>
      <ul>
        <li>
          <Tex>E = 0,\ f = 0</Tex>: <b>±0</b> (existe el cero con signo).
        </li>
        <li>
          <Tex>{'E = 0,\\ f \\ne 0'}</Tex>: <b>subnormales</b> <Tex>{'x = (-1)^s (0.f)_2 \\times 2^{1-\\text{sesgo}}'}</Tex> (llenan el hueco entre 0 y el menor normal: <i>underflow gradual</i>).
        </li>
        <li>
          <Tex>{'E = 2^w-1,\\ f = 0'}</Tex>: <b>±∞</b> (overflow, <Tex>1/0</Tex>).
        </li>
        <li>
          <Tex>{'E = 2^w-1,\\ f \\ne 0'}</Tex>: <b>NaN</b> (<Tex>0/0</Tex>, <Tex>{'\\infty-\\infty'}</Tex>, <Tex>{'\\sqrt{-1}'}</Tex> en reales).
        </li>
      </ul>
      <p>
        Todo real <Tex>x</Tex> se guarda como <Tex>{'fl(x)'}</Tex>, el flotante más cercano (redondeo al par en empates), con error relativo acotado por la <b>unidad de redondeo</b>:
      </p>
      <Tex block>{'fl(x) = x(1+\\delta),\\qquad |\\delta| \\le u = \\tfrac{1}{2}\\varepsilon_{mach} = 2^{-(m+1)}'}</Tex>
      <p>
        Por eso <Tex>0.1</Tex> no es exactamente representable: en binario es periódico <Tex>{'(0.0\\overline{0011})_2'}</Tex> y se corta a 52 bits.
      </p>
    </>
  ),
  conversion: (
    <>
      <p>
        <b>Parte entera → base β:</b> divisiones sucesivas entre β; los <b>residuos</b> leídos de abajo hacia arriba son los dígitos.
      </p>
      <p>
        <b>Parte fraccionaria → base β:</b> multiplicaciones sucesivas por β; la <b>parte entera</b> de cada producto es el siguiente dígito, y se continúa con la parte fraccionaria:
      </p>
      <Tex block>{'r_0 = \\text{frac}(x),\\qquad \\beta\\, r_k = d_{k+1} + r_{k+1},\\quad d_{k+1} = \\lfloor \\beta r_k \\rfloor'}</Tex>
      <p>
        Si algún <Tex>r_k</Tex> se repite, la expansión es <b>periódica</b>. Un racional <Tex>p/q</Tex> (irreducible) tiene expansión finita en base 2 sólo si <Tex>q</Tex> es potencia de 2; por eso 0.1, 0.2 o 1/3 no son exactos
        en binario.
      </p>
      <p>
        <b>Base β → decimal:</b> <Tex>{'(d_n\\ldots d_1d_0.d_{-1}d_{-2}\\ldots)_\\beta = \\sum_k d_k\\,\\beta^{k}'}</Tex>.
      </p>
      <p>
        <b>Codificar en IEEE 754 (ejercicio típico):</b> 1) signo; 2) pasar |x| a binario; 3) normalizar <Tex>{'1.b_1b_2\\ldots \\times 2^{e}'}</Tex>; 4) exponente sesgado <Tex>{'E = e + \\text{sesgo}'}</Tex>{' '}
        en binario; 5) tomar <Tex>m</Tex> bits de la fracción y redondear (bit de guarda + bits restantes, empate al par); 6) juntar <Tex>s\,|\,E\,|\,f</Tex> y escribir en hexadecimal.
      </p>
    </>
  ),
  'sistema-f': (
    <>
      <p>
        Un sistema de punto flotante normalizado <Tex>{'\\mathbb{F}(\\beta,t,L,U)'}</Tex> contiene el cero y los números
      </p>
      <Tex block>{'x = \\pm\\, 0.d_1d_2\\ldots d_t \\times \\beta^{e},\\qquad d_1 \\neq 0,\\quad 0\\le d_i \\le \\beta-1,\\quad L \\le e \\le U'}</Tex>
      <ul>
        <li>
          Cantidad de números: <Tex>{'2(\\beta-1)\\beta^{t-1}(U-L+1) + 1'}</Tex>
        </li>
        <li>
          Menor positivo (UFL): <Tex>{'\\beta^{L-1}'}</Tex>. Mayor (OFL): <Tex>{'(1-\\beta^{-t})\\,\\beta^{U}'}</Tex>
        </li>
        <li>
          Épsilon de máquina (distancia de 1 al siguiente): <Tex>{'\\varepsilon = \\beta^{1-t}'}</Tex>
        </li>
        <li>
          Unidad de redondeo: <Tex>{'u = \\tfrac12\\beta^{1-t}'}</Tex> (redondeo) o <Tex>{'u = \\beta^{1-t}'}</Tex> (corte / chopping), con <Tex>{'\\frac{|x-fl(x)|}{|x|}\\le u'}</Tex>
        </li>
      </ul>
      <p>
        Los números <b>no están equiespaciados</b>: entre <Tex>{'\\beta^{e-1}'}</Tex> y <Tex>{'\\beta^{e}'}</Tex> el espaciado es constante <Tex>{'\\beta^{e-t}'}</Tex> y se multiplica por β en cada década
        binaria/decimal. Con la convención <Tex>{'d_0.d_1\\ldots d_{t-1}\\times\\beta^e'}</Tex> (la de IEEE) las fórmulas cambian a UFL <Tex>{'\\beta^L'}</Tex>, OFL{' '}
        <Tex>{'(\\beta-\\beta^{1-t})\\beta^U'}</Tex>.
      </p>
    </>
  ),
  epsilon: (
    <>
      <p>
        El <b>épsilon de máquina</b> <Tex>{'\\varepsilon_{mach}'}</Tex> es la distancia entre 1 y el siguiente número de punto flotante; equivalentemente, el menor <Tex>{'\\varepsilon=2^{-k}'}</Tex> con{' '}
        <Tex>{'fl(1+\\varepsilon) > 1'}</Tex>. Se calcula con el bucle clásico:
      </p>
      <Tex block>{'\\varepsilon \\leftarrow 1;\\quad \\text{mientras } fl(1+\\varepsilon) > 1:\\ \\varepsilon \\leftarrow \\varepsilon/2;\\quad \\text{al salir } \\varepsilon_{mach} = 2\\varepsilon'}</Tex>
      <p>
        Resultados: simple <Tex>{'2^{-23}\\approx 1.19\\times10^{-7}'}</Tex>, doble <Tex>{'2^{-52}\\approx 2.22\\times10^{-16}'}</Tex> (en Scilab: <code>%eps</code>). La unidad de redondeo es{' '}
        <Tex>{'u=\\varepsilon/2'}</Tex>.
      </p>
      <p>
        El espaciado alrededor de <Tex>x</Tex> es <Tex>{'\\mathrm{ulp}(x) = \\varepsilon\\,2^{\\lfloor\\log_2|x|\\rfloor}'}</Tex>: crece con <Tex>|x|</Tex>, pero el espaciado <b>relativo</b>{' '}
        <Tex>{'\\mathrm{ulp}(x)/|x|'}</Tex> oscila entre <Tex>{'\\varepsilon/2'}</Tex> y <Tex>\varepsilon</Tex>. ¡No es el menor número positivo! (ese es <Tex>{'2^{-1074}'}</Tex> en doble).
      </p>
    </>
  ),
  errores: (
    <>
      <p>
        Si <Tex>{'p^*'}</Tex> aproxima al valor exacto <Tex>p</Tex>:
      </p>
      <Tex block>{'E_a = |p - p^*|,\\qquad E_r = \\frac{|p-p^*|}{|p|}\\ (p\\neq0),\\qquad E_\\% = 100\\,E_r'}</Tex>
      <p>
        <b>Cifras significativas (texto de la materia, Cap. 1):</b> <Tex>{'p^*'}</Tex> tiene <Tex>m</Tex> dígitos significativos si <Tex>m</Tex> es el mayor entero positivo tal que
      </p>
      <Tex block>{'\\frac{|p-p^*|}{|p|} \\le 5\\times 10^{-(m+1)}'}</Tex>
      <p>
        Ejemplo 1.12: <Tex>{'p=-0.001234,\\ p^*=-0.001229 \\Rightarrow E_r = 4.052\\times10^{-3} \\le 5\\times10^{-3} = 5\\times10^{-(2+1)} \\Rightarrow m = 2'}</Tex>.
      </p>
      <p>
        <b>Burden &amp; Faires</b> usa <Tex>{'E_r \\le 5\\times10^{-t}'}</Tex>, que da una cifra más (<Tex>t = m + 1</Tex>): con los mismos números, <Tex>t = 3</Tex>. Usa la definición que pida el
        profesor; la página permite elegir.
      </p>
      <p>
        <b>Decimales correctos:</b> el mayor <Tex>d</Tex> con <Tex>{'|p-p^*| \\le 0.5\\times10^{-d}'}</Tex>. El error absoluto depende de la escala; el relativo no, por eso mide mejor la calidad de una
        aproximación.
      </p>
      <p>
        <b>Fuentes de error:</b> de los datos (medición), de <b>redondeo</b> (representación finita, aritmética de máquina), de <b>truncamiento</b> (cortar un proceso infinito: series,
        derivadas por diferencias, iteraciones) y del modelo.
      </p>
    </>
  ),
  propagacion: (
    <>
      <p>
        Si los datos tienen errores <Tex>{'\\Delta x_i'}</Tex>, por Taylor de primer orden el error de <Tex>{'f(x_1,\\ldots,x_n)'}</Tex> es aproximadamente
      </p>
      <Tex block>{'\\Delta f \\approx \\sum_{i=1}^{n} \\left|\\frac{\\partial f}{\\partial x_i}\\right|\\Delta x_i \\qquad\\text{(una variable: } \\Delta f \\approx |f\'(x)|\\,\\Delta x)'}</Tex>
      <p>Casos particulares (errores absolutos Δ y relativos δ):</p>
      <ul>
        <li>
          Suma/resta: <Tex>{'\\Delta(x\\pm y) \\le \\Delta x + \\Delta y'}</Tex> — ¡el relativo explota si <Tex>{'x\\approx y'}</Tex> en la resta!
        </li>
        <li>
          Producto/cociente: <Tex>{'\\delta(xy) \\approx \\delta(x/y) \\approx \\delta x + \\delta y'}</Tex>
        </li>
        <li>
          Potencia: <Tex>{'\\delta(x^n) \\approx |n|\\,\\delta x'}</Tex>
        </li>
      </ul>
      <p>
        Además del peor caso (suma de valores absolutos) se suele reportar el error <b>estadístico</b> <Tex>{'\\sqrt{\\sum (\\partial_i f\\,\\Delta x_i)^2}'}</Tex> cuando los errores son
        independientes.
      </p>
    </>
  ),
  condicion: (
    <>
      <p>
        <b>Estabilidad matemática (texto, §1.6):</b> un problema <Tex>{'F(y,x)=0'}</Tex> es <b>estable</b> (o <b>bien condicionado</b>) si la solución <Tex>y</Tex> depende de manera continua de los
        datos <Tex>x</Tex>: pequeños cambios en <Tex>x</Tex> producen pequeños cambios en <Tex>y</Tex>. Si no, es <b>inestable</b> (<b>mal condicionado</b>), y lo será con cualquier algoritmo.
      </p>
      <p>
        El <b>número de condición</b> <Tex>K</Tex> (en esta página también <Tex>{'\\kappa'}</Tex>) mide esa sensibilidad comparando errores relativos:
      </p>
      <Tex block>{"K = \\sup_{\\delta x}\\frac{\\|\\delta y\\|/\\|y\\|}{\\|\\delta x\\|/\\|x\\|}\\qquad\\xrightarrow{\\;y=f(x)\\;}\\qquad K(x) = \\left|\\frac{x\\,f'(x)}{f(x)}\\right|,\\qquad \\frac{|\\delta y|}{|y|}\\approx K\\,\\frac{|\\delta x|}{|x|}"}</Tex>
      <ul>
        <li>
          <Tex>K</Tex> pequeño (el texto dice “del orden de 10”): problema <b>bien condicionado</b>.
        </li>
        <li>
          <Tex>{'K \\gg 1'}</Tex>: <b>mal condicionado</b>; se pierden ≈ <Tex>{'\\log_{10}K'}</Tex> cifras decimales, sin importar el algoritmo.
        </li>
      </ul>
      <p>
        <b>Ejemplo 1.21:</b> para <Tex>{'y=a^x'}</Tex> (<Tex>{'a>0,\\ a\\ne1'}</Tex>) se obtiene <Tex>{'K = |x\\ln a|'}</Tex>: con <Tex>{'K=10^5'}</Tex> y un error relativo de redondeo{' '}
        <Tex>{'10^{-7}'}</Tex> en <Tex>x</Tex>, el resultado tiene un error relativo <Tex>{'\\approx10^{-2}'}</Tex>.
      </p>
      <p>
        Otros: <Tex>{'\\sqrt{x}'}</Tex> tiene <Tex>{'K=1/2'}</Tex>; <Tex>{'e^x'}</Tex> tiene <Tex>{'K=|x|'}</Tex>; <Tex>{'\\ln x'}</Tex> tiene <Tex>{'K = 1/|\\ln x|'}</Tex> (malo cerca de <Tex>x=1</Tex>);{' '}
        <Tex>{'x-1'}</Tex> cerca de 1 (cancelación) y <Tex>{'\\tan x'}</Tex> cerca de <Tex>{'\\pi/2'}</Tex> están mal condicionados.
      </p>
      <p>
        Regla práctica: <Tex>{'\\text{error relativo del resultado} \\lesssim K \\times \\text{error relativo de los datos} \\;(+\\text{ error del algoritmo})'}</Tex>.
      </p>
    </>
  ),
  cancelacion: (
    <>
      <p>
        <b>Cancelación catastrófica:</b> al restar dos números muy próximos que ya traen errores de redondeo, los dígitos iniciales iguales se cancelan y el resultado queda dominado por el error. Si{' '}
        <Tex>{'a\\approx b'}</Tex>:
      </p>
      <Tex block>{'\\frac{|fl(a)-fl(b) - (a-b)|}{|a-b|} \\lesssim u\\,\\frac{|a|+|b|}{|a-b|}\\qquad\\Rightarrow\\qquad \\text{se pierden}\\ \\approx \\log_{10}\\frac{|a|}{|a-b|}\\ \\text{cifras}'}</Tex>
      <p>
        La resta en sí es exacta (lema de Sterbenz); el problema es que <b>revela</b> los errores previos. El remedio es <b>reformular algebraicamente</b> la expresión para evitar la resta:
      </p>
      <ul>
        <li>
          <Tex>{'\\frac{1-\\cos x}{x^2} = \\frac{2\\sin^2(x/2)}{x^2}'}</Tex>
        </li>
        <li>
          <Tex>{'\\sqrt{x+1}-\\sqrt{x} = \\frac{1}{\\sqrt{x+1}+\\sqrt{x}}'}</Tex> (racionalizar)
        </li>
        <li>
          Raíces de <Tex>{'ax^2+bx+c'}</Tex> con <Tex>{'b^2\\gg 4ac'}</Tex>: <Tex>{'x_1 = \\frac{-b-\\operatorname{sign}(b)\\sqrt{b^2-4ac}}{2a}'}</Tex>, <Tex>{'x_2 = \\frac{c}{a\\,x_1}'}</Tex>
        </li>
        <li>
          <Tex>{'\\ln(1+x)'}</Tex>, <Tex>{'e^x-1'}</Tex> para <Tex>x</Tex> pequeño: funciones <code>log1p</code>, <code>expm1</code>.
        </li>
      </ul>
      <p>
        <b>Error hacia adelante vs. hacia atrás:</b> si el algoritmo devuelve <Tex>{'\\hat y'}</Tex> en lugar de <Tex>{'y=f(x)'}</Tex>, el error <b>progresivo</b> (forward) es{' '}
        <Tex>{'|\\hat y - y|'}</Tex>; el error <b>regresivo</b> (backward) es el menor <Tex>{'|\\Delta x|'}</Tex> tal que <Tex>{'\\hat y = f(x+\\Delta x)'}</Tex>. Se relacionan por
      </p>
      <Tex block>{'\\text{error progresivo relativo} \\;\\lesssim\\; \\kappa(x)\\times\\text{error regresivo relativo}'}</Tex>
      <p>
        Un algoritmo es <b>estable hacia atrás</b> si su error regresivo es del orden de <Tex>u</Tex>. La fórmula ingenua <Tex>{'(1-\\cos x)/x^2'}</Tex> NO lo es aunque el problema esté bien condicionado
        (<Tex>{'\\kappa\\approx 0'}</Tex> cerca de 0): la culpa es del algoritmo, no del problema.
      </p>
    </>
  ),
  estabilidad: (
    <>
      <p>
        <b>Estabilidad numérica (texto, §1.7):</b> es una propiedad del <b>algoritmo</b>, no del problema: un problema matemáticamente inestable lo es con cualquier algoritmo, pero un problema
        estable puede resolverse con un algoritmo inestable. Hay que elegir algoritmos que no sean menos estables que el problema.
      </p>
      <p>
        Un algoritmo es <b>estable</b> si los errores (de redondeo o de los datos iniciales) no crecen de forma descontrolada durante el cálculo. Si <Tex>{'E_0'}</Tex> es el error inicial y{' '}
        <Tex>{'E_n'}</Tex> tras <Tex>n</Tex> pasos:
      </p>
      <Tex block>{'E_n \\approx C\\,n\\,E_0\\ \\ \\text{(crecimiento lineal: estable)}\\qquad E_n \\approx C^n E_0,\\ C>1\\ \\ \\text{(exponencial: inestable)}'}</Tex>
      <p>
        <b>Recurrencia</b> <Tex>{'I_n = \\int_0^1 x^n e^{x-1}dx = 1 - n\\,I_{n-1}'}</Tex>, <Tex>{'I_0 = 1-e^{-1}'}</Tex>. Hacia adelante el error de <Tex>{'I_0'}</Tex> se multiplica por{' '}
        <Tex>{'n!'}</Tex>: <Tex>{'E_n = n!\\,E_0'}</Tex> ⇒ inestable. Hacia atrás, <Tex>{'I_{n-1} = (1-I_n)/n'}</Tex> <b>divide</b> el error por <Tex>n</Tex> en cada paso: aunque se empiece con el
        disparate <Tex>{'I_M = 0'}</Tex>, se obtiene <Tex>{'I_n'}</Tex> con precisión de máquina.
      </p>
      <p>
        <b>Serie de Taylor de <Tex>{'e^{x}'}</Tex> con <Tex>{'x<0'}</Tex>:</b> los términos <Tex>{'x^k/k!'}</Tex> alternan de signo y alcanzan tamaño <Tex>{'\\sim e^{|x|}'}</Tex>, mientras que el
        resultado es <Tex>{'e^{-|x|}'}</Tex>. El error relativo es <Tex>{'\\approx u\\,e^{2|x|}'}</Tex>. Solución estable: <Tex>{'e^{x} = 1/e^{|x|}'}</Tex> (todos los términos positivos).
      </p>
      <p>
        <b>Consistencia + estabilidad ⇒ convergencia:</b> un método numérico es <b>consistente</b> si el problema discreto tiende al continuo (el error de truncamiento local → 0 al refinar), y
        converge si además es estable.
      </p>
    </>
  ),
  taylor: (
    <>
      <p>
        Si <Tex>f</Tex> tiene <Tex>n+1</Tex> derivadas continuas en un intervalo que contiene a <Tex>{'x_0'}</Tex> y <Tex>x</Tex>:
      </p>
      <Tex block>{'f(x) = \\underbrace{\\sum_{k=0}^{n} \\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k}_{P_n(x)} + \\underbrace{\\frac{f^{(n+1)}(\\xi)}{(n+1)!}(x-x_0)^{n+1}}_{R_n(x)}'}</Tex>
      <p>
        para algún <Tex>\xi</Tex> entre <Tex>{'x_0'}</Tex> y <Tex>x</Tex> (resto de Lagrange). Cota del <b>error de truncamiento</b>:
      </p>
      <Tex block>{'|f(x)-P_n(x)| \\le \\frac{M_{n+1}}{(n+1)!}|x-x_0|^{n+1},\\qquad M_{n+1} = \\max_{\\xi}|f^{(n+1)}(\\xi)|'}</Tex>
      <p>
        El error total de un cálculo es <b>truncamiento + redondeo</b>. Cuando <Tex>{'x_0=0'}</Tex> se llama serie de Maclaurin.
      </p>
    </>
  ),
}

const THEORY_EN: Record<ErrKind, ReactNode> = {
  ieee754: (
    <>
      <p>
        A binary floating-point number is stored as three fields: the <b>sign</b> <Tex>s</Tex>, the <b>biased exponent</b> <Tex>E</Tex> (<Tex>w</Tex> bits) and the{' '}
        <b>fraction</b> <Tex>f</Tex> (<Tex>m</Tex> bits). For <b>normal</b> numbers (<Tex>{'0 < E < 2^w-1'}</Tex>) the first bit of the mantissa is an implicit 1 that is not stored:
      </p>
      <Tex block>{'x = (-1)^s \\times (1.f)_2 \\times 2^{E - \\text{bias}}, \\qquad \\text{bias} = 2^{w-1}-1'}</Tex>
      <table className="err-mini">
        <thead>
          <tr>
            <th>Format</th>
            <th>Total</th>
            <th>Sign</th>
            <th>Exponent w</th>
            <th>Fraction m</th>
            <th>Bias</th>
            <th>ε = 2^(−m)</th>
            <th>Decimal digits ≈</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Half (float16, GPUs / AI)</td>
            <td>16</td>
            <td>1</td>
            <td>5</td>
            <td>10</td>
            <td>15</td>
            <td>9.77 × 10⁻⁴</td>
            <td>3</td>
          </tr>
          <tr>
            <td>Single (float32)</td>
            <td>32</td>
            <td>1</td>
            <td>8</td>
            <td>23</td>
            <td>127</td>
            <td>1.19 × 10⁻⁷</td>
            <td>7</td>
          </tr>
          <tr>
            <td>Double (float64, Scilab)</td>
            <td>64</td>
            <td>1</td>
            <td>11</td>
            <td>52</td>
            <td>1023</td>
            <td>2.22 × 10⁻¹⁶</td>
            <td>15–16</td>
          </tr>
        </tbody>
      </table>
      <p>Special values according to the exponent field:</p>
      <ul>
        <li>
          <Tex>E = 0,\ f = 0</Tex>: <b>±0</b> (there is a signed zero).
        </li>
        <li>
          <Tex>{'E = 0,\\ f \\ne 0'}</Tex>: <b>subnormals</b> <Tex>{'x = (-1)^s (0.f)_2 \\times 2^{1-\\text{bias}}'}</Tex> (they fill the gap between 0 and the smallest normal: <i>gradual underflow</i>).
        </li>
        <li>
          <Tex>{'E = 2^w-1,\\ f = 0'}</Tex>: <b>±∞</b> (overflow, <Tex>1/0</Tex>).
        </li>
        <li>
          <Tex>{'E = 2^w-1,\\ f \\ne 0'}</Tex>: <b>NaN</b> (<Tex>0/0</Tex>, <Tex>{'\\infty-\\infty'}</Tex>, <Tex>{'\\sqrt{-1}'}</Tex> in the reals).
        </li>
      </ul>
      <p>
        Every real <Tex>x</Tex> is stored as <Tex>{'fl(x)'}</Tex>, the nearest float (ties rounded to even), with relative error bounded by the <b>unit round-off</b>:
      </p>
      <Tex block>{'fl(x) = x(1+\\delta),\\qquad |\\delta| \\le u = \\tfrac{1}{2}\\varepsilon_{mach} = 2^{-(m+1)}'}</Tex>
      <p>
        That is why <Tex>0.1</Tex> is not exactly representable: in binary it is repeating, <Tex>{'(0.0\\overline{0011})_2'}</Tex>, and it is cut to 52 bits.
      </p>
    </>
  ),
  conversion: (
    <>
      <p>
        <b>Integer part → base β:</b> repeated division by β; the <b>remainders</b>, read from bottom to top, are the digits.
      </p>
      <p>
        <b>Fractional part → base β:</b> repeated multiplication by β; the <b>integer part</b> of each product is the next digit, and one continues with the fractional part:
      </p>
      <Tex block>{'r_0 = \\text{frac}(x),\\qquad \\beta\\, r_k = d_{k+1} + r_{k+1},\\quad d_{k+1} = \\lfloor \\beta r_k \\rfloor'}</Tex>
      <p>
        If some <Tex>r_k</Tex> repeats, the expansion is <b>periodic</b> (repeating). A rational <Tex>p/q</Tex> in lowest terms has a finite base-2 expansion only if <Tex>q</Tex> is a power of 2; that is why 0.1, 0.2 or 1/3
        are not exact in binary.
      </p>
      <p>
        <b>Base β → decimal:</b> <Tex>{'(d_n\\ldots d_1d_0.d_{-1}d_{-2}\\ldots)_\\beta = \\sum_k d_k\\,\\beta^{k}'}</Tex>.
      </p>
      <p>
        <b>Encoding in IEEE 754 (typical exercise):</b> 1) sign; 2) convert |x| to binary; 3) normalize <Tex>{'1.b_1b_2\\ldots \\times 2^{e}'}</Tex>; 4) biased exponent <Tex>{'E = e + \\text{bias}'}</Tex>{' '}
        in binary; 5) take <Tex>m</Tex> bits of the fraction and round (guard bit + remaining bits, ties to even); 6) put together <Tex>s\,|\,E\,|\,f</Tex> and write it in hexadecimal.
      </p>
    </>
  ),
  'sistema-f': (
    <>
      <p>
        A normalized floating-point system <Tex>{'\\mathbb{F}(\\beta,t,L,U)'}</Tex> contains zero and the numbers
      </p>
      <Tex block>{'x = \\pm\\, 0.d_1d_2\\ldots d_t \\times \\beta^{e},\\qquad d_1 \\neq 0,\\quad 0\\le d_i \\le \\beta-1,\\quad L \\le e \\le U'}</Tex>
      <ul>
        <li>
          How many numbers: <Tex>{'2(\\beta-1)\\beta^{t-1}(U-L+1) + 1'}</Tex>
        </li>
        <li>
          Smallest positive (UFL): <Tex>{'\\beta^{L-1}'}</Tex>. Largest (OFL): <Tex>{'(1-\\beta^{-t})\\,\\beta^{U}'}</Tex>
        </li>
        <li>
          Machine epsilon (distance from 1 to the next number): <Tex>{'\\varepsilon = \\beta^{1-t}'}</Tex>
        </li>
        <li>
          Unit round-off: <Tex>{'u = \\tfrac12\\beta^{1-t}'}</Tex> (rounding) or <Tex>{'u = \\beta^{1-t}'}</Tex> (chopping), with <Tex>{'\\frac{|x-fl(x)|}{|x|}\\le u'}</Tex>
        </li>
      </ul>
      <p>
        The numbers are <b>not equally spaced</b>: between <Tex>{'\\beta^{e-1}'}</Tex> and <Tex>{'\\beta^{e}'}</Tex> the spacing is a constant <Tex>{'\\beta^{e-t}'}</Tex>, and it is multiplied by β in
        each binary/decimal decade. With the convention <Tex>{'d_0.d_1\\ldots d_{t-1}\\times\\beta^e'}</Tex> (the IEEE one) the formulas become UFL <Tex>{'\\beta^L'}</Tex>, OFL{' '}
        <Tex>{'(\\beta-\\beta^{1-t})\\beta^U'}</Tex>.
      </p>
    </>
  ),
  epsilon: (
    <>
      <p>
        <b>Machine epsilon</b> <Tex>{'\\varepsilon_{mach}'}</Tex> is the distance between 1 and the next floating-point number; equivalently, the smallest <Tex>{'\\varepsilon=2^{-k}'}</Tex> with{' '}
        <Tex>{'fl(1+\\varepsilon) > 1'}</Tex>. It is computed with the classic loop:
      </p>
      <Tex block>{'\\varepsilon \\leftarrow 1;\\quad \\text{while } fl(1+\\varepsilon) > 1:\\ \\varepsilon \\leftarrow \\varepsilon/2;\\quad \\text{on exit } \\varepsilon_{mach} = 2\\varepsilon'}</Tex>
      <p>
        Results: single <Tex>{'2^{-23}\\approx 1.19\\times10^{-7}'}</Tex>, double <Tex>{'2^{-52}\\approx 2.22\\times10^{-16}'}</Tex> (in Scilab: <code>%eps</code>). The unit round-off is{' '}
        <Tex>{'u=\\varepsilon/2'}</Tex>.
      </p>
      <p>
        The spacing around <Tex>x</Tex> is <Tex>{'\\mathrm{ulp}(x) = \\varepsilon\\,2^{\\lfloor\\log_2|x|\\rfloor}'}</Tex>: it grows with <Tex>|x|</Tex>, but the <b>relative</b> spacing{' '}
        <Tex>{'\\mathrm{ulp}(x)/|x|'}</Tex> oscillates between <Tex>{'\\varepsilon/2'}</Tex> and <Tex>\varepsilon</Tex>. It is not the smallest positive number! (that one is <Tex>{'2^{-1074}'}</Tex> in double).
      </p>
    </>
  ),
  errores: (
    <>
      <p>
        If <Tex>{'p^*'}</Tex> approximates the exact value <Tex>p</Tex>:
      </p>
      <Tex block>{'E_a = |p - p^*|,\\qquad E_r = \\frac{|p-p^*|}{|p|}\\ (p\\neq0),\\qquad E_\\% = 100\\,E_r'}</Tex>
      <p>
        <b>Significant digits (course textbook, Ch. 1):</b> <Tex>{'p^*'}</Tex> has <Tex>m</Tex> significant digits if <Tex>m</Tex> is the largest positive integer such that
      </p>
      <Tex block>{'\\frac{|p-p^*|}{|p|} \\le 5\\times 10^{-(m+1)}'}</Tex>
      <p>
        Example 1.12: <Tex>{'p=-0.001234,\\ p^*=-0.001229 \\Rightarrow E_r = 4.052\\times10^{-3} \\le 5\\times10^{-3} = 5\\times10^{-(2+1)} \\Rightarrow m = 2'}</Tex>.
      </p>
      <p>
        <b>Burden &amp; Faires</b> use <Tex>{'E_r \\le 5\\times10^{-t}'}</Tex>, which gives one more digit (<Tex>t = m + 1</Tex>): with the same numbers, <Tex>t = 3</Tex>. Use the definition your
        instructor asks for; the page lets you choose.
      </p>
      <p>
        <b>Correct decimals:</b> the largest <Tex>d</Tex> with <Tex>{'|p-p^*| \\le 0.5\\times10^{-d}'}</Tex>. The absolute error depends on the scale; the relative error does not, which is why it is a
        better measure of the quality of an approximation.
      </p>
      <p>
        <b>Sources of error:</b> the data (measurement), <b>round-off</b> (finite representation, machine arithmetic), <b>truncation</b> (cutting off an infinite process: series, difference
        derivatives, iterations) and the model.
      </p>
    </>
  ),
  propagacion: (
    <>
      <p>
        If the data have errors <Tex>{'\\Delta x_i'}</Tex>, by first-order Taylor the error in <Tex>{'f(x_1,\\ldots,x_n)'}</Tex> is approximately
      </p>
      <Tex block>{'\\Delta f \\approx \\sum_{i=1}^{n} \\left|\\frac{\\partial f}{\\partial x_i}\\right|\\Delta x_i \\qquad\\text{(one variable: } \\Delta f \\approx |f\'(x)|\\,\\Delta x)'}</Tex>
      <p>Special cases (absolute errors Δ and relative errors δ):</p>
      <ul>
        <li>
          Sum/difference: <Tex>{'\\Delta(x\\pm y) \\le \\Delta x + \\Delta y'}</Tex> — the relative error blows up if <Tex>{'x\\approx y'}</Tex> in a subtraction!
        </li>
        <li>
          Product/quotient: <Tex>{'\\delta(xy) \\approx \\delta(x/y) \\approx \\delta x + \\delta y'}</Tex>
        </li>
        <li>
          Power: <Tex>{'\\delta(x^n) \\approx |n|\\,\\delta x'}</Tex>
        </li>
      </ul>
      <p>
        Besides the worst case (sum of absolute values), the <b>statistical</b> error <Tex>{'\\sqrt{\\sum (\\partial_i f\\,\\Delta x_i)^2}'}</Tex> is often reported when the errors are
        independent.
      </p>
    </>
  ),
  condicion: (
    <>
      <p>
        <b>Mathematical stability (textbook, §1.6):</b> a problem <Tex>{'F(y,x)=0'}</Tex> is <b>stable</b> (or <b>well conditioned</b>) if the solution <Tex>y</Tex> depends continuously on the
        data <Tex>x</Tex>: small changes in <Tex>x</Tex> produce small changes in <Tex>y</Tex>. Otherwise it is <b>unstable</b> (<b>ill conditioned</b>), and it will be so with any algorithm.
      </p>
      <p>
        The <b>condition number</b> <Tex>K</Tex> (on this page also <Tex>{'\\kappa'}</Tex>) measures that sensitivity by comparing relative errors:
      </p>
      <Tex block>{"K = \\sup_{\\delta x}\\frac{\\|\\delta y\\|/\\|y\\|}{\\|\\delta x\\|/\\|x\\|}\\qquad\\xrightarrow{\\;y=f(x)\\;}\\qquad K(x) = \\left|\\frac{x\\,f'(x)}{f(x)}\\right|,\\qquad \\frac{|\\delta y|}{|y|}\\approx K\\,\\frac{|\\delta x|}{|x|}"}</Tex>
      <ul>
        <li>
          Small <Tex>K</Tex> (the textbook says “of the order of 10”): <b>well-conditioned</b> problem.
        </li>
        <li>
          <Tex>{'K \\gg 1'}</Tex>: <b>ill conditioned</b>; about <Tex>{'\\log_{10}K'}</Tex> decimal digits are lost, no matter which algorithm is used.
        </li>
      </ul>
      <p>
        <b>Example 1.21:</b> for <Tex>{'y=a^x'}</Tex> (<Tex>{'a>0,\\ a\\ne1'}</Tex>) one gets <Tex>{'K = |x\\ln a|'}</Tex>: with <Tex>{'K=10^5'}</Tex> and a relative round-off error{' '}
        <Tex>{'10^{-7}'}</Tex> in <Tex>x</Tex>, the result has a relative error <Tex>{'\\approx10^{-2}'}</Tex>.
      </p>
      <p>
        Others: <Tex>{'\\sqrt{x}'}</Tex> has <Tex>{'K=1/2'}</Tex>; <Tex>{'e^x'}</Tex> has <Tex>{'K=|x|'}</Tex>; <Tex>{'\\ln x'}</Tex> has <Tex>{'K = 1/|\\ln x|'}</Tex> (bad near <Tex>x=1</Tex>);{' '}
        <Tex>{'x-1'}</Tex> near 1 (cancellation) and <Tex>{'\\tan x'}</Tex> near <Tex>{'\\pi/2'}</Tex> are ill conditioned.
      </p>
      <p>
        Rule of thumb: <Tex>{'\\text{relative error of the result} \\lesssim K \\times \\text{relative error of the data} \\;(+\\text{ algorithm error})'}</Tex>.
      </p>
    </>
  ),
  cancelacion: (
    <>
      <p>
        <b>Catastrophic cancellation:</b> when subtracting two very close numbers that already carry round-off errors, the equal leading digits cancel and the result is dominated by the error. If{' '}
        <Tex>{'a\\approx b'}</Tex>:
      </p>
      <Tex block>{'\\frac{|fl(a)-fl(b) - (a-b)|}{|a-b|} \\lesssim u\\,\\frac{|a|+|b|}{|a-b|}\\qquad\\Rightarrow\\qquad \\text{about}\\ \\log_{10}\\frac{|a|}{|a-b|}\\ \\text{digits are lost}'}</Tex>
      <p>
        The subtraction itself is exact (Sterbenz lemma); the problem is that it <b>exposes</b> the earlier errors. The remedy is to <b>rewrite the expression algebraically</b> to avoid the subtraction:
      </p>
      <ul>
        <li>
          <Tex>{'\\frac{1-\\cos x}{x^2} = \\frac{2\\sin^2(x/2)}{x^2}'}</Tex>
        </li>
        <li>
          <Tex>{'\\sqrt{x+1}-\\sqrt{x} = \\frac{1}{\\sqrt{x+1}+\\sqrt{x}}'}</Tex> (rationalize)
        </li>
        <li>
          Roots of <Tex>{'ax^2+bx+c'}</Tex> with <Tex>{'b^2\\gg 4ac'}</Tex>: <Tex>{'x_1 = \\frac{-b-\\operatorname{sign}(b)\\sqrt{b^2-4ac}}{2a}'}</Tex>, <Tex>{'x_2 = \\frac{c}{a\\,x_1}'}</Tex>
        </li>
        <li>
          <Tex>{'\\ln(1+x)'}</Tex>, <Tex>{'e^x-1'}</Tex> for small <Tex>x</Tex>: the functions <code>log1p</code>, <code>expm1</code>.
        </li>
      </ul>
      <p>
        <b>Forward vs. backward error:</b> if the algorithm returns <Tex>{'\\hat y'}</Tex> instead of <Tex>{'y=f(x)'}</Tex>, the <b>forward</b> error is{' '}
        <Tex>{'|\\hat y - y|'}</Tex>; the <b>backward</b> error is the smallest <Tex>{'|\\Delta x|'}</Tex> such that <Tex>{'\\hat y = f(x+\\Delta x)'}</Tex>. They are related by
      </p>
      <Tex block>{'\\text{relative forward error} \\;\\lesssim\\; \\kappa(x)\\times\\text{relative backward error}'}</Tex>
      <p>
        An algorithm is <b>backward stable</b> if its backward error is of the order of <Tex>u</Tex>. The naive formula <Tex>{'(1-\\cos x)/x^2'}</Tex> is NOT, even though the problem is well conditioned
        (<Tex>{'\\kappa\\approx 0'}</Tex> near 0): the algorithm is to blame, not the problem.
      </p>
    </>
  ),
  estabilidad: (
    <>
      <p>
        <b>Numerical stability (textbook, §1.7):</b> it is a property of the <b>algorithm</b>, not of the problem: a mathematically unstable problem is unstable with any algorithm, but a stable
        problem can be solved with an unstable algorithm. One must choose algorithms that are no less stable than the problem.
      </p>
      <p>
        An algorithm is <b>stable</b> if the errors (round-off or in the initial data) do not grow uncontrollably during the computation. If <Tex>{'E_0'}</Tex> is the initial error and{' '}
        <Tex>{'E_n'}</Tex> the error after <Tex>n</Tex> steps:
      </p>
      <Tex block>{'E_n \\approx C\\,n\\,E_0\\ \\ \\text{(linear growth: stable)}\\qquad E_n \\approx C^n E_0,\\ C>1\\ \\ \\text{(exponential: unstable)}'}</Tex>
      <p>
        <b>Recurrence</b> <Tex>{'I_n = \\int_0^1 x^n e^{x-1}dx = 1 - n\\,I_{n-1}'}</Tex>, <Tex>{'I_0 = 1-e^{-1}'}</Tex>. Going forward, the error in <Tex>{'I_0'}</Tex> is multiplied by{' '}
        <Tex>{'n!'}</Tex>: <Tex>{'E_n = n!\\,E_0'}</Tex> ⇒ unstable. Going backward, <Tex>{'I_{n-1} = (1-I_n)/n'}</Tex> <b>divides</b> the error by <Tex>n</Tex> at each step: even starting from the
        absurd <Tex>{'I_M = 0'}</Tex>, one obtains <Tex>{'I_n'}</Tex> to machine precision.
      </p>
      <p>
        <b>Taylor series of <Tex>{'e^{x}'}</Tex> with <Tex>{'x<0'}</Tex>:</b> the terms <Tex>{'x^k/k!'}</Tex> alternate in sign and reach a size <Tex>{'\\sim e^{|x|}'}</Tex>, while the
        result is <Tex>{'e^{-|x|}'}</Tex>. The relative error is <Tex>{'\\approx u\\,e^{2|x|}'}</Tex>. Stable solution: <Tex>{'e^{x} = 1/e^{|x|}'}</Tex> (all terms positive).
      </p>
      <p>
        <b>Consistency + stability ⇒ convergence:</b> a numerical method is <b>consistent</b> if the discrete problem tends to the continuous one (the local truncation error → 0 under refinement), and it
        converges if it is also stable.
      </p>
    </>
  ),
  taylor: (
    <>
      <p>
        If <Tex>f</Tex> has <Tex>n+1</Tex> continuous derivatives on an interval containing <Tex>{'x_0'}</Tex> and <Tex>x</Tex>:
      </p>
      <Tex block>{'f(x) = \\underbrace{\\sum_{k=0}^{n} \\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k}_{P_n(x)} + \\underbrace{\\frac{f^{(n+1)}(\\xi)}{(n+1)!}(x-x_0)^{n+1}}_{R_n(x)}'}</Tex>
      <p>
        for some <Tex>\xi</Tex> between <Tex>{'x_0'}</Tex> and <Tex>x</Tex> (Lagrange remainder). Bound on the <b>truncation error</b>:
      </p>
      <Tex block>{'|f(x)-P_n(x)| \\le \\frac{M_{n+1}}{(n+1)!}|x-x_0|^{n+1},\\qquad M_{n+1} = \\max_{\\xi}|f^{(n+1)}(\\xi)|'}</Tex>
      <p>
        The total error of a computation is <b>truncation + round-off</b>. When <Tex>{'x_0=0'}</Tex> it is called the Maclaurin series.
      </p>
    </>
  ),
}

export const THEORY: Record<ErrKind, ReactNode> = L(THEORY_ES, THEORY_EN)
