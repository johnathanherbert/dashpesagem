-- =====================================================
-- Schema PostgreSQL — Sistema de Aging
-- Execute este script para criar todas as tabelas
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABELA: aging_estoque
-- =====================================================
CREATE TABLE IF NOT EXISTS aging_estoque (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material TEXT NOT NULL,
    texto_breve_material TEXT,
    unidade_medida TEXT,
    lote TEXT NOT NULL,
    centro TEXT,
    deposito TEXT,
    tipo_deposito TEXT,
    posicao_deposito TEXT,
    estoque_disponivel NUMERIC,
    data_vencimento TEXT,
    ultimo_movimento TEXT,
    tipo_estoque TEXT,
    ultima_entrada_deposito TEXT,
    dias_aging INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aging_material ON aging_estoque(material);
CREATE INDEX IF NOT EXISTS idx_aging_deposito ON aging_estoque(deposito);
CREATE INDEX IF NOT EXISTS idx_aging_created_at ON aging_estoque(created_at DESC);

-- =====================================================
-- TABELA: material_valores
-- =====================================================
CREATE TABLE IF NOT EXISTS material_valores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material TEXT NOT NULL UNIQUE,
    valor_unitario NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_valores_material ON material_valores(material);

-- =====================================================
-- TABELA: remessas
-- =====================================================
CREATE TABLE IF NOT EXISTS remessas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero_remessa TEXT NOT NULL,
    data_picking TEXT,
    peso_total_remessa NUMERIC,
    item TEXT NOT NULL,
    data_disponibilidade TEXT NOT NULL,
    quantidade NUMERIC NOT NULL,
    unidade_medida TEXT NOT NULL,
    material TEXT NOT NULL,
    centro TEXT NOT NULL,
    deposito TEXT NOT NULL,
    descricao_material TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remessas_numero ON remessas(numero_remessa);
CREATE INDEX IF NOT EXISTS idx_remessas_material ON remessas(material);
CREATE INDEX IF NOT EXISTS idx_remessas_created_at ON remessas(created_at DESC);

-- =====================================================
-- TABELA: configuracao_residuais
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracao_residuais (
    id INTEGER PRIMARY KEY DEFAULT 1,
    limite_verde INTEGER NOT NULL DEFAULT 100,
    limite_amarelo INTEGER NOT NULL DEFAULT 900,
    limite_maximo INTEGER NOT NULL DEFAULT 999,
    materiais_alto_valor TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_only_one_row CHECK (id = 1),
    CONSTRAINT check_limites_ordem CHECK (
        limite_verde < limite_amarelo AND limite_amarelo < limite_maximo
    )
);

INSERT INTO configuracao_residuais (id, limite_verde, limite_amarelo, limite_maximo)
VALUES (1, 100, 900, 999)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TABELA: dashboard_historico
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    total_itens INTEGER,
    media_aging NUMERIC,
    max_aging INTEGER,
    itens_criticos INTEGER,
    itens_alerta INTEGER,
    total_valorizado NUMERIC,
    valor_critico NUMERIC,
    valor_alerta NUMERIC,
    itens_com_valor INTEGER,
    valor_ajuste NUMERIC,
    itens_ajuste INTEGER,
    valor_aju_saida NUMERIC,
    itens_aju_saida INTEGER,
    itens_vencidos INTEGER,
    itens_vencendo_30d INTEGER,
    materiais_inf INTEGER,
    materiais_cfa INTEGER
);

CREATE INDEX IF NOT EXISTS idx_historico_snapshot_at ON dashboard_historico(snapshot_at DESC);

-- =====================================================
-- FUNÇÃO + TRIGGERS: updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aging_updated_at ON aging_estoque;
CREATE TRIGGER trg_aging_updated_at
    BEFORE UPDATE ON aging_estoque
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_material_valores_updated_at ON material_valores;
CREATE TRIGGER trg_material_valores_updated_at
    BEFORE UPDATE ON material_valores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_remessas_updated_at ON remessas;
CREATE TRIGGER trg_remessas_updated_at
    BEFORE UPDATE ON remessas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_config_updated_at ON configuracao_residuais;
CREATE TRIGGER trg_config_updated_at
    BEFORE UPDATE ON configuracao_residuais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = t.table_name AND table_schema = 'public') AS colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('aging_estoque','material_valores','remessas','configuracao_residuais','dashboard_historico')
ORDER BY table_name;
