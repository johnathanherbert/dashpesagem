import materiaisEspeciais from '@/data/materiais-especiais.json'

export type TipoMaterialEspecial = 'inf' | 'cfa'

export interface MaterialEspecialConfig {
  nome: string
  descricao: string
  cor: string
  icone: string
  materiais: string[]
}

export interface MateriaisEspeciaisData {
  inf: MaterialEspecialConfig
  cfa: MaterialEspecialConfig
}

export function isMaterialEspecial(material: string): TipoMaterialEspecial | null {
  const data = materiaisEspeciais as MateriaisEspeciaisData
  
  if (data.inf.materiais.includes(material)) {
    return 'inf'
  }
  
  if (data.cfa.materiais.includes(material)) {
    return 'cfa'
  }
  
  return null
}

export function getMaterialEspecialConfig(tipo: TipoMaterialEspecial): MaterialEspecialConfig {
  const data = materiaisEspeciais as MateriaisEspeciaisData
  return data[tipo]
}

export function getMateriaisEspeciaisData(): MateriaisEspeciaisData {
  return materiaisEspeciais as MateriaisEspeciaisData
}

export function getMaterialEspecialBadge(material: string): { tipo: TipoMaterialEspecial; config: MaterialEspecialConfig } | null {
  const tipo = isMaterialEspecial(material)
  if (!tipo) return null
  
  return {
    tipo,
    config: getMaterialEspecialConfig(tipo)
  }
}
