'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { ExcelUpload } from '@/components/excel-upload';

interface UploadButtonProps {
  onUploadComplete: () => void;
}

export function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const [open, setOpen] = useState(false);

  const handleUploadComplete = () => {
    onUploadComplete();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed right-4 top-4 z-50 shadow-lg rounded-full h-12 w-12"
          title="Upload de Planilha"
        >
          <Upload className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload de Planilha Excel</DialogTitle>
          <DialogDescription>
            Selecione um arquivo .xlsx ou .xls para atualizar os dados do dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <ExcelUpload onUploadComplete={handleUploadComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
