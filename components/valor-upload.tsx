'use client';

import { useState } from 'react';
import { Upload, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseValorExcelFile, MaterialValor } from '@/lib/valor-parser';
import { supabase, invalidateMaterialValoresCache } from '@/lib/supabase';

const ADMIN_PASSWORD = '070594';

interface ValorUploadProps {
  onUploadComplete?: () => void;
}

export function ValorUpload({ onUploadComplete }: ValorUploadProps = {}) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClearCache = () => {
    invalidateMaterialValoresCache();
    setMessage({ type: 'success', text: '🗑️ Cache limpo! Os valores serão recarregados do banco.' });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setMessage(null);
    } else {
      setMessage({ type: 'error', text: 'Senha incorreta!' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Selecione um arquivo' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Parse do arquivo Excel
      const valoresData = await parseValorExcelFile(file);

      console.log(`📊 Processados ${valoresData.length} materiais da planilha`);
      console.log(`📝 Exemplo:`, valoresData.slice(0, 3));

      // Verifica quantos registros existem antes
      const { count: countBefore } = await supabase
        .from('material_valores')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📦 Registros no banco ANTES: ${countBefore || 0}`);

      // Deleta dados antigos - usando uma query que sempre funciona
      console.log('🗑️ Deletando registros antigos...');
      const { error: deleteError, count: deletedCount } = await supabase
        .from('material_valores')
        .delete()
        .gte('created_at', '2000-01-01'); // Delete todos desde 2000

      if (deleteError) {
        console.error('❌ Erro no delete:', deleteError);
        throw new Error(`Erro ao limpar dados antigos: ${deleteError.message}`);
      }

      console.log(`✅ Deletados: ${deletedCount || 'todos'} registros`);

      // Insere novos dados em lotes de 500 registros (reduzido para evitar timeout)
      const batchSize = 500;
      let insertedCount = 0;

      for (let i = 0; i < valoresData.length; i += batchSize) {
        const batch = valoresData.slice(i, i + batchSize);
        
        console.log(`📤 Inserindo lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(valoresData.length / batchSize)}...`);
        
        const { data: insertData, error: insertError } = await supabase
          .from('material_valores')
          .insert(batch)
          .select();

        if (insertError) {
          console.error(`❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}:`, insertError);
          throw new Error(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        }

        insertedCount += batch.length;
        console.log(`✅ Inseridos ${insertedCount}/${valoresData.length} materiais`);
      }

      // Verifica quantos registros existem depois
      const { count: countAfter } = await supabase
        .from('material_valores')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📦 Registros no banco DEPOIS: ${countAfter || 0}`);

      // Invalidar cache para forçar nova busca
      invalidateMaterialValoresCache();

      setMessage({
        type: 'success',
        text: `✅ Upload concluído! ${insertedCount} materiais inseridos. Total no banco: ${countAfter || insertedCount}`
      });
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById('valor-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Notifica o componente pai
      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
        }, 1000);
      }

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      setMessage({ 
        type: 'error', 
        text: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Acesso Restrito
          </CardTitle>
          <CardDescription>
            Digite a senha de administrador para acessar a configuração de valores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Senha de Administrador</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="mt-2"
              />
            </div>
            {message && message.type === 'error' && (
              <Alert variant="destructive">
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full">
              Acessar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload de Valores Unitários
        </CardTitle>
        <CardDescription>
          Faça upload da planilha Excel com códigos de materiais e valores unitários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="valor-file-input">
            Selecione a planilha (.xlsx ou .xls)
          </Label>
          <Input
            id="valor-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
            className="mt-2"
          />
          {file && (
            <p className="text-sm text-muted-foreground mt-2">
              Arquivo selecionado: {file.name}
            </p>
          )}
        </div>

        <div className="bg-muted p-4 rounded-md">
          <h4 className="font-semibold text-sm mb-2">Formato esperado da planilha:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Coluna 1: Código do Material (ou "Material", "Código")</li>
            <li>• Coluna 2: Valor Unitário (ou "Valor", "Preço Unitário")</li>
            <li>• Os nomes das colunas são detectados automaticamente</li>
            <li>• A primeira linha deve conter os cabeçalhos</li>
          </ul>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-100">
            💾 Cache Inteligente
          </h4>
          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
            Os valores são armazenados localmente por 24 horas para melhor performance. 
            Após o upload, o cache é automaticamente atualizado.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            className="text-xs h-7"
          >
            🗑️ Limpar Cache Manualmente
          </Button>
        </div>

        {message && (
          <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1"
          >
            {uploading ? 'Processando...' : 'Fazer Upload'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIsAuthenticated(false);
              setPassword('');
              setFile(null);
              setMessage(null);
            }}
          >
            Sair
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
