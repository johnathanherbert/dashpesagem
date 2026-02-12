'use client';

import { useState } from 'react';
import { Upload, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseValorExcelFile, MaterialValor } from '@/lib/valor-parser';
import { supabase } from '@/lib/supabase';

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

      console.log(`📊 Processados ${valoresData.length} materiais`);

      // Deleta dados antigos
      const { error: deleteError } = await supabase
        .from('material_valores')
        .delete()
        .neq('material', ''); // Deleta tudo

      if (deleteError && deleteError.code !== 'PGRST116') {
        throw new Error(`Erro ao limpar dados antigos: ${deleteError.message}`);
      }

      // Insere novos dados em lotes de 1000 registros
      const batchSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < valoresData.length; i += batchSize) {
        const batch = valoresData.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('material_valores')
          .upsert(batch, { 
            onConflict: 'material',
            ignoreDuplicates: false 
          });

        if (insertError) {
          throw new Error(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        }

        insertedCount += batch.length;
        console.log(`✅ Inseridos ${insertedCount}/${valoresData.length} materiais`);
      }

      setMessage({
        type: 'success',
        text: `✅ Upload concluído! ${insertedCount} materiais atualizados com sucesso.`
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
      console.error('Erro no upload:', error);
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
