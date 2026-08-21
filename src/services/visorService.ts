import { supabase } from './supabase';
// Removed import: PostgrestFilterBuilder is not exported from '@supabase/supabase-js'
import { Order, OrderItem, VisorRow, UserRole, ExecutiveOrder } from '@/types';

import { SearchFilters } from '@/components/FilterBar';

// Nota: select('*') se mantiene porque PostgREST no soporta columnas con
// caracteres especiales (#, espacios, acentos, paréntesis) en el string select.
// Optimización: pages de 5000 filas, 100% paralelo, caché 10 min,
// key-map pre-computado para procesamiento O(1) por fila.

// ============================================================
// Caché en memoria — evita re-descargar 55 MB en cada cambio de sesión
// ============================================================
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos — reduce re-descargas innecesarias
let visorCache: {
    data: VisorRow[];
    timestamp: number;
    cacheKey: string;
} | null = null;

export function clearVisorCache() {
    visorCache = null;
}

// ============================================================
// Callback de progreso para la UI
// ============================================================
export type ProgressCallback = (loaded: number, estimatedTotal?: number) => void;

// ============================================================
// Función de paginación — descarga en lotes de 1000 filas
// Supabase/PostgREST limita a 1000 filas por defecto.
// Sin esto, los datos pueden estar TRUNCADOS silenciosamente.
// ============================================================
const PAGE_SIZE = 1000;

// Máximo de filas por petición cuando el servidor soporta más de 1000.
// Se auto-detecta: si la primera petición devuelve exactamente PAGE_SIZE,
// el servidor tiene cap en 1000 y se mantiene. Si devuelve más, se usa
// PREFERRED_PAGE_SIZE para reducir el número total de peticiones.
const PREFERRED_PAGE_SIZE = 5000;

const applyFilters = <T>(
    query: T,
    role: UserRole,
    vendedorFilter?: string | string[],
    searchFilters?: SearchFilters
): T => {
    let q = (query as any).neq('Código del cliente', 'CN890927404-01');

    if (role === 'Externo') {
        if (searchFilters?.oferta) {
            const ofertaNum = parseInt(searchFilters.oferta, 10);
            if (!isNaN(ofertaNum)) {
                q = q.eq('Oferta de venta', ofertaNum);
            } else {
                q = q.ilike('Oferta de venta', `%${searchFilters.oferta.trim()}%`);
            }
        }
        if (searchFilters?.remision) {
            const remisionNum = parseInt(searchFilters.remision, 10);
            if (!isNaN(remisionNum)) {
                q = q.eq('# Remisión', remisionNum);
            } else {
                q = q.ilike('# Remisión', `%${searchFilters.remision.trim()}%`);
            }
        }
        if (searchFilters?.ov) {
            const ovNum = parseInt(searchFilters.ov, 10);
            if (!isNaN(ovNum)) {
                q = q.eq('Orden de venta', ovNum);
            } else {
                q = q.eq('Orden de venta', -1);
            }
        }
        if (searchFilters?.oc) {
            q = q.ilike('Orden de compra', `%${searchFilters.oc.trim()}%`);
        }
        if (searchFilters?.nit) {
            q = q.eq('Código del cliente', searchFilters.nit.trim());
        }
        return q as unknown as T;
    }

    // Para usuarios logueados, filtrar los últimos 6 meses en base de datos
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
    q = q.gte('fecha_ingreso_parsed', sixMonthsAgoStr);

    if (role === 'Asesor' || role === 'Vendedor') {
        if (Array.isArray(vendedorFilter) && vendedorFilter.length > 0) {
            const orConds = vendedorFilter.map(v => `vendedor.ilike.%${v.trim()}%`).join(',');
            q = q.or(orConds);
        } else if (typeof vendedorFilter === 'string' && vendedorFilter.trim() !== '') {
            q = q.ilike('vendedor', `%${vendedorFilter.trim()}%`);
        }
    }

    return q as unknown as T;
};

