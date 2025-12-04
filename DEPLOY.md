# 🚀 Guia de Deploy e Configuração Avançada

## Deploy na Vercel

### Passo 1: Preparar o Repositório
```bash
# Inicialize o Git (se ainda não foi feito)
git init
git add .
git commit -m "Initial commit - Dashboard de Aging"

# Crie um repositório no GitHub e faça push
git remote add origin https://github.com/seu-usuario/dashpesagem.git
git branch -M main
git push -u origin main
```

### Passo 2: Deploy na Vercel
1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Add New Project"
3. Importe seu repositório do GitHub
4. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Clique em "Deploy"

### Passo 3: Configurar Domínio (Opcional)
1. No painel da Vercel, vá em "Settings" > "Domains"
2. Adicione seu domínio personalizado
3. Configure os DNS conforme as instruções

## Otimizações de Performance

### 1. Configurar Cache do Supabase
Edite `lib/supabase.ts` para adicionar cache:

```typescript
export async function fetchAgingData(): Promise<AgingData[]> {
  const { data, error } = await supabase
    .from('aging_estoque')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

### 2. Implementar Paginação (Para grandes volumes)
Se você tiver mais de 10.000 registros, considere adicionar paginação na tabela.

### 3. Otimizar Imagens
Se adicionar imagens ou logos, use o componente `next/image` do Next.js.

## Segurança Avançada

### Row Level Security (RLS)

Para ambientes de produção, ative o RLS no Supabase:

```sql
-- Ativar RLS
ALTER TABLE aging_estoque ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para todos
CREATE POLICY "Public read access" ON aging_estoque
    FOR SELECT USING (true);

-- Permitir escrita apenas para usuários autenticados
CREATE POLICY "Authenticated users can insert" ON aging_estoque
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update" ON aging_estoque
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete" ON aging_estoque
    FOR DELETE USING (auth.role() = 'authenticated');
```

### Adicionar Autenticação

1. **Instalar Supabase Auth**:
```bash
npm install @supabase/auth-helpers-nextjs
```

2. **Criar página de login** em `app/login/page.tsx`

3. **Proteger rotas** usando middleware do Next.js

## Backup e Recuperação

### Backup Automático
O Supabase faz backup automático diário. Para backups manuais:

1. Vá no painel do Supabase
2. Database > Backups
3. Clique em "Create backup"

### Exportar Dados
```sql
-- No SQL Editor, execute:
COPY aging_estoque TO '/tmp/backup.csv' CSV HEADER;
```

## Monitoramento

### 1. Configurar Vercel Analytics
```bash
npm install @vercel/analytics
```

Adicione em `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Monitorar Supabase
- Dashboard do Supabase > Reports
- Monitore queries lentas
- Configure alertas de uso

## Customizações Comuns

### Adicionar Filtros Avançados
Edite `components/aging-table.tsx` para adicionar filtros por:
- Range de datas
- Múltiplos depósitos
- Tipo de estoque

### Exportar para PDF/Excel
Instale bibliotecas:
```bash
npm install jspdf jspdf-autotable xlsx
```

### Adicionar Notificações
Para alertas de itens críticos:
```bash
npm install sonner
```

## Troubleshooting

### Erro: "Failed to fetch"
- Verifique se as variáveis de ambiente estão configuradas
- Confirme que a tabela existe no Supabase
- Verifique as políticas RLS

### Erro: "Cannot read properties of undefined"
- Verifique se os dados estão sendo retornados corretamente
- Adicione validações nos componentes

### Performance lenta
- Verifique índices no banco de dados
- Considere implementar paginação
- Otimize queries do Supabase

## Manutenção

### Atualizar Dependências
```bash
npm update
npm audit fix
```

### Limpar Dados Antigos
Execute periodicamente no Supabase:
```sql
-- Deletar registros com mais de 1 ano
DELETE FROM aging_estoque
WHERE created_at < NOW() - INTERVAL '1 year';
```

## Próximos Passos

- [ ] Adicionar autenticação de usuários
- [ ] Implementar exportação para PDF
- [ ] Criar dashboards personalizados por usuário
- [ ] Adicionar notificações por email
- [ ] Implementar histórico de uploads
- [ ] Criar API REST para integração externa

## Recursos Úteis

- [Documentação Next.js](https://nextjs.org/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [ECharts Examples](https://echarts.apache.org/examples/)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

Para suporte ou dúvidas, consulte a documentação oficial ou abra uma issue no GitHub.
