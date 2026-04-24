import { Order, UserRole, OrderItem } from '@/types';
import { useState } from 'react';

interface OrderDetailProps {
    order: Order;
    role: UserRole;
    onBack: () => void;
}

const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('completo')) return 'text-emerald-700 bg-emerald-50 border-emerald-200 font-black shadow-sm shadow-emerald-100/30';
    if (s.includes('entregada')) return 'text-blue-700 bg-blue-50 border-blue-200 font-black';
    if (s.includes('recoger')) return 'text-emerald-700 bg-emerald-50 border-emerald-200 font-black shadow-sm shadow-emerald-100/30';
    if (s.includes('tránsito') || s.includes('despachado')) return 'text-emerald-700 bg-emerald-50 border-emerald-200 font-black';
    if (s.includes('producción') || s.includes('planta') || s.includes('proceso')) return 'text-orange-700 bg-orange-50 border-orange-200 font-bold';
    if (s.includes('pendiente') || s.includes('cola')) return 'text-amber-700 bg-amber-50 border-amber-200 font-bold';
    return 'text-slate-600 bg-slate-50 border-slate-100 font-medium';
};
export default function OrderDetail({ order, role, onBack }: OrderDetailProps) {
    const [searchTerm, setSearchTerm] = useState('');
    
    const isInternal = role !== 'Externo';
    const normalizedStatus = order.estado_orden.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const showTransitInfo = normalizedStatus.includes('transito') || normalizedStatus.includes('entregada') || normalizedStatus.includes('despachado');
    const showInvoiceInfo = normalizedStatus.includes('entregada') || !!order.numero_factura;

    const filteredItems = order.items
        .filter(item => item.familia?.toUpperCase() !== 'FINANZAS')
        .filter(item => 
            item.descripcion_producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.codigo_producto.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const stats = order.items.reduce((acc, item) => {
        const s = item.estado_orden?.toLowerCase() || '';
        if (s.includes('entregada')) acc.delivered++;
        else if (s.includes('tránsito') || s.includes('despachado')) acc.transit++;
        else if (s.includes('producción') || s.includes('proceso')) acc.production++;
        else acc.pending++;
        return acc;
    }, { pending: 0, production: 0, transit: 0, delivered: 0 });

    return (
        <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Compact Minimalist Header */}
            <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/40">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl transition-all border border-slate-100 active:scale-90"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Pedido #{order.numero_orden_venta}</h2>
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border shadow-sm ${
                                normalizedStatus.includes('entregada') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                normalizedStatus.includes('transito') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                normalizedStatus.includes('produccion') ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                                { (normalizedStatus.includes('transito') && (order.transportador?.toLowerCase().includes('cliente recoge'))) ? 'LISTO PARA RECOGER' : order.estado_orden }
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            <span className="flex items-center gap-1">
                                <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                                {order.fecha_ingreso}
                            </span>
                            <span className="w-0.5 h-0.5 bg-slate-200 rounded-full" />
                            <span className="flex items-center gap-1">
                                <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                OC: {order.numero_orden_compra || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.15em]">Sincronizado</span>
                </div>
            </div>

            {/* Unified Summary Banner - Compact */}
            <div className="bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm mb-4 flex flex-col lg:flex-row items-stretch overflow-hidden">
                {/* Section: Cliente */}
                <div className="flex-[1.2] p-4 flex flex-col justify-center min-w-[250px]">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Cliente</p>
                    <p className="text-xs font-black text-slate-800 leading-tight line-clamp-2 mb-1" title={order.nombre_cliente}>{order.nombre_cliente}</p>
                    <p className="text-[9px] font-bold text-primary">NIT: {order.nit_cliente}</p>
                </div>

                <div className="hidden lg:block w-px bg-slate-50 my-4" />

                {/* Section: Entrega */}
                <div className="flex-1 p-4 flex flex-col justify-center border-t lg:border-t-0 border-slate-50">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Destino</p>
                            <p className="text-[10px] font-black text-slate-700 truncate" title={order.ciudad_destino}>{order.ciudad_destino || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Est. Entrega</p>
                            <p className="text-[10px] font-black text-slate-700">{order.fecha_estimada_entrega || 'Pendiente'}</p>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block w-px bg-slate-50 my-4" />

                {/* Section: Gestión (Internal) */}
                {isInternal && (
                    <>
                        <div className="flex-[1.5] p-4 flex flex-col justify-center border-t lg:border-t-0 border-slate-50 bg-slate-50/20">
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] w-16">Responsable</span>
                                    <p className="text-[10px] font-black text-slate-700 truncate" title={order.vendedor}>{order.vendedor || 'No asignado'}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] w-16 mt-0.5">Sala/Proy</span>
                                    <p className="text-[10px] font-black text-slate-700 leading-tight" title={order.nombre_sala}>{order.nombre_sala || 'General'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="hidden lg:block w-px bg-slate-50 my-4" />
                    </>
                )}

                {/* Section: Resumen de Cantidades (Dark Accent) - Compact */}
                <div className="lg:w-[280px] bg-slate-900 m-1 rounded-xl p-4 text-white relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[8px] font-black uppercase tracking-[0.15em] text-white/50">Cantidades</h3>
                            <div className="px-1.5 py-0.5 bg-white/10 rounded-md border border-white/10 text-[8px] font-black">
                                {order.total_pedida}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {[
                                { label: 'Fac', count: Math.max(0, order.total_facturada), color: 'bg-emerald-500' },
                                { label: 'Des', count: Math.max(0, order.total_despacho), color: 'bg-blue-500' },
                                { label: 'Pro', count: Math.max(0, order.total_produccion), color: 'bg-orange-500' },
                                { label: 'Pen', count: Math.max(0, order.total_planificada), color: 'bg-slate-500' }
                            ].map(stat => (
                                <div key={stat.label} className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-white/30 uppercase mb-0.5">{stat.label}</span>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-1 h-1 rounded-full ${stat.color}`} />
                                        <span className="text-[10px] font-black">{stat.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Full Width Items Table - Compact */}
            <div className="space-y-4">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center border border-primary/10">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Artículos del Pedido</h3>
                        </div>
                        
                        <div className="relative group max-w-xs w-full">
                            <input 
                                type="text" 
                                placeholder="Buscar artículo..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                            />
                            <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-300 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1400px]">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="w-12 px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">IT</th>
                                    <th className="w-32 px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                    <th className="min-w-[280px] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                                    <th className="w-16 px-2 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Ped</th>
                                    <th className="w-16 px-2 py-3 text-[9px] font-black text-emerald-600 uppercase tracking-widest text-center bg-emerald-50/30">Fac</th>
                                    <th className="w-16 px-2 py-3 text-[9px] font-black text-blue-600 uppercase tracking-widest text-center bg-blue-50/30">Desp</th>
                                    <th className="w-16 px-2 py-3 text-[9px] font-black text-orange-600 uppercase tracking-widest text-center bg-orange-50/30">Prod</th>
                                    <th className="w-16 px-2 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center bg-slate-100/30">Plan</th>
                                    {isInternal && <th className="w-24 px-4 py-3 text-[9px] font-black text-violet-600 uppercase tracking-widest text-right">Valor T.</th>}
                                    <th className="w-24 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                    <th className="w-24 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Fecha Prog</th>
                                    <th className="w-24 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Fecha Desp</th>
                                    <th className="w-24 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Fecha Est</th>
                                    <th className="w-40 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Transportador</th>
                                    <th className="w-32 px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Guía</th>
                                    <th className="w-32 px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Factura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredItems.map((item, idx) => {
                                    const itemStatus = (normalizedStatus.includes('entregada') ? 'Entregado' : 
                                                        (normalizedStatus.includes('transito') || normalizedStatus.includes('despachado')) ? 
                                                        (order.transportador?.toLowerCase().includes('cliente recoge') ? 'RECOGER' : 'Tránsito') : 
                                                        (item.estado_produccion || 'Pendiente'));

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-3 py-3 text-[10px] font-bold text-slate-300 text-center">{idx + 1}</td>
                                            <td className="px-3 py-3">
                                                <span className="text-[10px] font-mono font-bold text-slate-400 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg group-hover:bg-white transition-colors">
                                                    {item.codigo_producto}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <p className="text-[11px] font-black text-slate-700 leading-tight truncate" title={item.descripcion_producto}>
                                                    {item.descripcion_producto}
                                                </p>
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <span className="text-[11px] font-black text-slate-800">{item.cantidad_pedida}</span>
                                            </td>
                                            <td className="px-2 py-3 text-center bg-emerald-50/10">
                                                <span className="text-[11px] font-black text-emerald-600">{Math.max(0, item.cantidad_facturada)}</span>
                                            </td>
                                            <td className="px-2 py-3 text-center bg-blue-50/10">
                                                <span className="text-[11px] font-black text-blue-600">{Math.max(0, item.cantidad_despacho)}</span>
                                            </td>
                                            <td className="px-2 py-3 text-center bg-orange-50/10">
                                                <span className="text-[11px] font-black text-orange-600">{Math.max(0, item.cantidad_produccion)}</span>
                                            </td>
                                            <td className="px-2 py-3 text-center bg-slate-50/30">
                                                <span className="text-[11px] font-black text-slate-500">{Math.max(0, item.cantidad_planificada)}</span>
                                            </td>
                                            {isInternal && (
                                                <td className="px-3 py-4 text-[10px] font-black text-violet-600 text-right tabular-nums whitespace-nowrap">
                                                    {item.valor_total ? `$ ${item.valor_total.toLocaleString('es-CO')}` : '--'}
                                                </td>
                                            )}
                                            <td className="px-3 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${
                                                    item.estado_produccion === 'Completo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    item.estado_produccion === 'En Producción' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                    'bg-slate-50 text-slate-500 border-slate-100'
                                                }`}>
                                                    {item.estado_produccion || itemStatus}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-[10px] font-bold text-slate-600 text-center whitespace-nowrap">{item.fecha_plan_despacho || order.fecha_plan_despacho || '--'}</td>
                                            <td className="px-4 py-4 text-[10px] font-bold text-slate-600 text-center whitespace-nowrap">{item.fecha_real_despacho || '--'}</td>
                                            <td className="px-4 py-4 text-[10px] font-bold text-slate-600 text-center whitespace-nowrap">{item.fecha_estimada_entrega || '--'}</td>
                                            <td className="px-3 py-4 text-[10px] font-bold text-slate-500 truncate max-w-[120px]" title={item.transportador}>{item.transportador || order.transportador || '--'}</td>
                                            <td className="px-3 py-3">
                                                <p className="text-[10px] font-mono font-bold text-slate-600 truncate" title={item.numero_guia || order.numero_guia}>
                                                    {item.numero_guia || order.numero_guia || '--'}
                                                </p>
                                            </td>
                                            <td className="px-3 py-3">
                                                <p className="text-[10px] font-black text-primary truncate" title={item.numero_factura || order.numero_factura}>
                                                    {item.numero_factura || order.numero_factura || '--'}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Logistics & Invoicing Secondary Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                    {showTransitInfo && (
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Logística del Pedido
                            </h4>
                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Transporte</span>
                                    <span className="text-[11px] font-black text-slate-700">{order.transportador || 'Pendiente'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Guía Principal</span>
                                    <span className="text-[11px] font-black text-slate-700">{order.numero_guia || 'No emitida'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Salida Real</span>
                                    <span className="text-[11px] font-black text-emerald-600">{order.fecha_real_despacho || '--'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {showInvoiceInfo && (
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Datos de Facturación
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Factura #</span>
                                    <span className="text-[11px] font-black text-slate-700">{order.numero_factura || 'En proceso'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fecha Factura</span>
                                    <span className="text-[11px] font-black text-slate-700">{order.fecha_factura || '--'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
