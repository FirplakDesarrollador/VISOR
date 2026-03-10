import { Order } from '@/types';
import { useMemo, useState } from 'react';

interface DashboardProps {
    orders: Order[];
}

export default function Dashboard({ orders }: DashboardProps) {
    // --- Filters ---
    const [filterCity, setFilterCity] = useState<string>('Todas');
    const [filterCarrier, setFilterCarrier] = useState<string>('Todas');
    const [filterAdvisor, setFilterAdvisor] = useState<string>('Todos');
    const [filterState, setFilterState] = useState<string>('Todos');

    // --- Options for Filters ---
    const filterOptions = useMemo(() => {
        const cities = new Set<string>();
        const carriers = new Set<string>();
        const advisors = new Set<string>();
        const states = new Set<string>();

        orders.forEach(o => {
            if (o.ciudad_destino) cities.add(o.ciudad_destino);
            if (o.transportador) carriers.add(o.transportador);
            if (o.vendedor) advisors.add(o.vendedor);
            if (o.estado_orden) states.add(o.estado_orden);
        });

        return {
            cities: ['Todas', ...Array.from(cities).sort()],
            carriers: ['Todas', ...Array.from(carriers).sort()],
            advisors: ['Todos', ...Array.from(advisors).sort()],
            states: ['Todos', ...Array.from(states).sort()],
        };
    }, [orders]);

    // --- Filtered Data ---
    const filteredData = useMemo(() => {
        return orders.filter(o => {
            const matchCity = filterCity === 'Todas' || o.ciudad_destino === filterCity;
            const matchCarrier = filterCarrier === 'Todas' || o.transportador === filterCarrier;
            const matchAdvisor = filterAdvisor === 'Todos' || o.vendedor === filterAdvisor;
            const matchState = filterState === 'Todos' || o.estado_orden === filterState;
            return matchCity && matchCarrier && matchAdvisor && matchState;
        });
    }, [orders, filterCity, filterCarrier, filterAdvisor, filterState]);

    // --- Complex Analytics Engine ---
    const analytics = useMemo(() => {
        const now = new Date();
        
        // Helper para fechas latinas (DD/MM/YYYY) o estándar
        const parseSafeDate = (dateStr: string | null | undefined) => {
            if (!dateStr) return null;
            if (dateStr.includes('/')) {
                const [d, m, y] = dateStr.split('/');
                return new Date(`${y}-${m}-${d}`);
            }
            return new Date(dateStr);
        };

        const stats = {
            totalOrders: filteredData.length,
            totalUnits: 0,
            onTimeDespacho: 0,
            lateDespacho: 0,
            onTimeEntrega: 0,
            totalLeadTimeIngresoDespacho: 0,
            countIngresoDespacho: 0,
            
            byState: {} as Record<string, number>,
            byCity: {} as Record<string, { total: number, late: number, transit: number, blocked: number }>,
            byAdvisor: {} as Record<string, { total: number, delivered: number, transit: number, blocked: number }>,
            byCarrier: {} as Record<string, { total: number, onTime: number, totalDays: number, countDays: number }>,
            
            // Nueva métrica: Promedio por RUTA (Transportador + Ciudad)
            avgByRoute: {} as Record<string, { totalDays: number, count: number }>,
            
            alerts: [] as string[],
            inTransitDetails: [] as any[],
            dataIssues: [] as string[]
        };

        // Primera pasada: Calcular promedios históricos de rutas (usando TODAS las órdenes para tener base estadística)
        orders.forEach(o => {
            if (o.fecha_real_despacho && o.fecha_entrega && o.transportador && o.ciudad_destino) {
                const desp = parseSafeDate(o.fecha_real_despacho);
                const entr = parseSafeDate(o.fecha_entrega);
                if (desp && entr && !isNaN(desp.getTime()) && !isNaN(entr.getTime())) {
                    const lead = (entr.getTime() - desp.getTime()) / (1000 * 60 * 60 * 24);
                    const routeKey = `${o.transportador}-${o.ciudad_destino}`;
                    if (!stats.avgByRoute[routeKey]) stats.avgByRoute[routeKey] = { totalDays: 0, count: 0 };
                    stats.avgByRoute[routeKey].totalDays += lead;
                    stats.avgByRoute[routeKey].count++;
                }
            }
        });

        // Segunda pasada: Procesar data filtrada para dashboard
        filteredData.forEach(o => {
            stats.totalUnits += o.total_pedida;

            // 1. Data Quality Check
            if (o.total_pedida < 0) stats.dataIssues.push(`OV ${o.numero_orden_venta}: Cantidad negativa detectada.`);
            const pIngreso = parseSafeDate(o.fecha_ingreso);
            const pDespacho = parseSafeDate(o.fecha_real_despacho);
            if (pDespacho && pIngreso && pDespacho < pIngreso) {
                stats.dataIssues.push(`OV ${o.numero_orden_venta}: Fecha despacho anterior a ingreso.`);
            }

            // 2. State Distribution
            const state = o.estado_orden || 'Sin Estado';
            stats.byState[state] = (stats.byState[state] || 0) + 1;

            // 3. SLA Despacho
            if (o.fecha_ingreso && (o.fecha_real_despacho || o.fecha_plan_despacho)) {
                const ingreso = parseSafeDate(o.fecha_ingreso);
                const compareDate = o.fecha_real_despacho ? parseSafeDate(o.fecha_real_despacho) : new Date();
                const plan = parseSafeDate(o.fecha_plan_despacho);
                
                if (ingreso && compareDate && plan) {
                    if (compareDate <= plan) stats.onTimeDespacho++;
                    else stats.lateDespacho++;

                    if (o.fecha_real_despacho) {
                        stats.totalLeadTimeIngresoDespacho += (compareDate.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24);
                        stats.countIngresoDespacho++;
                    }
                }
            }

            // 4. City Analysis
            const city = o.ciudad_destino || 'Desconocida';
            if (!stats.byCity[city]) stats.byCity[city] = { total: 0, late: 0, transit: 0, blocked: 0 };
            stats.byCity[city].total++;
            const pPlan = parseSafeDate(o.fecha_plan_despacho);
            if (pPlan && now > pPlan && !o.fecha_entrega) stats.byCity[city].late++;
            if (state.toLowerCase().includes('transito')) stats.byCity[city].transit++;
            if (state.toLowerCase().includes('bloqueo')) stats.byCity[city].blocked++;

            // 5. Advisor Analysis
            const advisor = o.vendedor || 'Sin Asesor';
            if (!stats.byAdvisor[advisor]) stats.byAdvisor[advisor] = { total: 0, delivered: 0, transit: 0, blocked: 0 };
            stats.byAdvisor[advisor].total++;
            if (state.toLowerCase().includes('entregada')) stats.byAdvisor[advisor].delivered++;
            if (state.toLowerCase().includes('transito')) stats.byAdvisor[advisor].transit++;
            if (state.toLowerCase().includes('bloqueo')) stats.byAdvisor[advisor].blocked++;

            // 6. Carrier Analysis
            const carrier = o.transportador || 'Sin Transportador';
            if (!stats.byCarrier[carrier]) stats.byCarrier[carrier] = { total: 0, onTime: 0, totalDays: 0, countDays: 0 };
            stats.byCarrier[carrier].total++;
            if (o.fecha_real_despacho && o.fecha_entrega) {
                const desp = parseSafeDate(o.fecha_real_despacho);
                const entr = parseSafeDate(o.fecha_entrega);
                if (desp && entr) {
                    const lead = (entr.getTime() - desp.getTime()) / (1000 * 60 * 60 * 24);
                    stats.byCarrier[carrier].totalDays += lead;
                    stats.byCarrier[carrier].countDays++;
                    const estEntrega = parseSafeDate(o.fecha_estimada_entrega);
                    if (estEntrega && entr <= estEntrega) stats.byCarrier[carrier].onTime++;
                }
            }

            // 7. Alerts & In Transit Risk (Comparativa Ruta)
            if (state.toLowerCase().includes('transito')) {
                const pStart = parseSafeDate(o.fecha_real_despacho || o.fecha_plan_despacho);
                if (pStart) {
                    const days = (now.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24);
                    const routeKey = `${o.transportador}-${o.ciudad_destino}`;
                    const routeAvgObj = stats.avgByRoute[routeKey];
                    const routeAvg = routeAvgObj ? (routeAvgObj.totalDays / routeAvgObj.count) : 3;

                    stats.inTransitDetails.push({
                        ov: o.numero_orden_venta,
                        city: o.ciudad_destino,
                        carrier: o.transportador,
                        days: Math.floor(days),
                        routeAvg: routeAvg.toFixed(1),
                        risk: days > (routeAvg + 2) // Riesgo si excede el promedio + 2 días
                    });
                    if (days > (routeAvg + 3)) stats.alerts.push(`OV ${o.numero_orden_venta} supera en +3 días el promedio de ${carrier} a ${city}.`);
                }
            }
            if (state.toLowerCase().includes('bloqueo')) {
                stats.alerts.push(`Bloqueo recurrente en OV ${o.numero_orden_venta} (${advisor}).`);
            }
        });

        return stats;
    }, [filteredData, orders]);

    const otifDespacho = analytics.totalOrders > 0 ? (analytics.onTimeDespacho / analytics.totalOrders) * 100 : 0;
    const avgLeadCycle = analytics.countIngresoDespacho > 0 ? (analytics.totalLeadTimeIngresoDespacho / analytics.countIngresoDespacho).toFixed(1) : '0';

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-700">
            {/* --- Section 0: Filters --- */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center">
                         <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </div>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Filtros Avanzados del Dashboard</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Ciudad', value: filterCity, setter: setFilterCity, options: filterOptions.cities },
                        { label: 'Transportador', value: filterCarrier, setter: setFilterCarrier, options: filterOptions.carriers },
                        { label: 'Asesor Comercial', value: filterAdvisor, setter: setFilterAdvisor, options: filterOptions.advisors },
                        { label: 'Estado de Orden', value: filterState, setter: setFilterState, options: filterOptions.states }
                    ].map(f => (
                        <div key={f.label} className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{f.label}</label>
                            <select 
                                value={f.value} 
                                onChange={(e) => f.setter(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-primary outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none cursor-pointer"
                            >
                                {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Section 1: KPIs Generales --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Cumplimiento Despacho', value: `${otifDespacho.toFixed(1)}%`, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-emerald-500', sub: 'OTIF (vs Planificado)' },
                    { label: 'Lead Time Operativo', value: avgLeadCycle, unit: 'Días', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-blue-500', sub: 'Ingreso a Despacho Real' },
                    { label: 'Órdenes Activas', value: analytics.totalOrders, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'bg-primary', sub: 'En proceso actual' },
                    { label: 'Unidades Totales', value: analytics.totalUnits.toLocaleString(), icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'bg-orange-500', sub: 'Carga total de productos' }
                ].map((kpi, i) => (
                    <div key={i} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 group hover:-translate-y-1 transition-all duration-300">
                        <div className={`w-12 h-12 rounded-2xl ${kpi.color}/10 flex items-center justify-center mb-5 border border-${kpi.color}/10`}>
                            <svg className={`w-6 h-6 text-${kpi.color === 'bg-primary' ? 'primary' : kpi.color.replace('bg-', '')}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={kpi.icon} />
                            </svg>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">{kpi.label}</h4>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">{kpi.value}</span>
                            {kpi.unit && <span className="text-[10px] font-black text-slate-400 tracking-widest">{kpi.unit}</span>}
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-4 italic">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* --- Section 2 & 3: Cumplimiento y Estados --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Estados de pedidos */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                    <h3 className="text-xl font-black text-primary tracking-tight mb-8">Estructura de la Operación</h3>
                    <div className="space-y-4">
                        {Object.entries(analytics.byState).sort((a,b) => b[1] - a[1]).map(([state, count]) => (
                            <div key={state} className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">{state}</span>
                                    <span className="text-primary">{count} órdenes</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                    <div 
                                        className="h-full bg-primary transition-all duration-1000 shadow-sm"
                                        style={{ width: `${(count / analytics.totalOrders) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Performance por Transportador */}
                <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group text-white">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-20" />
                    <h3 className="text-xl font-black tracking-tight mb-8 relative z-10">Eficiencia de Transportadores</h3>
                    <div className="space-y-4 relative z-10">
                        {Object.entries(analytics.byCarrier).sort((a,b) => b[1].total - a[1].total).slice(0, 5).map(([name, data]) => (
                            <div key={name} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-widest">{name}</span>
                                    <span className="text-[10px] text-white/40 font-bold">{data.total} envíos gestionados</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-blue-400 text-sm font-black">
                                        {data.countDays > 0 ? (data.totalDays / data.countDays).toFixed(1) : '---'} <span className="text-[9px]">DÍAS</span>
                                    </div>
                                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">Lead Time Prom.</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Section 4 & 5: Ciudad y Asesor --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking Asesores */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                    <h3 className="text-xl font-black text-primary tracking-tight mb-8">Ranking de Desempeño Comercial</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                    <th className="pb-4 text-left">Asesor</th>
                                    <th className="pb-4 text-center">Total</th>
                                    <th className="pb-4 text-center">Entregados</th>
                                    <th className="pb-4 text-center">Bloqueos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {Object.entries(analytics.byAdvisor).sort((a,b) => b[1].total - a[1].total).slice(0, 6).map(([name, data]) => (
                                    <tr key={name} className="group">
                                        <td className="py-4 text-xs font-black text-slate-700">{name}</td>
                                        <td className="py-4 text-center text-xs font-bold text-slate-400">{data.total}</td>
                                        <td className="py-4 text-center">
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-lg border border-emerald-100">
                                                {((data.delivered / data.total) * 100).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="py-4 text-center">
                                            <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg border ${data.blocked > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {data.blocked}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mapa de Calor Ciudades */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                    <h3 className="text-xl font-black text-primary tracking-tight mb-8">Análisis Geográfico de Cumplimiento</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(analytics.byCity).sort((a,b) => b[1].total - a[1].total).slice(0, 8).map(([city, data]) => (
                            <div key={city} className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 group hover:bg-primary hover:border-primary transition-all duration-300">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-white/60">{city}</div>
                                <div className="flex justify-between items-end">
                                    <div className="text-xl font-black text-primary group-hover:text-white">{data.total} <span className="text-[10px] opacity-40">pedidos</span></div>
                                    <div className={`text-[10px] font-black ${data.late > 0 ? 'text-red-500 group-hover:text-red-200' : 'text-emerald-500 group-hover:text-emerald-200'}`}>
                                        {data.late} retrasos
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Section 6: In Transit Details --- */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/40">
                <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/10">
                            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-primary tracking-tight leading-none">Visión Operativa en Tránsito</h3>
                            <p className="text-xs font-medium text-slate-400 mt-1">Monitoreo de carga movilizada actualmente.</p>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {analytics.inTransitDetails.length} ÓRDENES EN RUTA
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {analytics.inTransitDetails.slice(0, 9).map((track: any) => (
                        <div key={track.ov} className={`p-6 rounded-3xl border transition-all ${track.risk ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-sm font-black text-primary">OV: #{track.ov}</span>
                                {track.risk && (
                                    <span className="flex items-center gap-1 text-[8px] font-black text-red-600 uppercase tracking-widest bg-white px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                        Riesgo Alto
                                    </span>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {track.city}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {track.carrier}
                                </div>
                                <div className="pt-3 border-t border-black/5 flex flex-col gap-1">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Días Transcurridos</span>
                                        <span className={`text-xl font-black ${track.risk ? 'text-red-700' : 'text-primary'}`}>{track.days}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline px-2 py-1 bg-white/50 rounded-lg border border-black/5">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Promedio Histórico Ruta</span>
                                        <span className="text-[10px] font-black text-slate-600">{track.routeAvg} días</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Section 7: Alertas y Calidad --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Alertas Inteligentes */}
                <div className="bg-red-600 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <h3 className="text-xl font-black tracking-tight mb-8 relative z-10 flex items-center gap-3">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Alertas Operativas Críticas
                    </h3>
                    <div className="space-y-3 relative z-10 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {analytics.alerts.length > 0 ? analytics.alerts.map((alert, i) => (
                            <div key={i} className="p-4 bg-white/10 rounded-2xl border border-white/10 text-xs font-bold backdrop-blur-sm">
                                {alert}
                            </div>
                        )) : (
                            <p className="text-white/60 font-medium italic text-center py-10">Sin alertas críticas detectadas.</p>
                        )}
                    </div>
                </div>

                {/* Calidad de Datos */}
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 shadow-inner">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight mb-8 flex items-center gap-3">
                         <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 21a11.955 11.955 0 01-9.618-7.016m18.236-4.016a11.955 11.955 0 00-6.618-6.984m-8 0A11.955 11.955 0 003.382 9.984" />
                        </svg>
                        Auditoría de Integridad
                    </h3>
                    <div className="space-y-2 overflow-y-auto max-h-64 pr-2">
                        {analytics.dataIssues.length > 0 ? analytics.dataIssues.map((issue, i) => (
                            <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-slate-500 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                {issue}
                            </div>
                        )) : (
                            <div className="text-center py-10">
                                <div className="text-emerald-500 font-black text-sm uppercase tracking-widest mb-1">DATA INTEGRITY 100%</div>
                                <p className="text-slate-400 text-xs font-medium">Sin anomalías detectadas en la base actual.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
            `}</style>
        </div>
    );
}