const fetchAllPaginatedFiltered = async (
    role: UserRole,
    vendedorFilter?: string | string[],
    onProgress?: ProgressCallback,
    searchFilters?: SearchFilters
): Promise<VisorRow[]> => {
    if (role === 'Externo') {
        if (!searchFilters || (!searchFilters.ov && !searchFilters.oc && !searchFilters.nit)) {
            return [];
        }
        
        const query = applyFilters(
            supabase.from('visor_recent').select('*'),
            role,
            vendedorFilter,
            searchFilters
        );
        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching external order:', error);
            throw new Error(`Error fetching order: ${error.message}`);
        }
        return (data || []) as unknown as VisorRow[];
    }

    // Obtener el conteo total para la paginación paralela
    const countQuery = applyFilters(
        supabase.from('visor_recent').select('*', { count: 'exact', head: true }),
        role,
        vendedorFilter,
        searchFilters
    );
    
    const { count, error: countError } = await countQuery;
    if (countError) {
        console.error('Error getting count for parallel fetch:', countError);
        throw new Error(`Count failed: ${countError.message}`);
    }

    const totalRows = count || 0;
    console.log(`VISOR: Total registros a descargar: ${totalRows}`);

    if (totalRows === 0) return [];

    // ── Auto-detectar tamaño de página óptimo ──
    // Intentamos una primera petición con PREFERRED_PAGE_SIZE.
    // Si el servidor la capea a PAGE_SIZE, usamos el fallback.
    const probeQuery = applyFilters(
        supabase.from('visor_recent').select('*'),
        role,
        vendedorFilter,
        searchFilters
    ).range(0, PREFERRED_PAGE_SIZE - 1);

    const { data: probeData, error: probeError } = await probeQuery;
    if (probeError) {
        console.error('Error in probe request:', probeError);
        throw new Error(`Probe failed: ${probeError.message}`);
    }

    const probeRows = (probeData || []) as unknown as VisorRow[];
    // Si el servidor devolvió exactamente PAGE_SIZE (1000), tiene cap.
    const effectivePageSize = probeRows.length === PAGE_SIZE ? PAGE_SIZE : PREFERRED_PAGE_SIZE;
    let loadedCount = probeRows.length;
    if (onProgress) onProgress(loadedCount, totalRows);

    console.log(`VISOR: Page size efectivo: ${effectivePageSize} (probe devolvió ${probeRows.length})`);

    // Si ya tenemos todos los datos con la primera petición
    if (loadedCount >= totalRows) {
        console.log(`VISOR: Descarga completa en 1 petición (${loadedCount} filas)`);
        return probeRows;
    }

    // ── Descargar páginas restantes 100% en paralelo ──
    const remainingStart = loadedCount;
    const remainingPages = Math.ceil((totalRows - remainingStart) / effectivePageSize);

    const fetchPage = async (pageIdx: number): Promise<VisorRow[]> => {
        const from = remainingStart + pageIdx * effectivePageSize;
        const to = Math.min(from + effectivePageSize - 1, totalRows - 1);

        const pageQuery = applyFilters(
            supabase.from('visor_recent').select('*'),
            role,
            vendedorFilter,
            searchFilters
        ).range(from, to);

        const { data, error } = await pageQuery;
        if (error) {
            console.error(`Error fetching page ${pageIdx}:`, error);
            throw new Error(`Page ${pageIdx} failed: ${error.message}`);
        }

        const rows = (data || []) as unknown as VisorRow[];
        loadedCount += rows.length;
        if (onProgress) onProgress(loadedCount, totalRows);
        return rows;
    };

    // Disparar TODAS las páginas restantes en paralelo (sin batching)
    const pageResults = await Promise.all(
        Array.from({ length: remainingPages }, (_, i) => fetchPage(i))
    );

    // Concatenar: probe + todas las páginas restantes
    const allData = probeRows.concat(...pageResults);
    console.log(`VISOR: Descargados ${allData.length} registros en ${remainingPages + 1} peticiones paralelas`);
    return allData;
};

