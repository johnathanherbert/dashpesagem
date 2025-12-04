-- Tabela para armazenar valores unitários dos materiais
CREATE TABLE IF NOT EXISTS material_valores (
  material VARCHAR(50) PRIMARY KEY,
  valor_unitario DECIMAL(15, 2) NOT NULL,
  data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida por material
CREATE INDEX IF NOT EXISTS idx_material_valores_material ON material_valores(material);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_material_valores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER material_valores_updated_at
  BEFORE UPDATE ON material_valores
  FOR EACH ROW
  EXECUTE FUNCTION update_material_valores_updated_at();

-- Comentários para documentação
COMMENT ON TABLE material_valores IS 'Tabela de valores unitários dos materiais para análise financeira';
COMMENT ON COLUMN material_valores.material IS 'Código do material (chave primária)';
COMMENT ON COLUMN material_valores.valor_unitario IS 'Valor unitário do material em reais';
COMMENT ON COLUMN material_valores.data_atualizacao IS 'Data da última atualização do valor';
