import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'

/** Renderiza TeX con KaTeX. `block` para modo display. */
export function Tex({ children, block = false, className }: { children: string; block?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, { displayMode: block, throwOnError: false, strict: false, trust: false })
    } catch {
      return children
    }
  }, [children, block])
  const Tag = block ? 'div' : 'span'
  return <Tag className={(block ? 'tex-block ' : 'tex ') + (className ?? '')} dangerouslySetInnerHTML={{ __html: html }} />
}