export const getOrdersFromVisor = async (
    role: UserRole,
    vendedorFilter?: string | string[],
    onProgress?: ProgressCallback,
    searchFilters?: SearchFilters
): Promise<Order[]> => {
    // Para usuarios externos, no usar caché y consultar directamente
    if (role === 'Externo') {
        const rawData = await fetchAllPaginatedFiltered(role, vendedorFilter, onProgress, searchFilters);
        return groupRowsIntoOrders(rawData);
    }

    // Generar clave de caché basada en los parámetros de la consulta
    const cacheKey = `${role}|${Array.isArray(vendedorFilter) ? vendedorFilter.sort().join(',') : vendedorFilter || ''}`;

    // Verificar caché
    if (visorCache && visorCache.cacheKey === cacheKey && (Date.now() - visorCache.timestamp) < CACHE_TTL) {
        console.log('VISOR: Usando datos en caché (edad:', Math.round((Date.now() - visorCache.timestamp) / 1000), 'segundos)');
        if (onProgress) onProgress(visorCache.data.length, visorCache.data.length);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const filteredData = filterByDate(visorCache.data, sixMonthsAgo);
        return groupRowsIntoOrders(filteredData);
    }

    // Descargar con paginación progresiva optimizada
    const rawData = await fetchAllPaginatedFiltered(role, vendedorFilter, onProgress, searchFilters);

    // Guardar en caché
    visorCache = {
        data: rawData,
        timestamp: Date.now(),
        cacheKey,
    };

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const filteredData = filterByDate(rawData, sixMonthsAgo);

    return groupRowsIntoOrders(filteredData);
};

/** Función para invalidar la caché manualmente (ej: tras actualizar datos) */
export const invalidateVisorCache = () => {
    visorCache = null;
    console.log('VISOR: Caché invalidada');
};

