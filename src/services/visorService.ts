import { supabase } from './supabase';
import { Order, OrderItem, VisorRow, UserRole, ExecutiveOrder } from '@/types';

export const getOrdersFromVisor = async (role: UserRole, vendedorFilter?: string | string[]): Promise<Order[]> => {
    // In a real scenario, we might filter by role or vendor here
    let query = supabase.from('VISOR')
        .select('*')
        .neq('Código del cliente', 'CN890927404-01');

    // Optimización de rendimiento: Filtrar por fecha localmente 
    // ya que 'Fecha de ingreso' es texto en formato DD/MM/YYYY en la base de datos
    // y query.gte() hace una comparación de strings incorrecta.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Reglas de Negocio RBAC:
    if (role === 'Asesor') {
        if (Array.isArray(vendedorFilter) && vendedorFilter.length > 0) {
            query = query.in('vendedor', vendedorFilter);
        } else if (typeof vendedorFilter === 'string' && vendedorFilter.trim() !== '') {
            query = query.ilike('vendedor', `%${vendedorFilter.trim()}%`);
        } else {
            query = query.eq('vendedor', 'SESSION_IDENTITY_MISSING');
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching VISOR data (raw):', error);
        console.error('Error fetching VISOR data (stringified):', JSON.stringify(error));
        console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            name: error.name
        });
        throw new Error(`Supabase query failed: ${error.message || JSON.stringify(error)}`);
    }

    if (!data) return [];

    // Local filtering by date to replace the removed .gte()
    const filteredData = (data as unknown as VisorRow[]).filter(row => {
        const dateStr = row['Fecha de ingreso'];
        if (!dateStr) return true; // keep if no date
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
            // DD/MM/YYYY
            const rowDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            if (!isNaN(rowDate.getTime())) {
                return rowDate >= sixMonthsAgo;
            }
        }
        return true;
    });

    return groupRowsIntoOrders(filteredData);
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
                const num = parseFloat(String(val).replace(/,/g, ''));
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
            precio_unitario: (() => {
                const v = cleanString(row["Precio por unidad"]);
                if (!v) return undefined;
                const n = parseFloat(v.replace(/,/g, ''));
                return isNaN(n) ? undefined : n;
            })(),
            valor_total: (() => {
                const v = cleanString(row["Valor total"]);
                if (!v) return undefined;
                const n = parseFloat(v.replace(/,/g, ''));
                return isNaN(n) ? undefined : n;
            })(),
            estado_produccion: isCompleto ? 'Completo' :
                              cantFacturada >= cantPedida && cantPedida > 0 ? 'Entregada' :
                              cantProduccion > 0 ? 'En Producción' : 'Pendiente',
            componente: row["Componente"] || undefined,
            situacion_item: row["situación item"] || undefined,
            envio: row["envio"] || row["Envio"] || row["envío"] || row["Envío"] || undefined,
            estado_orden: normalizeOrderState(row["Estado de la orden"] || row["Estado de la Orden"]),
            numero_guia: formatLargeNumber(row["# GUIA"]),
            transportador: cleanString(row["Transportador"]),
            estado_raw: cleanString(row["Estado"]),
            // Per-item row data — preserva integridad de cada fila de la BD
            remision: cleanString(row["# Remisión"]),
            fecha_real_despacho: cleanString(row["Fecha real de despacho"] || (row as any)["Fecha real despacho"]),
            fecha_plan_despacho: cleanString(row["Fecha de despacho"] || (row as any)["Fecha despacho"] || (row as any)["Fecha Prog Desp"]),
            fecha_entrega: cleanString(row["Fecha de entrega"]),
            numero_factura: formatLargeNumber(row["# Factura"]),
            fecha_factura: cleanString(row["Fecha de la factura"]),
            estado_despacho: cleanString(row["Estado despacho"]),
            fecha_estimada_entrega: cleanString(row["Fecha estimada de entrega (real)"]) || cleanString(row["Fecha estimada de entrega"]),
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

export const getExecutiveOrdersFromVisor = async (role: UserRole, vendedorFilter?: string | string[]): Promise<ExecutiveOrder[]> => {
    let query = supabase.from('VISOR_EJECUTIVO').select('*');

    if (role === 'Asesor') {
        if (Array.isArray(vendedorFilter) && vendedorFilter.length > 0) {
            query = query.in('vendedor', vendedorFilter);
        } else if (typeof vendedorFilter === 'string' && vendedorFilter.trim() !== '') {
            query = query.ilike('vendedor', `%${vendedorFilter.trim()}%`);
        } else {
            query = query.eq('vendedor', 'SESSION_IDENTITY_MISSING');
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching VISOR_EJECUTIVO data:', error);
        throw new Error(`Supabase query failed: ${error.message}`);
    }

    if (!data) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return data.map((row: any) => {
        const pedidas = Number(row.total_unidades_pedidas) || 0;
        const cedi = Number(row.total_en_cedi) || 0;
        const prod = Number(row.total_en_produccion) || 0;
        const planif = Number(row.total_planificado) || 0;
        const valor = Number(row.valor_total_pedido) || 0;

        let pct_cedi = 0, pct_produccion = 0, pct_planificado = 0, pct_avance = 0;

        if (pedidas > 0) {
            pct_cedi = Math.min((cedi / pedidas) * 100, 100);
            pct_produccion = Math.min((prod / pedidas) * 100, 100);
            pct_planificado = Math.min((planif / pedidas) * 100, 100);
            // Avance total: suma de lo que ya está en CEDI más lo que está en producción
            pct_avance = Math.min(((cedi + prod) / pedidas) * 100, 100); 
        }

        let dias_atraso = 0;
        if (row.fecha_compromiso_date) {
            const compromiso = new Date(row.fecha_compromiso_date);
            const diffTime = today.getTime() - compromiso.getTime();
            if (diffTime > 0) {
                dias_atraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        }

        let prioridad: 'Alta' | 'Media' | 'Baja' = 'Baja';
        if (dias_atraso > 15) prioridad = 'Alta';
        else if (dias_atraso > 0) prioridad = 'Media';

        let estado_general = 'Pendiente';
        if (pct_cedi === 100) {
            estado_general = 'Listo para despacho';
        } else if (prod > 0) {
            estado_general = 'En producción';
        } else if (planif > 0 && cedi === 0) {
            estado_general = 'Planificado';
        } else if (cedi > 0 && cedi < pedidas) {
            estado_general = 'Parcial';
        }

        return {
            ...row,
            total_unidades_pedidas: pedidas,
            total_en_cedi: cedi,
            total_en_produccion: prod,
            total_planificado: planif,
            valor_total_pedido: valor,
            pct_cedi,
            pct_produccion,
            pct_planificado,
            pct_avance,
            dias_atraso,
            prioridad,
            estado_general,
        };
    });
};
