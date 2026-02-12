-- ============================================
-- Script de Atualização do Supabase
-- Sistema de Aging - Remessas e Residuais
-- ============================================

-- ============================================
-- 1. TABELA DE REMESSAS
-- ============================================

-- Criar tabela de remessas (se não existir)
CREATE TABLE IF NOT EXISTS public.remessas (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentários da tabela remessas
COMMENT ON TABLE public.remessas IS 'Remessas SAP - dados de picking e expedição';
COMMENT ON COLUMN public.remessas.numero_remessa IS 'Número da remessa (9 dígitos)';
COMMENT ON COLUMN public.remessas.data_picking IS 'Data do picking da remessa';
COMMENT ON COLUMN public.remessas.peso_total_remessa IS 'Peso total da remessa';
COMMENT ON COLUMN public.remessas.item IS 'Número do item na remessa';
COMMENT ON COLUMN public.remessas.data_disponibilidade IS 'Data de disponibilidade do item';
COMMENT ON COLUMN public.remessas.quantidade IS 'Quantidade do item';
COMMENT ON COLUMN public.remessas.unidade_medida IS 'Unidade de medida (KG, G, TON, etc)';
COMMENT ON COLUMN public.remessas.material IS 'Código do material';
COMMENT ON COLUMN public.remessas.centro IS 'Centro de distribuição';
COMMENT ON COLUMN public.remessas.deposito IS 'Código do depósito';
COMMENT ON COLUMN public.remessas.descricao_material IS 'Descrição do material';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_remessas_numero_remessa ON public.remessas(numero_remessa);
CREATE INDEX IF NOT EXISTS idx_remessas_material ON public.remessas(material);
CREATE INDEX IF NOT EXISTS idx_remessas_deposito ON public.remessas(deposito);
CREATE INDEX IF NOT EXISTS idx_remessas_data_disponibilidade ON public.remessas(data_disponibilidade);
CREATE INDEX IF NOT EXISTS idx_remessas_created_at ON public.remessas(created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_remessas_updated_at ON public.remessas;
CREATE TRIGGER update_remessas_updated_at
    BEFORE UPDATE ON public.remessas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABELA DE CONFIGURAÇÃO DE RESIDUAIS
-- ============================================

-- Criar tabela de configuração (se não existir)
CREATE TABLE IF NOT EXISTS public.configuracao_residuais (
    id INTEGER PRIMARY KEY DEFAULT 1,
    limite_verde INTEGER NOT NULL DEFAULT 100,
    limite_amarelo INTEGER NOT NULL DEFAULT 900,
    limite_maximo INTEGER NOT NULL DEFAULT 999,
    materiais_alto_valor TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_only_one_row CHECK (id = 1),
    CONSTRAINT check_limites_ordem CHECK (limite_verde < limite_amarelo AND limite_amarelo < limite_maximo)
);

-- Comentários da tabela
COMMENT ON TABLE public.configuracao_residuais IS 'Configuração para análise de saldos residuais';
COMMENT ON COLUMN public.configuracao_residuais.limite_verde IS 'Limite máximo em gramas para classificação verde (padrão: 100g)';
COMMENT ON COLUMN public.configuracao_residuais.limite_amarelo IS 'Limite máximo em gramas para classificação amarela (padrão: 900g)';
COMMENT ON COLUMN public.configuracao_residuais.limite_maximo IS 'Limite máximo em gramas para considerar residual (padrão: 999g)';
COMMENT ON COLUMN public.configuracao_residuais.materiais_alto_valor IS 'Lista de códigos de materiais de alto valor que não devem ser analisados como residuais';

-- Adicionar coluna limite_maximo caso a tabela já exista sem ela
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'configuracao_residuais'
        AND column_name = 'limite_maximo'
    ) THEN
        ALTER TABLE public.configuracao_residuais
        ADD COLUMN limite_maximo INTEGER NOT NULL DEFAULT 999;
    END IF;
END $$;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_configuracao_residuais_updated_at ON public.configuracao_residuais;
CREATE TRIGGER update_configuracao_residuais_updated_at
    BEFORE UPDATE ON public.configuracao_residuais
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir configuração padrão (apenas se não existir)
INSERT INTO public.configuracao_residuais (id, limite_verde, limite_amarelo, limite_maximo, materiais_alto_valor)
VALUES (1, 100, 900, 999, '{}')
ON CONFLICT (id)
DO UPDATE SET
    limite_verde = COALESCE(configuracao_residuais.limite_verde, 100),
    limite_amarelo = COALESCE(configuracao_residuais.limite_amarelo, 900),
    limite_maximo = COALESCE(configuracao_residuais.limite_maximo, 999),
    materiais_alto_valor = COALESCE(configuracao_residuais.materiais_alto_valor, '{}');

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE public.remessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_residuais ENABLE ROW LEVEL SECURITY;

-- Políticas para remessas (permitir tudo para usuários autenticados e anônimos)
DROP POLICY IF EXISTS "Permitir leitura de remessas" ON public.remessas;
CREATE POLICY "Permitir leitura de remessas"
    ON public.remessas FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir inserção de remessas" ON public.remessas;
CREATE POLICY "Permitir inserção de remessas"
    ON public.remessas FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de remessas" ON public.remessas;
CREATE POLICY "Permitir atualização de remessas"
    ON public.remessas FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de remessas" ON public.remessas;
CREATE POLICY "Permitir exclusão de remessas"
    ON public.remessas FOR DELETE
    USING (true);

-- Políticas para configuração de residuais
DROP POLICY IF EXISTS "Permitir leitura de configuracao" ON public.configuracao_residuais;
CREATE POLICY "Permitir leitura de configuracao"
    ON public.configuracao_residuais FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir inserção de configuracao" ON public.configuracao_residuais;
CREATE POLICY "Permitir inserção de configuracao"
    ON public.configuracao_residuais FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de configuracao" ON public.configuracao_residuais;
CREATE POLICY "Permitir atualização de configuracao"
    ON public.configuracao_residuais FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de configuracao" ON public.configuracao_residuais;
CREATE POLICY "Permitir exclusão de configuracao"
    ON public.configuracao_residuais FOR DELETE
    USING (true);

-- ============================================
-- 4. VIEWS ÚTEIS (OPCIONAL)
-- ============================================

-- View para contagem rápida de remessas por material
CREATE OR REPLACE VIEW public.vw_remessas_por_material AS
SELECT
    material,
    descricao_material,
    COUNT(*) as total_itens,
    COUNT(DISTINCT numero_remessa) as total_remessas,
    SUM(quantidade) as quantidade_total,
    unidade_medida,
    MIN(data_disponibilidade) as primeira_disponibilidade,
    MAX(data_disponibilidade) as ultima_disponibilidade
FROM public.remessas
GROUP BY material, descricao_material, unidade_medida
ORDER BY quantidade_total DESC;

-- View para remessas agrupadas por número
CREATE OR REPLACE VIEW public.vw_remessas_agrupadas AS
SELECT
    numero_remessa,
    data_picking,
    peso_total_remessa,
    COUNT(*) as total_itens,
    SUM(quantidade) as quantidade_total_itens,
    MIN(data_disponibilidade) as primeira_disponibilidade,
    MAX(data_disponibilidade) as ultima_disponibilidade
FROM public.remessas
GROUP BY numero_remessa, data_picking, peso_total_remessa
ORDER BY numero_remessa DESC;

-- ============================================
-- FIM DO SCRIPT
-- ============================================

-- Verificar tabelas criadas
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('remessas', 'configuracao_residuais')
ORDER BY table_name;
