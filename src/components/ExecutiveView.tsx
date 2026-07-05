"use client";

import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { ExecutiveOrder } from '@/types';

interface ExecutiveViewProps {
    orders: ExecutiveOrder[];
    onOrderClick: (ov: string) => void;
}

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc' | null;
};
const formatDisplayDate = (d: string | null | undefined) => {
    if (!d) return '';
    const s = String(d).trim();
    if (!s.includes('-')) return s;
    const parts = s.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return s;
};

const ExecutiveTableRow = memo(({ row, onClick }: { row: ExecutiveOrder; onClick: (ov: string) => void }) => {
    return (
        <tr 
            onClick={() => onClick(row.ov)}
            className="transition-all hover:bg-slate-50 border-b border-slate-100 cursor-pointer group"
        >
            <td className="sticky left-0 z-10 px-2 py-2 text-[11px] font-black text-[#0078D4] border-r border-slate-200/50 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] group-hover:underline">{row.ov}</td>
            <td className="sticky left-[90px] z-10 px-2 py-2 text-[11px] font-extrabold text-slate-700 border-r border-slate-200/50 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">{row.oc}</td>
            <td className="sticky left-[170px] z-10 px-2 py-2 text-[10px] font-bold text-slate-500 border-r border-slate-200/50 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] truncate">{row.cod_cliente}</td>
            <td className="sticky left-[290px] z-10 px-2 py-2 text-[11px] font-black text-[#0F2942] border-r border-slate-200/80 bg-white shadow-[6px_0_10px_-4px_rgba(0,0,0,0.12)] truncate">{row.cliente}</td>
            <td className="px-2 py-2 border-r border-slate-200/50 text-center truncate">
                {row.tipo_envio ? (
                    <span 
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                            row.tipo_envio.toLowerCase().includes('completo')
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : row.tipo_envio.toLowerCase().includes('incompleto')
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200 shadow-none font-bold italic normal-case tracking-normal'
                        }`}
                    >
                        {row.tipo_envio}
                    </span>
                ) : ''}
            </td>
            <td className="px-2 py-2 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 truncate">{row.vendedor}</td>
            <td className="px-2 py-2 text-[11px] font-black text-center text-emerald-600 border-r border-slate-200/50 bg-emerald-50/20">{row.pct_cedi.toFixed(1)}%</td>
            <td className="px-2 py-2 text-[11px] font-black text-center text-amber-600 border-r border-slate-200/50 bg-amber-50/20">{row.pct_produccion.toFixed(1)}%</td>
            <td className="px-2 py-2 text-[11px] font-black text-center text-blue-600 border-r border-slate-200/50 bg-blue-50/20">{row.pct_planificado.toFixed(1)}%</td>
            <td className="px-2 py-2 text-[10px] font-black text-right text-violet-800 border-r border-slate-200/50 bg-violet-50/30 whitespace-nowrap">{row.valor_total_pedido != null ? `$ ${row.valor_total_pedido.toLocaleString('en-US')}` : ''}</td>
            <td className="px-2 py-2 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 truncate">{row.estado_despacho}</td>
            <td className="px-2 py-2 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 whitespace-nowrap bg-slate-50/30">{formatDisplayDate(row.fecha_compromiso)}</td>
        </tr>
    );
});

ExecutiveTableRow.displayName = 'ExecutiveTableRow';

export default function ExecutiveView({ orders, onOrderClick }: ExecutiveViewProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fecha_compromiso_date', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [displayLimit, setDisplayLimit] = useState(100);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // Handle Infinite Scroll
    useEffect(() => {
        const handleWindowScroll = () => {
            if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 500) {
                setDisplayLimit(prev => prev + 100);
            }
        };
        window.addEventListener('scroll', handleWindowScroll);
        return () => window.removeEventListener('scroll', handleWindowScroll);
    }, []);

    // Lógica de Filtrado y Búsqueda
    const filteredData = useMemo(() => {
        let data = orders;

        const activeColumnFilters = Object.entries(columnFilters).filter(([_, v]) => !!v);
        if (activeColumnFilters.length > 0) {
            data = data.filter(d => 
                activeColumnFilters.every(([key, value]) => 
                    String((d as any)[key]).toLowerCase().includes(value.toLowerCase())
                )
            );
        }

        if (sortConfig.key && sortConfig.direction) {
            const { key, direction } = sortConfig;
            data = [...data].sort((a, b) => {
                const aVal = (a as any)[key] || '';
                const bVal = (b as any)[key] || '';
                if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [orders, columnFilters, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleFilterChange = (key: string, value: string) => {
        setColumnFilters(prev => ({ ...prev, [key]: value }));
    };

    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig.key !== colKey) return <svg className="w-2.5 h-2.5 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5zM5 12l5 5 5-5H5z"/></svg>;
        return <svg className={`w-2.5 h-2.5 text-white ${sortConfig.direction === 'desc' ? 'rotate-180' : ''} transition-transform`} fill="currentColor" viewBox="0 0 20 20"><path d="M5 15l5-5 5 5H5z"/></svg>;
    };

    const columns = [
        { key: 'ov', label: 'OV', width: '90px', sticky: 'left-0', z: 'z-[30]' },
        { key: 'oc', label: 'OC', width: '80px', sticky: 'left-[90px]', z: 'z-[30]' },
        { key: 'cod_cliente', label: 'Cód. Cliente', width: '120px', sticky: 'left-[170px]', z: 'z-[30]' },
        { key: 'cliente', label: 'Cliente', width: '220px', sticky: 'left-[290px]', z: 'z-[30]' },
        { key: 'tipo_envio', label: 'Tipo Envío', width: '100px' },
        { key: 'vendedor', label: 'Vendedor', width: '110px' },
        { key: 'pct_cedi', label: '% CEDI', width: '70px' },
        { key: 'pct_produccion', label: '% Prod', width: '70px' },
        { key: 'pct_planificado', label: '% Planif', width: '70px' },
        { key: 'valor_total_pedido', label: 'Valor Total', width: '110px' },
        { key: 'estado_despacho', label: 'Estado despacho', width: '130px' },
        { key: 'fecha_compromiso', label: 'Fecha Comp', width: '105px' }
    ];

    return (
        <div className="w-full relative animate-in fade-in duration-700 space-y-6">
            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto w-full custom-scrollbar" ref={scrollContainerRef}>
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="bg-[#0F2942] text-white sticky top-0 z-20">
                                {columns.map(col => (
                                    <th 
                                        key={col.key}
                                        className={`px-2 py-3 text-left border-r border-white/10 last:border-0 relative group/th ${
                                            col.sticky ? `sticky ${col.sticky} ${col.z || 'z-20'} bg-[#0a1e30]` : 'sticky top-0 z-20'
                                        } ${col.key === 'cliente' ? 'shadow-[6px_0_10px_-4px_rgba(0,0,0,0.12)] border-r-white/20' : ''}`}
                                        style={{ width: col.width }}
                                    >
                                        <div className="flex flex-col gap-2 overflow-hidden min-w-0">
                                            <div 
                                                className="flex items-center justify-between cursor-pointer group-hover/th:text-white/90 transition-colors"
                                                onClick={() => handleSort(col.key)}
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-wider leading-tight truncate block flex-1">
                                                    {col.label}
                                                </span>
                                                <SortIcon colKey={col.key} />
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="…"
                                                className="w-full px-1.5 py-1 bg-white/10 border border-white/10 rounded text-[9px] font-bold text-white placeholder-white/30 outline-none focus:bg-white/25 focus:border-white/40 transition-all"
                                                value={columnFilters[col.key] || ''}
                                                onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.slice(0, displayLimit).map((row) => (
                                <ExecutiveTableRow 
                                    key={row.ov} 
                                    row={row} 
                                    onClick={onOrderClick}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
