-- Script SQL para criar as tabelas necessárias no Supabase
-- Execute este script no SQL Editor do Supabase

-- =====================================================
-- TABELA: remessas
-- Armazena dados de remessas do SAP
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
    descricao_material TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_remessas_numero_remessa ON remessas(numero_remessa);
CREATE INDEX IF NOT EXISTS idx_remessas_material ON remessas(material);
CREATE INDEX IF NOT EXISTS idx_remessas_deposito ON remessas(deposito);
CREATE INDEX IF NOT EXISTS idx_remessas_data_disponibilidade ON remessas(data_disponibilidade);

-- Comentários
COMMENT ON TABLE remessas IS 'Armazena dados de remessas importados do SAP';
COMMENT ON COLUMN remessas.numero_remessa IS 'Número da remessa SAP (ex: 302604549)';
COMMENT ON COLUMN remessas.data_picking IS 'Data de picking da remessa';
COMMENT ON COLUMN remessas.peso_total_remessa IS 'Peso total da remessa';
COMMENT ON COLUMN remessas.item IS 'Número do item da remessa (ex: 10, 20)';
COMMENT ON COLUMN remessas.data_disponibilidade IS 'Data de disponibilidade do material';
COMMENT ON COLUMN remessas.quantidade IS 'Quantidade do material na remessa';
COMMENT ON COLUMN remessas.unidade_medida IS 'Unidade de medida (KG, UN, etc)';
COMMENT ON COLUMN remessas.material IS 'Código do material';
COMMENT ON COLUMN remessas.centro IS 'Centro (ex: 600)';
COMMENT ON COLUMN remessas.deposito IS 'Depósito (ALM, PES, PDD, etc)';
COMMENT ON COLUMN remessas.descricao_material IS 'Descrição/denominação do material';

-- =====================================================
-- TABELA: configuracao_residuais
-- Armazena configurações para análise de saldos residuais
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracao_residuais (
    id INTEGER PRIMARY KEY DEFAULT 1,
    limite_verde INTEGER NOT NULL DEFAULT 100,
    limite_amarelo INTEGER NOT NULL DEFAULT 900,
    materiais_alto_valor TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_limites CHECK (limite_verde < limite_amarelo),
    CONSTRAINT chk_id_unico CHECK (id = 1)
);

-- Inserir configuração padrão
INSERT INTO configuracao_residuais (id, limite_verde, limite_amarelo, materiais_alto_valor)
VALUES (1, 100, 900, '{}')
ON CONFLICT (id) DO NOTHING;

-- Comentários
COMMENT ON TABLE configuracao_residuais IS 'Configurações para análise de saldos residuais';
COMMENT ON COLUMN configuracao_residuais.limite_verde IS 'Limite máximo em gramas para classificação verde (padrão: 100g)';
COMMENT ON COLUMN configuracao_residuais.limite_amarelo IS 'Limite máximo em gramas para classificação amarela (padrão: 900g)';
COMMENT ON COLUMN configuracao_residuais.materiais_alto_valor IS 'Array de códigos de materiais de alto valor a serem desconsiderados na análise';

-- =====================================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE remessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_residuais ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir acesso total para usuários autenticados)
-- Ajuste conforme suas necessidades de segurança

-- Remessas: Leitura pública
CREATE POLICY "Permitir leitura de remessas" ON remessas
    FOR SELECT
    USING (true);

-- Remessas: Inserção apenas para usuários autenticados
CREATE POLICY "Permitir inserção de remessas para autenticados" ON remessas
    FOR INSERT
    WITH CHECK (true);

-- Remessas: Deleção apenas para usuários autenticados
CREATE POLICY "Permitir deleção de remessas para autenticados" ON remessas
    FOR DELETE
    USING (true);

-- Configuração: Leitura pública
CREATE POLICY "Permitir leitura de configuração" ON configuracao_residuais
    FOR SELECT
    USING (true);

-- Configuração: Atualização e inserção para autenticados
CREATE POLICY "Permitir atualização de configuração" ON configuracao_residuais
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir inserção de configuração" ON configuracao_residuais
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View: Resumo de remessas por material
CREATE OR REPLACE VIEW vw_resumo_remessas_material AS
SELECT
    material,
    descricao_material,
    COUNT(DISTINCT numero_remessa) as total_remessas,
    COUNT(*) as total_itens,
    SUM(quantidade) as quantidade_total,
    unidade_medida,
    deposito,
    centro
FROM remessas
GROUP BY material, descricao_material, unidade_medida, deposito, centro
ORDER BY quantidade_total DESC;

-- View: Remessas recentes (últimas cargas)
CREATE OR REPLACE VIEW vw_remessas_recentes AS
SELECT
    numero_remessa,
    data_picking,
    COUNT(*) as total_itens,
    SUM(quantidade) as quantidade_total,
    MAX(created_at) as data_carga
FROM remessas
GROUP BY numero_remessa, data_picking
ORDER BY created_at DESC
LIMIT 100;

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em remessas
DROP TRIGGER IF EXISTS update_remessas_updated_at ON remessas;
CREATE TRIGGER update_remessas_updated_at
    BEFORE UPDATE ON remessas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em configuracao_residuais
DROP TRIGGER IF EXISTS update_configuracao_residuais_updated_at ON configuracao_residuais;
CREATE TRIGGER update_configuracao_residuais_updated_at
    BEFORE UPDATE ON configuracao_residuais
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Listar tabelas criadas
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('remessas', 'configuracao_residuais')
ORDER BY tablename;

-- Contar registros
SELECT
    'remessas' as tabela,
    COUNT(*) as total_registros
FROM remessas
UNION ALL
SELECT
    'configuracao_residuais' as tabela,
    COUNT(*) as total_registros
FROM configuracao_residuais;

-- =====================================================
-- FINALIZADO
-- =====================================================

-- Script concluído com sucesso!
-- As seguintes tabelas foram criadas:
-- 1. remessas - Armazena dados de remessas do SAP
-- 2. configuracao_residuais - Configurações para análise de residuais
--
-- Views criadas:
-- 1. vw_resumo_remessas_material - Resumo de remessas por material
-- 2. vw_remessas_recentes - Últimas remessas carregadas
--
-- Triggers criados:
-- 1. update_remessas_updated_at - Atualiza timestamp em updates
-- 2. update_configuracao_residuais_updated_at - Atualiza timestamp em updates
