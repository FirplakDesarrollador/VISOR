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
        <div className="bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(51,68,84,0.15)] overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-700">
            {/* Header Section */}
            <div className="bg-primary px-8 py-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Detalle de Pedido</span>
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
                                    normalizedStatus.includes('entregada') ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                    (normalizedStatus.includes('transito') && (order.transportador?.toLowerCase().includes('cliente recoge'))) ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                    normalizedStatus.includes('transito') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                    normalizedStatus.includes('produccion') ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                    'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                }`}>
                                    { (normalizedStatus.includes('transito') && (order.transportador?.toLowerCase().includes('cliente recoge'))) ? 'LISTO PARA RECOGER' : order.estado_orden }
                                </span>
                            </div>
                            <h2 className="text-4xl font-black text-white tracking-tighter leading-none mt-1">OV: {order.numero_orden_venta}</h2>
                            <p className="text-white/70 text-xs font-bold mt-2.5 flex items-center gap-2">
                                <span className="opacity-50 uppercase tracking-widest text-[10px]">Generado el</span> {order.fecha_ingreso} 
                                <span className="w-1 h-1 bg-white/20 rounded-full" />
                                <span className="opacity-50 uppercase tracking-widest text-[10px]">OC:</span> {order.numero_orden_compra || 'N/A'}
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/20 font-black text-[9px] uppercase tracking-widest backdrop-blur-sm self-start md:self-center shadow-lg active:scale-95"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Volver
                    </button>
                </div>
            </div>

      <div className="p-6 md:p-8 space-y-8">
                {/* 1️⃣ Top Section: Dynamic Visibility (Balance & Timeline) */}
                <div className={`grid grid-cols-1 ${(!( (normalizedStatus.includes('transito') || normalizedStatus.includes('entregada') || normalizedStatus.includes('despachado')) && order.total_produccion === 0 && order.total_planificada === 0 && order.total_despacho === 0)) ? 'lg:grid-cols-12' : ''} gap-6 items-stretch`}>
                    {/* Conditional Balance */}
                    {!( (normalizedStatus.includes('transito') || normalizedStatus.includes('entregada') || normalizedStatus.includes('despachado')) && 
                        order.total_produccion === 0 && 
                        order.total_planificada === 0 &&
                        order.total_despacho === 0
                      ) && (
                        <div className="lg:col-span-5 bg-primary rounded-[2.5rem] p-6 text-white shadow-2xl shadow-primary/20 relative overflow-hidden group animate-in slide-in-from-top duration-700 flex flex-col justify-center">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                                            <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-black text-white tracking-tight">Balance</h3>
                                    </div>
                                    <div className="px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 flex items-center gap-2">
                                        <span className="text-[8px] font-black uppercase text-white/50 tracking-widest leading-none">PEDIDO</span>
                                        <span className="text-sm font-black leading-none">{order.total_pedida}</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Entregado', count: Math.max(0, order.total_facturada), color: 'bg-blue-400' },
                                        { label: 'En Tránsito', count: Math.max(0, order.total_despacho), color: 'bg-emerald-400' },
                                        { label: 'Producción', count: Math.max(0, order.total_produccion), color: 'bg-orange-400' },
                                        { label: 'Pendiente', count: Math.max(0, order.total_planificada), color: 'bg-slate-400' }
                                    ].map(stat => (
                                        <div key={stat.label} className="flex flex-col gap-1 p-4 bg-white/10 rounded-2xl border border-white/5 backdrop-blur-md hover:bg-white/20 transition-all duration-300">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${stat.color} animate-pulse`} />
                                                <span className="text-[8px] font-black uppercase text-white/70 tracking-widest">{stat.label}</span>
                                            </div>
                                            <span className="text-2xl font-black">{stat.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Visual Progress Stepper */}
                    <div className={`${(!( (normalizedStatus.includes('transito') || normalizedStatus.includes('entregada') || normalizedStatus.includes('despachado')) && order.total_produccion === 0 && order.total_planificada === 0 && order.total_despacho === 0)) ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20 relative overflow-hidden group/stepper flex flex-col justify-center h-full`}>
                        <div className="absolute -bottom-20 right-0 w-80 h-80 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover/stepper:scale-110 transition-transform duration-1000" />
                        <div className="relative z-10 w-full">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shadow-inner">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Estatus en Tiempo Real</h4>
                                    <h3 className="text-xl font-black text-primary tracking-tight leading-none">Flujo del Pedido</h3>
                                </div>
                            </div>
                            
                            <div className="relative flex-grow py-4">
                                {/* Background wire */}
                                <div className="absolute top-8 left-0 w-full h-1 bg-slate-100 z-0 rounded-full" />
                                
                                {/* Progress wire */}
                                <div 
                                    className="absolute top-8 left-0 h-1 bg-primary z-0 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(51,68,84,0.3)] rounded-full"
                                    style={{
                                        width: normalizedStatus.includes('entregada') ? '100%' :
                                                normalizedStatus.includes('transito') ? '66%' :
                                                normalizedStatus.includes('produccion') ? '33%' : '0%'
                                    }}
                                />
         
                                <div className="relative z-10 flex justify-between px-4">
                                    {[
                                        { id: 'recibida', label: 'Recibida', active: true },
                                        { id: 'produccion', label: 'Planta', active: normalizedStatus.includes('produccion') || normalizedStatus.includes('transito') || normalizedStatus.includes('entregada') },
                                        { id: 'transito', label: 'Tránsito', active: normalizedStatus.includes('transito') || normalizedStatus.includes('entregada') },
                                        { id: 'entregada', label: 'Entregada', active: normalizedStatus.includes('entregada') }
                                    ].map((step) => (
                                        <div key={step.id} className="flex flex-col items-center">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-[4px] transition-all duration-700 bg-white ${
                                                step.active 
                                                ? 'border-primary shadow-2xl shadow-primary/20 scale-110' 
                                                : 'border-slate-50 text-slate-200'
                                            }`}>
                                                {step.active ? (
                                                    <div className="w-4 h-4 bg-primary rounded-full animate-pulse shadow-[0_0_12px_rgba(51,68,84,0.5)]" />
                                                ) : (
                                                    <div className="w-2.5 h-2.5 bg-slate-100 rounded-full" />
                                                )}
                                            </div>
                                            <span className={`mt-4 text-[9px] font-black uppercase tracking-[0.3em] transition-colors ${step.active ? 'text-primary' : 'text-slate-300'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Client, Logistics & Commercial */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* 2️⃣ Información del Cliente */}
                        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2.5">
                                <div className="p-1.5 bg-slate-50 rounded-lg">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                Información del Cliente
                            </h4>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-2xl font-black text-primary leading-tight tracking-tight">{order.nombre_cliente}</p>
                                    <div className="inline-flex mt-4 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-widest shadow-sm">
                                        NIT: {order.nit_cliente}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3️⃣ Información Logística */}
                        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2.5">
                                <div className="p-1.5 bg-slate-50 rounded-lg">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                Logística del Envío
                            </h4>
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Destino</p>
                                        <p className="text-sm font-black text-primary truncate" title={order.ciudad_destino}>{order.ciudad_destino || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Est. Entrega</p>
                                        <p className="text-sm font-black text-primary">{order.fecha_estimada_entrega || 'Pendiente'}</p>
                                    </div>
                                </div>
                                
                                <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between group/dispatch">
                                    <div className="flex flex-col">
                                        <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Estado Despacho</p>
                                        <p className="text-sm font-black text-emerald-700">{order.estado_despacho || 'No iniciado'}</p>
                                    </div>
                                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover/dispatch:scale-110 transition-transform">
                                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4️⃣ Información Comercial */}
                        {isInternal && (
                            <div className="bg-slate-50/30 rounded-[2rem] p-8 border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2.5">
                                    <div className="p-1.5 bg-white shadow-sm rounded-lg">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    Información Comercial
                                </h4>
                                <div className="space-y-6">
                                    {[
                                        { label: 'Sala / Proyecto', value: order.nombre_sala },
                                        { label: 'Vendedor Responsable', value: order.vendedor }
                                    ].map(item => item.value && (
                                        <div key={item.label} className="group/item">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                            <p className="text-sm font-bold text-primary group-hover/item:text-primary-light transition-colors">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Products Table */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Products Table */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
                            <div className="px-8 py-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-primary tracking-tight">Ítems del Pedido</h3>
                                        <p className="text-slate-400 text-xs font-bold">{filteredItems.length} productos listados</p>
                                    </div>
                                </div>
                                
                                <div className="relative group max-w-sm w-full">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por código o descripción..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-[1.25rem] text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all shadow-sm"
                                    />
                                    <svg className="w-5 h-5 absolute left-4 top-4 text-slate-300 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            <div className="min-h-[400px]">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur-md">
                                        <tr>
                                            <th className="w-[35%] px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-50">Descripción del Producto</th>
                                            <th className="w-[10%] px-2 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-50 text-center">Cant.</th>
                                            <th className="w-[30%] px-2 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-50 text-center">Distribución Logística</th>
                                            <th className="w-[25%] px-6 py-5 d-none md:table-cell text-xs font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-50 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-all duration-300 group">
                                                <td className="px-6 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-base font-black text-primary group-hover:text-primary-light transition-colors leading-snug whitespace-normal">{item.descripcion_producto}</span>
                                                        <div className="flex items-center gap-3 mt-2.5">
                                                            <span className="text-[11px] font-mono font-bold text-slate-400 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">{item.codigo_producto}</span>
                                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 flex items-center gap-2 shadow-sm">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                DESPACHO: {order.fecha_plan_despacho}
                                                            </span>
                                                            {item.numero_guia && item.numero_guia !== 'NULL' && item.numero_guia !== '' && (
                                                                <span 
                                                                    className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-2 shadow-sm max-w-[160px] sm:max-w-[200px]"
                                                                    title={`Guía: ${item.numero_guia}`}
                                                                >
                                                                    <span className="truncate">GUÍA: {item.numero_guia}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-6 text-center align-top pt-7">
                                                    <span className="inline-flex items-center justify-center min-w-[3rem] h-12 px-4 bg-slate-50 text-primary text-base font-black border border-slate-200 rounded-[1rem] shadow-inner mt-1">
                                                        {item.cantidad_pedida}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-6">
                                                    {(() => {
                                                        const isOrderInTransit = normalizedStatus.includes('transito') || normalizedStatus.includes('despachado');
                                                        const isOrderDelivered = normalizedStatus.includes('entregada');
                                                        
                                                        let progressWidths = {
                                                            facturada: (Math.max(0, item.cantidad_facturada) / item.cantidad_pedida) * 100,
                                                            despacho: (Math.max(0, item.cantidad_despacho) / item.cantidad_pedida) * 100,
                                                            produccion: (Math.max(0, item.cantidad_produccion) / item.cantidad_pedida) * 100,
                                                            planificada: (Math.max(0, item.cantidad_planificada) / item.cantidad_pedida) * 100
                                                        };

                                                        if (isOrderDelivered) {
                                                            progressWidths = { facturada: 100, despacho: 0, produccion: 0, planificada: 0 };
                                                        } else if (isOrderInTransit) {
                                                            progressWidths = { facturada: 0, despacho: 100, produccion: 0, planificada: 0 };
                                                        }

                                                        return (
                                                            <div className="flex flex-col gap-3.5">
                                                                <div className="flex flex-wrap gap-2 justify-center">
                                                                    {Math.max(0, item.cantidad_facturada) > 0 && (
                                                                        <span className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[11px] font-black rounded-xl border border-blue-100 uppercase shadow-sm">E: {Math.max(0, item.cantidad_facturada)}</span>
                                                                    )}
                                                                    {Math.max(0, item.cantidad_despacho) > 0 && (
                                                                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[11px] font-black rounded-xl border border-emerald-100 uppercase shadow-sm">L: {Math.max(0, item.cantidad_despacho)}</span>
                                                                    )}
                                                                    {Math.max(0, item.cantidad_produccion) > 0 && (
                                                                        <span className="px-3 py-1.5 bg-orange-50 text-orange-600 text-[11px] font-black rounded-xl border border-orange-100 uppercase shadow-sm">P: {Math.max(0, item.cantidad_produccion)}</span>
                                                                    )}
                                                                    {Math.max(0, item.cantidad_planificada) > 0 && (
                                                                        <span className="px-3 py-1.5 bg-slate-50 text-slate-500 text-[11px] font-black rounded-xl border border-slate-100 uppercase shadow-sm">C: {Math.max(0, item.cantidad_planificada)}</span>
                                                                    )}
                                                                    
                                                                    {(isOrderInTransit || isOrderDelivered) && 
                                                                     Math.max(0, item.cantidad_facturada) === 0 && 
                                                                     Math.max(0, item.cantidad_despacho) === 0 && (
                                                                        <span className={`px-3 py-1.5 ${isOrderDelivered ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} text-[11px] font-black rounded-xl border uppercase shadow-sm`}>
                                                                            {isOrderDelivered ? 'E' : 'L'}: {item.cantidad_pedida}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {item.cantidad_pedida > 0 && (
                                                                    <div className="w-full max-w-[180px] mx-auto h-2 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                                                        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progressWidths.facturada}%` }} />
                                                                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${progressWidths.despacho}%` }} />
                                                                        <div className="h-full bg-orange-400 transition-all duration-700" style={{ width: `${progressWidths.produccion}%` }} />
                                                                        <div className="h-full bg-slate-300 transition-all duration-700" style={{ width: `${progressWidths.planificada}%` }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-6 d-none md:table-cell text-center">
                                                    {(() => {
                                                        let displayStatus = item.estado_produccion || 'Pendiente';
                                                        if (normalizedStatus.includes('entregada')) {
                                                            displayStatus = 'Entregado';
                                                        } else if (normalizedStatus.includes('transito') || normalizedStatus.includes('despachado')) {
                                                            displayStatus = order.transportador?.toLowerCase().includes('cliente recoge') ? 'LISTO PARA RECOGER' : 'En Tránsito';
                                                        }

                                                        return (
                                                            <span className={`inline-block whitespace-nowrap px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-md hover:scale-105 ${getStatusColor(displayStatus)}`}>
                                                                {displayStatus}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredItems.length === 0 && (
                                    <div className="py-32 text-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                                            <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-base font-black text-slate-400 uppercase tracking-widest">No se encontraron productos</p>
                                        <p className="text-slate-300 text-xs font-bold mt-1">Intenta con otro término de búsqueda</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Logistics Section */}
                        {showTransitInfo && (
                            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight leading-none mb-1">
                                                {order.numero_guia === 'DESPACHOS MÚLTIPLES' ? 'Despachos Múltiples' : 'Logística de Despacho'}
                                            </h3>
                                            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                                                {order.numero_guia === 'DESPACHOS MÚLTIPLES' ? 'Trazabilidad por ítem' : 'Envio Nacional Firplak'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                                    {[
                                        { label: 'Transportadora', value: order.transportador || 'Pendiente', iconPath: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                                        { label: 'Guía de Seguimiento', value: order.numero_guia || 'En Proceso', iconPath: 'M7 7h.01M7 11h.01M7 15h.01M13 7h.01M13 11h.01M13 15h.01M17 7h.01M17 11h.01M17 15h.01' },
                                        { label: 'Salida de Bodega', value: order.fecha_real_despacho || '-- / --', iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                                        { 
                                            label: order.fecha_entrega ? 'Fecha Real de Entrega' : 'Llegada Estimada', 
                                            value: order.fecha_entrega || order.fecha_estimada_entrega || 'Pendiente', 
                                            iconPath: order.fecha_entrega 
                                                ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' 
                                                : 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' 
                                        }
                                    ].map(item => (
                                        <div key={item.label} className="bg-white/5 p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-2 mb-3">
                                                <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.iconPath} />
                                                </svg>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 truncate">{item.label}</span>
                                            </div>
                                            <p 
                                                className="text-sm xl:text-base font-black tracking-tight leading-tight break-all" 
                                                title={String(item.value)}
                                            >
                                                {item.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Invoice & Billing Section */}
                        {showInvoiceInfo && (
                            <div className="bg-emerald-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-emerald-200 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-40 -mt-40 group-hover:scale-110 transition-transform duration-1000" />
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-md">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight leading-none mb-1">Facturación</h3>
                                            <p className="text-emerald-100 text-xs font-bold opacity-80 uppercase tracking-widest">Detalles contables del pedido</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-6 max-w-md w-full">
                                        <div className="bg-white/10 p-5 rounded-3xl border border-white/10 text-center flex-1">
                                            <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1"># de Factura</p>
                                            <p className="text-2xl font-black tracking-tighter">{order.numero_factura || 'En Proceso'}</p>
                                        </div>
                                        <div className="bg-white/10 p-5 rounded-3xl border border-white/10 text-center flex-1">
                                            <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1">Fecha Emisión</p>
                                            <p className="text-xl font-black tracking-tighter">{order.fecha_factura || '-- / --'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
