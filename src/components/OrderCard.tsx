import { Order } from '@/types';

interface OrderCardProps {
    order: Order;
    onClick: (order: Order) => void;
}

const getStatusStyles = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('entregada')) return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        indicator: 'bg-emerald-500',
        shadow: 'shadow-emerald-100/50'
    };
    if (s.includes('tránsito') || s.includes('despachado')) return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        indicator: 'bg-blue-500',
        shadow: 'shadow-blue-100/50'
    };
    if (s.includes('producción') || s.includes('proceso')) return {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        indicator: 'bg-orange-500',
        shadow: 'shadow-orange-100/50'
    };
    if (s.includes('pendiente')) return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        indicator: 'bg-amber-500',
        shadow: 'shadow-amber-100/50'
    };
    return {
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
        indicator: 'bg-slate-400',
        shadow: 'shadow-slate-100/50'
    };
};

export default function OrderCard({ order, onClick }: OrderCardProps) {
    const styles = getStatusStyles(order.estado_orden);

    const formatValue = (val: any) => (val === null || val === undefined || String(val).toUpperCase() === 'NULL' || String(val).trim() === '') ? 'N/A' : val;

    const itemsDelivered = order.items.filter(i => i.estado_orden?.toLowerCase().includes('entregada')).length;
    const progressPercent = order.items.length > 0 ? (itemsDelivered / order.items.length) * 100 : 0;

    return (
        <div
            onClick={() => onClick(order)}
            className="group bg-white rounded-[1.25rem] border border-slate-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col relative active:scale-[0.98]"
        >
            {/* Progress Bar (Critic suggestion) */}
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-50 overflow-hidden">
                <div 
                    className={`h-full ${styles.indicator} transition-all duration-1000 ease-in-out shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            <div className="flex flex-col md:flex-row flex-grow py-5 px-6 md:items-center justify-between gap-4">
                
                {/* ID Section */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none text-nowrap">Orden de Venta</span>
                        <div className={`w-1 h-1 rounded-full ${styles.indicator}`} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <h3 className="text-2xl font-black text-primary tracking-tighter group-hover:translate-x-1 transition-transform duration-300">
                            {formatValue(order.numero_orden_venta)}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                        <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md">OC: {formatValue(order.numero_orden_compra)}</span>
                    </div>
                </div>

                {/* Client Info */}
                <div className="flex-[1.5] min-w-0 md:border-l md:border-slate-50 md:pl-6">
                    <div className="flex items-center gap-1.5 mb-1 text-nowrap">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Cliente</span>
                    </div>
                    <p className="text-base font-black text-primary truncate leading-tight mb-1.5">
                        {formatValue(order.nombre_cliente)}
                    </p>
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase">
                            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {order.ciudad_destino || 'N/A'}
                        </div>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-200" />
                        <span className="text-[9px] font-bold text-slate-400">NIT: {formatValue(order.nit_cliente)}</span>
                    </div>
                </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 md:border-l md:border-slate-50 md:pl-6 min-w-[140px]">
                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] border transition-all ${styles.bg} ${styles.text} ${styles.border} shadow-sm group-hover:shadow-md w-full md:w-auto text-center truncate`}>
                            {order.estado_orden}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-primary/40 uppercase tracking-tighter whitespace-nowrap">
                                {order.items.length} ítems
                            </span>
                        </div>
                    </div>
            </div>

            {/* Hover Arrow Indicator (Optional/Compact) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:group-hover:flex opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                <svg className="w-4 h-4 text-primary/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </div>
    );
}
