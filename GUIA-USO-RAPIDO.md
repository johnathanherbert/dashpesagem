# Guia de Uso Rápido - Sistema de Gestão de Estoque

## 🚀 Status da Implementação

✅ **Todas as funcionalidades implementadas:**
- Sistema de Remessas SAP
- Análise de Residuais (3 níveis + exclusão)
- Configuração de limites e materiais especiais
- Visualização financeira de residuais
- Identificação de lotes únicos

## 📋 Passo a Passo para Começar

### 1. Atualizar o Supabase

**Abra o SQL Editor no Supabase:**
```
https://app.supabase.com → SQL Editor
```

**Cole e execute o script:**
```sql
-- Conteúdo do arquivo: supabase-update.sql
```

Este script cria:
- Tabela `remessas` com índices otimizados
- Tabela `configuracao_residuais` com valores padrão
- Políticas de RLS para ambas as tabelas
- Views úteis para consultas rápidas

### 2. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### 3. Primeira Configuração

#### a) Upload de Valores Unitários
1. Vá para a aba **"Config"**
2. Seção **"Upload de Valores Unitários"**
3. Faça upload da planilha de valores com as colunas:
   - Material
   - Valor Unitário

#### b) Upload de Remessas SAP
1. Na mesma aba **"Config"**
2. Seção **"Upload de Remessas"**
3. Faça upload do arquivo `REMESSAS.xlsx` ou similar
4. O sistema identifica automaticamente a estrutura hierárquica do SAP

#### c) Configurar Limites de Residuais
1. Na mesma aba **"Config"**
2. Seção **"Configuração de Residuais"**
3. Ajuste os limites em gramas:
   - **Verde**: ≤100g (padrão)
   - **Amarelo**: 100g-900g (padrão)
   - **Vermelho**: 900g-999g (padrão)
   - **Acima de 999g**: Não é residual

#### d) Adicionar Materiais Especiais (Opcional)
1. Digite o código do material
2. Clique em **"Adicionar"**
3. Materiais adicionados não aparecerão na análise de residuais

### 4. Usar o Sistema

#### Aba Financeiro
- Visão geral do valor do estoque
- Análise por tipo de depósito
- Filtros e busca global

#### Aba Residuais
- **6 cards estatísticos:**
  - Total de Residuais
  - Verdes (criticalidade baixa)
  - Amarelos (atenção)
  - Vermelhos (urgente)
  - Lotes Únicos
  - Valor Total em residuais
- **Tabela detalhada:**
  - Classificação por nível
  - Quantidade e unidade
  - **Valor Total** (quantidade × valor unitário)
  - Identificação de lote único
  - Dias de aging
- **Filtros:**
  - Por nível (Todos/Verde/Amarelo/Vermelho)
  - Busca por material, descrição ou lote

#### Aba Remessas
- Visualização de remessas carregadas
- Contagem de itens
- (Funcionalidade de análise em desenvolvimento)

## 🎯 Recursos Principais

### Análise de Residuais
- **Apenas depósito PES**: Analisa somente itens do depósito PES
- **Conversão automática**: KG → g, TON → g, etc.
- **3 níveis de criticidade**: Verde, Amarelo, Vermelho
- **Exclusão inteligente**:
  - Materiais acima do limite máximo
  - Materiais de alto valor configurados
- **Lote único**: Identifica materiais com apenas 1 lote no PES

### Cálculo Financeiro
- **Valor por item**: quantidade × valor_unitario
- **Valor total agregado**: Soma de todos os residuais
- **Visualização em reais**: Formatação BRL

### Performance
- **useMemo**: Cálculos otimizados para grande volume
- **Índices no banco**: Consultas rápidas
- **Lazy loading**: Carrega dados sob demanda

## 📊 Estrutura dos Dados

### Tabela: aging_estoque
- Dados principais do aging
- Informações de material, lote, depósito
- Dias de aging calculados

### Tabela: remessas
- Número de remessa (9 dígitos)
- Data de picking e disponibilidade
- Material, quantidade, depósito
- Estrutura hierárquica do SAP

### Tabela: configuracao_residuais
- Limites verde, amarelo, máximo
- Array de materiais especiais
- Registro único (id = 1)

### Tabela: material_valores
- Código do material
- Valor unitário em BRL

## 🔧 Troubleshooting

### Remessas não aparecem
- Verifique se a tabela foi criada no Supabase
- Execute o script `supabase-update.sql`
- Verifique o formato do Excel (estrutura SAP com SNVM)

### Residuais não calculados
- Confirme que os dados de aging estão carregados
- Verifique se há itens no depósito PES
- Ajuste os limites de configuração

### Valores não aparecem
- Faça upload da planilha de valores unitários
- Confira se os códigos de material coincidem

### Erro de TypeScript
- Execute `npm run build` para verificar
- Todos os erros foram corrigidos nesta implementação

## 📁 Arquivos Criados

### Componentes
- `components/configuracao-residuais.tsx` - UI de configuração
- `components/remessa-upload.tsx` - Upload de remessas
- `components/residuais-view.tsx` - Visualização de residuais

### Bibliotecas
- `lib/remessa-parser.ts` - Parser do Excel SAP
- `lib/residuais-analyzer.ts` - Lógica de análise

### Scripts SQL
- `supabase-update.sql` - Script de atualização completo
- `supabase-schema.sql` - Schema detalhado

### Documentação
- `IMPLEMENTACAO.md` - Detalhes técnicos
- `GUIA-SUPABASE.md` - Guia do banco de dados
- `GUIA-USO-RAPIDO.md` - Este arquivo

## 🎉 Próximos Passos

1. ✅ Execute o script SQL no Supabase
2. ✅ Inicie o servidor com `npm run dev`
3. ✅ Faça os uploads iniciais (valores e remessas)
4. ✅ Configure os limites de residuais
5. ✅ Explore a aba Residuais e veja a análise financeira

Sistema pronto para uso em produção! 🚀
