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
    };
    activeStatusFilter: string | null;
    onStatusFilterChange: (status: string | null) => void;
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

    // Conteo para "En Proceso" = Pendientes + En Fabricación
    const enProcesoCount = counts.pending + counts.production;

    const getCount = (id: string) => {
        if (id === 'EnProceso') return enProcesoCount;
        if (id === 'Transito')  return counts.transit;
        if (id === 'Entregada') return counts.delivered;
        return 0;
    };

    return (
        <div className="bg-white p-4 rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 mb-6 space-y-4 relative z-10 animate-in fade-in slide-in-from-top-2 duration-700">

            {/* Top Row: Title, Results & Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-black text-primary tracking-tight">
                            {user ? `Panel de ${user.role}` : 'Centro de Seguimiento'}
                        </h2>
                        <p className="text-xs font-bold text-slate-400">
                            {user ? 'Explora y gestiona las órdenes de venta activas.' : 'Consulta la situación actual de tu pedido.'}
                        </p>
                    </div>
                    {/* Badge de totales */}
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-2xl shadow-lg shadow-primary/20 border border-white/10 group overflow-hidden relative">
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 relative z-10">Resultados</span>
                        <span className="text-lg font-black relative z-10">{totalOrders}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    {user && (
                        <div className="flex items-center gap-3">
                            {/* Dropdown de Estado */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Estado</label>
                                <select
                                    value={activeStatusFilter ?? ''}
                                    onChange={(e) => {
                                        const val = e.target.value || null;
                                        onStatusFilterChange(val);
                                        onSearch(filters, val);
                                    }}
                                    className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-[12px] font-black text-primary shadow-inner cursor-pointer min-w-[175px]"
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="EnProceso">🟡 En Proceso</option>
                                    <option value="Transito">🔵 En Tránsito</option>
                                    <option value="Entregada">🟢 Entregadas</option>
                                </select>
                            </div>

                            {/* Botón Descargar */}
                            <button
                                onClick={onDownload}
                                className="flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition-all font-black text-[11px] shadow-lg shadow-emerald-200/50 uppercase tracking-widest group"
                            >
                                <svg className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Descargar
                            </button>
                        </div>
                    )}

                    <div className="flex-1 lg:flex-none">
                        {user ? (
                            <div className="flex items-center gap-5 pl-5 border-l border-slate-100">
                                <div className="text-right">
                                    <p className="text-[11px] font-black text-primary leading-none mb-1 uppercase tracking-tighter">{user.name || 'Usuario'}</p>
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{user.role}</span>
                                </div>
                                <button
                                    onClick={onLogoutClick}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100 group shadow-sm"
                                    title="Cerrar Sesión"
                                >
                                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={onLoginClick}
                                className="w-full flex items-center justify-center gap-3 px-8 py-3.5 bg-primary text-white rounded-xl hover:opacity-90 active:scale-95 transition-all font-black text-[13px] shadow-xl shadow-primary/20 uppercase tracking-widest"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                Acceso
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Tabs: 3 botones (En Proceso unifica Pendientes + En Fabricación) */}
            {user && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {STATUS_TABS.map(stat => (
                        <button
                            key={stat.id}
                            onClick={() => {
                                const newStatus = activeStatusFilter === stat.id ? null : stat.id;
                                onStatusFilterChange(newStatus);
                                onSearch(filters, newStatus);
                            }}
                            className={`relative flex items-center justify-between gap-3 px-4 py-2 rounded-xl border transition-all duration-300 group overflow-hidden ${
                                activeStatusFilter === stat.id
                                ? 'bg-white border-2 border-primary shadow-md shadow-primary/5'
                                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                            }`}
                        >
                            <div className="flex items-center gap-2 relative z-10">
                                <div className={`w-2.5 h-2.5 rounded-full ${stat.color} ${activeStatusFilter === stat.id ? 'animate-pulse' : ''} shadow-sm`} />
                                <span className={`text-[11px] font-black uppercase tracking-widest ${activeStatusFilter === stat.id ? 'text-primary' : 'text-slate-500'}`}>
                                    {stat.label}
                                </span>
                            </div>
                            <span className={`text-xl font-black relative z-10 transition-colors ${activeStatusFilter === stat.id ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                {getCount(stat.id).toLocaleString()}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Search Grid */}
            <div className="space-y-4 pt-3 border-t border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Criterios de búsqueda</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { id: 'ov',         label: 'Orden Venta (OV)',  placeholder: 'Ej: OV-1001' },
                        { id: 'oc',         label: 'Orden Compra (OC)', placeholder: 'Ej: OC-2234' },
                        { id: 'clientName', label: 'Cliente',           placeholder: 'Ej: Bolivar'  },
                        { id: 'nit',        label: 'C.C / NIT',         placeholder: 'Ej: 900'      }
                    ].map(field => (
                        <div key={field.id} className="group flex flex-col gap-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-3 group-focus-within:text-primary transition-colors">
                                {field.label}
                            </label>
                            <input
                                type="text"
                                placeholder={field.placeholder}
                                value={filters[field.id as keyof SearchFilters]}
                                onChange={(e) => handleChange(field.id as keyof SearchFilters, e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-[13px] font-black text-primary placeholder-slate-300 shadow-inner"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
