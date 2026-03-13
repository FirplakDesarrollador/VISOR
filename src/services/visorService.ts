import { supabase } from './supabase';
import { Order, OrderItem, VisorRow, UserRole } from '@/types';

export const getOrdersFromVisor = async (role: UserRole, vendedorFilter?: string): Promise<Order[]> => {
    // In a real scenario, we might filter by role or vendor here
    let query = supabase.from('VISOR')
        .select('*')
        .neq('Código del cliente', 'CN890927404-01');

    // Reglas de Negocio RBAC:
    // 1. Backoffice: Ve todo (excepto el cliente bloqueado por defecto)
    // 2. Asesor: Solo ve lo suyo (vendedor === email/id)
    // 3. Externo: No ve nada preventivo (se maneja por búsqueda exacta en el front)
    
    if (role === 'Asesor') {
        if (vendedorFilter && vendedorFilter.trim() !== '') {
            // Usamos comodines para máxima compatibilidad con espacios o nombres parciales en DB
            query = query.ilike('vendedor', `%${vendedorFilter.trim()}%`);
        } else {
            // Seguridad: Si el asesor no tiene nombre/email en sesión, no ve nada para evitar fugas.
            query = query.eq('vendedor', 'SESSION_IDENTITY_MISSING');
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching VISOR data:', error);
        throw error;
    }

    if (!data) return [];

    return groupRowsIntoOrders(data as VisorRow[]);
};

const normalizeOrderState = (state: string | null | undefined): string => {
    if (!state) return 'Pendiente';
    const s = state.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes('entrega') || s.includes('finaliza')) return 'Entregada';
    if (s.includes('transito') || s.includes('despacha') || s.includes('ruta')) return 'En Tránsito';
    if (s.includes('produccion') || s.includes('proceso') || s.includes('fabrica')) return 'En Producción';
    return 'Pendiente';
};

const cleanString = (val: any): string | undefined => {
    if (val === undefined || val === null || String(val).toLowerCase() === 'null' || String(val).trim() === '') {
        return undefined;
    }
    return String(val).trim();
};

const formatLargeNumber = (val: any): string | undefined => {
    const cleaned = cleanString(val);
    if (!cleaned) return undefined;
    
    // Si contiene notación científica (E) o es un número puro muy largo
    if (cleaned.toUpperCase().includes('E') || (typeof val === 'number' && Math.abs(val) > 1e12)) {
        const num = Number(cleaned);
        if (!isNaN(num)) {
            return new Intl.NumberFormat('en-US', { 
                useGrouping: false, 
                maximumFractionDigits: 0 
            }).format(num);
        }
    }
    return cleaned;
};

const isFleteOrFinanzas = (row: VisorRow): boolean => {
    const desc = (row["Descripción del producto"] || '').toUpperCase();
    const familia = (row["Familia"] || '').toUpperCase();
    return desc.includes('FLETE') || familia === 'FINANZAS';
};

