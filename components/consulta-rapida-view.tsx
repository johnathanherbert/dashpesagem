'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { AgingData, RemessaData } from '@/types/aging';
import { fetchAgingData, fetchRemessas, triggerSapAutomation, checkSapAutomationStatus } from '@/lib/api';
import { parseBarcode, ParsedBarcode } from '@/lib/barcode-parser';
import {
  generateDevolverZwm296Vbs,
  DevolverVolumeItem,
  generateBloquearMigoVbs,
  generateDesbloquearMigoVbs,
  BloquearItemParam,
  MacroActionType,
  MacroActionItem,
  AVAILABLE_MACROS,
} from '@/components/residuais-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  QrCode,
  Camera,
  CameraOff,
  Search,
  Package,
  Layers,
  MapPin,
  Clock,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  ChevronRight,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut,
  Loader2,
  Undo2,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Sparkles,
  ArrowRightLeft,
  RefreshCw,
  ChevronUp,
  ArrowDown,
  X,
  GripVertical,
} from 'lucide-react';

interface ConsultaRapidaViewProps {
  agingData?: AgingData[];
  remessas?: RemessaData[];
  currentUserEmail?: string;
  onNavigateToTab?: (tab: string) => void;
  isEmbedded?: boolean;
}

export function ConsultaRapidaView({
  agingData: initialAging,
  remessas: initialRemessas,
  currentUserEmail,
  onNavigateToTab,
  isEmbedded = false,
}: ConsultaRapidaViewProps) {
  const [agingList, setAgingList] = useState<AgingData[]>(initialAging || []);
  const [remessasList, setRemessasList] = useState<RemessaData[]>(initialRemessas || []);
  const [loadingData, setLoadingData] = useState<boolean>(!initialAging || initialAging.length === 0);

  // Devolver Modal State
  const [devolverOpen, setDevolverOpen] = useState<boolean>(false);
  const [devolverMaterial, setDevolverMaterial] = useState<string>('');
  const [devolverDescricao, setDevolverDescricao] = useState<string>('');
  const [devolverLote, setDevolverLote] = useState<string>('');
  const [devolverUnidade, setDevolverUnidade] = useState<string>('KG');
  const [devolverSaldoTotal, setDevolverSaldoTotal] = useState<number>(0);
  const [devolverVolumes, setDevolverVolumes] = useState<DevolverVolumeItem[]>([
    { id: '1', quantidade: '', volume: '1' },
  ]);
  const [isDevolverRunning, setIsDevolverRunning] = useState<boolean>(false);

  // Bloquear/Desbloquear Modal State & Macro Pipeline
  const [bloquearMigoOpen, setBloquearMigoOpen] = useState<boolean>(false);
  const [bloquearSelectedItems, setBloquearSelectedItems] = useState<BloquearItemParam[]>([]);
  const [macroPipeline, setMacroPipeline] = useState<MacroActionItem[]>([
    { id: 'step-1', actionType: 'bloquear_migo' },
  ]);
  const [isBloquearMigoRunning, setIsBloquearMigoRunning] = useState<boolean>(false);
  const [draggedMacroIndex, setDraggedMacroIndex] = useState<number | null>(null);

  // Scanner State
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<ParsedBarcode | null>(null);
  const [processingImage, setProcessingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scanner HTML element ref & Html5Qrcode instance
  const scannerContainerId = 'mobile-barcode-reader-view';
  const html5QrCodeRef = useRef<any>(null);

  // Buffer para coletor Bluetooth
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sincroniza props se atualizarem
  useEffect(() => {
    if (initialAging && initialAging.length > 0) {
      setAgingList(initialAging);
      setLoadingData(false);
    }
  }, [initialAging]);

  useEffect(() => {
    if (initialRemessas && initialRemessas.length > 0) {
      setRemessasList(initialRemessas);
    }
  }, [initialRemessas]);

  // Carrega dados de estoque e remessas caso não tenham sido passados via props
  const loadStockData = async () => {
    if (initialAging && initialAging.length > 0) return;
    setLoadingData(true);
    try {
      const [aging, remessas] = await Promise.all([
        fetchAgingData().catch(() => []),
        fetchRemessas().catch(() => []),
      ]);
      setAgingList(aging);
      setRemessasList(remessas);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, []);

  // Foca automaticamente no campo para facilitar coletores
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Ouvinte global de teclas para Coletor Bluetooth / Scanner Físico (Modo Teclado HID)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeDiff > 400 && barcodeBufferRef.current.length > 0) {
        barcodeBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const textToProcess = barcodeBufferRef.current.trim() || (document.activeElement === inputRef.current ? manualInput.trim() : '');
        if (textToProcess) {
          e.preventDefault();
          handleBarcodeScanned(textToProcess);
          barcodeBufferRef.current = '';
          if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
          return;
        }
      }

      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;

        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
        }

        bufferTimeoutRef.current = setTimeout(() => {
          if (barcodeBufferRef.current.length >= 4) {
            const buffered = barcodeBufferRef.current.trim();
            handleBarcodeScanned(buffered);
            barcodeBufferRef.current = '';
          }
        }, 250);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    };
  }, [manualInput]);

  // Controles de câmera
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);

  // Iniciar e Parar o leitor de câmera
  const startScanner = async () => {
    setCameraError(null);
    setScannerActive(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch (e) {
          // Ignora
        }
      }

      const instance = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = instance;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(viewfinderWidth * 0.90);
        const height = Math.min(Math.floor(viewfinderHeight * 0.5), 180);
        return { width: Math.max(width, 240), height: Math.max(height, 100) };
      };

      await instance.start(
        { facingMode: 'environment' },
        {
          fps: 25,
          qrbox: qrboxFunction,
          aspectRatio: 1.777778,
          disableFlip: false,
        },
        (decodedText: string) => {
          handleBarcodeScanned(decodedText);
          stopScanner();
        },
        () => {}
      );

      try {
        const capabilities: any = instance.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
        if (capabilities && capabilities.zoom) {
          setMaxZoom(capabilities.zoom.max || 1);
        }
      } catch (e) {
        // Ignora
      }
    } catch (err: any) {
      console.error('Erro ao iniciar câmera:', err);
      setCameraError(
        'Não foi possível acessar a câmera. Verifique se concedeu permissão HTTPS.'
      );
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      }
    } catch (err) {
      console.error('Erro ao parar câmera:', err);
    } finally {
      setScannerActive(false);
      setTorchOn(false);
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      toast.error('Não foi possível alternar a lanterna');
    }
  };

  const handleZoomChange = async (newZoom: number) => {
    if (!html5QrCodeRef.current) return;
    try {
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ zoom: newZoom }],
      });
      setZoomLevel(newZoom);
    } catch (err) {
      // Falha silenciosa
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);
    const toastId = toast.loading('Lendo etiqueta da foto HD...');

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      let tempContainer = document.getElementById('barcode-file-reader-hidden-view');
      if (!tempContainer) {
        tempContainer = document.createElement('div');
        tempContainer.id = 'barcode-file-reader-hidden-view';
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);
      }

      const fileScanner = new Html5Qrcode('barcode-file-reader-hidden-view', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      try {
        const decodedText = await fileScanner.scanFile(file, true);
        toast.dismiss(toastId);
        toast.success('Código de barras identificado com sucesso!');
        handleBarcodeScanned(decodedText);
        await fileScanner.clear();
      } catch (scanErr) {
        toast.dismiss(toastId);
        toast.error('Nenhum código legível encontrado na foto. Tente aproximar da etiqueta.');
        await fileScanner.clear();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Falha ao processar arquivo de imagem');
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBarcodeScanned = (rawText: string) => {
    if (!rawText || rawText.trim() === '') return;

    try {
      const parsed = parseBarcode(rawText);
      setScannedResult(parsed);
      setManualInput(rawText);

      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80, 40, 80]);
        }
      } catch (e) {
        // Ignora
      }

      const foundStock = agingList.some(
        (a) =>
          (parsed.material && a.material.replace(/^0+/, '') === parsed.material.replace(/^0+/, '')) ||
          (parsed.lote && a.lote.toUpperCase() === parsed.lote.toUpperCase())
      );

      if (foundStock) {
        toast.success(`Etiqueta identificada: Lote ${parsed.lote || parsed.material}`, {
          icon: '🏷️',
        });
      } else {
        toast('Material/Lote lido, buscando dados...', {
          icon: '🔍',
        });
      }
    } catch (e) {
      setScannedResult({
        raw: rawText,
        material: rawText.trim(),
        lote: '',
        quantidade: null,
      });
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeScanned(manualInput.trim());
    }
  };

  const handleClear = () => {
    setScannedResult(null);
    setManualInput('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Itens filtrados pelo lote ou material lido
  const loteItems = useMemo(() => {
    if (!scannedResult) return [];

    let filtered = agingList;

    if (scannedResult.lote) {
      const cleanLot = scannedResult.lote.trim().toUpperCase();
      const byLote = filtered.filter(
        (item) => String(item.lote).trim().toUpperCase() === cleanLot
      );
      if (byLote.length > 0) return byLote;
    }

    if (scannedResult.material) {
      const cleanMat = scannedResult.material.trim().replace(/^0+/, '');
      return filtered.filter(
        (item) => String(item.material).trim().replace(/^0+/, '') === cleanMat
      );
    }

    const raw = scannedResult.raw.trim().toUpperCase();
    return filtered.filter(
      (item) =>
        String(item.lote).trim().toUpperCase().includes(raw) ||
        String(item.material).trim().includes(raw) ||
        String(item.texto_breve_material).toUpperCase().includes(raw)
    );
  }, [scannedResult, agingList]);

  // Itens de outros lotes do mesmo material
  const allMaterialItems = useMemo(() => {
    if (!scannedResult) return [];

    const matCode =
      loteItems[0]?.material ||
      scannedResult.material ||
      '';

    if (!matCode) return [];

    const cleanMat = matCode.trim().replace(/^0+/, '');
    return agingList.filter(
      (item) => String(item.material).trim().replace(/^0+/, '') === cleanMat
    );
  }, [scannedResult, loteItems, agingList]);

  const totalEstoqueLote = useMemo(() => {
    return loteItems.reduce((acc, curr) => acc + (Number(curr.estoque_disponivel) || 0), 0);
  }, [loteItems]);

  const materialCode = loteItems[0]?.material || scannedResult?.material || '';
  const materialDescription =
    loteItems[0]?.texto_breve_material ||
    allMaterialItems[0]?.texto_breve_material ||
    'Material lido via etiqueta';
  // Importante: o lote exibido/considerado "lido" deve vir exclusivamente do que foi
  // efetivamente escaneado/digitado, nunca "adivinhado" a partir do primeiro item da
  // lista. Uma busca apenas por código de material deve listar todos os lotes em aberto.
  const loteCode = (scannedResult?.lote || '').trim();
  const loteEncontradoNoEstoque = useMemo(() => {
    if (!loteCode) return true;
    const cleanLot = loteCode.toUpperCase();
    return agingList.some((item) => String(item.lote).trim().toUpperCase() === cleanLot);
  }, [loteCode, agingList]);
  const unidadeMedida = loteItems[0]?.unidade_medida || allMaterialItems[0]?.unidade_medida || 'KG';

  const formatAgingDays = (days?: number) => {
    if (days === undefined || days === null) return <span className="text-slate-400 font-mono">-</span>;
    if (days >= 15) {
      return <span className="text-rose-400 font-bold font-mono">{days}d (Crítico)</span>;
    }
    if (days >= 7) {
      return <span className="text-amber-400 font-bold font-mono">{days}d (Alerta)</span>;
    }
    return <span className="text-emerald-400 font-bold font-mono">{days}d (Normal)</span>;
  };

  const materialRemessas = useMemo(() => {
    if (!materialCode) return [];
    const matClean = materialCode.trim().replace(/^0+/, '');
    return remessasList.filter(
      (r) => r.material.trim().replace(/^0+/, '') === matClean
    );
  }, [remessasList, materialCode]);

  // Lógica de Devolver Fracionado
  const parseQtdNumber = (val: string): number => {
    if (!val) return 0;
    const cleaned = String(val).trim().replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const somaVolumes = useMemo(() => {
    return devolverVolumes.reduce((acc, v) => acc + parseQtdNumber(v.quantidade), 0);
  }, [devolverVolumes]);

  const saldoRestante = Math.max(0, devolverSaldoTotal - somaVolumes);
  const isOverSaldo = somaVolumes > devolverSaldoTotal + 0.0001;

  const handleOpenDevolver = (
    mat: string,
    lot: string,
    desc: string,
    unidade: string,
    saldoTotal: number
  ) => {
    setDevolverMaterial(mat);
    setDevolverLote(lot);
    setDevolverDescricao(desc);
    setDevolverUnidade(unidade || 'KG');
    setDevolverSaldoTotal(saldoTotal);

    const saldoFormatted = saldoTotal > 0
      ? saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false })
      : '';

    setDevolverVolumes([
      { id: String(Date.now()), quantidade: saldoFormatted, volume: '1' },
    ]);
    setDevolverOpen(true);
  };

  const handleAddVolume = () => {
    setDevolverVolumes((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        quantidade: '',
        volume: '1',
      },
    ]);
  };

  const handleRemoveVolume = (idx: number) => {
    setDevolverVolumes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateVolume = (
    idx: number,
    field: 'quantidade' | 'volume',
    value: string
  ) => {
    setDevolverVolumes((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleFillRestante = () => {
    if (saldoRestante <= 0.0001) return;
    const restanteStr = saldoRestante.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });

    setDevolverVolumes((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && parseQtdNumber(prev[lastIdx].quantidade) === 0) {
        const copy = [...prev];
        copy[lastIdx] = { ...copy[lastIdx], quantidade: restanteStr };
        return copy;
      }
      return [
        ...prev,
        {
          id: String(Date.now()),
          quantidade: restanteStr,
          volume: '1',
        },
      ];
    });
  };

  const handleConfirmDevolver = async () => {
    if (!devolverMaterial || !devolverLote || devolverVolumes.length === 0) return;

    const hasInvalid = devolverVolumes.some((v) => !v.quantidade.trim() || parseQtdNumber(v.quantidade) <= 0);
    if (hasInvalid) {
      toast.error('Preencha a quantidade válida de todos os volumes.');
      return;
    }

    if (isOverSaldo) {
      toast.error('A soma dos volumes ultrapassa o saldo disponível do lote!');
      return;
    }

    setDevolverOpen(false);
    setIsDevolverRunning(true);
    const countVolumes = devolverVolumes.length;
    const toastId = toast.loading(`Enviando devolução de ${devolverMaterial} (${countVolumes} volume(s)) ao Planilha Sync...`);

    const vbsCode = generateDevolverZwm296Vbs(devolverMaterial, devolverLote, devolverVolumes);

    try {
      const res = await triggerSapAutomation('devolver', currentUserEmail || 'Mobile / Consulta', vbsCode);
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar devolução: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsDevolverRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading(`Aguardando execução do script de devolução (/nzwm296) no SAP...`, { id: toastId });

      let attempts = 0;
      const maxAttempts = 40;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast.success(`Devolução executada com sucesso no SAP para o lote ${devolverLote}!`, { id: toastId, icon: '📦' });
            loadStockData();
          } else if (statusJob?.status === 'failed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast.error(`Execução no SAP falhou: ${statusJob.result_message || 'Erro no script'}`, { id: toastId });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast('Tempo limite aguardando o Planilha Sync. Verifique se o app está aberto.', { id: toastId, icon: '⚠️' });
          }
        } catch (e) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setIsDevolverRunning(false);
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`, { id: toastId });
      setIsDevolverRunning(false);
    }
  };

  // Lógica de Bloquear/Desbloquear MIGO / Pipeline de Macros
  const handleOpenBloquear = (
    mat: string,
    lot: string,
    quantidade: number | string,
    unidade: string,
    descricao?: string
  ) => {
    const qtdStr = typeof quantidade === 'number'
      ? (quantidade > 0 ? quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false }) : '')
      : String(quantidade || '');

    setBloquearSelectedItems([
      {
        material: mat,
        lote: lot,
        quantidade: qtdStr,
        unidade: unidade || 'KG',
        descricao: descricao || materialDescription,
      },
    ]);
    setMacroPipeline([{ id: `step-${Date.now()}`, actionType: 'bloquear_migo' }]);
    setBloquearMigoOpen(true);
  };

  const handleToggleMigoMode = (mode: 'bloquear' | 'desbloquear') => {
    const targetType = mode === 'bloquear' ? 'bloquear_migo' : 'desbloquear_migo';
    setMacroPipeline((prev) => {
      const hasMigo = prev.some((m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo');
      if (!hasMigo) {
        return [{ id: `step-${Date.now()}`, actionType: targetType }, ...prev];
      }
      return prev.map((m) => {
        if (m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo') {
          return { ...m, actionType: targetType };
        }
        return m;
      });
    });
  };

  const handleUpdateSingleBloquearItem = (field: keyof BloquearItemParam, value: string) => {
    setBloquearSelectedItems((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[0] = { ...copy[0], [field]: value };
      return copy;
    });
  };

  const handleAddMacroToPipeline = (actionType: MacroActionType) => {
    setMacroPipeline((prev) => [
      ...prev,
      { id: `${actionType}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, actionType },
    ]);
  };

  const handleRemoveMacroFromPipeline = (index: number) => {
    setMacroPipeline((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveMacroInPipeline = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= macroPipeline.length) return;
    setMacroPipeline((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleApplyMacroPreset = (presetTypes: MacroActionType[]) => {
    setMacroPipeline(
      presetTypes.map((actionType, i) => ({
        id: `${actionType}-${Date.now()}-${i}`,
        actionType,
      }))
    );
  };

  const executeSapJobAndWait = async (
    action: string,
    user: string,
    vbsCode?: string,
    maxSeconds = 60
  ): Promise<{ success: boolean; message?: string }> => {
    return new Promise(async (resolve) => {
      try {
        const res = await triggerSapAutomation(action, user, vbsCode);
        if (!res.success || !res.job) {
          return resolve({ success: false, message: res.error || 'Erro ao criar solicitação' });
        }

        const jobId = res.job.id;
        let attempts = 0;
        const maxAttempts = Math.ceil(maxSeconds / 2);

        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusJob = await checkSapAutomationStatus(jobId);
            if (statusJob?.status === 'completed') {
              clearInterval(interval);
              return resolve({ success: true, message: statusJob.result_message });
            } else if (statusJob?.status === 'failed') {
              clearInterval(interval);
              return resolve({ success: false, message: statusJob.result_message || 'Falha na execução do SAP' });
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({ success: false, message: 'Tempo limite excedido aguardando resposta do SAP' });
            }
          } catch (e: any) {
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              return resolve({ success: false, message: e?.message || 'Erro de comunicação' });
            }
          }
        }, 2000);
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Erro inesperado' });
      }
    });
  };

  const handleExecuteBloquearMacroPipeline = async () => {
    if (macroPipeline.length === 0) {
      toast.error('Adicione ao menos uma macro ao pipeline de execução.');
      return;
    }

    const hasBloquearOrDesbloquear = macroPipeline.some(
      (m) => m.actionType === 'bloquear_migo' || m.actionType === 'desbloquear_migo'
    );
    if (hasBloquearOrDesbloquear) {
      if (bloquearSelectedItems.length === 0) return;
      const hasInvalid = bloquearSelectedItems.some(
        (it) => !it.material.trim() || !it.lote.trim() || !it.quantidade.trim()
      );
      if (hasInvalid) {
        toast.error('Preencha os campos obrigatórios (Material, Lote e Quantidade).');
        return;
      }
    }

    setBloquearMigoOpen(false);
    setIsBloquearMigoRunning(true);
    const totalSteps = macroPipeline.length;
    const countItems = bloquearSelectedItems.length;
    const toastId = toast.loading(`Iniciando pipeline de ${totalSteps} etapa(s) no SAP...`);

    try {
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        const step = macroPipeline[stepIdx];
        const stepNumber = stepIdx + 1;
        const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
        const label = macroDef?.shortLabel || step.actionType;

        toast.loading(`[${stepNumber}/${totalSteps}] Executando: ${label}...`, { id: toastId });

        let res: { success: boolean; message?: string };

        if (step.actionType === 'bloquear_migo') {
          const vbsCode = generateBloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'bloquear_migo',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'desbloquear_migo') {
          const vbsCode = generateDesbloquearMigoVbs(bloquearSelectedItems);
          res = await executeSapJobAndWait(
            'desbloquear_migo',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            Math.max(60, countItems * 25)
          );
        } else if (step.actionType === 'mover_ajuste') {
          res = await executeSapJobAndWait(
            'movermigo',
            currentUserEmail || 'Mobile / Consulta',
            undefined,
            60
          );
        } else if (step.actionType === 'atualizar_db') {
          res = await executeSapJobAndWait(
            'atualizar_db',
            currentUserEmail || 'Mobile / Consulta',
            undefined,
            180
          );
        } else if (step.actionType === 'devolver') {
          const firstMat = bloquearSelectedItems[0]?.material || '';
          const firstLot = bloquearSelectedItems[0]?.lote || '';
          const vbsCode = generateDevolverZwm296Vbs(
            firstMat,
            firstLot,
            bloquearSelectedItems.map((it, idx) => ({
              quantidade: it.quantidade,
              volume: String(idx + 1),
            }))
          );
          res = await executeSapJobAndWait(
            'devolver',
            currentUserEmail || 'Mobile / Consulta',
            vbsCode,
            90
          );
        } else {
          res = { success: true };
        }

        if (!res.success) {
          toast.error(`Falha na etapa [${stepNumber}/${totalSteps} - ${label}]: ${res.message || 'Erro no SAP'}`, {
            id: toastId,
            duration: 8000,
          });
          setIsBloquearMigoRunning(false);
          return;
        }
      }

      toast.success(`Pipeline completo executado com sucesso no SAP!`, {
        id: toastId,
        icon: '🎉',
        duration: 5000,
      });
      loadStockData();
    } catch (err: any) {
      toast.error(`Erro ao executar pipeline: ${err?.message || err}`, { id: toastId });
    } finally {
      setIsBloquearMigoRunning(false);
    }
  };

  return (
    <div className={cn("text-slate-100 font-sans w-full", !isEmbedded ? "max-w-6xl mx-auto px-2 sm:px-3" : "w-full")}>
      <div className="space-y-2.5">
        {/* Card de Leitura / Entrada */}
        <div className="bg-[#13283E] border border-[#2A4D6E] rounded-lg p-2.5 sm:p-3.5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[#AEE4FF]/10 border border-[#AEE4FF]/30">
                <QrCode className="h-4 w-4 text-[#AEE4FF]" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#AEE4FF] block">
                  Consulta Rápida & Bipagem
                </span>
                <span className="text-[10px] text-[#608BA6] hidden sm:inline">
                  Leitor de código de barras, fotos de etiquetas ou entrada manual
                </span>
              </div>
            </div>
            {scannedResult && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar Consulta
              </button>
            )}
          </div>

          {/* Container do Vídeo da Câmera */}
          <div className={`overflow-hidden rounded-lg bg-black/80 border border-[#AEE4FF]/40 shadow-inner relative ${scannerActive ? 'block' : 'hidden'}`}>
            <div id={scannerContainerId} className="w-full min-h-[240px]" />
            
            {/* Controles sobrepostos da câmera (Lanterna e Zoom) */}
            {scannerActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-md border backdrop-blur-md shadow-lg transition-all ${
                      torchOn
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                    }`}
                    title="Alternar Lanterna"
                  >
                    {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
                  </button>
                )}
              </div>
            )}

            {/* Slider de Zoom rápido se suportado */}
            {scannerActive && maxZoom > 1 && (
              <div className="absolute bottom-10 left-4 right-4 z-20 flex items-center justify-center gap-3 bg-black/60 backdrop-blur-md p-2 rounded-md border border-white/10">
                <ZoomOut className="h-4 w-4 text-slate-300" />
                <input
                  type="range"
                  min={1}
                  max={maxZoom}
                  step={0.1}
                  value={zoomLevel}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-40 accent-[#AEE4FF]"
                />
                <ZoomIn className="h-4 w-4 text-slate-300" />
                <span className="text-[11px] font-mono text-[#AEE4FF] font-bold">{zoomLevel.toFixed(1)}x</span>
              </div>
            )}

            <div className="p-2.5 bg-[#1B3550] border-t border-[#2A4D6E] text-center">
              <p className="text-xs font-semibold text-[#AEE4FF]">
                Enquadre a etiqueta de 10cm na barra horizontal
              </p>
              <p className="text-[10px] text-[#608BA6]">
                Mantenha a cerca de 15-25cm de distância para foco nítido
              </p>
            </div>
          </div>

          {cameraError && (
            <div className="p-2.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Container oculto para o scanner de arquivos */}
          <div id="barcode-file-reader-hidden-view" className="hidden" />

          {/* Input nativo de captura de câmera (alta definição nativa do celular) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageCapture}
            className="hidden"
          />

          {/* Ações de Captura e Campo de Entrada */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
            {/* Botões de Câmera */}
            <div className="grid grid-cols-2 gap-2 sm:col-span-5">
              <button
                type="button"
                disabled={processingImage}
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-[#AEE4FF] hover:bg-white text-[#13283E] rounded-md font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {processingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#13283E]" />
                    <span>Lendo...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-[#13283E]" />
                    <span>Tirar Foto HD</span>
                  </>
                )}
              </button>

              {!scannerActive ? (
                <button
                  type="button"
                  disabled={processingImage}
                  onClick={startScanner}
                  className="py-2 px-3 bg-[#1B3550] hover:bg-[#224467] text-[#AEE4FF] border border-[#2A4D6E] rounded-md font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4 text-[#AEE4FF]" />
                  <span>Leitor Ao Vivo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <CameraOff className="h-4 w-4" />
                  <span>Fechar Leitor</span>
                </button>
              )}
            </div>

            {/* Formulário Manual / Coletor */}
            <form onSubmit={handleManualSearch} className="sm:col-span-7 flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualInput(val);
                    if (val.trim().length >= 6 && (val.includes(' ') || val.includes('\t') || val.includes(';') || val.includes('|'))) {
                      handleBarcodeScanned(val);
                    }
                  }}
                  placeholder="Bipe com coletor ou digite material/lote..."
                  className="w-full pl-3 pr-9 py-2 bg-[#0E1C2B] border border-[#2A4D6E] rounded-md text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-[#AEE4FF] focus:ring-1 focus:ring-[#AEE4FF] transition-all font-mono"
                />
                {manualInput && (
                  <button
                    type="button"
                    onClick={() => setManualInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 bg-[#AEE4FF] hover:bg-white text-[#13283E] rounded-md font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Se nenhum resultado pesquisado ainda */}
        {!scannedResult && !loadingData && (
          <div className="text-center py-10 px-4 bg-[#13283E]/40 border border-[#2A4D6E]/50 rounded-lg space-y-2.5">
            <div className="w-12 h-12 rounded-md bg-[#1B3550] border border-[#2A4D6E] flex items-center justify-center mx-auto text-[#AEE4FF] shadow-inner">
              <Package className="h-6 w-6 opacity-80" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-200">Aguardando leitura de etiqueta ou material</p>
              <p className="text-xs text-[#608BA6] max-w-md mx-auto mt-1">
                Escaneie o código de barras com a câmera, bipe com o coletor ou informe o código para consultar outros lotes do material, remessas e executar devoluções ou bloqueios no SAP.
              </p>
            </div>
          </div>
        )}

        {/* Resultado da Consulta Direta */}
        {scannedResult && (
          <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Card Principal do Material / Lote Lido */}
            <div className="bg-[#13283E] border border-[#2A4D6E] rounded-lg p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Informações do Material e Lote */}
                <div className="md:col-span-7 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#608BA6] bg-[#0E1C2B] px-1.5 py-0.5 rounded border border-[#2A4D6E]">
                      Material
                    </span>
                    <span className="text-lg sm:text-xl font-mono font-extrabold text-[#AEE4FF]">
                      {materialCode || 'N/A'}
                    </span>
                    {loteCode ? (
                      <Badge
                        className={cn(
                          "font-mono text-xs px-2 py-0.5 font-bold",
                          loteEncontradoNoEstoque
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                            : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                        )}
                      >
                        Lote Lido: {loteCode}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold bg-[#0E1C2B] border-[#2A4D6E] text-slate-300">
                        Busca por código · todos os lotes
                      </Badge>
                    )}
                  </div>
                  {loteCode && !loteEncontradoNoEstoque && (
                    <p className="text-[10px] text-rose-300 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Lote não localizado no estoque atual — exibindo todos os lotes do material.
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-slate-200 font-medium leading-snug">
                    {materialDescription}
                  </p>
                  
                  {/* Resumo rápido de estoque */}
                  <div className="flex items-center gap-2 pt-1 text-xs text-slate-300 flex-wrap">
                    <div className="flex items-baseline gap-1 bg-[#1B3550] border border-[#2A4D6E] px-2 py-1 rounded-md">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {loteCode ? 'Estoque Lote:' : 'Estoque Total:'}
                      </span>
                      <span className="font-mono font-bold text-white">
                        {totalEstoqueLote > 0
                          ? totalEstoqueLote.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                          : (scannedResult.quantidade !== null && scannedResult.quantidade !== undefined ? scannedResult.quantidade : '0')}
                      </span>
                      <span className="text-[10px] text-[#AEE4FF] font-bold">{unidadeMedida}</span>
                    </div>

                    {allMaterialItems.length > 0 && (
                      <div className="flex items-baseline gap-1 bg-[#1B3550] border border-[#2A4D6E] px-2 py-1 rounded-md">
                        <span className="text-[10px] text-slate-400 font-semibold">Lotes:</span>
                        <span className="font-mono font-bold text-[#AEE4FF]">
                          {allMaterialItems.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões de Ação Imediata */}
                <div className="md:col-span-5 space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. Botão Devolver */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenDevolver(
                          materialCode,
                          loteCode,
                          materialDescription,
                          unidadeMedida,
                          totalEstoqueLote > 0 ? totalEstoqueLote : Number(scannedResult.quantidade || 0)
                        )
                      }
                      disabled={isDevolverRunning || !loteCode}
                      title="Devolver ao almoxarifado via /nzwm296"
                      className="py-2 px-2.5 bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] font-bold text-xs rounded-md shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Undo2 className="h-4 w-4 shrink-0" />
                      <span>Devolver</span>
                    </button>

                    {/* 2. Botão Bloquear / Desbloquear MIGO */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenBloquear(
                          materialCode,
                          loteCode,
                          totalEstoqueLote > 0 ? totalEstoqueLote : Number(scannedResult.quantidade || 0),
                          unidadeMedida,
                          materialDescription
                        )
                      }
                      disabled={isBloquearMigoRunning || !loteCode}
                      title="Bloquear ou desbloquear no SAP via MIGO"
                      className="py-2 px-2.5 bg-[#AEE4FF] hover:bg-white text-[#13283E] font-bold text-xs rounded-md shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center -space-x-1 shrink-0">
                        <Lock className="h-3.5 w-3.5 text-[#13283E]" />
                        <Unlock className="h-3.5 w-3.5 text-[#13283E]" />
                      </div>
                      <span>Bloq/Desbloq</span>
                    </button>
                  </div>
                  {!loteCode && (
                    <p className="text-[10px] text-slate-400 text-center md:text-right">
                      Selecione um lote na lista abaixo para devolver ou bloquear.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Grid Principal com Outros Lotes do Material e Remessas Abertas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {/* Coluna 1: Outros Lotes do Material */}
              <div className="lg:col-span-7 space-y-2.5">
                <div className="bg-[#13283E] border border-[#2A4D6E] rounded-lg p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#2A4D6E] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-[#AEE4FF]/10 text-[#AEE4FF]">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEE4FF]">
                          Outros Lotes do Material
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          {allMaterialItems.length} {allMaterialItems.length === 1 ? 'lote encontrado' : 'lotes encontrados no estoque'}
                        </p>
                      </div>
                    </div>
                    {allMaterialItems.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-[#1B3550] border-[#2A4D6E] text-slate-300 font-mono">
                        Total: {allMaterialItems.reduce((acc, c) => acc + (Number(c.estoque_disponivel) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {unidadeMedida}
                      </Badge>
                    )}
                  </div>

                  {allMaterialItems.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-[#1B3550]/40 rounded-md border border-[#2A4D6E]/40 space-y-1">
                      <p className="text-xs font-semibold text-slate-300">Nenhum lote deste material encontrado em estoque</p>
                      <p className="text-[10px] text-slate-500">Verifique se o material possui saldo ativo na última atualização.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                      {allMaterialItems.map((item, idx) => {
                        const isCurrentLote = loteCode && String(item.lote).trim().toUpperCase() === loteCode.trim().toUpperCase();
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-2.5 rounded-md border text-xs transition-all",
                              isCurrentLote
                                ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
                                : "bg-[#1B3550] hover:bg-[#203e5e] border-[#2A4D6E]"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              {/* Lote e Posição */}
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-amber-300 text-sm">
                                    {item.lote}
                                  </span>
                                  {isCurrentLote && (
                                    <Badge className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0 font-extrabold">
                                      Lido
                                    </Badge>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-slate-400">Posição:</span>
                                    <span className="font-mono font-bold text-[#AEE4FF] text-xs">
                                      {item.posicao_deposito || 'S/ POS'}
                                    </span>
                                    {item.tipo_deposito && (
                                      <Badge className="bg-[#0E1D2D] border border-[#2A4D6E] text-[9px] text-slate-300 font-mono py-0 px-1">
                                        {item.tipo_deposito}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                                  <span>Aging: {formatAgingDays(item.dias_aging)}</span>
                                  {item.data_vencimento && (
                                    <>
                                      <span>•</span>
                                      <span>Venc: <strong className="text-slate-200">{item.data_vencimento}</strong></span>
                                    </>
                                  )}
                                  {item.tipo_estoque && item.tipo_estoque !== 'Livre' && (
                                    <>
                                      <span>•</span>
                                      <span className="text-rose-400 font-semibold">Tipo {item.tipo_estoque}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Saldo e Ações Rápidas */}
                              <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-[#2A4D6E]/50 pt-2 sm:pt-0">
                                <div className="text-left sm:text-right">
                                  <span className="font-mono font-extrabold text-sm text-white">
                                    {Number(item.estoque_disponivel || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                                  </span>
                                  <span className="text-[10px] text-[#AEE4FF] ml-1 font-semibold">{item.unidade_medida || 'KG'}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenBloquear(
                                        item.material,
                                        item.lote,
                                        Number(item.estoque_disponivel) || 0,
                                        item.unidade_medida,
                                        item.texto_breve_material || materialDescription
                                      )
                                    }
                                    className="px-2 py-1 bg-[#AEE4FF]/15 hover:bg-[#AEE4FF] text-[#AEE4FF] hover:text-[#13283E] border border-[#AEE4FF]/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                                    title="Bloquear ou Desbloquear no SAP via MIGO"
                                  >
                                    <Lock className="h-3 w-3" /> Bloq
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenDevolver(
                                        item.material,
                                        item.lote,
                                        item.texto_breve_material || materialDescription,
                                        item.unidade_medida,
                                        Number(item.estoque_disponivel) || 0
                                      )
                                    }
                                    className="px-2 py-1 bg-[#E29A36]/20 hover:bg-[#E29A36] text-[#E29A36] hover:text-[#13283E] border border-[#E29A36]/40 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                                    title="Devolver ao almoxarifado via /nzwm296"
                                  >
                                    <Undo2 className="h-3 w-3" /> Devolver
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna 2: Remessas Abertas do Material */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="bg-[#13283E] border border-[#2A4D6E] rounded-lg p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#2A4D6E] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-[#AEE4FF]/10 text-[#AEE4FF]">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEE4FF]">
                          Remessas Abertas
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          {materialRemessas.length} {materialRemessas.length === 1 ? 'remessa pendente' : 'remessas pendentes'}
                        </p>
                      </div>
                    </div>
                    {onNavigateToTab && materialRemessas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('remessas')}
                        className="text-[10px] text-[#AEE4FF] hover:underline font-semibold flex items-center gap-0.5"
                      >
                        Ver todas <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {materialRemessas.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-[#1B3550]/40 rounded-md border border-[#2A4D6E]/40 space-y-1">
                      <p className="text-xs font-semibold text-slate-300">Nenhuma remessa em aberto</p>
                      <p className="text-[10px] text-slate-500">Não há ordens de picking pendentes para este material.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                      {materialRemessas.map((rem, idx) => (
                        <div
                          key={idx}
                          className="bg-[#1B3550] border border-[#2A4D6E] rounded-md p-2.5 text-xs flex items-center justify-between hover:bg-[#203e5e] transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#AEE4FF]">{rem.numero_remessa}</span>
                              <span className="text-[10px] text-slate-400 bg-[#0E1D2D] px-1.5 py-0.5 rounded border border-[#2A4D6E]">
                                Item {rem.item}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Data: <strong className="text-slate-200">{rem.data_disponibilidade || rem.data_picking || '-'}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {Number(rem.quantidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                            </span>
                            <p className="text-[10px] text-slate-400 font-semibold">{rem.unidade_medida || 'KG'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para Devolução Fracionada (/nzwm296) */}
      <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
        <DialogContent className="sm:max-w-lg bg-[#13283E] border-[#2A4D6E] text-white p-4 sm:p-6 max-h-[92vh] overflow-y-auto gap-3">
          <DialogHeader className="gap-1">
            <DialogTitle className="flex items-start gap-2 text-[#E29A36] text-sm sm:text-base font-bold text-left">
              <Undo2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#E29A36] shrink-0 mt-0.5" />
              <span>Devolução Fracionada ao Almoxarifado (/nzwm296)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
              Informe a divisão de volumes para devolução de saldo no SAP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Informações do Lote */}
            <div className="p-2.5 rounded-md bg-[#0E1D2D] border border-[#2A4D6E] space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 shrink-0">Material:</span>
                <span className="font-mono font-bold text-[#AEE4FF] truncate text-right">{devolverMaterial}</span>
              </div>
              {devolverDescricao && (
                <div className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-400 shrink-0">Descrição:</span>
                  <span className="text-slate-200 truncate text-right">{devolverDescricao}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 shrink-0">Lote:</span>
                <span className="font-mono font-bold text-amber-300 truncate text-right">{devolverLote}</span>
              </div>
              <div className="flex justify-between gap-2 border-t border-[#2A4D6E]/50 pt-1 mt-1 font-semibold">
                <span className="text-slate-400 shrink-0">Saldo Disponível:</span>
                <span className="font-mono text-emerald-400 text-right">
                  {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {devolverUnidade}
                </span>
              </div>
            </div>

            {/* Lista de Volumes */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Volumes a Devolver ({devolverVolumes.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddVolume}
                  className="h-8 sm:h-7 text-xs bg-[#1B3550] border-[#2A4D6E] text-[#AEE4FF] hover:bg-[#2A4D6E] w-full sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Volume
                </Button>
              </div>

              <div className="space-y-2 max-h-64 sm:max-h-48 overflow-y-auto pr-1">
                {devolverVolumes.map((vol, idx) => (
                  <div
                    key={vol.id}
                    className="p-2.5 rounded-md bg-[#0E1D2D] border border-[#2A4D6E] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#AEE4FF]">
                        Volume #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={devolverVolumes.length === 1}
                        onClick={() => handleRemoveVolume(idx)}
                        className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Qtd a devolver</label>
                        <Input
                          type="text"
                          value={vol.quantidade}
                          onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                          placeholder="Ex: 5,420"
                          className="h-9 sm:h-8 text-xs bg-[#13283E] border-[#2A4D6E] text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Volume</label>
                        <Input
                          type="text"
                          value={vol.volume}
                          onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                          placeholder="1"
                          className="h-9 sm:h-8 text-xs bg-[#13283E] border-[#2A4D6E] text-white font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão de Preenchimento Automático do Restante */}
              {saldoRestante > 0.0001 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleFillRestante}
                    className="text-xs text-[#AEE4FF] hover:underline flex items-start gap-1.5 font-semibold text-left"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#AEE4FF] shrink-0 mt-0.5" />
                    <span>Adicionar restante ({saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {devolverUnidade}) em novo volume</span>
                  </button>
                </div>
              )}

              {/* Barra de Progresso / Totalizador */}
              <div className="p-2.5 rounded-md bg-[#0E1D2D] border border-[#2A4D6E] space-y-1 text-xs">
                <div className="flex justify-between items-baseline gap-2 flex-wrap font-mono">
                  <span className="text-slate-400 shrink-0">Total a Devolver:</span>
                  <span className={cn('font-bold text-right', isOverSaldo ? 'text-red-400' : 'text-[#AEE4FF]')}>
                    {somaVolumes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} / {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {devolverUnidade}
                  </span>
                </div>
                {isOverSaldo && (
                  <p className="text-[11px] text-red-400 font-semibold">
                    ⚠️ A quantidade total informada excede o saldo disponível!
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDevolverOpen(false)}
              className="bg-[#1B3550] border-[#2A4D6E] text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDevolver}
              disabled={isDevolverRunning || isOverSaldo || somaVolumes <= 0}
              className="bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] font-bold gap-1.5"
            >
              <Undo2 className="h-4 w-4" />
              <span>Confirmar e Enviar ao SAP</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Bloquear/Desbloquear e Pipeline de Macros no SAP */}
      <Dialog open={bloquearMigoOpen} onOpenChange={setBloquearMigoOpen}>
        <DialogContent className="bg-[#13283E] border-[#2A4D6E] text-white sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#AEE4FF] text-base font-bold">
              {macroPipeline.some((m) => m.actionType === 'desbloquear_migo') ? (
                <>
                  <Unlock className="h-5 w-5 text-emerald-300" />
                  <span>Desbloquear no SAP (MIGO Y83)</span>
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 text-[#AEE4FF]" />
                  <span>Bloquear no SAP (MIGO Y84)</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 pt-1">
              Transfere o saldo entre Livre e Bloqueado (tipo S) via MIGO no SAP GUI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seletor de Opção: Bloquear (Y84) vs Desbloquear (Y83) */}
            <div className="bg-[#0E1D2D] p-1.5 rounded-md border border-[#2A4D6E] flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleMigoMode('bloquear')}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                  !macroPipeline.some((m) => m.actionType === 'desbloquear_migo')
                    ? "bg-[#1B3550] text-[#AEE4FF] border border-[#2A4D6E] shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-[#1B3550]/40"
                )}
              >
                <Lock className="h-4 w-4 text-[#AEE4FF]" />
                <span>Bloquear (Y84)</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleMigoMode('desbloquear')}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                  macroPipeline.some((m) => m.actionType === 'desbloquear_migo')
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-[#1B3550]/40"
                )}
              >
                <Unlock className="h-4 w-4 text-emerald-300" />
                <span>Desbloquear (Y83)</span>
              </button>
            </div>

            {/* Detalhes do Item a Bloquear / Desbloquear */}
            <div className="p-3 rounded-md bg-[#0E1D2D] border border-[#2A4D6E] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Material:</span>
                <span className="font-mono font-bold text-[#AEE4FF]">{bloquearSelectedItems[0]?.material}</span>
              </div>
              {bloquearSelectedItems[0]?.descricao && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Descrição:</span>
                  <span className="text-slate-200 truncate max-w-[280px]">{bloquearSelectedItems[0]?.descricao}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Lote:</span>
                <span className="font-mono font-bold text-amber-300">{bloquearSelectedItems[0]?.lote}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#2A4D6E]/50">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">Quantidade:</label>
                  <Input
                    value={bloquearSelectedItems[0]?.quantidade ?? ''}
                    onChange={(e) => handleUpdateSingleBloquearItem('quantidade', e.target.value)}
                    placeholder="Ex: 0,081"
                    className="h-8 bg-[#13283E] border-[#2A4D6E] text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5 font-bold uppercase">Unidade (UMB):</label>
                  <Input
                    value={bloquearSelectedItems[0]?.unidade ?? ''}
                    onChange={(e) => handleUpdateSingleBloquearItem('unidade', e.target.value.toUpperCase())}
                    placeholder="KG, UN..."
                    className="h-8 bg-[#13283E] border-[#2A4D6E] text-white text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Pipeline de Macros / Opções Rápidas */}
            <div className="p-3 rounded-md bg-[#0E1D2D] border border-[#2A4D6E] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-[#AEE4FF]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Pipeline de Macros
                  </span>
                </div>

                {/* Presets Rápidos */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['bloquear_migo', 'mover_ajuste', 'atualizar_db'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-[#AEE4FF] border border-[#2A4D6E] font-semibold"
                  >
                    ⚡ Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['bloquear_migo'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-slate-300 border border-[#2A4D6E] font-semibold"
                  >
                    🔒 Só Bloquear (Y84)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMacroPreset(['desbloquear_migo'])}
                    className="px-2 py-0.5 rounded bg-[#1B3550] hover:bg-[#234465] text-emerald-300 border border-emerald-500/30 font-semibold"
                  >
                    🔓 Só Desbloquear (Y83)
                  </button>
                </div>
              </div>

              {/* Lista Sequencial */}
              <div className="space-y-1.5">
                {macroPipeline.map((step, idx) => {
                  const macroDef = AVAILABLE_MACROS.find((m) => m.type === step.actionType);
                  if (!macroDef) return null;

                  return (
                    <div
                      key={step.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#13283E] border border-[#2A4D6E] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-[#1B3550] border border-[#2A4D6E] flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {step.actionType === 'bloquear_migo' && <Lock className="h-3.5 w-3.5 text-[#AEE4FF] shrink-0" />}
                          {step.actionType === 'desbloquear_migo' && <Unlock className="h-3.5 w-3.5 text-emerald-300 shrink-0" />}
                          {step.actionType === 'mover_ajuste' && <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-300 shrink-0" />}
                          {step.actionType === 'atualizar_db' && <RefreshCw className="h-3.5 w-3.5 text-emerald-300 shrink-0" />}
                          {step.actionType === 'devolver' && <Undo2 className="h-3.5 w-3.5 text-amber-300 shrink-0" />}
                          <span className="font-semibold text-white truncate">{macroDef.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMoveMacroInPipeline(idx, idx - 1)}
                          className="h-6 w-6 text-slate-400 hover:text-white"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === macroPipeline.length - 1}
                          onClick={() => handleMoveMacroInPipeline(idx, idx + 1)}
                          className="h-6 w-6 text-slate-400 hover:text-white"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMacroFromPipeline(idx)}
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botões para Adicionar Etapas Extras */}
              <div className="pt-1 border-t border-[#2A4D6E]/50 flex flex-wrap gap-1">
                {AVAILABLE_MACROS.map((macro) => (
                  <button
                    key={macro.type}
                    type="button"
                    onClick={() => handleAddMacroToPipeline(macro.type)}
                    className="px-2 py-1 bg-[#13283E] hover:bg-[#1B3550] text-slate-200 border border-[#2A4D6E] rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-3 w-3 text-[#AEE4FF]" />
                    <span>{macro.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBloquearMigoOpen(false)}
              className="bg-[#1B3550] border-[#2A4D6E] text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExecuteBloquearMacroPipeline}
              disabled={isBloquearMigoRunning || macroPipeline.length === 0}
              className="bg-[#AEE4FF] hover:bg-[#86d4fa] text-[#13283E] font-bold gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Executar no SAP</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
