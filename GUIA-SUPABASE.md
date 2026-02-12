# Guia de Implementação no Supabase

## Passo a Passo para Criar as Tabelas

### 1. Acessar o Supabase

1. Abra seu navegador e acesse: https://supabase.com
2. Faça login na sua conta
3. Selecione o projeto **dashpesagem** (ou o nome do seu projeto)

### 2. Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **SQL Editor** (ícone de banco de dados)
2. Clique em **New query** (ou "Nova consulta")

### 3. Executar o Script SQL

1. Abra o arquivo `supabase-schema.sql` nesta pasta
2. Copie **TODO O CONTEÚDO** do arquivo
3. Cole no SQL Editor do Supabase
4. Clique no botão **RUN** (ou pressione `Ctrl+Enter` / `Cmd+Enter`)

**Aguarde**: O script pode levar alguns segundos para executar completamente.

### 4. Verificar a Criação das Tabelas

Após executar o script, você verá na parte inferior:

```
Tabelas criadas:
- remessas (com índices)
- configuracao_residuais (com configuração padrão)

Views criadas:
- vw_resumo_remessas_material
- vw_remessas_recentes

Triggers criados:
- update_remessas_updated_at
- update_configuracao_residuais_updated_at
```

### 5. Confirmar no Table Editor

1. Clique em **Table Editor** no menu lateral
2. Você deve ver as novas tabelas:
   - ✅ `remessas`
   - ✅ `configuracao_residuais`
   - ✅ `aging_estoque` (já existente)
   - ✅ `material_valores` (já existente)

### 6. Verificar Configuração Padrão

Execute esta query no SQL Editor para confirmar:

```sql
SELECT * FROM configuracao_residuais;
```

Deve retornar:
```
id: 1
limite_verde: 100
limite_amarelo: 900
materiais_alto_valor: {}
created_at: (data/hora atual)
updated_at: (data/hora atual)
```

## ⚠️ Problemas Comuns e Soluções

### Erro: "relation already exists"
**Causa**: Tabela já foi criada anteriormente
**Solução**: O script usa `CREATE TABLE IF NOT EXISTS`, então é seguro executar novamente

### Erro: "permission denied"
**Causa**: Falta de permissões no projeto
**Solução**: Certifique-se de estar logado como owner do projeto

### Erro: "syntax error"
**Causa**: Script copiado incorretamente
**Solução**: Copie novamente o arquivo inteiro, do início ao fim

### Tabela criada mas não aparece
**Causa**: Cache do browser
**Solução**: Pressione `Ctrl+F5` (ou `Cmd+Shift+R`) para recarregar

## 🔍 Comandos Úteis para Verificação

### Ver estrutura da tabela remessas
```sql
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'remessas'
ORDER BY ordinal_position;
```

### Ver índices criados
```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'remessas';
```

### Contar registros (deve ser 0 inicialmente)
```sql
SELECT
    'remessas' as tabela,
    COUNT(*) as registros
FROM remessas
UNION ALL
SELECT
    'configuracao_residuais',
    COUNT(*)
FROM configuracao_residuais;
```

## 📊 Políticas de Segurança (RLS)

As políticas foram configuradas automaticamente para:

### Tabela remessas:
- ✅ **SELECT**: Qualquer usuário pode ler
- ✅ **INSERT**: Qualquer usuário pode inserir
- ✅ **DELETE**: Qualquer usuário pode deletar

### Tabela configuracao_residuais:
- ✅ **SELECT**: Qualquer usuário pode ler
- ✅ **UPDATE**: Qualquer usuário pode atualizar
- ✅ **INSERT**: Qualquer usuário pode inserir

**Nota**: Estas políticas permissivas são adequadas para um dashboard interno. Se precisar de mais segurança, modifique as políticas.

## ✅ Checklist Final

Após executar o script, verifique:

- [ ] SQL executou sem erros
- [ ] Tabela `remessas` aparece no Table Editor
- [ ] Tabela `configuracao_residuais` aparece no Table Editor
- [ ] Query `SELECT * FROM configuracao_residuais` retorna 1 registro
- [ ] Views aparecem na seção de Views
- [ ] RLS está habilitado (ícone de cadeado nas tabelas)

## 🚀 Próximos Passos

Após criar as tabelas:

1. ✅ Volte para o aplicativo Next.js
2. ✅ Execute `npm run dev`
3. ✅ Acesse http://localhost:3000
4. ✅ Vá na aba **Config**
5. ✅ Faça upload da planilha de remessas
6. ✅ Configure os materiais de alto valor
7. ✅ Vá na aba **Residuais** para ver a análise

## 🆘 Precisa de Ajuda?

### Logs do Supabase
Os logs podem ajudar a identificar problemas:
1. Vá em **Logs** no menu lateral
2. Selecione **Database**
3. Procure por erros relacionados às tabelas

### Testar Conexão
Execute no SQL Editor:
```sql
-- Testar insert e select básico
INSERT INTO configuracao_residuais (id, limite_verde, limite_amarelo)
VALUES (1, 150, 1000)
ON CONFLICT (id) DO UPDATE
SET limite_verde = 150, limite_amarelo = 1000;

SELECT * FROM configuracao_residuais;
```

### Recriar Tabelas (se necessário)
Se algo deu errado e você quer recomeçar:

```sql
-- ATENÇÃO: Isso vai DELETAR todas as remessas e configurações!
DROP TABLE IF EXISTS remessas CASCADE;
DROP TABLE IF EXISTS configuracao_residuais CASCADE;
DROP VIEW IF EXISTS vw_resumo_remessas_material;
DROP VIEW IF EXISTS vw_remessas_recentes;

-- Depois execute o script supabase-schema.sql novamente
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase
2. Copie a mensagem de erro completa
3. Verifique se as variáveis de ambiente estão corretas no `.env.local`
4. Tente executar os comandos SQL individualmente para identificar qual linha está falhando
