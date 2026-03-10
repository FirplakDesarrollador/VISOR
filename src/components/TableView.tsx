"use client";

import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { Order } from '@/types';

interface TableViewProps {
    orders: Order[];
    onOrderClick: (order: Order) => void;
}

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc' | null;
};

// Componente de Fila Memoizado para evitar re-renders innecesarios
const TableRow = memo(({ row, onClick }: { row: any, onClick: (order: any) => void }) => {
    return (
        <tr 
            onClick={() => onClick(row.orderRef)}
            className={`transition-all cursor-pointer group hover:shadow-inner ${row.colorRow}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '0 56px' } as any}
        >
            <td className="sticky left-0 z-10 px-5 py-5 text-sm font-black text-[#0078D4] border-r border-slate-200/50 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] tracking-tight">{row.ov}</td>
            <td className="sticky left-[150px] z-10 px-5 py-5 text-[13px] font-extrabold text-slate-700 border-r border-slate-200/50 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] tracking-wide">{row.oc}</td>
            <td className="sticky left-[300px] z-10 px-5 py-5 text-xs font-bold text-slate-500 border-r border-slate-200/50 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] tracking-wider truncate max-w-[150px]">{row.nit}</td>
            <td className="sticky left-[450px] z-10 px-5 py-5 text-sm font-black text-[#0F2942] border-r border-slate-200/80 bg-inherit shadow-[10px_0_15px_-6px_rgba(0,0,0,0.15)] truncate max-w-[340px]">{row.cliente}</td>
            <td className="px-5 py-5 border-r border-slate-200/50">
                <span className={`inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest shadow-sm ${
                    row.estado.includes('ENTREGADA') ? 'text-green-800 bg-green-100/50' :
                    row.estado.includes('TRANSITO') ? 'text-amber-800 bg-amber-100/50 border border-amber-200/50' :
                    row.estado.includes('PRODUCCION') ? 'text-orange-800 bg-orange-100/50' :
                    'text-slate-600 bg-slate-100/50'
                }`}>
                    {row.estado}
                </span>
            </td>
            <td className="px-5 py-5 text-xs font-bold text-slate-600 border-r border-slate-200/50 truncate max-w-[200px]">{row.vendedor}</td>
            <td className="px-5 py-5 text-xs font-black text-slate-400 text-center border-r border-slate-200/50 bg-slate-50/50">{row.itemIdx}</td>
            <td className="px-5 py-5 border-r border-slate-200/50 truncate max-w-[380px]">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black text-primary/40 tracking-widest">{row.codigo}</span>
                    <span className="text-xs font-extrabold text-slate-700 leading-tight truncate" title={row.producto}>{row.producto}</span>
                </div>
            </td>
            <td className="px-5 py-5 text-sm font-black text-center text-primary border-r border-slate-200/50 whitespace-nowrap">{row.cantidad}</td>
            <td className="px-5 py-5 text-sm font-black text-center text-indigo-600 border-r border-slate-200/50 bg-indigo-50/20 whitespace-nowrap">{row.cantFacturada}</td>
            <td className="px-5 py-5 text-sm font-black text-center text-emerald-600 border-r border-slate-200/50 bg-emerald-50/20 whitespace-nowrap">{row.cantDespacho}</td>
            <td className="px-5 py-5 text-sm font-black text-center text-amber-600 border-r border-slate-200/50 bg-amber-50/20 whitespace-nowrap">{row.cantProduccion}</td>
            <td className="px-5 py-5 text-sm font-black text-center text-slate-500 border-r border-slate-200/50 whitespace-nowrap">{row.cantPlanificada}</td>
            <td className="px-5 py-5 text-xs font-bold text-slate-600 border-r border-slate-200/50 truncate max-w-[200px]">{row.transportador}</td>
            <td className="px-5 py-5 text-xs font-bold text-slate-700 border-r border-slate-200/50 font-mono tracking-widest truncate max-w-[180px]">{row.guia}</td>
            <td className="px-5 py-5 text-[11px] font-bold text-slate-500 border-r border-slate-200/50">{row.fechaIngreso}</td>
            <td className="px-5 py-5 text-[11px] font-black text-emerald-600 border-r border-slate-200/50">{row.fechaRealDespacho}</td>
            <td className="px-5 py-5 text-[11px] font-bold text-slate-600 border-r border-slate-200/50">{row.fechaEstimada}</td>
            <td className="px-5 py-5 text-[11px] font-black text-emerald-700 border-r border-slate-200/50">
                <div className="flex items-center gap-2">
                    {row.isRealEntrega && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />}
                    {row.fechaEntrega}
                </div>
            </td>
            <td className="px-5 py-5 text-xs font-black text-blue-800 bg-blue-50/50 border-r border-blue-100/50 font-mono tracking-widest">{row.factura}</td>
            <td className="px-5 py-5 text-xs font-bold text-blue-600 bg-blue-50/50 whitespace-nowrap">{row.fechaFactura}</td>
        </tr>
    );
});

TableRow.displayName = 'TableRow';

export default function TableView({ orders, onOrderClick }: TableViewProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fechaIngreso', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [displayLimit, setDisplayLimit] = useState(100);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    // Sync scrollbar
    const handleTopScroll = () => {
        if (scrollContainerRef.current && topScrollRef.current) {
            scrollContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleMainScroll = () => {
        if (scrollContainerRef.current && topScrollRef.current) {
            topScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
        }
    };

    // Reset limit on filter/search change
    useEffect(() => {
        setDisplayLimit(100);
    }, [columnFilters, sortConfig]);

    // Handle Infinite Scroll en la ventana
    useEffect(() => {
        const handleWindowScroll = () => {
            if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 500) {
                setDisplayLimit(prev => prev + 100);
            }
        };
        window.addEventListener('scroll', handleWindowScroll);
        return () => window.removeEventListener('scroll', handleWindowScroll);
    }, []);

    // Aplanar las órdenes una sola vez por cambio en orders
    const flatData = useMemo(() => {
        const cleanStr = (val: string | null | undefined) => {
            if (!val) return '';
            const s = String(val).trim();
            if (s.toLowerCase() === 'null' || s === '---' || s.toLowerCase() === 'nan') return '';
            return s;
        };

        return orders.flatMap(order => 
            order.items.map((item, index) => ({
                id: `${order.numero_orden_venta}-${index}`,
                orderRef: order,
                ov: cleanStr(order.numero_orden_venta),
                oc: cleanStr(order.numero_orden_compra),
                itemIdx: index + 1,
                cliente: cleanStr(order.nombre_cliente),
                nit: cleanStr(order.nit_cliente),
                vendedor: cleanStr(order.vendedor),
                producto: cleanStr(item.descripcion_producto),
                codigo: cleanStr(item.codigo_producto),
                cantidad: item.cantidad_pedida,
                cantFacturada: item.cantidad_facturada,
                cantDespacho: item.cantidad_despacho,
                cantProduccion: item.cantidad_produccion,
                cantPlanificada: item.cantidad_planificada,
                estado: (order.normalizedStatus?.includes('transito') && order.transportador?.toLowerCase().includes('cliente recoge')) 
                         ? 'LISTO PARA RECOGER' 
                         : cleanStr(order.estado_orden),
                fechaIngreso: cleanStr(order.fecha_ingreso),
                fechaDespacho: cleanStr(order.fecha_plan_despacho),
                fechaRealDespacho: cleanStr(order.fecha_real_despacho),
                fechaEstimada: cleanStr(order.fecha_estimada_entrega),
                fechaEntrega: cleanStr(order.fecha_entrega),
                isRealEntrega: !!order.fecha_entrega && cleanStr(order.fecha_entrega) !== '',
                guia: cleanStr(order.numero_guia),
                transportador: cleanStr(order.transportador),
                factura: cleanStr(order.numero_factura),
                fechaFactura: cleanStr(order.fecha_factura),
                ciudad: order.ciudad_destino,
                colorRow: order.estado_orden.toLowerCase().includes('entregada') ? 'bg-[#E2EFDA] hover:bg-[#D5EAD8]' : 
                          order.estado_orden.toLowerCase().includes('transito') ? 'bg-[#FFF2CC] hover:bg-[#FFE699]' :
                          order.estado_orden.toLowerCase().includes('produccion') ? 'bg-[#FCE4D6] hover:bg-[#F8CBAD]' : 'bg-white hover:bg-slate-50'
            }))
        );
    }, [orders]);

    // Lógica de Filtrado y Búsqueda Optimizada
    const filteredData = useMemo(() => {
        let data = flatData;

        // Column Filters
        const activeColumnFilters = Object.entries(columnFilters).filter(([_, v]) => !!v);
        if (activeColumnFilters.length > 0) {
            data = data.filter(d => 
                activeColumnFilters.every(([key, value]) => 
                    String((d as any)[key]).toLowerCase().includes(value.toLowerCase())
                )
            );
        }

        // Sorting
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
    }, [flatData, columnFilters, sortConfig]);

    useEffect(() => {
        if (scrollContainerRef.current) {
            setTableWidth(scrollContainerRef.current.scrollWidth);
        }
    }, [filteredData, displayLimit]);


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
        if (sortConfig.key !== colKey) return <svg className="w-3 h-3 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5zM5 12l5 5 5-5H5z"/></svg>;
        return <svg className={`w-3 h-3 text-white ${sortConfig.direction === 'desc' ? 'rotate-180' : ''} transition-transform`} fill="currentColor" viewBox="0 0 20 20"><path d="M5 15l5-5 5 5H5z"/></svg>;
    };

    return (
        <div className="w-full bg-slate-50 relative animate-in fade-in duration-700">
            {/* Table Actions Header */}
            <div className="flex flex-col gap-2 mb-2 bg-transparent">
                <div className="px-6 py-2 flex justify-end items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200/50">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{filteredData.length} ÍTEMS</span>
                    </div>
                    <button 
                        onClick={() => { setColumnFilters({}); setSortConfig({ key: 'fechaIngreso', direction: 'desc' }); }}
                        className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200 shadow-sm active:scale-95"
                    >
                        Limpiar Filtros
                    </button>
                </div>

                {/* Top Synchronized Scrollbar */}
                <div className="px-6 w-full">
                    <div 
                        ref={topScrollRef}
                        onScroll={handleTopScroll}
                        className="overflow-x-auto w-full custom-scrollbar bg-white/50 border border-slate-200/50 rounded-t-xl hover:bg-slate-100/50 transition-colors"
                        style={{ paddingBottom: '2px' }}
                    >
                        <div style={{ width: tableWidth ? `${tableWidth}px` : '100%', height: '8px' }} />
                    </div>
                </div>
            </div>

            {/* Excel-like Grid - No max-height so it scrolls natively on window */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleMainScroll}
                className="overflow-x-auto w-full custom-scrollbar"
            >
                <table className="w-full border-collapse table-fixed">
                    <thead>
                        <tr className="bg-[#0078D4] text-white sticky top-0 z-20 shadow-lg">
                            {[
                                { key: 'ov', label: 'Orden Venta', width: '150px', sticky: 'left-0', z: 'z-[30]' },
                                { key: 'oc', label: 'Orden Compra', width: '150px', sticky: 'left-[150px]', z: 'z-[30]' },
                                { key: 'nit', label: 'Cód. Cliente', width: '150px', sticky: 'left-[300px]', z: 'z-[30]' },
                                { key: 'cliente', label: 'Nombre del Cliente', width: '340px', sticky: 'left-[450px]', z: 'z-[30]' },
                                { key: 'estado', label: 'Estado', width: '180px' },
                                { key: 'vendedor', label: 'Vendedor', width: '200px' },
                                { key: 'itemIdx', label: 'ITEM', width: '80px', preventTranslation: true },
                                { key: 'producto', label: 'Descripción de Producto', width: '380px' },
                                { key: 'cantidad', label: 'Ped.', width: '70px' },
                                { key: 'cantFacturada', label: 'Fact.', width: '70px' },
                                { key: 'cantDespacho', label: 'Desp.', width: '70px' },
                                { key: 'cantProduccion', label: 'Prod.', width: '70px' },
                                { key: 'cantPlanificada', label: 'Plan.', width: '70px' },
                                { key: 'transportador', label: 'Transportadora', width: '200px' },
                                { key: 'guia', label: '# Guía', width: '180px' },
                                { key: 'fechaIngreso', label: 'F. Registro', width: '140px' },
                                { key: 'fechaRealDespacho', label: 'Despacho Real', width: '140px' },
                                { key: 'fechaEstimada', label: 'Estimada', width: '140px' },
                                { key: 'fechaEntrega', label: 'Entrega Real', width: '140px' },
                                { key: 'factura', label: 'Factura', width: '150px' },
                                { key: 'fechaFactura', label: 'F. Factura', width: '130px' },
                            ].map(col => (
                                <th 
                                    key={col.key}
                                    className={`px-5 py-5 text-left border-r border-white/20 last:border-0 relative group/th ${
                                        col.sticky ? `sticky ${col.sticky} ${col.z || 'z-20'} bg-[#006bd1]` : 'sticky top-0 z-20'
                                    } ${col.key === 'cliente' ? 'shadow-[8px_0_15px_-4px_rgba(0,0,0,0.15)] border-r-white/40' : ''}`}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex flex-col gap-3 overflow-hidden min-w-0">
                                        <div 
                                            className={`flex items-center justify-between cursor-pointer group-hover/th:text-white/90 transition-colors ${(col as any).preventTranslation ? 'notranslate' : ''}`}
                                            translate={(col as any).preventTranslation ? 'no' : undefined}
                                            onClick={() => handleSort(col.key)}
                                        >
                                            <span 
                                                className="text-[11px] font-black uppercase tracking-widest leading-tight truncate block flex-1"
                                                title={col.label}
                                            >
                                                {col.label === 'ITEM' ? 'I\u200BT\u200BE\u200BM' : col.label}
                                            </span>
                                            <SortIcon colKey={col.key} />
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="..."
                                            className="w-full px-2.5 py-2 bg-white/10 border border-white/10 rounded-lg text-[11px] font-bold text-white placeholder-white/40 outline-none focus:bg-white/25 focus:border-white/40 transition-all shadow-inner"
                                            value={columnFilters[col.key] || ''}
                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredData.slice(0, displayLimit).map((row) => (
                            <TableRow 
                                key={row.id} 
                                row={row} 
                                onClick={onOrderClick} 
                            />
                        ))}
                    </tbody>
                </table>
                {filteredData.length > displayLimit && (
                    <div className="py-4 text-center bg-slate-50/50 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                            Cargando más pedidos... ({displayLimit} de {filteredData.length})
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
