'use client';

import { useState, useEffect, useRef } from 'react';
import { AgingData, RemessaData } from '@/types/aging';
import { fetchAgingData, fetchRemessas } from '@/lib/api';
import { parseBarcode, ParsedBarcode } from '@/lib/barcode-parser';
import { ProtectedRoute } from '@/components/protected-route';
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
} from 'lucide-react';
import Link from 'next/link';

export default function MobileConsultaPage() {
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [agingList, setAgingList] = useState<AgingData[]>([]);
  const [remessasList, setRemessasList] = useState<RemessaData[]>([]);

  // Scanner State
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<ParsedBarcode | null>(null);
  const [processingImage, setProcessingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scanner HTML element ref & Html5Qrcode instance
  const scannerContainerId = 'mobile-barcode-reader';
  const html5QrCodeRef = useRef<any>(null);

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
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Ex: 010311    M5B4344    24..."
                  className="w-full pl-3 pr-10 py-2.5 bg-[#0E1C2B] border border-[#2A4D6E] rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-[#AEE4FF] transition-all font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#AEE4FF] text-[#13283E] rounded-lg font-bold text-xs flex items-center justify-center hover:bg-white active:scale-95 transition-all"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-[#608BA6] leading-tight">
                Aceita leitura de pistola coletora, scanner bluetooth ou digitação com espaços (Código + Lote + Qtd).
              </p>
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
      </div>
    </ProtectedRoute>
  );
}