const groupRowsIntoOrders = (rows: VisorRow[]): Order[] => {
    const ordersMap = new Map<string, Order>();

    rows.forEach(row => {
        // Ignorar registros de FLETES o FINANZAS completamente de la lógica logística
        if (isFleteOrFinanzas(row)) return;

        const ov = String(row["Orden de venta"] || '');
        if (!ov) return;

        if (!ordersMap.has(ov)) {
            ordersMap.set(ov, {
                numero_orden_venta: ov,
                numero_orden_compra: row["Orden de compra"] || undefined,
                tipo_orden_venta: row["tipo orden de venta"] || '',
                ciudad_destino: row["Destino"] || '',
                fecha_ingreso: row["Fecha de ingreso"] || '',
                fecha_plan_despacho: row["Fecha de despacho"] || '',
                fecha_real_despacho: row["Fecha real de despacho"] || undefined,
                estado_orden: normalizeOrderState(row["Estado de la orden"] || row["Estado de la Orden"]),
                items: [],
                total_pedida: 0,
                total_facturada: 0,
                total_despacho: 0,
                total_produccion: 0,
                total_planificada: 0,
                nombre_cliente: row["Nombre del cliente"] || '',
                nit_cliente: row["Código del cliente"] || '',
                nombre_sala: row["Nombre de la sala"] || undefined,
                vendedor: cleanString(row["vendedor"]),
                transportador: cleanString(row["Transportador"]),
                numero_guia: formatLargeNumber(row["# GUIA"]),
                fecha_estimada_entrega: cleanString(row["Fecha estimada de entrega (real)"]) || cleanString(row["Fecha estimada de entrega"]),
                fecha_entrega: cleanString(row["Fecha de entrega"]),
                numero_factura: formatLargeNumber(row["# Factura"]),
                fecha_factura: cleanString(row["Fecha de la factura"]),
                envio: cleanString(row["envio"] || row["Envio"] || row["envío"] || row["Envío"]),
                estado_despacho: cleanString(row["Estado despacho"]),
                estado_raw: cleanString(row["Estado"]),
                normalizedStatus: normalizeOrderState(row["Estado de la orden"] || row["Estado de la Orden"]),
            });
        }

        const order = ordersMap.get(ov)!;

        // Update invoice info if found in any row
        if (row["# Factura"] && !order.numero_factura) order.numero_factura = formatLargeNumber(row["# Factura"]);
        if (row["Fecha de la factura"] && !order.fecha_factura) order.fecha_factura = row["Fecha de la factura"];

        const getVal = (searchKey: string) => {
            const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const target = clean(searchKey);
            
            // Búsqueda estricta tras normalización para evitar colisiones
            const actualKey = Object.keys(row).find(k => clean(k) === target);
            const val = actualKey ? (row as any)[actualKey] : null;
            
            if (val !== undefined && val !== null && String(val).toLowerCase() !== 'null' && String(val).trim() !== '') {
                const num = parseFloat(String(val).replace(',', '.'));
                return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        const cantPedida = getVal("cantidad pedida");
        const cantFacturada = getVal("cantidad facturada");
        const cantDespacho = getVal("cant ent despacho");
        const cantProduccion = getVal("cant proc");
        const cantPlanificado = getVal("cant planif");

        order.total_pedida += cantPedida;
        order.total_facturada += cantFacturada;
        order.total_despacho += cantDespacho;
        order.total_produccion += cantProduccion;
        order.total_planificada += cantPlanificado;

        const isCompleto = (cantPedida > 0 && cantPedida === (cantFacturada + cantDespacho)) || 
                           (String(row["situación item"] || '').toLowerCase().includes('disponible para despachar') && cantPedida === (cantFacturada + cantDespacho));

        order.items.push({
            codigo_producto: row["Código del producto"] || '',
            descripcion_producto: row["Descripción del producto"] || '',
            familia: row["Familia"] || undefined,
            cantidad_pedida: cantPedida,
            cantidad_facturada: cantFacturada,
            cantidad_despacho: cantDespacho,
            cantidad_produccion: cantProduccion,
            cantidad_planificada: cantPlanificado,
            estado_produccion: isCompleto ? 'Completo' :
                              cantFacturada >= cantPedida && cantPedida > 0 ? 'Entregada' :
                              cantProduccion > 0 ? 'En Producción' : 'Pendiente',
            componente: row["Componente"] || undefined,
            situacion_item: row["situación item"] || undefined,
            envio: row["envio"] || row["Envio"] || row["envío"] || row["Envío"] || undefined,
            estado_orden: normalizeOrderState(row["Estado de la orden"] || row["Estado de la Orden"]),
            numero_guia: formatLargeNumber(row["# GUIA"]),
            transportador: row["Transportador"] || undefined,
        });

        // Hipótesis 3: Si un ítem ya tiene guía pero la orden no, actualizarla
        if (row["# GUIA"] && !order.numero_guia) {
            order.numero_guia = formatLargeNumber(row["# GUIA"]);
            order.transportador = row["Transportador"] || order.transportador;
        }
    });

    // Hipótesis 3: Detectar si hay múltiples guías
    return Array.from(ordersMap.values())
        .filter(order => order.items.length > 0)
        .map(order => {
            const uniqueGuides = new Set(order.items.map(i => i.numero_guia).filter(g => !!g));
            if (uniqueGuides.size > 1) {
                order.numero_guia = "DESPACHOS MÚLTIPLES";
            }
            return order;
        });
};
