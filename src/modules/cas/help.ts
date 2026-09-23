// Lista de comandos de la calculadora (panel de ayuda).

export interface HelpItem {
  cmd: string
  desc: string
  ex: string[]
}
export interface HelpGroup {
  title: string
  items: HelpItem[]
}

export const HELP: HelpGroup[] = [
  {
    title: 'Básico',
    items: [
      { cmd: 'expresión', desc: 'Evalúa numéricamente (muestra la forma exacta si hay fracciones o raíces).', ex: ['2^10 / 3', 'sqrt(2)/2 + 1/3', 'sin(pi/6)', '(1 + 1/1000)^1000'] },
      { cmd: 'a = 3', desc: 'Asigna una variable (número, matriz o expresión simbólica).', ex: ['a = 3', 'g = x^2 + a*x', 'ans'] },
      { cmd: 'f(x) = …', desc: 'Define una función reutilizable.', ex: ['f(x) = x^3 - 2x - 5', 'f(2)', 'h(x, y) = x^2 + y^2'] },
      { cmd: 'N(expr)', desc: 'Aproximación decimal.', ex: ['N(pi)', 'N(exp(1))'] },
      { cmd: 'vars', desc: 'Lista las variables y funciones definidas.', ex: ['vars'] },
    ],
  },
  {
    title: 'Cálculo simbólico',
    items: [
      { cmd: 'derivada(expr, x, n)', desc: 'Derivada de orden n (por defecto 1). Alias: diff.', ex: ['derivada(x^3*ln(x), x)', 'derivada(sin(x)^2, x, 2)', 'derivada(f(x), x)'] },
      { cmd: 'integrar(expr, x)', desc: 'Primitiva (integral indefinida). Alias: integral, integrate.', ex: ['integrar(x^2*exp(x), x)', 'integrar(1/(1 + x^2), x)', 'integrar(sin(x)^2, x)'] },
      { cmd: 'integrar(expr, x, a, b)', desc: 'Integral definida: exacta si se puede y siempre numérica (Simpson adaptativo). Admite ±inf.', ex: ['integrar(exp(-x^2), x, 0, 1)', 'integrar(sin(x)/x, x, 1, 10)', 'integrar(exp(-x^2), x, -inf, inf)'] },
      { cmd: 'limite(expr, x, a)', desc: 'Límite (a puede ser inf).', ex: ['limite(sin(x)/x, x, 0)', 'limite((1 + 1/n)^n, n, inf)', 'limite((x^2 - 1)/(x - 1), x, 1)'] },
      { cmd: 'taylor(expr, x, x0, n)', desc: 'Polinomio de Taylor exacto de orden n alrededor de x0.', ex: ['taylor(sin(x), x, 0, 7)', 'taylor(exp(x), x, 1, 3)', 'taylor(ln(x), x, 1, 4)'] },
      { cmd: 'sumatoria(expr, k, a, b)', desc: 'Suma finita exacta.', ex: ['sumatoria(1/k^2, k, 1, 10)', 'sumatoria(k^3, k, 1, 20)'] },
    ],
  },
  {
    title: 'Álgebra',
    items: [
      { cmd: 'simplificar(expr)', desc: 'Simplifica.', ex: ['simplificar((x^2 - 1)/(x - 1))', 'simplificar(sin(x)^2 + cos(x)^2)'] },
      { cmd: 'expandir(expr)', desc: 'Desarrolla productos y potencias.', ex: ['expandir((x + 1)^5)', 'expandir((a + b)*(a - b))'] },
      { cmd: 'factorizar(expr)', desc: 'Factoriza polinomios.', ex: ['factorizar(x^3 - 6x^2 + 11x - 6)', 'factorizar(x^4 - 1)'] },
      { cmd: 'fracciones_parciales(expr, x)', desc: 'Descomposición en fracciones parciales.', ex: ['fracciones_parciales(1/(x^2 - 1), x)'] },
      { cmd: 'resolver(ecuación, x)', desc: 'Resuelve una ecuación (simbólico; si no, raíces numéricas en [−100, 100]).', ex: ['resolver(x^2 - 5x + 6, x)', 'resolver(x^3 = 2, x)', 'resolver(cos(x) = x, x)'] },
      { cmd: 'resolver_sistema(ec1, ec2, …)', desc: 'Sistema de ecuaciones.', ex: ['resolver_sistema(x + y = 3, x - y = 1)', 'resolver_sistema(2x + y - z = 1, x - y = 0, x + z = 4)'] },
      { cmd: 'raices(f, a, b)', desc: 'Raíces reales en [a, b] por muestreo + bisección.', ex: ['raices(x^3 - 2x - 5, -5, 5)', 'raices(sin(x) - 0.3, 0, 10)'] },
    ],
  },
  {
    title: 'Matrices',
    items: [
      { cmd: 'A = [1 2; 3 4]', desc: 'Matriz (estilo Scilab o [1, 2; 3, 4]). Operaciones: +, −, *, A\', A^2.', ex: ['A = [4 1 0; 1 4 1; 0 1 4]', 'b = [1; 2; 3]', "A'", 'A*b'] },
      { cmd: 'det, inv, traza, rango', desc: 'Determinante, inversa, traza y rango.', ex: ['det(A)', 'inv(A)', 'traza(A)', 'rango([1 2; 2 4])'] },
      { cmd: 'lusolve(A, b)', desc: 'Resuelve Ax = b.', ex: ['lusolve(A, b)', 'lu(A)', 'rref([1 2 3; 4 5 6])'] },
      { cmd: 'eig(A)', desc: 'Valores y vectores propios (QR de Francis). Alias: valores_propios, spec.', ex: ['eig(A)', 'eig([0 1; -1 0])', 'eig([2 1; 1 2])'] },
      { cmd: 'cond(A), norm(A, p)', desc: 'Número de condición (norma 2) y normas (1, 2, inf, "fro").', ex: ['cond([1 2; 2 4.0001])', 'norm(A, 1)', 'norm(A, "fro")'] },
    ],
  },
  {
    title: 'Gráficas',
    items: [
      { cmd: 'graficar(f1, f2, …, a, b)', desc: 'Grafica una o varias funciones de x en [a, b] (por defecto [−10, 10]). Alias: plot.', ex: ['graficar(sin(x), cos(x), -2pi, 2pi)', 'graficar(f(x), -3, 3)', 'graficar(exp(-x^2), x^2*exp(-x), -1, 4)'] },
    ],
  },
]