/** Filtro local por fecha — se mantiene porque la columna es texto DD/MM/YYYY */
const filterByDate = (data: VisorRow[], sixMonthsAgo: Date): VisorRow[] => {
    return data.filter(row => {
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

const normalizeKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

const getRawField = (row: Record<string, any>, candidateKeys: string[]): any => {
    if (!row) return undefined;
    
    // 1. Direct exact match check
    for (const key of candidateKeys) {
        if (row[key] !== undefined && row[key] !== null) {
            const strVal = String(row[key]).trim();
            if (strVal !== '' && strVal.toLowerCase() !== 'null' && strVal.toLowerCase() !== 'undefined') {
                return row[key];
            }
        }
    }
    
    // 2. Normalized match check
    const rowKeys = Object.keys(row);
    if (rowKeys.length === 0) return undefined;
    
    const targetNorms = candidateKeys.map(normalizeKey);
    for (const targetNorm of targetNorms) {
        for (const rKey of rowKeys) {
            if (normalizeKey(rKey) === targetNorm) {
                const val = row[rKey];
                if (val !== undefined && val !== null) {
                    const strVal = String(val).trim();
                    if (strVal !== '' && strVal.toLowerCase() !== 'null' && strVal.toLowerCase() !== 'undefined') {
                        return val;
                    }
                }
            }
        }
    }
    
    return undefined;
};

const formatOrderNumber = (val: any): string => {
    if (val === undefined || val === null) return '';
    let s = String(val).trim();
    if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
    if (s.endsWith('.0')) {
        s = s.slice(0, -2);
    }
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
        s = s.replace(/,/g, '');
    }
    return s;
};

const isFleteOrFinanzas = (row: VisorRow): boolean => {
    const desc = String(getRawField(row, ["Descripción del producto", "Descripcion del producto", "PRODUCTO", "Producto"]) || '').toUpperCase();
    const familia = String(getRawField(row, ["Familia", "FAMILIA"]) || '').toUpperCase();
    return desc.includes('FLETE') || familia === 'FINANZAS';
};

const isServiceItem = (item: { codigo_producto: string; descripcion_producto: string; familia?: string | null }): boolean => {
    const familia = (item.familia || '').toUpperCase();
    if (familia === 'SERVICIOS') return true;
    
    const code = (item.codigo_producto || '').toUpperCase();
    if (code.startsWith('SINS')) return true;
    
    const desc = (item.descripcion_producto || '').toUpperCase();
    if (desc.includes('INSTALACION') || desc.includes('MANTENIMIENTO') || desc.includes('REPARACION') || desc.includes('VISITA')) {
        return true;
    }
    return false;
};

export const groupRowsIntoOrders = (rows: VisorRow[]): Order[] => {
    const ordersMap = new Map<string, Order>();

    rows.forEach(row => {
        const ovVal = getRawField(row, ["Orden de venta", "Orden de Venta", "ORDEN DE VENTA", "Orden Venta", "OV", "N° OV", "No. OV", "# OV"]);
        const ov = formatOrderNumber(ovVal);
        if (!ov) return;

        const rawOferta = getRawField(row, [
            "Oferta de venta", "Oferta de Venta", "oferta de venta", "OFERTA DE VENTA",
            "Oferta Venta", "OFERTA VENTA", "Oferta", "OFERTA", "Oferta vta", "Oferta de vta",
            "OFERTA VTA", "OFERTA DE VTA", "Cotizacion", "Cotización", "COTIZACION", "COTIZACIÓN",
            "Doc. Base", "Doc Base", "Documento Base", "Documento base", "DOCUMENTO BASE",
            "# Oferta", "No. Oferta", "N° Oferta", "Num Oferta", "Numero Oferta", "Número Oferta",
            "N° Oferta Venta", "No. Oferta Venta", "Oferta #", "Oferta No", "OfertaVenta",
            "Oferta_Venta", "oferta_venta", "Nº oferta", "Nº Oferta"
        ]);
        const ofertaVal = rawOferta ? (formatOrderNumber(rawOferta) || cleanString(rawOferta)) : undefined;

        const rawRemision = formatLargeNumber(getRawField(row, ["# Remisión", "REMISIÓN", "Remisión", "Remision", "# Remision", "Remisión #", "Remision #", "N° Remisión", "No. Remisión", "NUM REMISION", "Numero Remision", "# REMISIÓN"]));

        if (!ordersMap.has(ov)) {
            ordersMap.set(ov, {
                oferta_venta: ofertaVal,
                remision: rawRemision,
                numero_orden_venta: ov,
                numero_orden_compra: cleanString(getRawField(row, ["Orden de compra", "Orden de Compra", "ORDEN DE COMPRA", "OC"])),
                tipo_orden_venta: getRawField(row, ["tipo orden de venta", "Tipo orden de venta", "Tipo Orden de Venta", "TIPO ORDEN DE VENTA"]) || '',
                ciudad_destino: getRawField(row, ["Destino", "DESTINO", "Ciudad", "CIUDAD"]) || '',
                fecha_ingreso: getRawField(row, ["Fecha de ingreso", "FECHA DE INGRESO", "FECHA OV", "Fecha OV"]) || '',
                fecha_plan_despacho: getRawField(row, ["Fecha de despacho", "FECHA DE DESPACHO", "FECHA PROG DESP", "Fecha Prog Desp"]) || '',
                fecha_real_despacho: cleanString(getRawField(row, ["Fecha real de despacho", "FECHA REAL DESPACHO", "FECHA REAL DESP"])),
                estado_orden: normalizeOrderState(getRawField(row, ["Estado de la orden", "Estado de la Orden", "ESTADO DE LA ORDEN", "ESTADO", "Estado"])),
                items: [],
                total_pedida: 0,
                total_facturada: 0,
                total_despacho: 0,
                total_produccion: 0,
                total_planificada: 0,
                nombre_cliente: getRawField(row, ["Nombre del cliente", "NOMBRE DEL CLIENTE", "CLIENTE", "Cliente"]) || '',
                nit_cliente: getRawField(row, ["Código del cliente", "Codigo del cliente", "CÓD. CLIENTE", "COD. CLIENTE", "COD CLIENTE", "NIT", "Nit"]) || '',
                nombre_sala: getRawField(row, ["Nombre de la sala", "NOMBRE DE LA SALA", "SALA / PROYECTO", "SALA", "Proyecto"]) || undefined,
                vendedor: cleanString(getRawField(row, ["vendedor", "Vendedor", "VENDEDOR", "Asesor"])),
                transportador: cleanString(getRawField(row, ["Transportador", "TRANSPORTADOR", "Transportadora", "TRANSPORTADORA"])),
                numero_guia: formatLargeNumber(getRawField(row, ["# GUIA", "GUÍA", "Guía", "Guia", "GUIA", "# Guía"])),
                fecha_estimada_entrega: cleanString(getRawField(row, ["Fecha estimada de entrega (real)", "Fecha estimada de entrega", "FECHA ESTIMADA"])),
                fecha_entrega: cleanString(getRawField(row, ["Fecha de entrega", "FECHA ENTREGA", "Fecha Entrega"])),
                numero_factura: formatLargeNumber(getRawField(row, ["# Factura", "FACTURA", "Factura", "# FACTURA"])),
                fecha_factura: cleanString(getRawField(row, ["Fecha de la factura", "FECHA FACTURA", "Fecha Factura", "FECHA FACT"])),
                envio: cleanString(getRawField(row, ["envio", "Envio", "envío", "Envío", "ENVÍO", "ENVIO"])),
                estado_despacho: cleanString(getRawField(row, ["Estado despacho", "ESTADO DESPACHO"])),
                estado_raw: cleanString(getRawField(row, ["Estado", "ESTADO"])),
                normalizedStatus: normalizeOrderState(getRawField(row, ["Estado de la orden", "Estado de la Orden", "ESTADO DE LA ORDEN", "ESTADO", "Estado"])),
            });
        }

        const order = ordersMap.get(ov)!;

        // Update oferta_venta if found in any row
        if (ofertaVal && !order.oferta_venta) {
            order.oferta_venta = ofertaVal;
        }

        // Update remision if found in any row
        if (rawRemision && !order.remision) {
            order.remision = rawRemision;
        }

        // Update invoice info if found in any row
        const rowFactura = formatLargeNumber(getRawField(row, ["# Factura", "FACTURA", "Factura", "# FACTURA"]));
        if (rowFactura && !order.numero_factura) order.numero_factura = rowFactura;
        
        const rowFechaFactura = getRawField(row, ["Fecha de la factura", "FECHA FACTURA", "Fecha Factura", "FECHA FACT"]);
        if (rowFechaFactura && !order.fecha_factura) order.fecha_factura = String(rowFechaFactura);

        const getValNum = (searchKeys: string[]) => {
            const val = getRawField(row, searchKeys);
            if (val !== undefined && val !== null && String(val).toLowerCase() !== 'null' && String(val).trim() !== '') {
                const num = parseFloat(String(val).replace(/,/g, ''));
                return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        const cantPedida = getValNum(["Cantidad pedida", "cantidad pedida", "CANTIDAD PEDIDA", "PED", "Cantidad"]);
        const cantFacturada = getValNum(["cantidad facturada", "Cantidad facturada", "CANTIDAD FACTURADA", "FAC"]);
        const cantDespacho = getValNum(["cant - ent - despacho", "cant ent despacho", "CANT ENT DESPACHO", "DESP", "DESPACHO"]);
        const cantProduccion = getValNum(["cant proc", "CANT PROC", "PROD", "PRODUCCION"]);
        const cantPlanificado = getValNum(["cant planif", "CANT PLANIF", "PLAN"]);

        order.total_pedida += cantPedida;
        order.total_facturada += cantFacturada;
        order.total_despacho += cantDespacho;
        order.total_produccion += cantProduccion;
        order.total_planificada += cantPlanificado;

        const situacionStr = String(getRawField(row, ["situación item", "situacion item", "SITUACIÓN ITEM", "SITUACIÓN"]) || '').toLowerCase();
        const isCompleto = (cantPedida > 0 && cantPedida === (cantFacturada + cantDespacho)) || 
                           (situacionStr.includes('disponible para despachar') && cantPedida === (cantFacturada + cantDespacho));

        order.items.push({
            codigo_producto: getRawField(row, ["Código del producto", "Codigo del producto", "CÓD. PRODUCTO", "COD. PRODUCTO", "COD PRODUCTO"]) || '',
            descripcion_producto: getRawField(row, ["Descripción del producto", "Descripcion del producto", "DESCRIPCIÓN DEL PRODUCTO", "PRODUCTO", "Producto"]) || '',
            familia: getRawField(row, ["Familia", "FAMILIA"]) || undefined,
            cantidad_pedida: cantPedida,
            cantidad_facturada: cantFacturada,
            cantidad_despacho: cantDespacho,
            cantidad_produccion: cantProduccion,
            cantidad_planificada: cantPlanificado,
            precio_unitario: (() => {
                const v = cleanString(getRawField(row, ["Precio por unidad", "PRECIO POR UNIDAD", "VALOR UNITARIO", "Precio Unitario", "Precio U."]));
                if (!v) return undefined;
                const n = parseFloat(v.replace(/,/g, ''));
                return isNaN(n) ? undefined : n;
            })(),
            valor_total: (() => {
                const v = cleanString(getRawField(row, ["Valor total", "VALOR TOTAL", "Valor Total"]));
                if (!v) return undefined;
                const n = parseFloat(v.replace(/,/g, ''));
                return isNaN(n) ? undefined : n;
            })(),
            estado_produccion: isCompleto ? 'Completo' :
                               cantFacturada >= cantPedida && cantPedida > 0 ? 'Entregada' :
                               cantProduccion > 0 ? 'En Producción' : 'Pendiente',
            componente: getRawField(row, ["Componente", "COMPONENTE"]) || undefined,
            situacion_item: getRawField(row, ["situación item", "situacion item", "SITUACIÓN ITEM", "SITUACIÓN"]) || undefined,
            envio: cleanString(getRawField(row, ["envio", "Envio", "envío", "Envío", "ENVÍO", "ENVIO"])),
            estado_orden: normalizeOrderState(getRawField(row, ["Estado de la orden", "Estado de la Orden", "ESTADO DE LA ORDEN", "ESTADO", "Estado"])),
            numero_guia: formatLargeNumber(getRawField(row, ["# GUIA", "GUÍA", "Guía", "Guia", "GUIA", "# Guía"])),
            transportador: cleanString(getRawField(row, ["Transportador", "TRANSPORTADOR", "Transportadora", "TRANSPORTADORA"])),
            estado_raw: cleanString(getRawField(row, ["Estado", "ESTADO"])),
            // Per-item row data — preserva integridad de cada fila de la BD
            remision: cleanString(getRawField(row, ["# Remisión", "REMISIÓN", "Remisión", "Remision"])),
            fecha_real_despacho: cleanString(getRawField(row, ["Fecha real de despacho", "FECHA REAL DESPACHO", "FECHA REAL DESP"])),
            fecha_plan_despacho: cleanString(getRawField(row, ["Fecha de despacho", "FECHA DE DESPACHO", "FECHA PROG DESP", "Fecha Prog Desp"])),
            fecha_entrega: cleanString(getRawField(row, ["Fecha de entrega", "FECHA ENTREGA", "Fecha Entrega"])),
            numero_factura: formatLargeNumber(getRawField(row, ["# Factura", "FACTURA", "Factura", "# FACTURA"])),
            fecha_factura: cleanString(getRawField(row, ["Fecha de la factura", "FECHA FACTURA", "Fecha Factura", "FECHA FACT"])),
            estado_despacho: cleanString(getRawField(row, ["Estado despacho", "ESTADO DESPACHO"])),
            fecha_estimada_entrega: cleanString(getRawField(row, ["Fecha estimada de entrega (real)", "Fecha estimada de entrega", "FECHA ESTIMADA"])),
        });

        const rowGuia = formatLargeNumber(getRawField(row, ["# GUIA", "GUÍA", "Guía", "Guia", "GUIA", "# Guía"]));
        if (rowGuia && !order.numero_guia) {
            order.numero_guia = rowGuia;
            order.transportador = cleanString(getRawField(row, ["Transportador", "TRANSPORTADOR", "Transportadora", "TRANSPORTADORA"])) || order.transportador;
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

            // Ajustar estado de ítems de servicio individuales (sin importar el vendedor)
            order.items.forEach(item => {
                if (isServiceItem(item)) {
                    const isFacturado = !!item.numero_factura || (item.cantidad_facturada >= item.cantidad_pedida && item.cantidad_pedida > 0);
                    if (isFacturado) {
                        item.estado_orden = 'Entregada';
                        item.estado_produccion = 'Completo';
                    } else {
                        item.estado_orden = 'En Producción';
                        item.estado_produccion = 'En Proceso';
                    }
                }
            });

            // Ajustar estado a nivel de orden para órdenes de vendedor "Servicios" o que tengan solo servicios
            const isServiciosOrder = order.vendedor?.toLowerCase().includes('servicios') || 
                                     order.items.every(item => isServiceItem(item));

            if (isServiciosOrder) {
                const allServiceItemsFacturados = order.items.every(item => {
                    return !!item.numero_factura || (item.cantidad_facturada >= item.cantidad_pedida && item.cantidad_pedida > 0);
                });
                
                if (allServiceItemsFacturados) {
                    order.estado_orden = 'Entregada';
                    order.normalizedStatus = 'Entregada';
                } else {
                    order.estado_orden = 'En Producción';
                    order.normalizedStatus = 'En Producción';
                }
            }

            return order;
        });
};

export const mapOrdersToExecutive = (orders: Order[]): ExecutiveOrder[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDDMMYYYY = (dateStr: string | null | undefined): string | undefined => {
        if (!dateStr) return undefined;
        const s = String(dateStr).trim();
        if (s.includes('-')) return s;
        const parts = s.split('/');
        if (parts.length === 3) {
            const year = parts[2];
            const month = parts[1].padStart(2, '0');
            const day = parts[0].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return undefined;
    };

    return orders.map((order) => {
        const pedidas = order.total_pedida || 0;
        const cedi = order.total_despacho || 0;
        const prod = order.total_produccion || 0;
        const planif = order.total_planificada || 0;
        const valor = order.items.reduce((sum, item) => sum + (item.valor_total || 0), 0);

        let pct_cedi = 0, pct_produccion = 0, pct_planificado = 0, pct_avance = 0;

        if (pedidas > 0) {
            pct_cedi = Math.min((cedi / pedidas) * 100, 100);
            pct_produccion = Math.min((prod / pedidas) * 100, 100);
            pct_planificado = Math.min((planif / pedidas) * 100, 100);
            // Avance total: suma de lo que ya está en CEDI más lo que está en producción
            pct_avance = Math.min(((cedi + prod) / pedidas) * 100, 100); 
        }

        const fecha_compromiso_date = parseDDMMYYYY(order.fecha_plan_despacho);
        const fecha_ingreso_date = parseDDMMYYYY(order.fecha_ingreso);

        let dias_atraso = 0;
        if (fecha_compromiso_date) {
            const compromiso = new Date(fecha_compromiso_date);
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

        // Regla de Negocio Vendedor "Servicios" o solo servicios
        const isServiciosOrder = order.vendedor?.toLowerCase().includes('servicios') || 
                                 order.items.every(item => isServiceItem(item));

        if (isServiciosOrder) {
            const allServiceItemsFacturados = order.items.every(item => {
                return !!item.numero_factura || (item.cantidad_facturada >= item.cantidad_pedida && item.cantidad_pedida > 0);
            });
            estado_general = allServiceItemsFacturados ? 'Entregada' : 'En producción';
        }

        return {
            oferta_venta: order.oferta_venta,
            remision: order.remision,
            ov: order.numero_orden_venta,
            oc: order.numero_orden_compra,
            cod_cliente: order.nit_cliente,
            cliente: order.nombre_cliente,
            tipo_envio: order.envio,
            vendedor: order.vendedor,
            fecha_compromiso: order.fecha_plan_despacho,
            fecha_ingreso: order.fecha_ingreso,
            total_unidades_pedidas: pedidas,
            total_en_cedi: cedi,
            total_en_produccion: prod,
            total_planificado: planif,
            valor_total_pedido: valor,
            fecha_ingreso_date,
            fecha_compromiso_date,
            pct_cedi,
            pct_produccion,
            pct_planificado,
            pct_avance,
            dias_atraso,
            prioridad,
            estado_general,
            estado_despacho: order.estado_despacho,
        };
    });
};

export const getExecutiveOrdersFromVisor = async (role: UserRole, vendedorFilter?: string | string[]): Promise<ExecutiveOrder[]> => {
    try {
        const orders = await getOrdersFromVisor(role, vendedorFilter);
        return mapOrdersToExecutive(orders);
    } catch (error) {
        console.error('Error fetching/mapping executive orders:', error);
        throw error;
    }
};
