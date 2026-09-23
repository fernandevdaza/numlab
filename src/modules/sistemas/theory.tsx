import type { ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { L } from '../../i18n'

export type SisId = 'gauss' | 'lu' | 'thomas' | 'jacobi' | 'gauss-seidel' | 'condicion' | 'newton-sistemas' | 'punto-fijo-sistemas' | 'potencia'

/** Títulos de página (coinciden con el menú o son un poco más largos). */
export const TITLES: Record<SisId, string> = {
  gauss: L('Eliminación de Gauss con pivoteo', 'Gaussian elimination with pivoting'),
  thomas: L('Método de Thomas (tridiagonal)', 'Thomas algorithm (tridiagonal)'),
  lu: L('Factorización LU (Doolittle y Crout)', 'LU factorization (Doolittle and Crout)'),
  jacobi: L('Método de Gauss-Jacobi', 'Jacobi method'),
  'gauss-seidel': L('Método de Gauss-Seidel y SOR', 'Gauss–Seidel method and SOR'),
  condicion: L('Número de condición y estabilidad', 'Condition number and stability'),
  'newton-sistemas': L('Newton para sistemas no lineales', 'Newton for nonlinear systems'),
  'punto-fijo-sistemas': L('Punto fijo para sistemas no lineales', 'Fixed point for nonlinear systems'),
  potencia: L('Método de la potencia (valores propios)', 'Power method (eigenvalues)'),
}

/** Nota común: aritmética de t cifras de los ejemplos del texto. */
const T_CIFRAS = (
  <p>
    <b>Aritmética de t cifras.</b> Los ejemplos del texto se resuelven con una “calculadora” decimal de 4 cifras en la mantisa: cada dato y el resultado de cada operación se
    redondean a 4 cifras significativas. El campo <i>Cifras de la mantisa</i> simula esa calculadora (0 = doble precisión, ≈ 16 cifras).
  </p>
)

const THEORY_ES: Record<SisId, ReactNode> = {
  gauss: (
    <>
      <p>
        Se resuelve <Tex>Ax=b</Tex> (con <Tex>{'\\det A\\neq 0'}</Tex>) en dos etapas: <b>triangularización</b> (con pivoteo) y <b>sustitución regresiva</b>. La triangularización usa
        dos operaciones elementales que no cambian la solución: intercambiar dos ecuaciones y restar a una ecuación otra multiplicada por un factor.
      </p>
      <p>
        <b>Columna k</b> (<Tex>{'k=1,\\dots,n-1'}</Tex>). <i>Pivoteo:</i> entre las ecuaciones <Tex>{'k,\\dots,n'}</Tex> se busca la de mayor <Tex>{'|a_{ik}^{(k-1)}|'}</Tex> y se
        intercambia con la ecuación <Tex>k</Tex>; así el pivote <Tex>{'a_{kk}^{(k-1)}'}</Tex> es no nulo. <i>Eliminación:</i> para <Tex>{'i,j=k+1,\\dots,n'}</Tex>
      </p>
      <Tex block>{'a_{ij}^{(k)} = a_{ij}^{(k-1)} - \\frac{a_{ik}^{(k-1)}}{a_{kk}^{(k-1)}}\\,a_{kj}^{(k-1)},\\qquad b_i^{(k)} = b_i^{(k-1)} - \\frac{a_{ik}^{(k-1)}}{a_{kk}^{(k-1)}}\\,b_k^{(k-1)}'}</Tex>
      <p>
        El superíndice <Tex>{'(0)'}</Tex> indica el sistema original. Al terminar la columna <Tex>n-1</Tex> el sistema es triangular superior y se despeja desde la última ecuación:
      </p>
      <Tex block>{'x_n = \\frac{b_n^{(n-1)}}{a_{nn}^{(n-1)}},\\qquad x_i = \\frac{1}{a_{ii}^{(i-1)}}\\Big(b_i^{(i-1)} - \\sum_{j=i+1}^{n} a_{ij}^{(i-1)}x_j\\Big),\\quad i = n-1,\\dots,1'}</Tex>
      <p>
        El pivoteo hace el método siempre posible y reduce la propagación de los errores de redondeo (Ej. 3.1: gana una cifra significativa). Si la matriz es{' '}
        <b>estrictamente diagonalmente dominante</b> (EDD), <Tex>{'|a_{ii}| > \\sum_{j\\neq i}|a_{ij}|'}</Tex>, no hace falta pivotear; por eso conviene reordenar las ecuaciones
        para que el sistema sea lo más EDD posible. Como subproducto, <Tex>{'\\det A = \\pm\\prod_i a_{ii}^{(i-1)}'}</Tex> (signo − si hubo un número impar de intercambios).
      </p>
      <p>
        <b>Rapidez.</b> Memoria <Tex>{'\\propto n^2'}</Tex>. Operaciones (tabla del texto, sin pivoteo):
      </p>
      <div className="table-wrap" style={{ margin: '8px 0' }}>
        <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Operación</th>
              <th>Triangularización</th>
              <th>Sustitución regresiva</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Restas</td>
              <td><Tex>{'\\sum_{i=1}^{n-1} i^2 = \\tfrac{(n-1)n(2n-1)}{6}'}</Tex></td>
              <td><Tex>{'\\tfrac{(n-1)n}{2}'}</Tex></td>
            </tr>
            <tr>
              <td>Multiplicaciones</td>
              <td><Tex>{'\\tfrac{(n-1)n(2n-1)}{6}'}</Tex></td>
              <td><Tex>{'\\tfrac{(n-1)n}{2}'}</Tex></td>
            </tr>
            <tr>
              <td>Divisiones</td>
              <td><Tex>{'\\tfrac{(n-1)n}{2}'}</Tex></td>
              <td><Tex>n</Tex></td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <p>
        El total crece como <Tex>{'n^3'}</Tex> (la transformación de <Tex>b</Tex> añade <Tex>{'\\tfrac{(n-1)n}{2}'}</Tex> multiplicaciones y restas más): si <Tex>n=10</Tex> tarda 1 s,{' '}
        <Tex>n=100</Tex> tarda ≈ 1000 s. <i>Complemento (Burden):</i> el pivoteo <b>escalado</b> elige el mayor <Tex>{'|a_{ik}|/s_i'}</Tex> con <Tex>{'s_i=\\max_j|a_{ij}|'}</Tex>.
      </p>
      {T_CIFRAS}
    </>
  ),
  thomas: (
    <>
      <p>
        Para sistemas <b>tridiagonales</b> (<Tex>{'a_{ij}=0'}</Tex> si <Tex>{'|i-j|>1'}</Tex>), como los de splines cúbicos. Con la notación del texto, la ecuación <Tex>i</Tex> es{' '}
        <Tex>{'a_i x_{i-1} + b_i x_i + c_i x_{i+1} = d_i'}</Tex> y sólo se guardan los vectores <Tex>a, b, c, d</Tex> (<Tex>{'2n + 2(n-1)'}</Tex> valores en lugar de <Tex>{'n^2'}</Tex>).
      </p>
      <p>
        Es Gauss sin pivoteo: en cada columna sólo hay que anular un elemento bajo la diagonal; los <Tex>{'c_i'}</Tex> no cambian. Para <Tex>{'k=1,\\dots,n-1'}</Tex>:
      </p>
      <Tex block>{'b_{k+1}^{(k)} = b_{k+1}^{(k-1)} - \\frac{a_{k+1}}{b_k^{(k-1)}}\\,c_k,\\qquad d_{k+1}^{(k)} = d_{k+1}^{(k-1)} - \\frac{a_{k+1}}{b_k^{(k-1)}}\\,d_k^{(k-1)}'}</Tex>
      <p>
        <b>Sustitución regresiva:</b>
      </p>
      <Tex block>{'x_n = \\frac{d_n^{(n-1)}}{b_n^{(n-1)}},\\qquad x_k = \\frac{1}{b_k^{(k-1)}}\\big(d_k^{(k-1)} - c_k\\,x_{k+1}\\big),\\quad k = n-1,\\dots,1'}</Tex>
      <p>
        <b>Operaciones</b> (Práctica 04.1): triangularización <Tex>{'2(n-1)'}</Tex> restas, <Tex>{'2(n-1)'}</Tex> multiplicaciones y <Tex>{'n-1'}</Tex> divisiones; sustitución{' '}
        <Tex>{'n-1'}</Tex> restas, <Tex>{'n-1'}</Tex> multiplicaciones y <Tex>n</Tex> divisiones: en total <Tex>{'8n-7'}</Tex>, es decir, el tiempo de cálculo es{' '}
        <b>proporcional a n</b> (Gauss: <Tex>{'n^3'}</Tex>). Sin pivoteo, el método es estable si la matriz es diagonalmente dominante.
      </p>
      <p>
        <i>Variante normalizada</i> (Burden, “algoritmo de Crout tridiagonal”): se divide cada fila entre su pivote, <Tex>{"c'_k = c_k/b_k^{(k-1)}"}</Tex>,{' '}
        <Tex>{"d'_k = d_k^{(k-1)}/b_k^{(k-1)}"}</Tex>, y entonces <Tex>{"x_k = d'_k - c'_k x_{k+1}"}</Tex>. Da los mismos resultados.
      </p>
      {T_CIFRAS}
    </>
  ),
  lu: (
    <>
      <p>
        Se factoriza <Tex>A = LU</Tex> con <Tex>L</Tex> triangular inferior y <Tex>U</Tex> triangular superior, y el sistema se resuelve con dos sistemas triangulares:
      </p>
      <Tex block>{'Ax=b\\;\\Leftrightarrow\\; L(Ux)=b:\\qquad (1)\\;Ly=b\\;\\;\\text{(sustitución progresiva)},\\qquad (2)\\;Ux=y\\;\\;\\text{(sustitución regresiva)}'}</Tex>
      <p>
        <Tex>L</Tex> y <Tex>U</Tex> tienen <Tex>{'n(n+1)'}</Tex> incógnitas pero <Tex>LU=A</Tex> da sólo <Tex>{'n^2'}</Tex> ecuaciones, así que se fijan <Tex>n</Tex> valores:{' '}
        <b>Doolittle</b> (<Tex>{'l_{ii}=1'}</Tex>, el que desarrolla el texto) o <b>Crout</b> (<Tex>{'u_{ii}=1'}</Tex>). En Doolittle se calcula, en este orden, una <b>fila de U</b> y
        luego una <b>columna de L</b> (el orden garantiza que todo lo que aparece a la derecha ya se calculó):
      </p>
      <Tex block>{'u_{1j} = a_{1j};\\qquad u_{kj} = a_{kj} - \\sum_{m=1}^{k-1} l_{km}u_{mj}\\;\\;(j\\ge k),\\qquad l_{ik} = \\frac{1}{u_{kk}}\\Big(a_{ik} - \\sum_{m=1}^{k-1} l_{im}u_{mk}\\Big)\\;\\;(i>k)'}</Tex>
      <Tex block>{'y_1 = b_1,\\quad y_i = b_i - \\sum_{m=1}^{i-1} l_{im}y_m;\\qquad x_n = \\frac{y_n}{u_{nn}},\\quad x_i = \\frac{1}{u_{ii}}\\Big(y_i - \\sum_{m=i+1}^{n} u_{im}x_m\\Big)'}</Tex>
      <p>
        Como <Tex>{'\\det A = \\det L\\,\\det U = \\prod u_{ii} \\neq 0'}</Tex>, los <Tex>{'u_{ii}'}</Tex> son no nulos. Por los errores de redondeo conviene reordenar antes las ecuaciones
        para que el sistema sea lo más EDD posible (Ej. 3.2). Ventajas: se puede guardar <Tex>L</Tex> y <Tex>U</Tex> en una sola matriz (sin los unos de la diagonal de <Tex>L</Tex>),
        y cada nuevo <Tex>b</Tex> cuesta sólo <Tex>{'O(n^2)'}</Tex>, lo que sirve, p. ej., para calcular <Tex>{'A^{-1}'}</Tex> columna por columna.
      </p>
      <p>
        <i>Complementos (Burden):</i> <b>PA = LU</b> con pivoteo parcial (<Tex>P</Tex> registra los intercambios; se resuelve <Tex>Ly=Pb</Tex>) y <b>Cholesky</b>{' '}
        <Tex>{'A=LL^T'}</Tex>, que existe si y sólo si <Tex>A</Tex> es simétrica definida positiva:{' '}
        <Tex>{'l_{jj} = \\sqrt{a_{jj} - \\sum_{k<j} l_{jk}^2}'}</Tex>, <Tex>{'l_{ij} = (a_{ij} - \\sum_{k<j} l_{ik}l_{jk})/l_{jj}'}</Tex>.
      </p>
      {T_CIFRAS}
    </>
  ),
  jacobi: (
    <>
      <p>
        Los métodos iterativos se usan sobre todo en sistemas grandes y dispersos. Primero se <b>reordenan</b> las ecuaciones para que la diagonal tenga los coeficientes de mayor valor
        absoluto (lo más EDD posible, y <Tex>{'a_{ii}\\neq 0'}</Tex>) y se despeja la incógnita de la diagonal de cada ecuación: <Tex>{'Ax=b \\;\\Rightarrow\\; x = Cx + D'}</Tex>, con
      </p>
      <Tex block>{'c_{ij} = -\\frac{a_{ij}}{a_{ii}}\\;(j\\neq i),\\quad c_{ii}=0,\\qquad D_i = \\frac{b_i}{a_{ii}}'}</Tex>
      <p>
        <b>Gauss-Jacobi (desplazamientos simultáneos):</b> toda la nueva aproximación se calcula con la anterior, <Tex>{'x^{(k+1)} = Cx^{(k)} + D'}</Tex>, es decir,
      </p>
      <Tex block>{'x_i^{(k+1)} = \\frac{1}{a_{ii}}\\Big(b_i - \\sum_{j\\neq i} a_{ij}\\,x_j^{(k)}\\Big),\\qquad i=1,\\dots,n,\\quad k\\ge 0'}</Tex>
      <p>
        <b>Condición suficiente de convergencia</b> (para cualquier <Tex>{'x^{(0)}'}</Tex>): por filas o por columnas,
      </p>
      <Tex block>{'\\forall i:\\;\\sum_{j\\neq i}|a_{ij}| < |a_{ii}| \\quad\\text{o}\\quad \\forall j:\\;\\sum_{i\\neq j}|a_{ij}| < |a_{jj}|;\\qquad\\text{con } C:\\;\\forall i:\\sum_j|c_{ij}|<1\\;\\;\\text{o}\\;\\;\\forall j:\\sum_i|c_{ij}|<1'}</Tex>
      <p>
        Es sólo suficiente: si no se cumple, el método puede o no converger (Ej. 3.3). <b>Criterio de parada:</b> se elige una norma — euclidiana{' '}
        <Tex>{'\\|x\\|_2=(\\sum x_i^2)^{1/2}'}</Tex>, maximal <Tex>{'\\|x\\|_\\infty=\\max|x_i|'}</Tex> o, en general, <Tex>{'\\|x\\|_p'}</Tex> — y un <Tex>eps</Tex> (en general{' '}
        <Tex>{'eps\\le 10^{-3}'}</Tex>), y se para cuando <Tex>{'\\|x^{(k)}-x^{(k-1)}\\| < eps'}</Tex>. En la práctica se empieza con <Tex>{'x^{(0)}=0'}</Tex>.
      </p>
      <p>
        <i>Complemento (Burden):</i> con <Tex>A=D+L+U</Tex>, la matriz de iteración es <Tex>{'T_J = C = -D^{-1}(L+U)'}</Tex> y el método converge para todo <Tex>{'x^{(0)}'}</Tex> si y sólo
        si el <b>radio espectral</b> <Tex>{'\\rho(T_J)=\\max|\\lambda_i|<1'}</Tex>; el error baja ≈ un factor <Tex>{'\\rho'}</Tex> por iteración.
      </p>
    </>
  ),
  'gauss-seidel': (
    <>
      <p>
        <b>Gauss-Seidel (desplazamientos sucesivos):</b> igual que Gauss-Jacobi, pero cada componente nueva se usa <b>inmediatamente</b> en el cálculo de las siguientes, suponiendo que es
        mejor que la anterior; en general converge más rápido:
      </p>
      <Tex block>{'x_i^{(k+1)} = \\frac{1}{a_{ii}}\\Big(b_i - \\sum_{j<i} a_{ij}\\,x_j^{(k+1)} - \\sum_{j>i} a_{ij}\\,x_j^{(k)}\\Big),\\qquad k\\ge 0'}</Tex>
      <p>
        La <b>condición suficiente</b> del texto es la misma que para Jacobi (dominancia diagonal estricta por filas o por columnas) y el criterio de parada también:{' '}
        <Tex>{'\\|x^{(k)}-x^{(k-1)}\\|<eps'}</Tex> en la norma elegida. En el Ej. 3.3 Jacobi diverge y Gauss-Seidel converge; en el sistema modificado (EDD) ambos convergen, Gauss-Seidel en
        10 iteraciones y Jacobi en 86.
      </p>
      <p>
        <i>Complementos (Burden):</i> <Tex>{'T_{GS} = -(D+L)^{-1}U'}</Tex>; converge si y sólo si <Tex>{'\\rho(T_{GS})<1'}</Tex> (en particular si <Tex>A</Tex> es EDD o simétrica
        definida positiva). Para matrices tridiagonales <Tex>{'\\rho(T_{GS}) = \\rho(T_J)^2'}</Tex>. <b>SOR</b> (sobrerrelajación) promedia con un factor <Tex>\omega</Tex>:
      </p>
      <Tex block>{'x_i^{(k+1)} = (1-\\omega)\\,x_i^{(k)} + \\frac{\\omega}{a_{ii}}\\Big(b_i - \\sum_{j<i} a_{ij}x_j^{(k+1)} - \\sum_{j>i} a_{ij}x_j^{(k)}\\Big),\\qquad T_\\omega = (D+\\omega L)^{-1}\\big[(1-\\omega)D - \\omega U\\big]'}</Tex>
      <p>
        <Tex>\omega=1</Tex> es Gauss-Seidel; se necesita <Tex>{'0<\\omega<2'}</Tex> (Kahan). Para tridiagonales definidas positivas el óptimo es{' '}
        <Tex>{'\\omega_{\\text{opt}} = 2/\\big(1+\\sqrt{1-\\rho(T_J)^2}\\big)'}</Tex>.
      </p>
    </>
  ),
  condicion: (
    <>
      <p>
        Un sistema es <b>estable</b> o <b>bien condicionado</b> si pequeños errores en los coeficientes (o durante el cálculo) tienen un efecto pequeño en la solución; si no, es{' '}
        <b>inestable</b> o <b>mal condicionado</b>. Para medirlo se usa la <b>norma de una matriz</b>, inducida por una norma vectorial:
      </p>
      <Tex block>{'\\|A\\| = \\max_{x\\neq 0}\\frac{\\|Ax\\|}{\\|x\\|} = \\max_{\\|x\\|=1}\\|Ax\\|,\\qquad \\kappa(A) = \\|A\\|\\,\\|A^{-1}\\|\\;\\ge 1'}</Tex>
      <p>
        El sistema está bien condicionado si el <b>número de condición</b> <Tex>{'\\kappa(A)'}</Tex> es pequeño (del orden de 10); si es grande, está mal condicionado (Ej. 3.4:{' '}
        <Tex>{'\\kappa\\approx 20000'}</Tex>). Las normas inducidas más usadas son
      </p>
      <Tex block>{'\\|A\\|_1 = \\max_j \\sum_i |a_{ij}|\\;(\\text{columnas}),\\qquad \\|A\\|_\\infty = \\max_i \\sum_j |a_{ij}|\\;(\\text{filas}),\\qquad \\|A\\|_2 = \\sigma_{\\max},\\;\\;\\kappa_2 = \\frac{\\sigma_{\\max}}{\\sigma_{\\min}}'}</Tex>
      <p>
        <Tex>{'\\kappa_2'}</Tex> es lo que calcula <code>cond(A)</code> en Matlab/Scilab. Interpretación (Burden):{' '}
        <Tex>{'\\frac{\\|\\delta x\\|}{\\|x\\|} \\le \\kappa(A)\\,\\frac{\\|\\delta b\\|}{\\|b\\|}'}</Tex>, y con <Tex>t</Tex> cifras se pierden ≈ <Tex>{'\\log_{10}\\kappa(A)'}</Tex> de ellas.
        Un determinante pequeño <b>no</b> implica mal condicionamiento (<Tex>{'0.1\\,I_{10}'}</Tex> tiene <Tex>{'\\det = 10^{-10}'}</Tex> y <Tex>{'\\kappa=1'}</Tex>). La matriz de Hilbert
        es el ejemplo clásico de mal condicionamiento (Práctica 05).
      </p>
    </>
  ),
  'newton-sistemas': (
    <>
      <p>
        Un sistema no lineal <Tex>{'f_1(x,y)=0,\\;f_2(x,y)=0'}</Tex> se resuelve buscando la intersección de las curvas <Tex>{'f_i=0'}</Tex>; la gráfica da una aproximación inicial{' '}
        <Tex>{'(x_0,y_0)'}</Tex>. Con Taylor de primer orden alrededor de <Tex>{'(x_0,y_0)'}</Tex>, evaluado en la solución <Tex>{'(\\alpha,\\beta)'}</Tex>:
      </p>
      <Tex block>{'\\underbrace{\\begin{pmatrix} \\partial_x f_1 & \\partial_y f_1 \\\\ \\partial_x f_2 & \\partial_y f_2 \\end{pmatrix}_{(x_0,y_0)}}_{J(x_0,y_0)\\;\\text{(Jacobiano)}}\\begin{pmatrix}\\alpha-x_0\\\\ \\beta-y_0\\end{pmatrix} \\approx -\\begin{pmatrix} f_1(x_0,y_0)\\\\ f_2(x_0,y_0)\\end{pmatrix}'}</Tex>
      <p>
        Convirtiendo la aproximación en igualdad se obtiene el <b>método de Newton</b>: (i) se fija <Tex>{'(x_0,y_0)'}</Tex> y <Tex>eps</Tex>; (ii) se resuelve el sistema{' '}
        <b>lineal</b> <Tex>{'J(x_k,y_k)\\,(\\Delta x,\\Delta y)^T = -\\big(f_1,f_2\\big)^T_{(x_k,y_k)}'}</Tex>; (iii){' '}
        <Tex>{'x_{k+1}=x_k+\\Delta x,\\;y_{k+1}=y_k+\\Delta y'}</Tex>; (iv) si se cumple el criterio de convergencia se para, si no se vuelve a (ii). No hace falta calcular{' '}
        <Tex>{'J^{-1}'}</Tex>. Con <Tex>n</Tex> ecuaciones es igual, con el Jacobiano <Tex>{'n\\times n'}</Tex> <Tex>{'J_{ij} = \\partial f_i/\\partial x_j'}</Tex>.
      </p>
      <p>
        Aquí se para cuando <Tex>{'\\|\\Delta\\mathbf{x}^{(k)}\\|_\\infty < eps'}</Tex> y el sistema lineal se resuelve por Gauss con pivoteo. La convergencia es <b>cuadrática</b> si{' '}
        <Tex>{'J'}</Tex> es no singular en la solución (Ej. 3.6: seis cifras en dos iteraciones); si las curvas son tangentes, <Tex>J</Tex> es singular y la convergencia se vuelve lenta
        (Ej. 3.5, <Tex>{'x^2+y^2=2,\\;xy=1'}</Tex>).
      </p>
    </>
  ),
  'punto-fijo-sistemas': (
    <>
      <p>
        Como en el punto fijo de una variable, se despeja una incógnita de cada ecuación, <Tex>{'x=g_1(x,y),\\;y=g_2(x,y)'}</Tex>, y se itera desde <Tex>{'(x_0,y_0)'}</Tex>:
      </p>
      <Tex block>{'x_{k+1} = g_1(x_k,y_k),\\qquad y_{k+1} = g_2(x_k,y_k),\\qquad k\\ge 0'}</Tex>
      <p>
        <b>Condición suficiente:</b> en la solución (el punto fijo) <Tex>{'(\\alpha,\\beta)'}</Tex>, la suma de los valores absolutos de las derivadas parciales de cada <Tex>{'g_i'}</Tex>{' '}
        debe ser menor que 1. Como la solución no se conoce, en la práctica se verifica en <Tex>{'(x_0,y_0)'}</Tex>: si se cumple, se puede esperar convergencia; si no, probablemente no:
      </p>
      <Tex block>{'\\Big|\\frac{\\partial g_i}{\\partial x}(x_0,y_0)\\Big| + \\Big|\\frac{\\partial g_i}{\\partial y}(x_0,y_0)\\Big| < 1,\\qquad i=1,2'}</Tex>
      <p>
        Un mismo sistema admite varios despejes; cada uno puede converger a una raíz distinta o no converger (Ej. 3.7). <b>Seidel:</b> la convergencia se acelera usando en{' '}
        <Tex>{'g_2'}</Tex> el valor <Tex>{'x_{k+1}'}</Tex> ya calculado, <Tex>{'y_{k+1}=g_2(x_{k+1},y_k)'}</Tex>. Con 3 o más ecuaciones es igual, sumando las derivadas respecto de
        todas las variables. Criterio de parada aquí: <Tex>{'\\|\\mathbf{x}^{(k)}-\\mathbf{x}^{(k-1)}\\|_\\infty<eps'}</Tex>.
      </p>
    </>
  ),
  potencia: (
    <>
      <p>
        <i>Complemento (Burden, cap. 9): el capítulo 3 del texto no desarrolla este método; el sílabo pide entender el cálculo de valores propios.</i> Si <Tex>A</Tex> tiene un valor propio{' '}
        <b>dominante</b> <Tex>{'|\\lambda_1| > |\\lambda_2| \\ge \\dots \\ge |\\lambda_n|'}</Tex>, la sucesión <Tex>{'A^k x^{(0)}'}</Tex> se alinea con su vector propio. Normalizando con{' '}
        <Tex>{'\\|\\cdot\\|_\\infty'}</Tex>:
      </p>
      <Tex block>{'y^{(k)} = A\\,x^{(k-1)},\\qquad \\mu^{(k)} = y^{(k)}_{p},\\qquad x^{(k)} = \\frac{y^{(k)}}{y^{(k)}_{p_k}}'}</Tex>
      <p>
        donde <Tex>p</Tex> es el índice de la componente de mayor módulo de <Tex>{'x^{(k-1)}'}</Tex> (que vale 1). Entonces <Tex>{'\\mu^{(k)}\\to\\lambda_1'}</Tex> y{' '}
        <Tex>{'x^{(k)}\\to v_1'}</Tex> con convergencia lineal de razón <Tex>{'|\\lambda_2/\\lambda_1|'}</Tex>.
      </p>
      <p>
        <b>Potencia inversa con desplazamiento</b> <Tex>q</Tex>: los valores propios de <Tex>{'(A-qI)^{-1}'}</Tex> son <Tex>{'1/(\\lambda_i - q)'}</Tex>; el dominante corresponde al{' '}
        <Tex>{'\\lambda_i'}</Tex> <b>más cercano a</b> <Tex>q</Tex>:
      </p>
      <Tex block>{'(A - qI)\\,y^{(k)} = x^{(k-1)},\\qquad \\lambda \\approx q + \\frac{1}{\\mu^{(k)}}'}</Tex>
      <p>
        Con <Tex>q=0</Tex> se obtiene el valor propio de <b>menor</b> módulo. La matriz <Tex>A-qI</Tex> se factoriza (LU) una sola vez. Los valores propios también deciden la
        convergencia de Jacobi y Gauss-Seidel: el radio espectral <Tex>{'\\rho(T)'}</Tex> de la matriz de iteración.
      </p>
    </>
  ),
}

/** Common note (English): t-digit arithmetic in the textbook examples. */
const T_DIGITS = (
  <p>
    <b>t-digit arithmetic.</b> The textbook examples are solved with a decimal “calculator” with 4 mantissa digits: every datum and the result of every operation are
    rounded to 4 significant digits. The <i>Mantissa digits</i> field simulates that calculator (0 = double precision, ≈ 16 digits).
  </p>
)

const THEORY_EN: Record<SisId, ReactNode> = {
  gauss: (
    <>
      <p>
        We solve <Tex>Ax=b</Tex> (with <Tex>{'\\det A\\neq 0'}</Tex>) in two stages: <b>reduction to triangular form</b> (with pivoting) and <b>back substitution</b>. The
        reduction uses two elementary operations that do not change the solution: interchanging two equations and subtracting from one equation a multiple of another.
      </p>
      <p>
        <b>Column k</b> (<Tex>{'k=1,\\dots,n-1'}</Tex>). <i>Pivoting:</i> among equations <Tex>{'k,\\dots,n'}</Tex> find the one with the largest <Tex>{'|a_{ik}^{(k-1)}|'}</Tex> and
        interchange it with equation <Tex>k</Tex>\\; this makes the pivot <Tex>{'a_{kk}^{(k-1)}'}</Tex> nonzero. <i>Elimination:</i> for <Tex>{'i,j=k+1,\\dots,n'}</Tex>
      </p>
      <Tex block>{'a_{ij}^{(k)} = a_{ij}^{(k-1)} - \\frac{a_{ik}^{(k-1)}}{a_{kk}^{(k-1)}}\\,a_{kj}^{(k-1)},\\qquad b_i^{(k)} = b_i^{(k-1)} - \\frac{a_{ik}^{(k-1)}}{a_{kk}^{(k-1)}}\\,b_k^{(k-1)}'}</Tex>
      <p>
        The superscript <Tex>{'(0)'}</Tex> denotes the original system. After column <Tex>n-1</Tex> the system is upper triangular and is solved starting from the last equation:
      </p>
      <Tex block>{'x_n = \\frac{b_n^{(n-1)}}{a_{nn}^{(n-1)}},\\qquad x_i = \\frac{1}{a_{ii}^{(i-1)}}\\Big(b_i^{(i-1)} - \\sum_{j=i+1}^{n} a_{ij}^{(i-1)}x_j\\Big),\\quad i = n-1,\\dots,1'}</Tex>
      <p>
        Pivoting makes the method always possible and reduces the propagation of round-off errors (Ex. 3.1: it gains one significant digit). If the matrix is{' '}
        <b>strictly diagonally dominant</b> (SDD), <Tex>{'|a_{ii}| > \\sum_{j\\neq i}|a_{ij}|'}</Tex>, pivoting is not needed\\; that is why it pays to reorder the equations so the
        system is as SDD as possible. As a by-product, <Tex>{'\\det A = \\pm\\prod_i a_{ii}^{(i-1)}'}</Tex> (sign − if there was an odd number of interchanges).
      </p>
      <p>
        <b>Speed.</b> Memory <Tex>{'\\propto n^2'}</Tex>. Operations (textbook table, without pivoting):
      </p>
      <div className="table-wrap" style={{ margin: '8px 0' }}>
        <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Triangular reduction</th>
              <th>Back substitution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Subtractions</td>
              <td><Tex>{'\\sum_{i=1}^{n-1} i^2 = \\tfrac{(n-1)n(2n-1)}{6}'}</Tex></td>
              <td><Tex>{'\\tfrac{(n-1)n}{2}'}</Tex></td>
            </tr>
            <tr>
              <td>Multiplications</td>
              <td><Tex>{'\\tfrac{(n-1)n(2n-1)}{6}'}</Tex></td>
              <td><Tex>{'\\tfrac{(n-1)n}{2}'}</Tex></td>
            </tr>
            <tr>
              <td>Divisions</td>
              <td><Tex>{'\\tfrac{(n-1)n}{2}'}</Tex></td>
              <td><Tex>n</Tex></td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <p>
        The total grows like <Tex>{'n^3'}</Tex> (transforming <Tex>b</Tex> adds <Tex>{'\\tfrac{(n-1)n}{2}'}</Tex> more multiplications and subtractions): if <Tex>n=10</Tex> takes 1 s,{' '}
        <Tex>n=100</Tex> takes ≈ 1000 s. <i>Supplement (Burden):</i> <b>scaled</b> partial pivoting chooses the largest <Tex>{'|a_{ik}|/s_i'}</Tex> with <Tex>{'s_i=\\max_j|a_{ij}|'}</Tex>.
      </p>
      {T_DIGITS}
    </>
  ),
  thomas: (
    <>
      <p>
        For <b>tridiagonal</b> systems (<Tex>{'a_{ij}=0'}</Tex> if <Tex>{'|i-j|>1'}</Tex>), such as those of cubic splines. In the textbook notation, equation <Tex>i</Tex> is{' '}
        <Tex>{'a_i x_{i-1} + b_i x_i + c_i x_{i+1} = d_i'}</Tex> and only the vectors <Tex>a, b, c, d</Tex> are stored (<Tex>{'2n + 2(n-1)'}</Tex> values instead of <Tex>{'n^2'}</Tex>).
      </p>
      <p>
        It is Gaussian elimination without pivoting: in each column only one entry below the diagonal has to be eliminated\\; the <Tex>{'c_i'}</Tex> do not change. For <Tex>{'k=1,\\dots,n-1'}</Tex>:
      </p>
      <Tex block>{'b_{k+1}^{(k)} = b_{k+1}^{(k-1)} - \\frac{a_{k+1}}{b_k^{(k-1)}}\\,c_k,\\qquad d_{k+1}^{(k)} = d_{k+1}^{(k-1)} - \\frac{a_{k+1}}{b_k^{(k-1)}}\\,d_k^{(k-1)}'}</Tex>
      <p>
        <b>Back substitution:</b>
      </p>
      <Tex block>{'x_n = \\frac{d_n^{(n-1)}}{b_n^{(n-1)}},\\qquad x_k = \\frac{1}{b_k^{(k-1)}}\\big(d_k^{(k-1)} - c_k\\,x_{k+1}\\big),\\quad k = n-1,\\dots,1'}</Tex>
      <p>
        <b>Operations</b> (Practice 04.1): reduction <Tex>{'2(n-1)'}</Tex> subtractions, <Tex>{'2(n-1)'}</Tex> multiplications and <Tex>{'n-1'}</Tex> divisions\\; substitution{' '}
        <Tex>{'n-1'}</Tex> subtractions, <Tex>{'n-1'}</Tex> multiplications and <Tex>n</Tex> divisions: <Tex>{'8n-7'}</Tex> in total, so the computing time is{' '}
        <b>proportional to n</b> (Gauss: <Tex>{'n^3'}</Tex>). Without pivoting, the method is stable if the matrix is diagonally dominant.
      </p>
      <p>
        <i>Normalized variant</i> (Burden, “Crout factorization for tridiagonal systems”): each row is divided by its pivot, <Tex>{"c'_k = c_k/b_k^{(k-1)}"}</Tex>,{' '}
        <Tex>{"d'_k = d_k^{(k-1)}/b_k^{(k-1)}"}</Tex>, and then <Tex>{"x_k = d'_k - c'_k x_{k+1}"}</Tex>. It gives the same results.
      </p>
      {T_DIGITS}
    </>
  ),
  lu: (
    <>
      <p>
        We factor <Tex>A = LU</Tex> with <Tex>L</Tex> lower triangular and <Tex>U</Tex> upper triangular, and the system is solved through two triangular systems:
      </p>
      <Tex block>{'Ax=b\\;\\Leftrightarrow\\; L(Ux)=b:\\qquad (1)\\;Ly=b\\;\\;\\text{(forward substitution)},\\qquad (2)\\;Ux=y\\;\\;\\text{(back substitution)}'}</Tex>
      <p>
        <Tex>L</Tex> and <Tex>U</Tex> have <Tex>{'n(n+1)'}</Tex> unknowns but <Tex>LU=A</Tex> gives only <Tex>{'n^2'}</Tex> equations, so <Tex>n</Tex> values are fixed:{' '}
        <b>Doolittle</b> (<Tex>{'l_{ii}=1'}</Tex>, the one developed in the textbook) or <b>Crout</b> (<Tex>{'u_{ii}=1'}</Tex>). In Doolittle one computes, in this order, a <b>row of U</b> and
        then a <b>column of L</b> (the order guarantees that everything on the right-hand side has already been computed):
      </p>
      <Tex block>{'u_{1j} = a_{1j}\\;\\qquad u_{kj} = a_{kj} - \\sum_{m=1}^{k-1} l_{km}u_{mj}\\;\\;(j\\ge k),\\qquad l_{ik} = \\frac{1}{u_{kk}}\\Big(a_{ik} - \\sum_{m=1}^{k-1} l_{im}u_{mk}\\Big)\\;\\;(i>k)'}</Tex>
      <Tex block>{'y_1 = b_1,\\quad y_i = b_i - \\sum_{m=1}^{i-1} l_{im}y_m\\;\\qquad x_n = \\frac{y_n}{u_{nn}},\\quad x_i = \\frac{1}{u_{ii}}\\Big(y_i - \\sum_{m=i+1}^{n} u_{im}x_m\\Big)'}</Tex>
      <p>
        Since <Tex>{'\\det A = \\det L\\,\\det U = \\prod u_{ii} \\neq 0'}</Tex>, the <Tex>{'u_{ii}'}</Tex> are nonzero. Because of round-off errors it pays to reorder the equations first
        so the system is as SDD as possible (Ex. 3.2). Advantages: <Tex>L</Tex> and <Tex>U</Tex> can be stored in a single matrix (without the ones on the diagonal of <Tex>L</Tex>),
        and each new <Tex>b</Tex> costs only <Tex>{'O(n^2)'}</Tex>, which is useful, e.g., to compute <Tex>{'A^{-1}'}</Tex> column by column.
      </p>
      <p>
        <i>Supplements (Burden):</i> <b>PA = LU</b> with partial pivoting (<Tex>P</Tex> records the interchanges\\; one solves <Tex>Ly=Pb</Tex>) and <b>Cholesky</b>{' '}
        <Tex>{'A=LL^T'}</Tex>, which exists if and only if <Tex>A</Tex> is symmetric positive definite:{' '}
        <Tex>{'l_{jj} = \\sqrt{a_{jj} - \\sum_{k<j} l_{jk}^2}'}</Tex>, <Tex>{'l_{ij} = (a_{ij} - \\sum_{k<j} l_{ik}l_{jk})/l_{jj}'}</Tex>.
      </p>
      {T_DIGITS}
    </>
  ),
  jacobi: (
    <>
      <p>
        Iterative methods are used mainly for large sparse systems. First the equations are <b>reordered</b> so that the diagonal holds the coefficients of largest absolute
        value (as SDD as possible, and <Tex>{'a_{ii}\\neq 0'}</Tex>) and the diagonal unknown is solved for in each equation: <Tex>{'Ax=b \\;\\Rightarrow\\; x = Cx + D'}</Tex>, with
      </p>
      <Tex block>{'c_{ij} = -\\frac{a_{ij}}{a_{ii}}\\;(j\\neq i),\\quad c_{ii}=0,\\qquad D_i = \\frac{b_i}{a_{ii}}'}</Tex>
      <p>
        <b>Jacobi (simultaneous displacements):</b> the whole new approximation is computed from the previous one, <Tex>{'x^{(k+1)} = Cx^{(k)} + D'}</Tex>, that is,
      </p>
      <Tex block>{'x_i^{(k+1)} = \\frac{1}{a_{ii}}\\Big(b_i - \\sum_{j\\neq i} a_{ij}\\,x_j^{(k)}\\Big),\\qquad i=1,\\dots,n,\\quad k\\ge 0'}</Tex>
      <p>
        <b>Sufficient condition for convergence</b> (for any <Tex>{'x^{(0)}'}</Tex>): by rows or by columns,
      </p>
      <Tex block>{'\\forall i:\\;\\sum_{j\\neq i}|a_{ij}| < |a_{ii}| \\quad\\text{or}\\quad \\forall j:\\;\\sum_{i\\neq j}|a_{ij}| < |a_{jj}|\\;\\qquad\\text{with } C:\\;\\forall i:\\sum_j|c_{ij}|<1\\;\\;\\text{or}\\;\\;\\forall j:\\sum_i|c_{ij}|<1'}</Tex>
      <p>
        It is only sufficient: if it fails, the method may or may not converge (Ex. 3.3). <b>Stopping criterion:</b> choose a norm — Euclidean{' '}
        <Tex>{'\\|x\\|_2=(\\sum x_i^2)^{1/2}'}</Tex>, maximum <Tex>{'\\|x\\|_\\infty=\\max|x_i|'}</Tex> or, in general, <Tex>{'\\|x\\|_p'}</Tex> — and an <Tex>eps</Tex> (usually{' '}
        <Tex>{'eps\\le 10^{-3}'}</Tex>), and stop when <Tex>{'\\|x^{(k)}-x^{(k-1)}\\| < eps'}</Tex>. In practice one starts with <Tex>{'x^{(0)}=0'}</Tex>.
      </p>
      <p>
        <i>Supplement (Burden):</i> with <Tex>A=D+L+U</Tex>, the iteration matrix is <Tex>{'T_J = C = -D^{-1}(L+U)'}</Tex> and the method converges for every <Tex>{'x^{(0)}'}</Tex> if and
        only if the <b>spectral radius</b> <Tex>{'\\rho(T_J)=\\max|\\lambda_i|<1'}</Tex>\\; the error decreases by a factor ≈ <Tex>{'\\rho'}</Tex> per iteration.
      </p>
    </>
  ),
  'gauss-seidel': (
    <>
      <p>
        <b>Gauss–Seidel (successive displacements):</b> like Jacobi, but each new component is used <b>immediately</b> in computing the following ones, assuming it is better
        than the previous one\\; it usually converges faster:
      </p>
      <Tex block>{'x_i^{(k+1)} = \\frac{1}{a_{ii}}\\Big(b_i - \\sum_{j<i} a_{ij}\\,x_j^{(k+1)} - \\sum_{j>i} a_{ij}\\,x_j^{(k)}\\Big),\\qquad k\\ge 0'}</Tex>
      <p>
        The textbook's <b>sufficient condition</b> is the same as for Jacobi (strict diagonal dominance by rows or by columns), and so is the stopping criterion:{' '}
        <Tex>{'\\|x^{(k)}-x^{(k-1)}\\|<eps'}</Tex> in the chosen norm. In Ex. 3.3 Jacobi diverges and Gauss–Seidel converges\\; in the modified (SDD) system both converge, Gauss–Seidel in
        10 iterations and Jacobi in 86.
      </p>
      <p>
        <i>Supplements (Burden):</i> <Tex>{'T_{GS} = -(D+L)^{-1}U'}</Tex>\\; it converges if and only if <Tex>{'\\rho(T_{GS})<1'}</Tex> (in particular if <Tex>A</Tex> is SDD or symmetric
        positive definite). For tridiagonal matrices <Tex>{'\\rho(T_{GS}) = \\rho(T_J)^2'}</Tex>. <b>SOR</b> (successive over-relaxation) averages with a factor <Tex>\omega</Tex>:
      </p>
      <Tex block>{'x_i^{(k+1)} = (1-\\omega)\\,x_i^{(k)} + \\frac{\\omega}{a_{ii}}\\Big(b_i - \\sum_{j<i} a_{ij}x_j^{(k+1)} - \\sum_{j>i} a_{ij}x_j^{(k)}\\Big),\\qquad T_\\omega = (D+\\omega L)^{-1}\\big[(1-\\omega)D - \\omega U\\big]'}</Tex>
      <p>
        <Tex>\omega=1</Tex> is Gauss–Seidel\\; <Tex>{'0<\\omega<2'}</Tex> is required (Kahan). For positive definite tridiagonal matrices the optimum is{' '}
        <Tex>{'\\omega_{\\text{opt}} = 2/\\big(1+\\sqrt{1-\\rho(T_J)^2}\\big)'}</Tex>.
      </p>
    </>
  ),
  condicion: (
    <>
      <p>
        A system is <b>stable</b> or <b>well-conditioned</b> if small errors in the coefficients (or during the computation) have a small effect on the solution\\; otherwise it is{' '}
        <b>unstable</b> or <b>ill-conditioned</b>. To measure this we use the <b>norm of a matrix</b>, induced by a vector norm:
      </p>
      <Tex block>{'\\|A\\| = \\max_{x\\neq 0}\\frac{\\|Ax\\|}{\\|x\\|} = \\max_{\\|x\\|=1}\\|Ax\\|,\\qquad \\kappa(A) = \\|A\\|\\,\\|A^{-1}\\|\\;\\ge 1'}</Tex>
      <p>
        The system is well-conditioned if the <b>condition number</b> <Tex>{'\\kappa(A)'}</Tex> is small (of the order of 10)\\; if it is large, it is ill-conditioned (Ex. 3.4:{' '}
        <Tex>{'\\kappa\\approx 20000'}</Tex>). The most common induced norms are
      </p>
      <Tex block>{'\\|A\\|_1 = \\max_j \\sum_i |a_{ij}|\\;(\\text{columns}),\\qquad \\|A\\|_\\infty = \\max_i \\sum_j |a_{ij}|\\;(\\text{rows}),\\qquad \\|A\\|_2 = \\sigma_{\\max},\\;\\;\\kappa_2 = \\frac{\\sigma_{\\max}}{\\sigma_{\\min}}'}</Tex>
      <p>
        <Tex>{'\\kappa_2'}</Tex> is what <code>cond(A)</code> computes in Matlab/Scilab. Interpretation (Burden):{' '}
        <Tex>{'\\frac{\\|\\delta x\\|}{\\|x\\|} \\le \\kappa(A)\\,\\frac{\\|\\delta b\\|}{\\|b\\|}'}</Tex>, and with <Tex>t</Tex> digits about <Tex>{'\\log_{10}\\kappa(A)'}</Tex> of them are lost.
        A small determinant does <b>not</b> imply ill-conditioning (<Tex>{'0.1\\,I_{10}'}</Tex> has <Tex>{'\\det = 10^{-10}'}</Tex> and <Tex>{'\\kappa=1'}</Tex>). The Hilbert matrix
        is the classic example of ill-conditioning (Practice 05).
      </p>
    </>
  ),
  'newton-sistemas': (
    <>
      <p>
        A nonlinear system <Tex>{'f_1(x,y)=0,\\;f_2(x,y)=0'}</Tex> is solved by looking for the intersection of the curves <Tex>{'f_i=0'}</Tex>\\; the plot gives an initial approximation{' '}
        <Tex>{'(x_0,y_0)'}</Tex>. With a first-order Taylor expansion about <Tex>{'(x_0,y_0)'}</Tex>, evaluated at the solution <Tex>{'(\\alpha,\\beta)'}</Tex>:
      </p>
      <Tex block>{'\\underbrace{\\begin{pmatrix} \\partial_x f_1 & \\partial_y f_1 \\\\ \\partial_x f_2 & \\partial_y f_2 \\end{pmatrix}_{(x_0,y_0)}}_{J(x_0,y_0)\\;\\text{(Jacobian)}}\\begin{pmatrix}\\alpha-x_0\\\\ \\beta-y_0\\end{pmatrix} \\approx -\\begin{pmatrix} f_1(x_0,y_0)\\\\ f_2(x_0,y_0)\\end{pmatrix}'}</Tex>
      <p>
        Turning the approximation into an equality yields <b>Newton's method</b>: (i) fix <Tex>{'(x_0,y_0)'}</Tex> and <Tex>eps</Tex>\\; (ii) solve the{' '}
        <b>linear</b> system <Tex>{'J(x_k,y_k)\\,(\\Delta x,\\Delta y)^T = -\\big(f_1,f_2\\big)^T_{(x_k,y_k)}'}</Tex>\\; (iii){' '}
        <Tex>{'x_{k+1}=x_k+\\Delta x,\\;y_{k+1}=y_k+\\Delta y'}</Tex>\\; (iv) if the convergence criterion holds, stop\\; otherwise go back to (ii). There is no need to compute{' '}
        <Tex>{'J^{-1}'}</Tex>. With <Tex>n</Tex> equations it is the same, with the <Tex>{'n\\times n'}</Tex> Jacobian <Tex>{'J_{ij} = \\partial f_i/\\partial x_j'}</Tex>.
      </p>
      <p>
        Here we stop when <Tex>{'\\|\\Delta\\mathbf{x}^{(k)}\\|_\\infty < eps'}</Tex> and the linear system is solved by Gaussian elimination with pivoting. Convergence is <b>quadratic</b> if{' '}
        <Tex>{'J'}</Tex> is nonsingular at the solution (Ex. 3.6: six digits in two iterations)\\; if the curves are tangent, <Tex>J</Tex> is singular and convergence becomes slow
        (Ex. 3.5, <Tex>{'x^2+y^2=2,\\;xy=1'}</Tex>).
      </p>
    </>
  ),
  'punto-fijo-sistemas': (
    <>
      <p>
        As in one-variable fixed-point iteration, one unknown is solved for in each equation, <Tex>{'x=g_1(x,y),\\;y=g_2(x,y)'}</Tex>, and we iterate from <Tex>{'(x_0,y_0)'}</Tex>:
      </p>
      <Tex block>{'x_{k+1} = g_1(x_k,y_k),\\qquad y_{k+1} = g_2(x_k,y_k),\\qquad k\\ge 0'}</Tex>
      <p>
        <b>Sufficient condition:</b> at the solution (the fixed point) <Tex>{'(\\alpha,\\beta)'}</Tex>, the sum of the absolute values of the partial derivatives of each <Tex>{'g_i'}</Tex>{' '}
        must be less than 1. Since the solution is unknown, in practice it is checked at <Tex>{'(x_0,y_0)'}</Tex>: if it holds, convergence can be expected\\; if not, probably not:
      </p>
      <Tex block>{'\\Big|\\frac{\\partial g_i}{\\partial x}(x_0,y_0)\\Big| + \\Big|\\frac{\\partial g_i}{\\partial y}(x_0,y_0)\\Big| < 1,\\qquad i=1,2'}</Tex>
      <p>
        The same system admits several rearrangements\\; each may converge to a different root or not converge at all (Ex. 3.7). <b>Seidel:</b> convergence is accelerated by using in{' '}
        <Tex>{'g_2'}</Tex> the already computed value <Tex>{'x_{k+1}'}</Tex>, <Tex>{'y_{k+1}=g_2(x_{k+1},y_k)'}</Tex>. With 3 or more equations it is the same, summing the derivatives with
        respect to all the variables. Stopping criterion here: <Tex>{'\\|\\mathbf{x}^{(k)}-\\mathbf{x}^{(k-1)}\\|_\\infty<eps'}</Tex>.
      </p>
    </>
  ),
  potencia: (
    <>
      <p>
        <i>Supplement (Burden, ch. 9): chapter 3 of the textbook does not develop this method\\; the syllabus asks for an understanding of how eigenvalues are computed.</i> If <Tex>A</Tex> has a{' '}
        <b>dominant</b> eigenvalue <Tex>{'|\\lambda_1| > |\\lambda_2| \\ge \\dots \\ge |\\lambda_n|'}</Tex>, the sequence <Tex>{'A^k x^{(0)}'}</Tex> aligns with its eigenvector. Normalizing with{' '}
        <Tex>{'\\|\\cdot\\|_\\infty'}</Tex>:
      </p>
      <Tex block>{'y^{(k)} = A\\,x^{(k-1)},\\qquad \\mu^{(k)} = y^{(k)}_{p},\\qquad x^{(k)} = \\frac{y^{(k)}}{y^{(k)}_{p_k}}'}</Tex>
      <p>
        where <Tex>p</Tex> is the index of the component of largest modulus of <Tex>{'x^{(k-1)}'}</Tex> (which equals 1). Then <Tex>{'\\mu^{(k)}\\to\\lambda_1'}</Tex> and{' '}
        <Tex>{'x^{(k)}\\to v_1'}</Tex> with linear convergence of ratio <Tex>{'|\\lambda_2/\\lambda_1|'}</Tex>.
      </p>
      <p>
        <b>Inverse power method with shift</b> <Tex>q</Tex>: the eigenvalues of <Tex>{'(A-qI)^{-1}'}</Tex> are <Tex>{'1/(\\lambda_i - q)'}</Tex>\\; the dominant one corresponds to the{' '}
        <Tex>{'\\lambda_i'}</Tex> <b>closest to</b> <Tex>q</Tex>:
      </p>
      <Tex block>{'(A - qI)\\,y^{(k)} = x^{(k-1)},\\qquad \\lambda \\approx q + \\frac{1}{\\mu^{(k)}}'}</Tex>
      <p>
        With <Tex>q=0</Tex> one obtains the eigenvalue of <b>smallest</b> modulus. The matrix <Tex>A-qI</Tex> is factored (LU) only once. Eigenvalues also decide the
        convergence of Jacobi and Gauss–Seidel: the spectral radius <Tex>{'\\rho(T)'}</Tex> of the iteration matrix.
      </p>
    </>
  ),
}

export const THEORY: Record<SisId, ReactNode> = L(THEORY_ES, THEORY_EN)
