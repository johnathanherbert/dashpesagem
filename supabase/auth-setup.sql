-- Configuração de Autenticação no Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Habilitar autenticação por email
-- Vá em: Authentication > Providers > Email
-- Certifique-se que está habilitado

-- 2. Criar usuário administrador
-- Opção A: Via Dashboard do Supabase
-- Vá em: Authentication > Users > Add User
-- Email: johnathan.herbert47@gmail.com
-- Password: 070594
-- Auto Confirm User: ON

-- Opção B: Via SQL (menos recomendado, use o dashboard)
-- O Supabase Auth gerencia isso automaticamente no dashboard

-- 3. Configurar políticas de segurança RLS (Row Level Security)
-- Para as tabelas aging_estoque e material_valores

-- Habilitar RLS nas tabelas
ALTER TABLE aging_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_valores ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ler dados
CREATE POLICY "Usuários autenticados podem visualizar aging_estoque"
ON aging_estoque FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir aging_estoque"
ON aging_estoque FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar aging_estoque"
ON aging_estoque FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem deletar aging_estoque"
ON aging_estoque FOR DELETE
TO authenticated
USING (true);

-- Mesmas políticas para material_valores
CREATE POLICY "Usuários autenticados podem visualizar material_valores"
ON material_valores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir material_valores"
ON material_valores FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar material_valores"
ON material_valores FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem deletar material_valores"
ON material_valores FOR DELETE
TO authenticated
USING (true);

-- 4. Configurações de Email (Opcional)
-- Se quiser desabilitar confirmação de email:
-- Vá em: Authentication > Email Templates
-- Desative "Confirm signup" se quiser que usuários entrem direto

-- INSTRUÇÕES DE USO:
-- 1. Execute as políticas RLS acima no SQL Editor
-- 2. Vá em Authentication > Users > Add User
-- 3. Adicione: johnathan.herbert47@gmail.com com senha 070594
-- 4. Marque "Auto Confirm User" para ativar imediatamente
-- 5. Pronto! O login está configurado
