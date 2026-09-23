// Captura errores de render de una página de método para que un fallo (p. ej. una expresión que
// math.js acepta al compilar pero que lanza al evaluar, como "sqrt()") no deje la app en blanco.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Al cambiar (p. ej. la ruta), el error se descarta y se vuelve a intentar. */
  resetKey: string
  /** Prefijo de las claves de localStorage de este tema (numlab:<prefijo>…) para restablecer entradas. */
  storagePrefix?: string
  children: ReactNode
}

interface State {
  error: Error | null
  key: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[NumLab] Error en la página:', error, info.componentStack)
  }

  private resetInputs = () => {
    const p = this.props.storagePrefix
    if (p) {
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('numlab:' + p)) localStorage.removeItem(k)
      } catch {
        /* sin almacenamiento */
      }
    }
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="crash card" role="alert">
        <div className="card-title">No se pudo mostrar esta página</div>
        <p>
          Algo en las entradas actuales hizo fallar el cálculo. Suele pasar con una expresión incompleta, por ejemplo una función sin argumento como{' '}
          <code>sqrt()</code>.
        </p>
        <pre className="crash-msg">{String(error.message || error)}</pre>
        <div className="crash-actions">
          <button type="button" className="btn primary" onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
          {this.props.storagePrefix && (
            <button type="button" className="btn" onClick={this.resetInputs}>
              Restablecer las entradas de este tema
            </button>
          )}
          <a className="btn ghost" href="#/">
            Ir al inicio
          </a>
        </div>
      </div>
    )
  }
}
