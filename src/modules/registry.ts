import type { TopicDef } from './types'
import { topic as errores } from './errores'
import { topic as raices } from './raices'
import { topic as sistemas } from './sistemas'
import { topic as interpolacion } from './interpolacion'
import { topic as integracion } from './integracion'
import { topic as edo } from './edo'
import { topic as cas } from './cas'

export const TOPICS: TopicDef[] = [errores, raices, sistemas, interpolacion, integracion, edo, cas]

export function findMethod(topicId: string, methodId: string) {
  const t = TOPICS.find((x) => x.id === topicId)
  const m = t?.methods.find((x) => x.id === methodId)
  return t && m ? { topic: t, method: m } : null
}
