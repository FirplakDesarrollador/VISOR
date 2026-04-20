"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getAllVisorRows } from '@/services/visorRawService';
import { VisorRow } from '@/types';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
//  Column definition (order matters for display)
// ─────────────────────────────────────────────
const COLUMNS: { key: keyof VisorRow; label: string; width: number }[] = [
  { key: 'Orden de venta',                     label: 'ORDEN VENTA',         width: 120 },
  { key: 'Fecha de ingreso',                   label: 'F. INGRESO',          width: 110 },
  { key: 'tipo orden de venta',                label: 'TIPO OV',             width: 120 },
  { key: 'Orden de compra',                    label: 'ORDEN COMPRA',        width: 145 },
  { key: 'vendedor',                           label: 'VENDEDOR',            width: 160 },
  { key: 'Código del cliente',                 label: 'CÓD. CLIENTE',        width: 140 },
  { key: 'Nombre del cliente',                 label: 'NOMBRE DEL CLIENTE',  width: 220 },
  { key: 'Nombre de la sala',                  label: 'SALA',                width: 160 },
  { key: 'Código del producto',                label: 'CÓD. PRODUCTO',       width: 135 },
  { key: 'Descripción del producto',           label: 'DESCRIPCIÓN PRODUCTO',width: 230 },
  { key: 'Cantidad pedida',                    label: 'CANT. PEDIDA',        width: 115 },
  { key: 'cantidad facturada',                 label: 'CANT. FACT.',         width: 110 },
  { key: 'cant - ent - despacho',              label: 'CANT. DESP.',         width: 110 },
  { key: 'cant proc',                          label: 'CANT. PROC.',         width: 105 },
  { key: 'cant planif',                        label: 'CANT. PLANIF.',       width: 110 },
  { key: 'Precio por unidad',                  label: 'PRECIO UNIT.',        width: 120 },
  { key: 'Valor total',                        label: 'VALOR TOTAL',         width: 120 },
  { key: 'Componente',                         label: 'COMPONENTE',          width: 130 },
  { key: 'situación item',                     label: 'SITUACIÓN ÍTEM',      width: 180 },
  { key: 'envio',                              label: 'ENVÍO',               width: 100 },
  { key: 'Familia',                            label: 'FAMILIA',             width: 120 },
  { key: 'Estado',                             label: 'ESTADO',              width: 120 },
  { key: 'Fecha de despacho',                  label: 'F. DESPACHO',         width: 115 },
  { key: 'Fecha real de despacho',             label: 'F. REAL DESP.',       width: 130 },
  { key: 'Fecha estimada de entrega',          label: 'F. EST. ENTREGA',     width: 140 },
  { key: 'Fecha estimada de entrega (real)',   label: 'F. EST. ENTREGA (R)', width: 155 },
  { key: 'Destino',                            label: 'DESTINO',             width: 130 },
  { key: 'Estado despacho',                    label: 'ESTADO DESP.',        width: 135 },
  { key: 'Estado de la orden',                 label: 'ESTADO ORDEN',        width: 140 },
  { key: '# Remisión',                         label: '# REMISIÓN',          width: 120 },
  { key: 'Transportador',                      label: 'TRANSPORTADOR',       width: 155 },
  { key: '# GUIA',                             label: '# GUÍA',              width: 120 },
  { key: 'Fecha de entrega',                   label: 'F. ENTREGA',          width: 115 },
  { key: '# Factura',                          label: '# FACTURA',           width: 120 },
  { key: 'Fecha de la factura',                label: 'F. FACTURA',          width: 115 },
];

