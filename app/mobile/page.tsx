'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { AgingData, RemessaData } from '@/types/aging';
import { fetchAgingData, fetchRemessas, triggerSapAutomation, checkSapAutomationStatus } from '@/lib/api';
import { parseBarcode, ParsedBarcode } from '@/lib/barcode-parser';
import { ProtectedRoute } from '@/components/protected-route';
import { useFirebase } from '@/components/auth-provider';
import { generateDevolverZwm296Vbs, DevolverVolumeItem } from '@/components/residuais-view';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut,
  Upload,
  Loader2,
  ImageIcon,
  Undo2,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function MobileConsultaPage() {
  const { user, userData } = useFirebase();
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [agingList, setAgingList] = useState<AgingData[]>([]);
  const [remessasList, setRemessasList] = useState<RemessaData[]>([]);

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

  // Scanner State
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<ParsedBarcode | null>(null);
  const [processingImage, setProcessingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scanner HTML element ref & Html5Qrcode instance
  const scannerContainerId = 'mobile-barcode-reader';
  const html5QrCodeRef = useRef<any>(null);

  // Buffer para coletor Bluetooth
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect Mobile device screen width / user-agent
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 800;
      setIsMobileDevice(isMobileUA || isSmallScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Carrega dados de estoque e remessas
  const loadStockData = async () => {
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
      // Ignora teclas de controle especiais
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Se passou muito tempo (> 400ms), limpa o buffer pois pode ter sido digitação manual lenta
      if (timeDiff > 400 && barcodeBufferRef.current.length > 0) {
        barcodeBufferRef.current = '';
      }

      // Se for tecla Enter / Retorno do coletor
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

      // Se for um caractere imprimível
      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;

        // Limpa timeout anterior
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
        }

        // Se o coletor não mandar Enter no final, mas enviou vários caracteres rápido (velocidade de leitor < 100ms)
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

    // Pequeno delay para garantir que o elemento DOM já está renderizado
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      // Se já existia uma instância anterior ativa, limpa
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch (e) {
          // Ignora erro ao limpar instância anterior
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

      // Configuração de leitura
      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.floor(viewfinderWidth * 0.90);
        const height = Math.min(Math.floor(viewfinderHeight * 0.5), 180);
        return { width: Math.max(width, 240), height: Math.max(height, 100) };
      };

      const qrConfig = {
        fps: 20,
        qrbox: qrboxFunction,
        disableFlip: true,
      };

      const onScanSuccess = (decodedText: string) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80, 50, 80]);
        }
        handleBarcodeScanned(decodedText);
        stopScanner();
      };

      // Tenta iniciar com câmera traseira
      try {
        await instance.start(
          { facingMode: 'environment' },
          qrConfig,
          onScanSuccess,
          () => {}
        );
      } catch (errEnvironment) {
        console.warn('Falha ao abrir facingMode environment, listando câmeras disponíveis...', errEnvironment);
        // Fallback: listar câmeras e pegar a última (normalmente traseira em celulares)
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const backCamera = devices.find(d => /back|traseira|rear|environment/i.test(d.label)) || devices[devices.length - 1];
          await instance.start(
            backCamera.id,
            qrConfig,
            onScanSuccess,
            () => {}
          );
        } else {
          throw errEnvironment;
        }
      }

      // Checar se lanterna e zoom estão disponíveis
      try {
        const capabilities: any = instance.getRunningTrackCapabilities?.();
        if (capabilities) {
          if (capabilities.torch) setHasTorch(true);
          if (capabilities.zoom) {
            setMaxZoom(capabilities.zoom.max || 1);
            setZoomLevel(capabilities.zoom.min || 1);
          }
        }
      } catch (capErr) {
        // Silencioso se não suportar
      }
    } catch (err: any) {
      console.error('Erro ao iniciar câmera:', err);
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (!isHttps && !isLocalhost) {
        setCameraError('Acesso à câmera pelo navegador em celulares requer conexão segura (HTTPS). Você também pode usar a digitação ou leitor bluetooth abaixo.');
      } else {
        setCameraError(err?.message || 'Não foi possível acessar a câmera. Verifique se deu permissão de câmera ao navegador.');
      }
      setScannerActive(false);
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
      console.warn('Erro ao alternar lanterna:', err);
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
      console.warn('Erro ao ajustar zoom:', err);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Erro ao parar scanner:', err);
      }
    }
    setScannerActive(false);
    setTorchOn(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Processamento de Foto em Alta Resolução (Tirada da Câmera Nativa ou Galeria)
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    setProcessingImage(true);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('barcode-file-reader-hidden');

      const decodedText = await html5QrCode.scanFile(file, true);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
      handleBarcodeScanned(decodedText);
      await html5QrCode.clear();
    } catch (err: any) {
      console.warn('Erro ao ler código da foto:', err);
      setCameraError('Não foi possível identificar o código de barras na foto tirada. Certifique-se de que a etiqueta está bem iluminada e nítida.');
    } finally {
      setProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBarcodeScanned = (rawText: string) => {
    const parsed = parseBarcode(rawText);
    setScannedResult(parsed);
    setManualInput(rawText);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleBarcodeScanned(manualInput);
  };

  const handleClear = () => {
    setScannedResult(null);
    setManualInput('');
    stopScanner();
  };

  // Filtragem de dados com base no scannedResult
  const materialCode = scannedResult?.material || '';
  const loteCode = scannedResult?.lote || '';

  // 1. Itens correspondentes ao Lote específico lido
  const loteItems = loteCode
    ? agingList.filter((item) => {
        const itemLote = String(item.lote || '').trim().toUpperCase();
        const searchLote = loteCode.trim().toUpperCase();
        const matchesLote = itemLote === searchLote || itemLote.includes(searchLote);

        if (materialCode) {
          const itemMat = String(item.material || '').trim().replace(/^0+/, '');
          const searchMat = materialCode.trim().replace(/^0+/, '');
          return matchesLote && (itemMat === searchMat || itemMat.includes(searchMat));
        }
        return matchesLote;
      })
    : [];

  const totalEstoqueLote = loteItems.reduce((acc, curr) => acc + (Number(curr.estoque_disponivel) || 0), 0);

  // 2. Todos os itens desse material no depósito (todos os lotes/posições)
  const allMaterialItems = materialCode
    ? agingList.filter((item) => {
        const itemMat = String(item.material || '').trim().replace(/^0+/, '');
        const searchMat = materialCode.trim().replace(/^0+/, '');
        return itemMat === searchMat || itemMat.includes(searchMat);
      })
    : [];

  const totalEstoqueMaterial = allMaterialItems.reduce((acc, curr) => acc + (Number(curr.estoque_disponivel) || 0), 0);

  // Descrição do material (se encontrada em algum registro)
  const materialDescription =
    allMaterialItems[0]?.texto_breve_material ||
    loteItems[0]?.texto_breve_material ||
    'Material não catalogado na última planilha';

  const unidadeMedida =
    allMaterialItems[0]?.unidade_medida ||
    loteItems[0]?.unidade_medida ||
    'KG';

  // Remessas abertas para esse material
  const materialRemessas = materialCode
    ? remessasList.filter((r) => {
        const rMat = String(r.material || '').trim().replace(/^0+/, '');
        const searchMat = materialCode.trim().replace(/^0+/, '');
        return rMat === searchMat || rMat.includes(searchMat);
      })
    : [];

  // Helper para conversão numérica de inputs
  const parseQtdNumber = (val: string): number => {
    if (!val) return 0;
    const cleaned = String(val).trim().replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const totalDevolvendo = useMemo(() => {
    return (
      Math.round(
        devolverVolumes.reduce((acc, v) => acc + parseQtdNumber(v.quantidade), 0) * 1000
      ) / 1000
    );
  }, [devolverVolumes]);

  const saldoRestante = useMemo(() => {
    return Math.round((devolverSaldoTotal - totalDevolvendo) * 1000) / 1000;
  }, [devolverSaldoTotal, totalDevolvendo]);

  const isOverSaldo = saldoRestante < -0.0001;
  const isZeroRestante = Math.abs(saldoRestante) <= 0.0001 && totalDevolvendo > 0;

  const handleOpenDevolver = (
    material: string,
    lote: string,
    descricao?: string,
    unidade?: string,
    saldo?: number
  ) => {
    const numEstoque =
      saldo !== undefined && saldo > 0
        ? saldo
        : totalEstoqueLote > 0
        ? totalEstoqueLote
        : (scannedResult?.quantidade && scannedResult.quantidade > 0 ? scannedResult.quantidade : 1);

    const quantidadeFormatada = numEstoque.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: false,
    });

    setDevolverMaterial(material);
    setDevolverDescricao(descricao || materialDescription || '');
    setDevolverLote(lote);
    setDevolverUnidade(unidade?.toUpperCase() || unidadeMedida?.toUpperCase() || 'KG');
    setDevolverSaldoTotal(numEstoque);
    setDevolverVolumes([
      {
        id: '1',
        quantidade: quantidadeFormatada,
        volume: '1',
      },
    ]);
    setDevolverOpen(true);
  };

  const handleAddVolume = () => {
    const restante = Math.max(0, Math.round((devolverSaldoTotal - totalDevolvendo) * 1000) / 1000);
    const initialQtd =
      restante > 0.0001
        ? restante.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
            useGrouping: false,
          })
        : '';

    setDevolverVolumes((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        quantidade: initialQtd,
        volume: '1',
      },
    ]);
  };

  const handleRemoveVolume = (idx: number) => {
    if (devolverVolumes.length <= 1) return;
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
        const updated = [...prev];
        updated[lastIdx] = { ...updated[lastIdx], quantidade: restanteStr };
        return updated;
      }
      return [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          quantidade: restanteStr,
          volume: '1',
        },
      ];
    });
  };

  const handleConfirmDevolver = async () => {
    const validVolumes = devolverVolumes.filter((v) => parseQtdNumber(v.quantidade) > 0);
    if (validVolumes.length === 0 || !devolverMaterial.trim() || !devolverLote.trim()) {
      toast.error('Preencha ao menos 1 volume com quantidade válida maior que 0');
      return;
    }

    if (isOverSaldo) {
      toast.error(
        `A soma das quantidades (${totalDevolvendo.toLocaleString('pt-BR')} ${devolverUnidade}) ultrapassa o saldo disponível (${devolverSaldoTotal.toLocaleString('pt-BR')} ${devolverUnidade})`
      );
      return;
    }

    setDevolverOpen(false);
    setIsDevolverRunning(true);
    const countVol = validVolumes.length;
    const toastId = toast.loading(
      `Enviando devolução (/nzwm296) de ${countVol} volume(s) do lote ${devolverLote} para o Planilha Sync...`
    );

    const vbsCode = generateDevolverZwm296Vbs(
      devolverMaterial,
      devolverLote,
      validVolumes.map((v) => ({
        quantidade: v.quantidade,
        volume: v.volume || '1',
      }))
    );

    try {
      const res = await triggerSapAutomation('devolver', user?.email || userData?.email || 'Mobile Consulta', vbsCode);
      if (!res.success || !res.job) {
        toast.error(`Falha ao disparar automação: ${res.error || 'Erro desconhecido'}`, { id: toastId });
        setIsDevolverRunning(false);
        return;
      }

      const jobId = res.job.id;
      toast.loading(`Aguardando execução no SAP GUI (${countVol} vol)...`, { id: toastId });

      let attempts = 0;
      const maxAttempts = 40; // até 80s
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusJob = await checkSapAutomationStatus(jobId);
          if (statusJob?.status === 'completed') {
            clearInterval(interval);
            setIsDevolverRunning(false);
            toast.success(
              `Devolução (/nzwm296) de ${countVol} volume(s) executada com sucesso no SAP para o lote ${devolverLote}!`,
              { id: toastId, icon: '↩️' }
            );
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0E1C2B] text-slate-100 flex flex-col font-sans pb-12">
        {/* Aviso caso abra em tela grande de Desktop */}
        {!isMobileDevice && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Esta página foi projetada para telas de celulares e coletores móveis.</span>
            </div>
            <Link href="/" className="underline text-amber-300 font-semibold text-[11px] hover:text-white">
              Voltar ao Painel Geral
            </Link>
          </div>
        )}

        {/* Header Mobile Otimizado */}
        <header className="sticky top-0 z-30 bg-[#13283E] border-b border-[#2A4D6E] px-4 py-3 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://izishared.blob.core.windows.net/assets/grupo-ems-lp/grupoems-logo.png"
              alt="EMS"
              className="h-6 w-auto brightness-0 invert opacity-90"
            />
            <div>
              <h1 className="text-sm font-extrabold text-[#AEE4FF] uppercase tracking-tight flex items-center gap-1.5">
                <span>Consulta Rápida Mobile</span>
              </h1>
              <p className="text-[10px] text-[#608BA6]">Leitor Code 128 / Estoque PES</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs bg-[#1B3550] border border-[#2A4D6E] text-[#AEE4FF] px-2.5 py-1.5 rounded-lg font-bold active:scale-95 transition-all"
          >
            Dashboard
          </Link>
        </header>

        <main className="p-4 space-y-4 max-w-lg mx-auto w-full">
          {/* Card de Leitura / Entrada */}
          <div className="bg-[#13283E] border border-[#2A4D6E] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#AEE4FF] flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-[#AEE4FF]" />
                Leitor de Código de Barras
              </span>
              {scannedResult && (
                <button
                  onClick={handleClear}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>

            {/* Container do Vídeo da Câmera */}
            <div className={`overflow-hidden rounded-2xl bg-black/80 border-2 border-[#AEE4FF]/40 shadow-inner relative ${scannerActive ? 'block' : 'hidden'}`}>
              <div id={scannerContainerId} className="w-full min-h-[260px]" />
              
              {/* Controles sobrepostos da câmera (Lanterna e Zoom) */}
              {scannerActive && (
                <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all ${
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

              {/* Slider / botões de Zoom rápido se suportado */}
              {scannerActive && maxZoom > 1 && (
                <div className="absolute bottom-10 left-4 right-4 z-20 flex items-center justify-center gap-3 bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10">
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
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Container oculto para o scanner de arquivos */}
            <div id="barcode-file-reader-hidden" className="hidden" />

            {/* Input nativo de captura de câmera (alta definição nativa do celular) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />

            {/* Ações de Captura */}
            <div className="grid grid-cols-2 gap-2">
              {/* Botão 1: Tirar Foto em Alta Resolução (Câmera Nativa) */}
              <button
                type="button"
                disabled={processingImage}
                onClick={() => fileInputRef.current?.click()}
                className="py-3 px-3 bg-[#AEE4FF] hover:bg-white text-[#13283E] rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {processingImage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-[#13283E]" />
                    <span>Processando Foto...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-5 w-5 text-[#13283E]" />
                    <span>Tirar Foto HD</span>
                  </>
                )}
              </button>

              {/* Botão 2: Câmera Ao Vivo ou Fechar */}
              {!scannerActive ? (
                <button
                  type="button"
                  disabled={processingImage}
                  onClick={startScanner}
                  className="py-3 px-3 bg-[#1B3550] hover:bg-[#224467] text-[#AEE4FF] border border-[#2A4D6E] rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <QrCode className="h-5 w-5 text-[#AEE4FF]" />
                  <span>Leitor Ao Vivo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="py-3 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                >
                  <CameraOff className="h-5 w-5" />
                  <span>Fechar Leitor</span>
                </button>
              )}
            </div>

            {/* Formulário Manual / Leitor Físico USB/Bluetooth */}
            <form onSubmit={handleManualSearch} className="space-y-2 pt-1">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualInput(val);
                    // Se o leitor colou/digitou o código inteiro de uma vez
                    if (val.trim().length >= 6 && (val.includes(' ') || val.includes('\t') || val.includes(';') || val.includes('|'))) {
                      handleBarcodeScanned(val);
                    }
                  }}
                  placeholder="Bipe com o coletor ou digite..."
                  className="w-full pl-3 pr-10 py-2.5 bg-[#0E1C2B] border border-[#2A4D6E] rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-[#AEE4FF] focus:ring-1 focus:ring-[#AEE4FF] transition-all font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#AEE4FF] text-[#13283E] rounded-lg font-bold text-xs flex items-center justify-center hover:bg-white active:scale-95 transition-all"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#608BA6]">
                <span>📡 Pronto para Coletor Bluetooth / USB</span>
                <span>(Enter ou bip automático)</span>
              </div>
            </form>
          </div>

          {/* Se nenhum resultado pesquisado ainda */}
          {!scannedResult && !loadingData && (
            <div className="text-center py-10 px-4 bg-[#13283E]/40 border border-[#2A4D6E]/50 rounded-2xl space-y-2">
              <Package className="h-10 w-10 text-[#608BA6] mx-auto opacity-60" />
              <p className="text-sm font-semibold text-slate-300">Aguardando leitura de etiqueta</p>
              <p className="text-xs text-[#608BA6] max-w-xs mx-auto">
                Escaneie o código de barras Code 128 com a câmera ou digite os dados acima para ver o estoque instantâneo.
              </p>
            </div>
          )}

          {/* Resultado da Consulta */}
          {scannedResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Card Resumo do Material Lido */}
              <div className="bg-[#13283E] border border-[#2A4D6E] rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-[#2A4D6E] pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#608BA6]">Material</span>
                    <h2 className="text-xl font-mono font-extrabold text-[#AEE4FF] leading-none mt-0.5">
                      {materialCode || 'N/A'}
                    </h2>
                    <p className="text-xs text-slate-200 font-medium mt-1">
                      {materialDescription}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#608BA6]">Lote Lido</span>
                    <p className="text-sm font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md mt-0.5 inline-block">
                      {loteCode || 'N/A'}
                    </p>
                    {scannedResult.quantidade !== null && scannedResult.quantidade !== undefined && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Qtd Etiqueta: <strong className="text-slate-200">{scannedResult.quantidade} {unidadeMedida}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Cards de Métricas Rápidas */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[#1B3550] border border-[#2A4D6E] p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-[#608BA6] text-[10px] font-bold uppercase">
                      <Layers className="h-3.5 w-3.5 text-amber-400" />
                      Qtd deste Lote
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-black text-amber-300 font-mono">
                        {totalEstoqueLote.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{unidadeMedida}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {loteItems.length} {loteItems.length === 1 ? 'posição' : 'posições'}
                    </span>
                  </div>

                  <div className="bg-[#1B3550] border border-[#2A4D6E] p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-[#608BA6] text-[10px] font-bold uppercase">
                      <Package className="h-3.5 w-3.5 text-[#AEE4FF]" />
                      Total no Depósito
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-black text-[#AEE4FF] font-mono">
                        {totalEstoqueMaterial.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{unidadeMedida}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {allMaterialItems.length} {allMaterialItems.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                </div>
                {/* Ação de Devolução Rápida do Lote Lido */}
                {loteCode && (
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenDevolver(
                        materialCode,
                        loteCode,
                        materialDescription,
                        unidadeMedida,
                        totalEstoqueLote
                      )
                    }
                    className="w-full py-2.5 px-3 bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all mt-2"
                  >
                    <Undo2 className="h-4 w-4 text-[#13283E]" />
                    <span>Devolver este Lote no SAP (/nzwm296)</span>
                  </button>
                )}
              </div>

              {/* Seção 1: Posições do LOTE ESPECÍFICO */}
              <div className="bg-[#13283E] border border-[#2A4D6E] rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Posição do Lote ({loteCode})
                  </h3>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                    {loteItems.length} no estoque
                  </span>
                </div>

                {loteItems.length === 0 ? (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>Lote não encontrado ou zerado no estoque do depósito.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loteItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="bg-[#1B3550] border border-[#2A4D6E] rounded-xl p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                            <span className="text-[#608BA6] text-[11px]">Posição:</span>
                            <span className="text-[#AEE4FF]">{item.posicao_deposito || 'N/D'}</span>
                          </span>
                          <span className="font-mono font-black text-amber-300 text-sm">
                            {Number(item.estoque_disponivel || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {item.unidade_medida}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-[#608BA6] pt-1 border-t border-[#2A4D6E]/60">
                          <div>
                            <span>Depósito: </span>
                            <strong className="text-slate-300">{item.deposito} ({item.tipo_deposito})</strong>
                          </div>
                          <div>
                            <span>Aging: </span>
                            <strong className={Number(item.dias_aging || 0) >= 20 ? 'text-rose-400' : Number(item.dias_aging || 0) >= 7 ? 'text-amber-400' : 'text-emerald-400'}>
                              {item.dias_aging ?? '-'} dias
                            </strong>
                          </div>
                          <div>
                            <span>Vencimento: </span>
                            <strong className="text-slate-300">{item.data_vencimento || 'N/D'}</strong>
                          </div>
                          <div>
                            <span>Últ. Mov.: </span>
                            <strong className="text-slate-300">{item.ultimo_movimento || 'N/D'}</strong>
                          </div>
                        </div>

                        <div className="pt-1.5 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDevolver(
                                item.material,
                                item.lote,
                                item.texto_breve_material,
                                item.unidade_medida,
                                Number(item.estoque_disponivel || 0)
                              )
                            }
                            className="px-2.5 py-1 bg-[#E29A36]/15 hover:bg-[#E29A36] text-[#E29A36] hover:text-[#13283E] border border-[#E29A36]/40 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all"
                          >
                            <Undo2 className="h-3 w-3" />
                            <span>Devolver esta posição</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção 2: TODOS OS OUTROS LOTES DESTE MATERIAL NO DEPÓSITO */}
              <div className="bg-[#13283E] border border-[#2A4D6E] rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEE4FF] flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#AEE4FF]" />
                    Todos os Lotes deste Material no Depósito
                  </h3>
                  <span className="text-[10px] bg-[#1B3550] text-[#AEE4FF] font-bold px-2 py-0.5 rounded-full border border-[#2A4D6E]">
                    {allMaterialItems.length} {allMaterialItems.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {allMaterialItems.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Nenhum estoque encontrado para este código de material.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {allMaterialItems.map((item, idx) => {
                      const isCurrentScannedLote = String(item.lote || '').trim().toUpperCase() === loteCode.trim().toUpperCase();

                      return (
                        <div
                          key={item.id || idx}
                          className={`rounded-xl p-3 space-y-1.5 text-xs border ${
                            isCurrentScannedLote
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-[#1B3550]/60 border-[#2A4D6E]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-200">
                                Lote: <span className={isCurrentScannedLote ? 'text-amber-300 font-extrabold' : 'text-slate-100'}>{item.lote || 'N/D'}</span>
                              </span>
                              {isCurrentScannedLote && (
                                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-sm">
                                  LIDO
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-[#AEE4FF]">
                              {Number(item.estoque_disponivel || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {item.unidade_medida}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#608BA6] pt-1 border-t border-[#2A4D6E]/40">
                            <span>Pos: <strong className="text-slate-300">{item.posicao_deposito || 'N/D'}</strong> ({item.deposito})</span>
                            <span>Aging: <strong className="text-slate-300">{item.dias_aging ?? '-'}d</strong></span>
                            <span>Venc: <strong className="text-slate-300">{item.data_vencimento || 'N/D'}</strong></span>
                          </div>

                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenDevolver(
                                  item.material,
                                  item.lote,
                                  item.texto_breve_material,
                                  item.unidade_medida,
                                  Number(item.estoque_disponivel || 0)
                                )
                              }
                              className="px-2 py-0.5 bg-[#E29A36]/15 hover:bg-[#E29A36] text-[#E29A36] hover:text-[#13283E] border border-[#E29A36]/40 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all"
                            >
                              <Undo2 className="h-3 w-3" />
                              <span>Devolver</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção 3: Remessas Abertas do Material */}
              {materialRemessas.length > 0 && (
                <div className="bg-[#13283E] border border-[#2A4D6E] rounded-2xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Remessas Abertas ({materialRemessas.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {materialRemessas.slice(0, 5).map((rem, i) => (
                      <div key={i} className="bg-[#1B3550] p-2.5 rounded-xl border border-[#2A4D6E] flex items-center justify-between text-xs">
                        <div>
                          <p className="font-mono font-bold text-slate-200">Remessa: {rem.numero_remessa}</p>
                          <p className="text-[10px] text-[#608BA6]">Dep: {rem.deposito} | Item: {rem.item}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-[#AEE4FF]">{rem.quantidade} {rem.unidade_medida}</p>
                          <p className="text-[10px] text-slate-400">{rem.data_disponibilidade || 'Sem data'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Modal de Devolução Fracionada (/nzwm296) Otimizado para Mobile */}
        <Dialog open={devolverOpen} onOpenChange={setDevolverOpen}>
          <DialogContent className="sm:max-w-xl max-w-[95vw] bg-[#13283E] border-[#2A4D6E] text-white p-4 sm:p-6 max-h-[92vh] flex flex-col rounded-2xl">
            <DialogHeader className="shrink-0 pb-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <DialogTitle className="flex items-center gap-2 text-[#AEE4FF] text-base sm:text-lg font-bold">
                  <Undo2 className="h-5 w-5 text-[#E29A36]" />
                  <span>Devolução no SAP (/nzwm296)</span>
                </DialogTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E] font-mono text-[11px] px-2 py-0.5">
                    Mat: <strong className="text-white ml-1">{devolverMaterial}</strong>
                  </Badge>
                  <Badge variant="outline" className="bg-[#1B3550] text-[#AEE4FF] border-[#2A4D6E] font-mono text-[11px] px-2 py-0.5">
                    Lote: <strong className="text-white ml-1">{devolverLote}</strong>
                  </Badge>
                </div>
              </div>
              {devolverDescricao && (
                <p className="text-xs text-slate-300 truncate">{devolverDescricao}</p>
              )}
              <DialogDescription className="text-slate-400 text-[11px]">
                Fracione a devolução em volumes. O saldo restante é calculado automaticamente.
              </DialogDescription>
            </DialogHeader>

            {/* Cards de Feedback Visual e Saldo */}
            <div className="grid grid-cols-3 gap-2 my-2 shrink-0">
              {/* Card 1: Saldo Disponível */}
              <div className="p-2.5 rounded-xl bg-[#0D1D2D] border border-[#2A4D6E] flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estoque</span>
                <div className="mt-0.5">
                  <span className="text-base sm:text-lg font-bold font-mono text-[#AEE4FF]">
                    {devolverSaldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">{devolverUnidade}</span>
                </div>
              </div>

              {/* Card 2: Total Devolvendo */}
              <div className="p-2.5 rounded-xl bg-[#0D1D2D] border border-[#2A4D6E] flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Devolvendo</span>
                <div className="mt-0.5">
                  <span className={cn(
                    "text-base sm:text-lg font-bold font-mono",
                    isOverSaldo ? "text-red-400" : isZeroRestante ? "text-emerald-400" : "text-white"
                  )}>
                    {totalDevolvendo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">{devolverUnidade}</span>
                </div>
              </div>

              {/* Card 3: Saldo Restante (Interativo / Auto-preenchimento) */}
              <div
                onClick={saldoRestante > 0.0001 ? handleFillRestante : undefined}
                className={cn(
                  "p-2.5 rounded-xl border flex flex-col justify-between transition-all duration-200",
                  isZeroRestante
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                    : isOverSaldo
                    ? "bg-red-950/40 border-red-500/50 text-red-300"
                    : "bg-[#E29A36]/15 hover:bg-[#E29A36]/25 border-[#E29A36]/60 text-[#E29A36] cursor-pointer active:scale-95 shadow-sm"
                )}
                title={
                  saldoRestante > 0.0001
                    ? "Toque para preencher o saldo restante"
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {isZeroRestante ? 'Completo' : isOverSaldo ? 'Excedido' : 'Restante'}
                  </span>
                  {isZeroRestante ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : isOverSaldo ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-[#E29A36]/20 font-bold">
                      Preencher ↵
                    </span>
                  )}
                </div>
                <div className="mt-0.5">
                  <span className="text-base sm:text-lg font-bold font-mono">
                    {isOverSaldo ? '+' : ''}
                    {Math.abs(saldoRestante).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                  </span>
                  <span className="text-[10px] ml-1">{devolverUnidade}</span>
                </div>
              </div>
            </div>

            {/* Tabela de Volumes Fracionados */}
            <div className="flex-1 overflow-y-auto border border-[#2A4D6E] rounded-xl bg-[#0D1D2D]/60 my-1">
              <Table>
                <TableHeader className="bg-[#1B3550] sticky top-0 z-10">
                  <TableRow className="border-[#2A4D6E] hover:bg-transparent">
                    <TableHead className="w-10 text-[#AEE4FF] text-[11px] font-bold text-center">#</TableHead>
                    <TableHead className="text-[#AEE4FF] text-[11px] font-bold">Qtd a Devolver</TableHead>
                    <TableHead className="w-20 text-[#AEE4FF] text-[11px] font-bold text-center">Vol</TableHead>
                    <TableHead className="w-12 text-[#AEE4FF] text-[11px] font-bold text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devolverVolumes.map((volItem, idx) => (
                    <TableRow key={volItem.id} className="border-[#2A4D6E]/50 hover:bg-[#1B3550]/40">
                      <TableCell className="font-mono text-xs text-center font-bold text-slate-400">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={volItem.quantidade}
                            onChange={(e) => handleUpdateVolume(idx, 'quantidade', e.target.value)}
                            placeholder="Ex: 4,985"
                            className="font-mono font-bold text-sm bg-[#13283E] border-[#2A4D6E] text-white focus-visible:ring-[#E29A36] h-8"
                          />
                          <span className="text-xs text-slate-400 font-semibold">{devolverUnidade}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={volItem.volume}
                          onChange={(e) => handleUpdateVolume(idx, 'volume', e.target.value)}
                          placeholder="1"
                          className="font-mono text-center text-xs bg-[#13283E] border-[#2A4D6E] text-white focus-visible:ring-[#E29A36] h-8 mx-auto w-16"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVolume(idx)}
                          disabled={devolverVolumes.length <= 1}
                          className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/40 disabled:opacity-30"
                          title="Remover volume"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Barra de Ações Rápidas de Volumes */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddVolume}
                  className="border-[#2A4D6E] bg-[#1B3550] text-[#AEE4FF] hover:bg-[#234465] hover:text-white font-bold h-8 text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Adicionar Volume</span>
                </Button>

                {saldoRestante > 0.0001 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFillRestante}
                    className="border-[#E29A36]/60 bg-[#E29A36]/10 text-[#E29A36] hover:bg-[#E29A36] hover:text-[#13283E] font-bold h-8 text-xs gap-1.5 transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Restante ({saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })})</span>
                  </Button>
                )}
              </div>

              <span className="text-[10px] text-slate-400 font-mono">
                /nzwm296 | BWLVS: 996 | WERKS: 600
              </span>
            </div>

            <DialogFooter className="mt-2 pt-2 border-t border-[#2A4D6E] gap-2 sm:gap-0 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDevolverOpen(false)}
                className="border-[#2A4D6E] text-slate-300 hover:bg-[#1B3550] hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDevolver}
                disabled={
                  totalDevolvendo <= 0 ||
                  isOverSaldo ||
                  isDevolverRunning ||
                  devolverVolumes.some((v) => parseQtdNumber(v.quantidade) <= 0)
                }
                className="bg-[#E29A36] hover:bg-[#d48c2a] text-[#13283E] font-bold gap-1.5 shadow-md px-4"
              >
                {isDevolverRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#13283E]" />
                    <span>Executando no SAP...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="h-4 w-4 text-[#13283E]" />
                    <span>
                      Executar Devolução SAP ({devolverVolumes.length} {devolverVolumes.length === 1 ? 'Volume' : 'Volumes'})
                    </span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
