# Sistema de Aging v1.0.0 - Gestão Inteligente de Estoque

![Next.js](https://img.shields.io/badge/Next.js-16.0.7-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-yellow)

Sistema completo de análise financeira e gestão de aging de estoque desenvolvido para o setor de Pesagem. Oferece visualizações interativas, análise de criticidade e valorização de materiais em tempo real.

---

## 🎯 Funcionalidades Principais

### 📊 Análise Financeira Completa
- **Valorização de Materiais**: Sistema de upload de valores unitários via Excel com proteção por senha
- **Análise por Criticidade**: 
  - Normal (< 10 dias) - Verde
  - Alerta (10-20 dias) - Amarelo
  - Crítico (> 20 dias) - Vermelho
- **Visualização Interativa**: Gráficos de pizza e barras com drill-down por material
- **Métricas Financeiras**: Valor total, cobertura, valores críticos e em alerta
- **Modo Ajustes**: Filtro específico para materiais PES com tipo de estoque "S"

### 🔍 Filtros e Visualização
- **Filtros Globais**: Por tipo de depósito (Todos, PES, 999, TR-ZONE, DEVOL, DEVMAR, PES SAB)
- **Filtros por Tabela**: Busca individual em cada depósito com limite de exibição customizável
- **Ordenação Avançada**: Por valor total, aging, peso, criticidade e tipo de estoque
- **Totais Filtrados**: Badge dinâmico mostrando valor e quantidade de lotes quando filtrado

### 📈 Dashboards Interativos
- **Cards de Estatísticas**: Total de itens, média de aging, alertas e críticos com valores financeiros
- **Gráfico Valor por Criticidade**: Pie chart com drill-down + cards detalhados (contagem de materiais e lotes)
- **Gráfico Top 10 Materiais**: Barras horizontais mostrando materiais de maior valor
- **Drill-Down Completo**: 
  - Clique em criticidade → Filtra Top 15 materiais daquela categoria
  - Clique em material → Busca automática na tabela + scroll + highlight visual
- **Highlight de Seleção**: Material selecionado destacado com fundo azul e borda

### 🎨 Interface Moderna
- **Dark Mode**: Alternância com persistência em localStorage, botão no canto inferior direito
- **Design Responsivo**: Otimizado para desktop, tablet e mobile
- **Topbar Mobile**: Filtros acessíveis em barra superior fixa com scroll horizontal
- **Upload Simplificado**: Botão visível apenas em desktop
- **Navegação Limpa**: 2 abas principais (Análise Financeira e Configurações)

### 🔄 Upload de Dados
- **Aging de Estoque**: Upload direto via botão principal
- **Valores Unitários**: Upload protegido por senha (070594) no painel de configurações
- **Processamento Inteligente**: Parse automático de planilhas Excel com validação de dados
- **Atualização em Tempo Real**: Dashboards recarregam automaticamente após upload

---

## 🛠️ Stack Tecnológica

### Core
- **Next.js 16.0.7** - Framework React com Turbopack
- **TypeScript 5.0** - Type safety e IntelliSense
- **React 19** - Biblioteca UI com Server Components

### Database & Backend
- **Supabase** - PostgreSQL serverless
- **Tabelas**: 
  - `aging_estoque` - Dados de estoque e aging
  - `material_valores` - Valores unitários por material

### UI/UX
- **shadcn/ui** - Componentes acessíveis baseados em Radix UI
- **Tailwind CSS v4** - Utility-first CSS com dark mode
- **Apache ECharts** - Gráficos interativos SVG com eventos de clique
- **Lucide React** - Ícones modernos e leves

### Utilidades
- **xlsx** - Parse de planilhas Excel (.xlsx, .xls)
- **date-fns** - Manipulação de datas com locale pt-BR
- **clsx + tailwind-merge** - Conditional classes otimizadas

---

## 📋 Pré-requisitos

- **Node.js** 18.x ou superior
- **npm** ou **yarn**
- Conta **Supabase** (plano gratuito disponível)

---

## 🚀 Instalação e Configuração

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/dashpesagem.git
cd dashpesagem
```

### 2. Instale as Dependências

```bash
npm install
# ou
yarn install
```

### 3. Configure o Supabase

#### 3.1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto e aguarde a inicialização

#### 3.2. Criar Tabelas

No **SQL Editor** do Supabase, execute os scripts abaixo:

**Tabela de Aging de Estoque:**
```sql
CREATE TABLE IF NOT EXISTS aging_estoque (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  descricao TEXT,
  lote TEXT NOT NULL,
  peso NUMERIC(15, 2),
  tipo_deposito TEXT,
  pesagem TEXT,
  tr_zone TEXT,
  devolucao TEXT,
  ultimo_movimento DATE,
  tipo_estoque TEXT,
  data_entrada DATE,
  dias_aging INTEGER,
  estoque_disponivel NUMERIC(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(codigo, lote)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_aging_tipo_deposito ON aging_estoque(tipo_deposito);
CREATE INDEX IF NOT EXISTS idx_aging_codigo ON aging_estoque(codigo);
CREATE INDEX IF NOT EXISTS idx_aging_dias ON aging_estoque(dias_aging);
CREATE INDEX IF NOT EXISTS idx_aging_estoque_disponivel ON aging_estoque(estoque_disponivel);
```

**Tabela de Valores Unitários:**
```sql
CREATE TABLE IF NOT EXISTS material_valores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material TEXT NOT NULL UNIQUE,
  valor_unitario NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índice para joins
CREATE INDEX IF NOT EXISTS idx_material_valores_material ON material_valores(material);
```

### 4. Configure Variáveis de Ambiente

1. Copie o arquivo `.env.example` e renomeie para `.env.local`
2. No painel do Supabase, vá em **Settings** > **API**
3. Preencha as variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

### 5. Execute o Projeto

```bash
npm run dev
# ou
yarn dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## 📊 Estrutura da Planilha Excel

### Upload de Aging de Estoque

O sistema aceita planilhas Excel com as seguintes colunas (nomes flexíveis):

| Coluna | Variações Aceitas | Obrigatória |
|--------|-------------------|-------------|
| Código | Código, Codigo, CODIGO, Material, MATERIAL | ✅ |
| Descrição | Descrição, Descricao, DESCRICAO, Description | ❌ |
| Lote | Lote, LOTE, lote, Batch | ✅ |
| Peso | Peso, PESO, peso, Weight | ✅ |
| Depósito | Depósito, Deposito, DEPOSITO, tipo_deposito | ❌ |
| Pesagem | Pesagem, PESAGEM, pesagem | ❌ |
| TR-Zone | TR-Zone, TR Zone, TR_ZONE, tr_zone | ❌ |
| Devolução | Devolução, Devolucao, DEVOLUCAO, devolucao | ❌ |
| Último Movimento | Último Movimento, Ultimo Movimento, ULTIMO_MOVIMENTO | ❌ |
| Tipo Estoque | Tipo Estoque, Tipo de Estoque, TIPO_ESTOQUE | ❌ |
| Estoque Disponível | Estoque Disponível, Estoque Disponivel, ESTOQUE_DISPONIVEL | ❌ |

**Nota**: O sistema calcula automaticamente **Aging (dias)** baseado em `ultimo_movimento` ou `data_entrada`.

### Upload de Valores Unitários

Planilha com 2 colunas obrigatórias:

| Coluna | Variações Aceitas | Tipo |
|--------|-------------------|------|
| Material | Material, Código, Codigo, MATERIAL | Texto |
| Valor Unitário | Valor Unitário, Valor Unitario, VALOR_UNITARIO, Preço | Numérico (R$) |

**Proteção**: Requer senha **070594** para upload.

---

## 📂 Estrutura do Projeto

```
dashpesagem/
├── app/
│   ├── globals.css          # Estilos globais + variáveis dark mode
│   ├── layout.tsx           # Layout raiz com suppressHydrationWarning
│   └── page.tsx             # Página principal (2 tabs)
├── components/
│   ├── ui/                  # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── sheet.tsx
│   ├── aging-financial.tsx  # Dashboard financeiro principal
│   ├── aging-stats.tsx      # Cards de estatísticas
│   ├── valor-upload.tsx     # Upload de valores unitários
│   ├── theme-toggle.tsx     # Botão dark mode
│   └── layout/
│       ├── sidebar.tsx      # Menu lateral desktop
│       ├── filter-panel.tsx # Filtros tipo depósito (responsive)
│       └── upload-button.tsx # Botão upload aging
├── lib/
│   ├── supabase.ts          # Cliente Supabase
│   ├── excel-parser.ts      # Parser aging estoque
│   ├── valor-parser.ts      # Parser valores unitários
│   └── utils.ts             # Utilitários (cn)
├── types/
│   ├── aging.ts             # Tipos AgingData, SortField, etc
│   └── validator.ts         # Validações de dados
├── .env.local               # Variáveis de ambiente (NÃO COMMITAR)
├── .env.example             # Template de variáveis
└── package.json             # Dependências
```

---

## 🎯 Como Usar

### 1. Upload de Dados de Aging

1. Clique no botão **"Upload Planilha"** (canto superior direito no desktop)
2. Selecione arquivo Excel (.xlsx ou .xls)
3. Aguarde processamento (dados antigos serão substituídos)
4. Dashboard recarrega automaticamente

### 2. Upload de Valores Unitários

1. Vá em **Configurações** (ícone de engrenagem)
2. Na seção "Upload de Valores Unitários":
   - Digite a senha: **070594**
   - Escolha planilha com colunas Material e Valor Unitário
   - Clique em "Atualizar Valores"
3. Sistema valida e atualiza preços

### 3. Análise Financeira

1. Acesse aba **"Análise Financeira"**
2. Visualize:
   - **Cards superiores**: Valor total, cobertura, alertas
   - **Gráfico Valor por Criticidade**: Clique em uma fatia para filtrar
   - **Cards de detalhes**: Materiais e lotes por criticidade
   - **Gráfico Top Materiais**: Clique em uma barra para buscar na tabela
   - **Tabelas por Depósito**: Ordenação e busca individual

### 4. Filtros e Interações

**Filtros Globais:**
- Desktop: Painel lateral direito
- Mobile: Topbar horizontal com scroll

**Interações:**
- **Clique em criticidade (pie chart)** → Filtra Top 15 materiais daquela categoria
- **Clique em material (bar chart)** → Busca na tabela + scroll + highlight
- **Ordenar tabela** → Clique nos headers (Valor, Aging, Peso, Status, Tipo)
- **Buscar material** → Use campo de busca individual em cada tabela

### 5. Modo Ajustes (PES)

1. Selecione **"PES"** nos filtros laterais
2. Clique no botão **"Ajustes (PES/S)"** que aparece abaixo do gráfico
3. Visualize apenas materiais PES com `tipo_estoque = "S"`
4. Clique novamente para voltar ao modo geral

---

## 🎨 Funcionalidades da Interface

### Layout Desktop
- **Sidebar Esquerda**: Navegação principal (Visão Geral, Análise Financeira)
- **Painel Filtros Direito**: Filtros verticais por tipo de depósito
- **Botão Upload**: Canto superior direito (sempre visível)
- **Botão Dark Mode**: Canto inferior direito (circular, fixo)

### Layout Mobile (< 1024px)
- **Topbar Fixa**: Filtros horizontais com scroll
- **Menu Hamburger**: Sidebar em sheet modal
- **Sem Botão Upload**: Interface simplificada
- **Botão Dark Mode**: Sempre visível (posição fixa)

### Interações Especiais

**Gráfico Valor por Criticidade (Pie Chart):**
- Clique em fatia → Filtra gráfico de barras para Top 15 materiais da criticidade
- Cards abaixo mostram contagem de materiais e lotes

**Gráfico Top Materiais (Bar Chart):**
- Clique em barra → Busca material na tabela
- Scroll automático até linha correspondente
- Highlight azul com borda no material selecionado

**Tabelas por Depósito:**
- **Headers clicáveis**: Ordenação por Valor, Aging, Peso, Status, Tipo
- **Campo de busca**: Filtra materiais/descrições/lotes em tempo real
- **Limite de exibição**: Dropdown para mostrar 10/25/50/100 linhas
- **Badge de totais**: Aparece ao filtrar, mostra valor e quantidade de lotes
- **Highlight seleção**: Fundo azul-50/800 e borda azul-500 no material clicado

**Dark Mode:**
- Botão circular com ícones Lua/Sol
- Persiste seleção em localStorage
- Detecta preferência do sistema se não tiver cache
- Transições suaves em todos os componentes

---

## 🔐 Segurança

### Proteção de Dados
- **Variáveis de Ambiente**: Credenciais NUNCA no código-fonte
- **Row Level Security (RLS)**: Configurável no Supabase para autenticação
- **Password Protection**: Upload de valores requer senha (070594)
- **Input Validation**: Sanitização de dados Excel antes de inserção
- **Type Safety**: TypeScript em 100% do código

### Boas Práticas
- `.env.local` no `.gitignore` (nunca commitado)
- Anon key do Supabase (sem permissões críticas)
- Validação de tipos em parsers de Excel
- Tratamento de erros em uploads

---

## 🌐 Deploy

### Vercel (Recomendado)

**Via GitHub:**
1. Push do repositório para GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em "New Project"
4. Conecte seu repositório
5. Configure variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy automático!

**Via CLI:**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Produção
vercel --prod
```

### Outras Plataformas

**Netlify:**
```bash
npm run build
# Upload da pasta .next
```

**Railway:**
- Conectar repositório GitHub
- Configurar variáveis de ambiente
- Deploy automático

**AWS Amplify:**
- Suporte completo para Next.js
- CI/CD integrado
- Configure build settings

---

## 🔄 Fluxo de Dados

### 1. Upload de Aging
```
Excel (.xlsx) 
  ↓
excel-parser.ts (remove 3 linhas topo, 4 rodapé)
  ↓
Validação TypeScript
  ↓
Cálculo dias_aging (baseado em ultimo_movimento)
  ↓
Supabase INSERT/UPDATE (aging_estoque)
  ↓
Dashboard recarrega (fetchAgingData)
```

### 2. Upload de Valores
```
Excel (.xlsx) + Senha
  ↓
valor-parser.ts (identifica colunas dinamicamente)
  ↓
Validação (material string, valor > 0)
  ↓
Supabase UPSERT (material_valores)
  ↓
Análise financeira habilitada
```

### 3. Análise Financeira
```
aging_estoque JOIN material_valores (ON codigo = material)
  ↓
Cálculo: valor_total = estoque_disponivel × valor_unitario
  ↓
Classificação criticidade:
  - dias < 10 → Normal (verde)
  - 10 ≤ dias ≤ 20 → Alerta (amarelo)
  - dias > 20 → Crítico (vermelho)
  ↓
Agregação por tipo_deposito
  ↓
ECharts render (pie + bar) + Tabelas
```

### 4. Interação Chart → Table
```
Usuário clica em material no gráfico
  ↓
setSelectedMaterial(material)
  ↓
Atualiza tableSearchTerms[deposito] = material
  ↓
Scroll para tabela (scrollIntoView)
  ↓
Aplica highlight azul (bg-blue-50 dark:bg-blue-800)
```

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 👨‍💻 Desenvolvedor

**Johnathan Herbert**  
ID: 75710  
GitHub: [@johnathanherbert](https://github.com/johnathanherbert)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Add: nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/johnathanherbert/dashpesagem/issues)
- **Documentação**: Este README
- **Email**: Disponível no perfil GitHub

---

## 🙏 Agradecimentos

- **Vercel** - Next.js e hospedagem
- **Supabase** - Backend as a Service
- **shadcn** - Componentes UI acessíveis
- **Apache ECharts** - Biblioteca de gráficos interativos

---

**⭐ Se este projeto foi útil, considere dar uma estrela no GitHub!**

