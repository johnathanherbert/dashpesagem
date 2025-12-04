'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-parser';
import { replaceAllAgingData } from '@/lib/supabase';
import { AgingData } from '@/types/aging';

interface ExcelUploadProps {
  onUploadComplete: () => void;
}

export function ExcelUpload({ onUploadComplete }: ExcelUploadProps) {
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
      setMessage('Processando arquivo Excel...');
      let data: AgingData[];
      
      try {
        data = await parseExcelFile(file);
      } catch (parseError) {
        throw new Error(`Erro ao processar Excel: ${parseError instanceof Error ? parseError.message : 'Formato inválido'}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhum dado encontrado no arquivo. Verifique se a planilha contém dados válidos.');
      }

      // Validar estrutura dos dados
      const primeiroItem = data[0];
      if (!primeiroItem.material || !primeiroItem.lote) {
        throw new Error('Dados inválidos: campos obrigatórios (Material, Lote) não encontrados.');
      }

      // Upload para Supabase
      setMessage(`Enviando ${data.length} registros para o banco de dados...`);
      
      try {
        await replaceAllAgingData(data);
      } catch (uploadError) {
        throw new Error(`Erro ao salvar no banco: ${uploadError instanceof Error ? uploadError.message : 'Falha na conexão'}`);
      }

      setStatus('success');
      setMessage(`✓ ${data.length} registros atualizados com sucesso!`);
      setFile(null);
      
      // Limpa o input
      const fileInput = document.getElementById('excel-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Notifica o componente pai
      setTimeout(() => {
        onUploadComplete();
      }, 1000);

    } catch (error) {
      console.error('Erro no upload:', error);
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
        <Upload className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Upload de Planilha Excel</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            id="excel-file"
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
              Atualizar Dados
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
        O arquivo Excel deve conter as colunas: Material, Texto breve material, UMB, Lote, 
        Centro, Depósito, Tipo de depósito, Posição no depósito, Estoque disponível, 
        Data do vencimento, Último movimento, Tipo de estoque, Última entrada dep.
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
