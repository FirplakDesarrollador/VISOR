"use client";

import { User } from '@/types';

export interface SearchFilters {
    ov: string;
    oc: string;
    clientName: string;
    nit: string;
}

interface FilterBarProps {
    user: User | null;
    onLoginClick: () => void;
    onLogoutClick: () => void;
    onSearch: (filters: SearchFilters, statusFilter: string | null) => void;
    onDownload: () => void;
    totalOrders: number;
    counts: {
        pending: number;
        production: number;
        transit: number;
        delivered: number;
        enProceso?: number;
    };
    activeStatusFilter: string | null;
    onStatusFilterChange: (status: string | null) => void;
    rawStatuses?: string[];
    filters: SearchFilters;
    onFilterChange: (filters: SearchFilters) => void;
}

// Botones de estado unificados:
// "En Proceso" agrupa Pendientes + En Fabricación
// El id 'EnProceso' es virtual; en page.tsx se mapea a ambos estados
const STATUS_TABS = [
    { id: 'EnProceso', label: 'En Proceso', color: 'bg-amber-500' },
    { id: 'Transito',  label: 'En Tránsito', color: 'bg-blue-500' },
    { id: 'Entregada', label: 'Entregadas',  color: 'bg-emerald-500' },
];

export default function FilterBar({
    user,
    onLoginClick,
    onLogoutClick,
    onSearch,
    onDownload,
    totalOrders,
    counts,
    activeStatusFilter,
    onStatusFilterChange,
    rawStatuses = [],
    filters,
    onFilterChange
}: FilterBarProps) {
    const handleChange = (field: keyof SearchFilters, value: string) => {
        onFilterChange({ ...filters, [field]: value });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSearch(filters, activeStatusFilter);
        }
    };

    const getCount = (id: string) => {
        if (id === 'EnProceso') return counts.enProceso ?? (counts.pending + counts.production);
        if (id === 'Transito')  return counts.transit;
        if (id === 'Entregada') return counts.delivered;
        return 0;
    };

    return (
        <div className="bg-white px-4 py-2.5 rounded-xl shadow-md shadow-slate-200/40 border border-slate-100 mb-3 space-y-2 relative z-10 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Row 1: Title + Status tabs + Actions — TODO EN UNA LÍNEA */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Left: Status tabs inline */}
                <div className="flex items-center gap-2">
                    {user && STATUS_TABS.map(stat => (
                        <button
                            key={stat.id}
                            onClick={() => {
                                const newStatus = activeStatusFilter === stat.id ? null : stat.id;
                                onStatusFilterChange(newStatus);
                                onSearch(filters, newStatus);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all text-[10px] font-black uppercase tracking-wider ${
                                activeStatusFilter === stat.id
                                ? 'bg-white border-primary/40 shadow-sm text-primary'
                                : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${stat.color} ${activeStatusFilter === stat.id ? 'animate-pulse' : ''}`} />
                            {stat.label}
                            <span className={`text-xs font-black ml-0.5 ${activeStatusFilter === stat.id ? 'text-primary' : 'text-slate-400'}`}>
                                {getCount(stat.id).toLocaleString()}
                            </span>
                        </button>
                    ))}
                    {!user && (
                        <span className="text-sm font-black text-primary">Consulta de Pedidos</span>
                    )}
                    
                    {/* Badge resultados */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 rounded-lg ml-1">
                        <span className="text-[8px] font-black text-primary/50 uppercase tracking-widest">Pedidos</span>
                        <span className="text-sm font-black text-primary">{totalOrders}</span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {user && (
                        <>
                            {/* Dropdown Estado */}
                            <select
                                value={activeStatusFilter ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value || null;
                                    onStatusFilterChange(val);
                                    onSearch(filters, val);
                                }}
                                className="px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none transition-all text-[10px] font-black text-primary cursor-pointer min-w-[130px]"
                            >
                                <option value="">Todos</option>
                                <option value="EnProceso">🟡 En Proceso</option>
                                <option value="Transito">🔵 En Tránsito</option>
                                <option value="Entregada">🟢 Entregadas</option>
                                {rawStatuses.length > 0 && (
                                    <optgroup label="Estados BD">
                                        {rawStatuses.map(s => (
                                            <option key={s} value={`raw:${s}`}>📁 {s}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>

                            {/* Descargar */}
                            <button
                                onClick={onDownload}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition-all font-black text-[9px] shadow-sm uppercase tracking-wider"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Excel
                            </button>
                        </>
                    )}

                    {/* User / Login */}
                    {user ? (
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
                            <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black text-primary leading-none uppercase tracking-tight">{user.name || 'Usuario'}</p>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</span>
                            </div>
                            <button
                                onClick={onLogoutClick}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100"
                                title="Cerrar Sesión"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLoginClick}
                            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 active:scale-95 transition-all font-black text-[10px] shadow-sm uppercase tracking-wider"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Acceso
                        </button>
                    )}
                </div>
            </div>

            {/* Row 2: Search inputs inline */}
            <div className="flex items-center gap-2 pt-1.5 border-t border-slate-50">
                <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {[
                    { id: 'ov',         label: 'OV',      placeholder: 'Ej: 1001' },
                    { id: 'oc',         label: 'OC',      placeholder: 'Ej: 2234' },
                    { id: 'clientName', label: 'Cliente', placeholder: 'Nombre' },
                    { id: 'nit',        label: 'NIT',     placeholder: 'Ej: 900' }
                ].map(field => (
                    <div key={field.id} className="flex-1 min-w-0">
                        <input
                            type="text"
                            placeholder={`${field.label}: ${field.placeholder}`}
                            value={filters[field.id as keyof SearchFilters]}
                            onChange={(e) => handleChange(field.id as keyof SearchFilters, e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/20 outline-none transition-all text-[11px] font-bold text-primary placeholder-slate-300"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
