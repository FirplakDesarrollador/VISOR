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

// Componente de Fila Memoizado — COMPACTO
const TableRow = memo(({ row, onClick }: { row: any, onClick: (order: any) => void }) => {
    return (
        <tr 
            onClick={() => onClick(row.orderRef)}
            className={`transition-all cursor-pointer group hover:shadow-inner ${row.colorRow}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '0 36px' } as any}
        >
            <td className="sticky left-0 z-10 px-2 py-1.5 text-[11px] font-black text-[#0078D4] border-r border-slate-200/50 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">{row.ov}</td>
            <td className="sticky left-[90px] z-10 px-2 py-1.5 text-[11px] font-extrabold text-slate-700 border-r border-slate-200/50 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">{row.oc}</td>
            <td className="sticky left-[170px] z-10 px-2 py-1.5 text-[10px] font-bold text-slate-500 border-r border-slate-200/50 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] truncate">{row.nit}</td>
            <td className="sticky left-[290px] z-10 px-2 py-1.5 text-[11px] font-black text-[#0F2942] border-r border-slate-200/80 bg-inherit shadow-[6px_0_10px_-4px_rgba(0,0,0,0.12)] truncate">{row.cliente}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 truncate italic">{row.envio}</td>
            <td className={`px-2 py-1.5 text-[9px] font-black uppercase tracking-wider border-r border-slate-200/50 ${
                row.estado.toLowerCase().includes('entregada') ? 'text-green-700' :
                row.estado.toLowerCase().includes('transito') || row.estado.toLowerCase().includes('tránsito') ? 'text-amber-600' :
                row.estado.toLowerCase().includes('produccion') || row.estado.toLowerCase().includes('producción') ? 'text-orange-600' :
                'text-slate-600'
            }`}>
                {row.estado}
            </td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 truncate">{row.vendedor}</td>
            <td className="px-2 py-1.5 text-[10px] font-black text-slate-400 text-center border-r border-slate-200/50 bg-slate-50/50">{row.itemIdx}</td>
            <td className="px-2 py-1.5 border-r border-slate-200/50 truncate">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-primary/40 tracking-wide">{row.codigo}</span>
                    <span className="text-[10px] font-extrabold text-slate-700 leading-tight truncate" title={row.producto}>{row.producto}</span>
                </div>
            </td>
            <td className="px-1 py-1.5 text-[11px] font-black text-center text-primary border-r border-slate-200/50 whitespace-nowrap">{row.cantidad}</td>
            <td className="px-1 py-1.5 text-[11px] font-black text-center text-indigo-600 border-r border-slate-200/50 bg-indigo-50/20 whitespace-nowrap">{row.cantFacturada}</td>
            <td className="px-1 py-1.5 text-[11px] font-black text-center text-emerald-600 border-r border-slate-200/50 bg-emerald-50/20 whitespace-nowrap">{row.cantDespacho}</td>
            <td className="px-1 py-1.5 text-[11px] font-black text-center text-amber-600 border-r border-slate-200/50 bg-amber-50/20 whitespace-nowrap">{row.cantProduccion}</td>
            <td className="px-1 py-1.5 text-[11px] font-black text-center text-slate-500 border-r border-slate-200/50 whitespace-nowrap">{row.cantPlanificada}</td>
            <td className="px-2 py-1.5 text-[10px] font-black text-right text-violet-700 border-r border-slate-200/50 bg-violet-50/20 whitespace-nowrap">{row.precioUnitario != null ? `$ ${row.precioUnitario.toLocaleString('en-US')}` : ''}</td>
            <td className="px-2 py-1.5 text-[10px] font-black text-right text-violet-800 border-r border-slate-200/50 bg-violet-50/30 whitespace-nowrap">{row.valorTotal != null ? `$ ${row.valorTotal.toLocaleString('en-US')}` : ''}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 truncate">{row.transportador}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-700 border-r border-slate-200/50 font-mono tracking-wide truncate">{row.guia}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-500 border-r border-slate-200/50 whitespace-nowrap">{row.fechaIngreso}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 whitespace-nowrap bg-slate-50/30">{row.fechaProgDesp}</td>
            <td className="px-2 py-1.5 text-[10px] font-black text-emerald-600 border-r border-slate-200/50 whitespace-nowrap">{row.fechaRealDespacho}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-600 border-r border-slate-200/50 whitespace-nowrap">{row.fechaEstimada}</td>
            <td className="px-2 py-1.5 text-[10px] font-black text-emerald-700 border-r border-slate-200/50 whitespace-nowrap">
                <div className="flex items-center gap-1">
                    {row.isRealEntrega && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />}
                    {row.fechaEntrega}
                </div>
            </td>
            <td className="px-2 py-1.5 text-[10px] font-black text-blue-800 bg-blue-50/50 border-r border-blue-100/50 font-mono tracking-wide">{row.factura}</td>
            <td className="px-2 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50/50 whitespace-nowrap">{row.fechaFactura}</td>
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
                precioUnitario: item.precio_unitario,
                valorTotal: item.valor_total,
                estado: item.estado_raw ? cleanStr(item.estado_raw) : 
                        ((order.normalizedStatus?.includes('transito') && order.transportador?.toLowerCase().includes('cliente recoge')) 
                         ? 'LISTO PARA RECOGER' 
                         : cleanStr(order.estado_orden)),
                fechaIngreso: cleanStr(order.fecha_ingreso),
                fechaProgDesp: cleanStr(order.fecha_plan_despacho),
                fechaDespacho: cleanStr(order.fecha_plan_despacho),
                // PER-ITEM: cada fila muestra SOLO sus propios datos de la BD
                fechaRealDespacho: cleanStr(item.fecha_real_despacho),
                fechaEstimada: cleanStr(item.fecha_estimada_entrega),
                fechaEntrega: cleanStr(item.fecha_entrega),
                isRealEntrega: !!item.fecha_entrega && cleanStr(item.fecha_entrega) !== '',
                guia: cleanStr(item.numero_guia),
                transportador: cleanStr(item.transportador),
                factura: cleanStr(item.numero_factura),
                fechaFactura: cleanStr(item.fecha_factura),
                envio: cleanStr(item.envio || order.envio),
                ciudad: order.ciudad_destino,
                colorRow: (item.estado_raw || order.estado_orden).toLowerCase().includes('entregada') ? 'bg-[#E2EFDA] hover:bg-[#D5EAD8]' : 
                          (item.estado_raw || order.estado_orden).toLowerCase().includes('transito') ? 'bg-[#FFF2CC] hover:bg-[#FFE699]' :
                          (item.estado_raw || order.estado_orden).toLowerCase().includes('produccion') ? 'bg-[#FCE4D6] hover:bg-[#F8CBAD]' : 'bg-white hover:bg-slate-50'
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

    // Suma del Valor Total de todos los ítems filtrados
    const sumaValorTotal = useMemo(() => {
        return filteredData.reduce((acc, row) => acc + (row.valorTotal ?? 0), 0);
    }, [filteredData]);


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

    // Column definitions — COMPACTO
    const columns = [
        { key: 'ov', label: 'OV', width: '90px', sticky: 'left-0', z: 'z-[30]' },
        { key: 'oc', label: 'OC', width: '80px', sticky: 'left-[90px]', z: 'z-[30]' },
        { key: 'nit', label: 'Cód. Cliente', width: '120px', sticky: 'left-[170px]', z: 'z-[30]' },
        { key: 'cliente', label: 'Cliente', width: '220px', sticky: 'left-[290px]', z: 'z-[30]' },
        { key: 'envio', label: 'Envío', width: '100px' },
        { key: 'estado', label: 'Estado', width: '120px' },
        { key: 'vendedor', label: 'Vendedor', width: '110px' },
        { key: 'itemIdx', label: 'IT', width: '40px', preventTranslation: true },
        { key: 'producto', label: 'Producto', width: '250px' },
        { key: 'cantidad', label: 'Ped', width: '50px' },
        { key: 'cantFacturada', label: 'Fac', width: '50px' },
        { key: 'cantDespacho', label: 'Des', width: '50px' },
        { key: 'cantProduccion', label: 'Pro', width: '50px' },
        { key: 'cantPlanificada', label: 'Pla', width: '50px' },
        { key: 'precioUnitario', label: 'Precio U.', width: '100px' },
        { key: 'valorTotal', label: 'Valor Total', width: '110px' },
        { key: 'transportador', label: 'Transportadora', width: '140px' },
        { key: 'guia', label: '# Guía', width: '110px' },
        { key: 'fechaIngreso', label: 'Fecha OV', width: '95px' },
        { key: 'fechaProgDesp', label: 'Fecha Prog Desp', width: '105px' },
        { key: 'fechaRealDespacho', label: 'Fecha Desp', width: '95px' },
        { key: 'fechaEstimada', label: 'Fecha Estim', width: '95px' },
        { key: 'fechaEntrega', label: 'Fecha Entr', width: '95px' },
        { key: 'factura', label: 'Factura', width: '100px' },
        { key: 'fechaFactura', label: 'Fecha Fact', width: '90px' },
    ];

    return (
        <div className="w-full bg-slate-50 relative animate-in fade-in duration-700">
            {/* Table Actions Header — compacto */}
            <div className="flex flex-col gap-1 mb-1 bg-transparent">
                <div className="px-4 py-1 flex justify-end items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-200/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{filteredData.length} ÍTEMS</span>
                    </div>
                    <button 
                        onClick={() => { setColumnFilters({}); setSortConfig({ key: 'fechaIngreso', direction: 'desc' }); }}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-slate-200 shadow-sm active:scale-95"
                    >
                        Limpiar Filtros
                    </button>
                </div>

                {/* Top Synchronized Scrollbar */}
                <div className="px-4 w-full">
                    <div 
                        ref={topScrollRef}
                        onScroll={handleTopScroll}
                        className="overflow-x-auto w-full custom-scrollbar bg-white/50 border border-slate-200/50 rounded-t-lg hover:bg-slate-100/50 transition-colors"
                        style={{ paddingBottom: '1px' }}
                    >
                        <div style={{ width: tableWidth ? `${tableWidth}px` : '100%', height: '6px' }} />
                    </div>
                </div>
            </div>

            {/* Excel-like Grid */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleMainScroll}
                className="overflow-x-auto w-full custom-scrollbar"
            >
                <table className="w-full border-collapse table-fixed">
                    <thead>
                        <tr className="bg-[#0078D4] text-white sticky top-0 z-20 shadow-lg">
                            {columns.map(col => (
                                <th 
                                    key={col.key}
                                    className={`px-2 py-2 text-left border-r border-white/20 last:border-0 relative group/th ${
                                        col.sticky ? `sticky ${col.sticky} ${col.z || 'z-20'} bg-[#006bd1]` : 'sticky top-0 z-20'
                                    } ${col.key === 'cliente' ? 'shadow-[6px_0_10px_-4px_rgba(0,0,0,0.12)] border-r-white/40' : ''}`}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex flex-col gap-1 overflow-hidden min-w-0">
                                        <div 
                                            className={`flex items-center justify-between cursor-pointer group-hover/th:text-white/90 transition-colors ${(col as any).preventTranslation ? 'notranslate' : ''}`}
                                            translate={(col as any).preventTranslation ? 'no' : undefined}
                                            onClick={() => handleSort(col.key)}
                                        >
                                            <span 
                                                className="text-[9px] font-black uppercase tracking-wider leading-tight truncate block flex-1"
                                                title={col.label}
                                            >
                                                {col.label === 'IT' ? 'I\u200BT' : col.label}
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
                            <TableRow 
                                key={row.id} 
                                row={row} 
                                onClick={onOrderClick} 
                            />
                        ))}
                    </tbody>
                    {/* Footer con suma de Valor Total */}
                    <tfoot className="sticky bottom-0 z-20">
                        <tr className="bg-[#0A2A5C] text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
                            <td className="sticky left-0 z-[30] bg-[#0A2A5C] px-2 py-2 border-r border-white/10" />
                            <td className="sticky left-[90px] z-[30] bg-[#0A2A5C] px-2 py-2 border-r border-white/10" />
                            <td className="sticky left-[170px] z-[30] bg-[#0A2A5C] px-2 py-2 border-r border-white/10" />
                            <td className="sticky left-[290px] z-[30] bg-[#0A2A5C] px-2 py-2 border-r border-white/10 shadow-[6px_0_10px_-4px_rgba(0,0,0,0.12)]">
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/60">TOTAL VALOR</span>
                            </td>
                            {/* Columnas 5-13 vacías */}
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            {/* Precio Unit. vacía */}
                            <td className="px-2 py-2 border-r border-white/10" />
                            {/* VALOR TOTAL — suma */}
                            <td className="px-2 py-2 border-r border-white/10 text-right">
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Σ Total</span>
                                    <span className="text-xs font-black text-emerald-400 tracking-tight">$ {sumaValorTotal.toLocaleString('en-US')}</span>
                                </div>
                            </td>
                            {/* Columnas restantes vacías */}
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2 border-r border-white/10" />
                            <td className="px-2 py-2" />
                        </tr>
                    </tfoot>
                </table>
                {filteredData.length > displayLimit && (
                    <div className="py-2 text-center bg-slate-50/50 border-t border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                            Cargando más pedidos... ({displayLimit} de {filteredData.length})
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
