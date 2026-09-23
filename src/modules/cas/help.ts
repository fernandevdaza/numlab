// Lista de comandos de la calculadora (panel de ayuda).
// Cada comando tiene nombre en español y en inglés (ver CMD en engine.ts): los dos funcionan siempre;
// la ayuda muestra los nombres y ejemplos del idioma de la interfaz.

import { L } from '../../i18n'

export interface HelpItem {
  cmd: string
  desc: string
  ex: string[]
}
export interface HelpGroup {
  title: string
  items: HelpItem[]
}

/** Elige la versión española o inglesa de un comando de la ayuda. */
const H = (es: HelpItem, en: HelpItem): HelpItem => L(es, en)

export const HELP: HelpGroup[] = [
  {
    title: L('Básico', 'Basics'),
    items: [
      H(
        { cmd: 'expresión', desc: 'Evalúa numéricamente (muestra la forma exacta si hay fracciones o raíces).', ex: ['2^10 / 3', 'sqrt(2)/2 + 1/3', 'sin(pi/6)', '(1 + 1/1000)^1000'] },
        { cmd: 'expression', desc: 'Evaluates numerically (also shows the exact form when there are fractions or roots).', ex: ['2^10 / 3', 'sqrt(2)/2 + 1/3', 'sin(pi/6)', '(1 + 1/1000)^1000'] },
      ),
      H(
        { cmd: 'a = 3', desc: 'Asigna una variable (número, matriz o expresión simbólica).', ex: ['a = 3', 'g = x^2 + a*x', 'ans'] },
        { cmd: 'a = 3', desc: 'Assigns a variable (number, matrix or symbolic expression).', ex: ['a = 3', 'g = x^2 + a*x', 'ans'] },
      ),
      H(
        { cmd: 'f(x) = …', desc: 'Define una función reutilizable.', ex: ['f(x) = x^3 - 2x - 5', 'f(2)', 'h(x, y) = x^2 + y^2'] },
        { cmd: 'f(x) = …', desc: 'Defines a reusable function.', ex: ['f(x) = x^3 - 2x - 5', 'f(2)', 'h(x, y) = x^2 + y^2'] },
      ),
      H(
        { cmd: 'N(expr)', desc: 'Aproximación decimal. Alias: aprox, num, approx.', ex: ['N(pi)', 'N(exp(1))'] },
        { cmd: 'N(expr)', desc: 'Decimal approximation. Aliases: approx, num, aprox.', ex: ['N(pi)', 'approx(exp(1))'] },
      ),
      H(
        { cmd: 'vars', desc: 'Lista las variables y funciones definidas.', ex: ['vars'] },
        { cmd: 'vars', desc: 'Lists the defined variables and functions.', ex: ['vars'] },
      ),
    ],
  },
  {
    title: L('Cálculo simbólico', 'Symbolic calculus'),
    items: [
      H(
        { cmd: 'derivada(expr, x, n)', desc: 'Derivada de orden n (por defecto 1). Alias: derivar, diff, derivative.', ex: ['derivada(x^3*ln(x), x)', 'derivada(sin(x)^2, x, 2)', 'derivada(f(x), x)'] },
        { cmd: 'diff(expr, x, n)', desc: 'Derivative of order n (default 1). Aliases: derivative, derivada.', ex: ['diff(x^3*ln(x), x)', 'diff(sin(x)^2, x, 2)', 'derivative(f(x), x)'] },
      ),
      H(
        { cmd: 'integrar(expr, x)', desc: 'Primitiva (integral indefinida). Alias: integral, integrate.', ex: ['integrar(x^2*exp(x), x)', 'integrar(1/(1 + x^2), x)', 'integrar(sin(x)^2, x)'] },
        { cmd: 'integrate(expr, x)', desc: 'Antiderivative (indefinite integral). Aliases: integral, integrar.', ex: ['integrate(x^2*exp(x), x)', 'integrate(1/(1 + x^2), x)', 'integrate(sin(x)^2, x)'] },
      ),
      H(
        {
          cmd: 'integrar(expr, x, a, b)',
          desc: 'Integral definida: exacta si se puede y siempre numérica (Simpson adaptativo). Admite ±inf.',
          ex: ['integrar(exp(-x^2), x, 0, 1)', 'integrar(sin(x)/x, x, 1, 10)', 'integrar(exp(-x^2), x, -inf, inf)'],
        },
        {
          cmd: 'integrate(expr, x, a, b)',
          desc: 'Definite integral: exact when possible, always numerical too (adaptive Simpson). Accepts ±inf.',
          ex: ['integrate(exp(-x^2), x, 0, 1)', 'integrate(sin(x)/x, x, 1, 10)', 'integrate(exp(-x^2), x, -inf, inf)'],
        },
      ),
      H(
        { cmd: 'limite(expr, x, a)', desc: 'Límite (a puede ser inf). Alias: limit.', ex: ['limite(sin(x)/x, x, 0)', 'limite((1 + 1/n)^n, n, inf)', 'limite((x^2 - 1)/(x - 1), x, 1)'] },
        { cmd: 'limit(expr, x, a)', desc: 'Limit (a may be inf). Alias: limite.', ex: ['limit(sin(x)/x, x, 0)', 'limit((1 + 1/n)^n, n, inf)', 'limit((x^2 - 1)/(x - 1), x, 1)'] },
      ),
      H(
        { cmd: 'taylor(expr, x, x0, n)', desc: 'Polinomio de Taylor exacto de orden n alrededor de x0. Alias: series.', ex: ['taylor(sin(x), x, 0, 7)', 'taylor(exp(x), x, 1, 3)', 'taylor(ln(x), x, 1, 4)'] },
        { cmd: 'taylor(expr, x, x0, n)', desc: 'Exact Taylor polynomial of order n about x0. Alias: series.', ex: ['taylor(sin(x), x, 0, 7)', 'series(exp(x), x, 1, 3)', 'taylor(ln(x), x, 1, 4)'] },
      ),
      H(
        { cmd: 'sumatoria(expr, k, a, b)', desc: 'Suma finita exacta. Alias: suma, sum.', ex: ['sumatoria(1/k^2, k, 1, 10)', 'sumatoria(k^3, k, 1, 20)'] },
        { cmd: 'sum(expr, k, a, b)', desc: 'Exact finite sum. Aliases: summation, sumatoria.', ex: ['sum(1/k^2, k, 1, 10)', 'sum(k^3, k, 1, 20)'] },
      ),
    ],
  },
  {
    title: L('Álgebra', 'Algebra'),
    items: [
      H(
        { cmd: 'simplificar(expr)', desc: 'Simplifica. Alias: simplify.', ex: ['simplificar((x^2 - 1)/(x - 1))', 'simplificar(sin(x)^2 + cos(x)^2)'] },
        { cmd: 'simplify(expr)', desc: 'Simplifies. Alias: simplificar.', ex: ['simplify((x^2 - 1)/(x - 1))', 'simplify(sin(x)^2 + cos(x)^2)'] },
      ),
      H(
        { cmd: 'expandir(expr)', desc: 'Desarrolla productos y potencias. Alias: expand.', ex: ['expandir((x + 1)^5)', 'expandir((a + b)*(a - b))'] },
        { cmd: 'expand(expr)', desc: 'Expands products and powers. Alias: expandir.', ex: ['expand((x + 1)^5)', 'expand((a + b)*(a - b))'] },
      ),
      H(
        { cmd: 'factorizar(expr)', desc: 'Factoriza polinomios. Alias: factor.', ex: ['factorizar(x^3 - 6x^2 + 11x - 6)', 'factorizar(x^4 - 1)'] },
        { cmd: 'factor(expr)', desc: 'Factors polynomials. Alias: factorizar.', ex: ['factor(x^3 - 6x^2 + 11x - 6)', 'factor(x^4 - 1)'] },
      ),
      H(
        { cmd: 'fracciones_parciales(expr, x)', desc: 'Descomposición en fracciones parciales. Alias: partfrac.', ex: ['fracciones_parciales(1/(x^2 - 1), x)'] },
        { cmd: 'partfrac(expr, x)', desc: 'Partial fraction decomposition. Aliases: partial_fractions, apart.', ex: ['partfrac(1/(x^2 - 1), x)', 'partial_fractions((x + 3)/(x^2 + x), x)'] },
      ),
      H(
        { cmd: 'resolver(ecuación, x)', desc: 'Resuelve una ecuación (simbólico; si no, raíces numéricas en [−100, 100]). Alias: solve.', ex: ['resolver(x^2 - 5x + 6, x)', 'resolver(x^3 = 2, x)', 'resolver(cos(x) = x, x)'] },
        { cmd: 'solve(equation, x)', desc: 'Solves an equation (symbolically; otherwise numerical roots in [−100, 100]). Alias: resolver.', ex: ['solve(x^2 - 5x + 6, x)', 'solve(x^3 = 2, x)', 'solve(cos(x) = x, x)'] },
      ),
      H(
        { cmd: 'resolver_sistema(ec1, ec2, …)', desc: 'Sistema de ecuaciones. Alias: sistema, solve_system.', ex: ['resolver_sistema(x + y = 3, x - y = 1)', 'resolver_sistema(2x + y - z = 1, x - y = 0, x + z = 4)'] },
        { cmd: 'solve_system(eq1, eq2, …)', desc: 'System of equations. Alias: resolver_sistema.', ex: ['solve_system(x + y = 3, x - y = 1)', 'solve_system(2x + y - z = 1, x - y = 0, x + z = 4)'] },
      ),
      H(
        { cmd: 'raices(f, a, b)', desc: 'Raíces reales en [a, b] por muestreo + bisección. Alias: roots.', ex: ['raices(x^3 - 2x - 5, -5, 5)', 'raices(sin(x) - 0.3, 0, 10)'] },
        { cmd: 'roots(f, a, b)', desc: 'Real roots in [a, b] by sampling + bisection. Alias: raices.', ex: ['roots(x^3 - 2x - 5, -5, 5)', 'roots(sin(x) - 0.3, 0, 10)'] },
      ),
    ],
  },
  {
    title: L('Matrices', 'Matrices'),
    items: [
      H(
        { cmd: 'A = [1 2; 3 4]', desc: "Matriz (estilo Scilab o [1, 2; 3, 4]). Operaciones: +, −, *, A', A^2.", ex: ['A = [4 1 0; 1 4 1; 0 1 4]', 'b = [1; 2; 3]', "A'", 'A*b'] },
        { cmd: 'A = [1 2; 3 4]', desc: "Matrix (Scilab style or [1, 2; 3, 4]). Operations: +, −, *, A', A^2.", ex: ['A = [4 1 0; 1 4 1; 0 1 4]', 'b = [1; 2; 3]', "A'", 'A*b'] },
      ),
      H(
        { cmd: 'det, inv, traza, rango', desc: 'Determinante, inversa, traza y rango (también trace, rank, inversa, transpuesta).', ex: ['det(A)', 'inv(A)', 'traza(A)', 'rango([1 2; 2 4])'] },
        { cmd: 'det, inv, trace, rank', desc: 'Determinant, inverse, trace and rank (also inverse, transpose).', ex: ['det(A)', 'inv(A)', 'trace(A)', 'rank([1 2; 2 4])'] },
      ),
      H(
        { cmd: 'lusolve(A, b)', desc: 'Resuelve Ax = b.', ex: ['lusolve(A, b)', 'lu(A)', 'rref([1 2 3; 4 5 6])'] },
        { cmd: 'lusolve(A, b)', desc: 'Solves Ax = b.', ex: ['lusolve(A, b)', 'lu(A)', 'rref([1 2 3; 4 5 6])'] },
      ),
      H(
        { cmd: 'eig(A)', desc: 'Valores y vectores propios (QR de Francis). Alias: valores_propios, spec, eigenvalues.', ex: ['eig(A)', 'eig([0 1; -1 0])', 'eig([2 1; 1 2])'] },
        { cmd: 'eig(A)', desc: 'Eigenvalues and eigenvectors (Francis QR). Aliases: eigenvalues, spec, valores_propios.', ex: ['eig(A)', 'eig([0 1; -1 0])', 'eigenvalues([2 1; 1 2])'] },
      ),
      H(
        { cmd: 'cond(A), norm(A, p)', desc: 'Número de condición (norma 2) y normas (1, 2, inf, "fro").', ex: ['cond([1 2; 2 4.0001])', 'norm(A, 1)', 'norm(A, "fro")'] },
        { cmd: 'cond(A), norm(A, p)', desc: 'Condition number (2-norm) and norms (1, 2, inf, "fro").', ex: ['cond([1 2; 2 4.0001])', 'norm(A, 1)', 'norm(A, "fro")'] },
      ),
    ],
  },
  {
    title: L('Gráficas', 'Plots'),
    items: [
      H(
        {
          cmd: 'graficar(f1, f2, …, a, b)',
          desc: 'Grafica una o varias funciones de x en [a, b] (por defecto [−10, 10]). Alias: plot.',
          ex: ['graficar(sin(x), cos(x), -2pi, 2pi)', 'graficar(f(x), -3, 3)', 'graficar(exp(-x^2), x^2*exp(-x), -1, 4)'],
        },
        {
          cmd: 'plot(f1, f2, …, a, b)',
          desc: 'Plots one or more functions of x on [a, b] (default [−10, 10]). Alias: graficar.',
          ex: ['plot(sin(x), cos(x), -2pi, 2pi)', 'plot(f(x), -3, 3)', 'plot(exp(-x^2), x^2*exp(-x), -1, 4)'],
        },
      ),
    ],
  },
]
