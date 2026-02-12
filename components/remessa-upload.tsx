'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { parseRemessasExcel } from '@/lib/remessa-parser';
import { replaceAllRemessas } from '@/lib/supabase';
import { RemessaData } from '@/types/aging';

interface RemessaUploadProps {
  onUploadComplete: () => void;
}

export function RemessaUpload({ onUploadComplete }: RemessaUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('error');
      setMessage('Por favor, selecione um arquivo Excel');
      return;
    }

    setUploading(true);
    setStatus('idle');
    setMessage('');

    try {
      // Parse do Excel
      setMessage('Processando arquivo de remessas do SAP...');
      let data: RemessaData[];

      try {
        data = await parseRemessasExcel(file);
      } catch (parseError) {
        throw new Error(`Erro ao processar Excel: ${parseError instanceof Error ? parseError.message : 'Formato inválido'}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhuma remessa encontrada no arquivo. Verifique se a planilha contém dados válidos do SAP.');
      }

      // Validar estrutura dos dados
      const primeiraRemessa = data[0];
      if (!primeiraRemessa.numero_remessa || !primeiraRemessa.material) {
        throw new Error('Dados inválidos: campos obrigatórios (Remessa, Material) não encontrados.');
      }

      // Upload para Supabase
      setMessage(`Enviando ${data.length} itens de remessa para o banco de dados...`);

      try {
        await replaceAllRemessas(data);
      } catch (uploadError) {
        throw new Error(`Erro ao salvar no banco: ${uploadError instanceof Error ? uploadError.message : 'Falha na conexão'}`);
      }

      setStatus('success');
      setMessage(`✓ ${data.length} itens de remessa carregados com sucesso!`);
      setFile(null);

      // Limpa o input
      const fileInput = document.getElementById('remessa-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Notifica o componente pai
      setTimeout(() => {
        onUploadComplete();
      }, 1000);

    } catch (error) {
      console.error('Erro no upload de remessas:', error);
      setStatus('error');

      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }

      setMessage(`Erro: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Upload de Remessas SAP</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            id="remessa-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
            className="cursor-pointer"
          />
        </div>
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="sm:w-auto w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Carregar Remessas
            </>
          )}
        </Button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
          status === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : status === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {status === 'success' && <CheckCircle className="h-4 w-4" />}
          {status === 'error' && <AlertCircle className="h-4 w-4" />}
          {status === 'idle' && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Arquivo de relatório do SAP contendo remessas com colunas:
        Remessa, Data picking, Item, Data disponibilidade, Quantidade, Unidade,
        Material, Centro, Depósito, Denominação.
      </p>

      {typeof window !== 'undefined' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && (
        <div className="flex items-center gap-2 p-3 rounded-md text-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
          <AlertCircle className="h-4 w-4" />
          <span>
            ⚠️ Supabase não configurado. Configure as variáveis de ambiente no arquivo .env.local
          </span>
        </div>
      )}
    </div>
  );
}