const ITEMS_PER_PAGE = 100;

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const normalize = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function VisorTable() {
  const [rows, setRows] = useState<VisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [colFilters, setColFilters] = useState<Partial<Record<keyof VisorRow, string>>>({});
  const [sortKey, setSortKey] = useState<keyof VisorRow>('Orden de venta');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Fetch on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getAllVisorRows();
        setRows(data);
      } catch (e: any) {
        setError(e?.message || 'Error al cargar los datos del VISOR.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Sorting
  const handleSort = useCallback((key: keyof VisorRow) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }, [sortKey]);

  // Filtering + sorting (memoized for perf)
  const filteredRows = useMemo(() => {
    let result = rows;

    // Global search
    if (globalSearch.trim()) {
      const q = norm(globalSearch.trim());
      result = result.filter(row =>
        COLUMNS.some(col => norm(normalize(row[col.key])).includes(q))
      );
    }

    // Per-column filters
    Object.entries(colFilters).forEach(([k, v]) => {
      if (!v?.trim()) return;
      const q = norm(v.trim());
      result = result.filter(row =>
        norm(normalize(row[k as keyof VisorRow])).includes(q)
      );
    });

    // Sort
    result = [...result].sort((a, b) => {
      const va = normalize(a[sortKey]);
      const vb = normalize(b[sortKey]);
      const num_a = Number(va.replace(/[^0-9.-]/g, ''));
      const num_b = Number(vb.replace(/[^0-9.-]/g, ''));
      const isNum = !isNaN(num_a) && !isNaN(num_b) && va !== '' && vb !== '';
      const cmp = isNum ? num_a - num_b : va.localeCompare(vb, 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rows, globalSearch, colFilters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginated = filteredRows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [globalSearch, colFilters]);

  // Export
  const handleExport = () => {
    if (filteredRows.length === 0) return;
    const exportData = filteredRows.map(row =>
      Object.fromEntries(COLUMNS.map(col => [col.label, normalize(row[col.key])]))
    );
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VISOR');
    const cols = COLUMNS.map(col => ({
      wch: Math.max(col.label.length, ...exportData.map(r => String(r[col.label] ?? '').length)) + 2,
    }));
    ws['!cols'] = cols;
    XLSX.writeFile(wb, `VISOR_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ─── Render ───────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ── Header toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Vista Completa VISOR
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {loading ? 'Cargando registros…' : `${filteredRows.length.toLocaleString('es-CO')} registros`}
            {rows.length > 0 && !loading && ` de ${rows.length.toLocaleString('es-CO')} totales`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Global search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="visor-global-search"
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Buscar en todos los campos…"
              className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-64 transition"
            />
          </div>

          {/* Export button */}
          <button
            id="visor-export-btn"
            onClick={handleExport}
            disabled={filteredRows.length === 0 || loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar Excel
          </button>

          {/* Reset filters */}
          {(globalSearch || Object.values(colFilters).some(v => v?.trim())) && (
            <button
              id="visor-reset-btn"
              onClick={() => { setGlobalSearch(''); setColFilters({}); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-medium">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && (
        <div
          ref={tableRef}
          className="overflow-auto rounded-2xl border border-slate-200 shadow-sm bg-white"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          <table className="text-xs border-collapse" style={{ minWidth: COLUMNS.reduce((a, c) => a + c.width, 0) }}>
            {/* HEADER */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0A2A5C]">
                {COLUMNS.map(col => (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col.key)}
                    className="text-left px-3 py-2.5 text-white font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap border-r border-white/10 hover:bg-white/10 transition"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {sortDir === 'asc'
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          }
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>

              {/* Per-column filter row */}
              <tr className="bg-[#0d3575]">
                {COLUMNS.map(col => (
                  <td key={`f-${String(col.key)}`} className="px-2 py-1 border-r border-white/10">
                    <input
                      id={`visor-filter-${String(col.key)}`}
                      type="text"
                      value={colFilters[col.key] ?? ''}
                      onChange={e =>
                        setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))
                      }
                      placeholder="…"
                      className="w-full bg-white/10 text-white placeholder-white/30 text-[10px] px-2 py-1 rounded-lg border border-transparent focus:border-blue-300/50 focus:outline-none focus:bg-white/20 transition"
                      style={{ minWidth: col.width - 16 }}
                    />
                  </td>
                ))}
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center py-16 text-slate-400 font-medium">
                    No se encontraron registros con los filtros actuales.
                  </td>
                </tr>
              ) : (
                paginated.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    className={`border-b border-slate-100 hover:bg-blue-50/60 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    {COLUMNS.map(col => {
                      const val = normalize(row[col.key]);
                      return (
                        <td
                          key={String(col.key)}
                          className="px-3 py-2 border-r border-slate-100 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ maxWidth: col.width }}
                          title={val}
                        >
                          {val || (
                            <span className="text-slate-300 font-light">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-xs text-slate-500 font-medium">
            Página <span className="font-black text-slate-700">{currentPage}</span> de <span className="font-black text-slate-700">{totalPages}</span>
            {' '}·{' '}<span className="font-black text-slate-700">{ITEMS_PER_PAGE}</span> filas por página
          </p>
          <div className="flex items-center gap-2">
            <button
              id="visor-prev-page"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Anterior
            </button>
            {/* Page numbers (show up to 7) */}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  id={`visor-page-${page}`}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition ${
                    currentPage === page
                      ? 'bg-[#0A2A5C] text-white shadow'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              id="visor-next-page"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
