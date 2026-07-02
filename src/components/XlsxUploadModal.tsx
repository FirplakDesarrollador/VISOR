"use client";

import { useRef, useState, useCallback } from "react";
import { parseXlsxFile, ParsePhase, ParseProgress } from "@/services/xlsxParserService";
import { indexedDbService, XlsxMeta } from "@/services/indexedDbService";
import { Order } from "@/types";

// ── Iconos inline (no deps extra) ───────────────────────────
const IconUpload = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);
const IconFile = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconError = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const IconX = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Props ────────────────────────────────────────────────────
interface XlsxUploadModalProps {
  isOpen: boolean;
  currentMeta: XlsxMeta | null;
  onClose: () => void;
  onSuccess: (orders: Order[], meta: XlsxMeta) => void;
  onClear: () => void;
}

// ── Step indicator ───────────────────────────────────────────
const PHASES: { key: ParsePhase; label: string }[] = [
  { key: "reading", label: "Leyendo archivo" },
  { key: "parsing", label: "Analizando estructura" },
  { key: "processing", label: "Procesando filas" },
  { key: "saving", label: "Guardando localmente" },
];

const phaseOrder = ["reading", "parsing", "processing", "saving", "success"];

function StepIndicator({ phase }: { phase: ParsePhase }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {PHASES.map((s, i) => {
        const current = phaseOrder.indexOf(phase);
        const stepIdx = phaseOrder.indexOf(s.key);
        const done = current > stepIdx;
        const active = current === stepIdx;
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                done ? "bg-emerald-500 text-white" :
                active ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse" :
                "bg-slate-200 text-slate-400"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-bold hidden sm:block ${active ? "text-blue-700" : done ? "text-emerald-600" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`flex-1 h-0.5 rounded transition-all duration-500 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function XlsxUploadModal({
  isOpen, currentMeta, onClose, onSuccess, onClear,
}: XlsxUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const isProcessing = progress !== null && progress.phase !== "success" && progress.phase !== "error";
  const isSuccess = progress?.phase === "success";

  const reset = () => {
    setProgress(null);
    setError(null);
    setDragging(false);
  };

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError("Solo se aceptan archivos .xlsx o .xls");
      return;
    }
    setError(null);
    try {
      const result = await parseXlsxFile(file, (p) => setProgress({ ...p }));
      onSuccess(result.orders, result.meta);
    } catch (e: any) {
      console.error("XLSX parse error:", e);
      setError(e?.message ?? "Error desconocido al procesar el archivo");
      setProgress(null);
    }
  }, [onSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await indexedDbService.clearAll();
      onClear();
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-tight">Cargar Datos</h2>
              <p className="text-white/60 text-xs font-medium mt-0.5">Solo Administradores &middot; Archivo .xlsx o .xls</p>
            </div>
          </div>
          {!isProcessing && (
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
              <IconX />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">

          {/* ── ESTADO: Procesando ── */}
          {isProcessing && (
            <div className="space-y-4">
              <StepIndicator phase={progress!.phase} />
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                  <span>{progress!.message}</span>
                  <span className="text-blue-600">{Math.round(progress!.pct)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress!.pct}%` }}
                  />
                </div>
                {progress!.totalRows && (
                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    {progress!.processedRows?.toLocaleString("es-CO")} / {progress!.totalRows.toLocaleString("es-CO")} filas
                  </p>
                )}
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">
                ⏳ Proceso en curso, por favor no cierres esta ventana...
              </p>
            </div>
          )}

          {/* ── ESTADO: Éxito ── */}
          {isSuccess && (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center text-emerald-500 animate-in zoom-in duration-500">
                  <IconCheck />
                </div>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-xl">¡Datos cargados!</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {currentMeta?.totalRows.toLocaleString("es-CO")} filas →{" "}
                  <strong className="text-blue-700">{currentMeta?.totalOrders.toLocaleString("es-CO")} órdenes</strong>
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all"
              >
                Ver pedidos →
              </button>
            </div>
          )}

          {/* ── ESTADO: Idle / Drop zone ── */}
          {!isProcessing && !isSuccess && (
            <>
              {/* Drag-and-drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                  dragging
                    ? "border-blue-500 bg-blue-50 scale-[1.01]"
                    : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <div className={`flex justify-center mb-3 transition-colors ${dragging ? "text-blue-500" : "text-slate-400"}`}>
                  <IconUpload />
                </div>
                <p className={`font-bold text-sm transition-colors ${dragging ? "text-blue-700" : "text-slate-600"}`}>
                  {dragging ? "Suelta el archivo aquí" : "Arrastra tu archivo .xlsx o .xls aquí"}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  o <span className="text-blue-600 font-semibold">haz clic para seleccionar</span>
                </p>
                <p className="text-slate-300 text-[10px] mt-3 font-medium uppercase tracking-wide">
                  Solo .xlsx o .xls &middot; Hasta 100,000 filas recomendado
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="text-red-700 font-bold text-sm">Error al procesar el archivo</p>
                    <p className="text-red-600 text-xs mt-0.5">{error}</p>
                  </div>
                  <button onClick={reset} className="ml-auto text-red-400 hover:text-red-600">
                    <IconX />
                  </button>
                </div>
              )}

              {/* Datos actuales (si existen) */}
              {currentMeta && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Datos actualmente cargados
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <IconFile />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 text-sm truncate">{currentMeta.fileName}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {currentMeta.totalRows.toLocaleString("es-CO")} filas ·{" "}
                        <strong className="text-blue-700">{currentMeta.totalOrders.toLocaleString("es-CO")} órdenes</strong>
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Cargado el {formatDate(currentMeta.loadedAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className="mt-4 flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    <IconTrash />
                    {clearing ? "Limpiando..." : "Limpiar datos y volver a Supabase"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer note */}
        {!isProcessing && !isSuccess && (
          <div className="px-6 pb-5">
            <p className="text-[10px] text-slate-300 text-center">
              Los datos se guardan en tu navegador y persisten al recargar la página
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
