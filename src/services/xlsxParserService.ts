// ============================================================
// xlsxParserService.ts
// Lee un archivo .xlsx del usuario, lo convierte a Order[]
// reutilizando la logica existente de visorService, y persiste
// en IndexedDB para que los datos sobrevivan al reload.
// ============================================================
import { VisorRow, Order } from "@/types";
import { groupRowsIntoOrders, mapOrdersToExecutive, clearVisorCache } from "./visorService";
import { indexedDbService, XlsxMeta } from "./indexedDbService";
import { supabase } from "./supabase";

export type ParsePhase =
    | "idle"
    | "reading"
    | "parsing"
    | "processing"
    | "saving"
    | "success"
    | "error";

export interface ParseProgress {
    phase: ParsePhase;
    pct: number;          // 0-100
    message: string;
    processedRows?: number;
    totalRows?: number;
}

export interface ParseResult {
    orders: Order[];
    meta: XlsxMeta;
}

type OnProgress = (p: ParseProgress) => void;

// ── Helpers ─────────────────────────────────────────────────

/** Yield al event loop para que React pueda re-renderizar */
const yieldUI = () => new Promise<void>((r) => setTimeout(r, 30));

/** Convierte una fecha serial de Excel a YYYY-MM-DD */
function parseExcelDate(serial: any): any {
    if (typeof serial !== "number") return serial;
    if (serial < 30000 || serial > 80000) return serial;
    const utcDays = Math.round(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Lee el File como ArrayBuffer reportando progreso del FileReader */
function readFile(file: File, onPct: (p: number) => void): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
            if (e.lengthComputable) onPct((e.loaded / e.total) * 100);
        };
        reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

/** Sincroniza las órdenes del archivo cargado a la base de datos Supabase para que todos los usuarios las vean */
export async function syncUploadedOrdersToSupabase(
    orders: Order[],
    onProgress?: (pct: number, msg: string) => void
): Promise<void> {
    if (!orders || orders.length === 0) return;

    clearVisorCache();

    const total = orders.length;
    const BATCH_SIZE = 40;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE);
        
        if (onProgress) {
            const currentPct = 88 + Math.round((i / total) * 11);
            onProgress(currentPct, `Sincronizando ${i.toLocaleString('es-CO')} de ${total.toLocaleString('es-CO')} ordenes en la nube...`);
        }

        await Promise.all(batch.map(async (order) => {
            const ovNum = parseInt(order.numero_orden_venta, 10);
            if (isNaN(ovNum)) return;

            const isDelivered = (order.estado_orden || '').toLowerCase().includes('entregada');
            const isTransit = (order.estado_orden || '').toLowerCase().includes('transito');

            const updateData: Record<string, any> = {
                "Estado de la orden": order.estado_orden,
                "Estado": isDelivered ? "Cerrado" : "Abierto",
            };

            if (order.vendedor) updateData["vendedor"] = order.vendedor;
            if (order.nombre_cliente) updateData["Nombre del cliente"] = order.nombre_cliente;
            if (order.nit_cliente) updateData["Código del cliente"] = order.nit_cliente;
            if (order.nombre_sala) updateData["Nombre de la sala"] = order.nombre_sala;
            if (order.envio) updateData["envio"] = order.envio;
            if (order.fecha_plan_despacho) updateData["Fecha de despacho"] = order.fecha_plan_despacho;
            if (order.fecha_real_despacho) updateData["Fecha real de despacho"] = order.fecha_real_despacho;
            if (order.fecha_estimada_entrega) updateData["Fecha estimada de entrega (real)"] = order.fecha_estimada_entrega;
            if (order.fecha_entrega) updateData["Fecha de entrega"] = order.fecha_entrega;
            if (order.numero_guia) updateData["# GUIA"] = order.numero_guia;
            if (order.transportador) updateData["Transportador"] = order.transportador;
            if (order.numero_factura) updateData["# Factura"] = order.numero_factura;
            if (order.fecha_factura) updateData["Fecha de la factura"] = order.fecha_factura;
            if (order.remision) updateData["# Remisión"] = order.remision;

            if (isDelivered) {
                updateData["cant-ent-despacho"] = "1";
                updateData["cantidad facturada"] = "1";
                updateData["envio"] = "Completo";
                updateData["situación item"] = "Entregado";
            }

            try {
                await supabase.from('visor_recent')
                    .update(updateData)
                    .eq('Orden de venta', ovNum);
            } catch (err) {
                // Continuar silenciosamente
            }
        }));
    }

    clearVisorCache();
}

// ── API publica ─────────────────────────────────────────────

export async function parseXlsxFile(
    file: File,
    onProgress: OnProgress
): Promise<ParseResult> {
    // Fase 1: Leer archivo
    onProgress({ phase: "reading", pct: 0, message: "Leyendo archivo..." });
    const buffer = await readFile(file, (p) =>
        onProgress({ phase: "reading", pct: p * 0.15, message: `Leyendo archivo... ${Math.round(p)}%` })
    );

    // Fase 2: Parsear XLSX
    onProgress({ phase: "parsing", pct: 15, message: "Analizando estructura del archivo..." });
    await yieldUI();

    // @ts-ignore - Ignore type definitions for the dist bundle
    const xlsxModule = await import("xlsx/dist/xlsx.full.min.js");
    const XLSX = xlsxModule.default || xlsxModule;

    const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: false,
        cellNF: false,
        cellStyles: false,
        sheetStubs: false,
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    onProgress({ phase: "parsing", pct: 40, message: "Convirtiendo filas..." });
    await yieldUI();

    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: true,
    });

    for (const row of rawRows) {
        for (const key of Object.keys(row)) {
            if (key.toLowerCase().includes("fecha") && typeof row[key] === "number") {
                row[key] = parseExcelDate(row[key]);
            }
        }
    }

    const totalRows = rawRows.length;

    // Fase 3: Procesar filas → ordenes
    onProgress({
        phase: "processing",
        pct: 55,
        message: `Procesando ${totalRows.toLocaleString("es-CO")} filas...`,
        processedRows: 0,
        totalRows,
    });
    await yieldUI();

    const orders = groupRowsIntoOrders(rawRows as unknown as VisorRow[]);

    onProgress({
        phase: "processing",
        pct: 80,
        message: `${orders.length.toLocaleString("es-CO")} ordenes generadas`,
        processedRows: totalRows,
        totalRows,
    });
    await yieldUI();

    // Fase 4: Guardar en IndexedDB y Sincronizar en la Nube
    onProgress({ phase: "saving", pct: 88, message: "Sincronizando datos en la nube para todos los usuarios..." });
    await yieldUI();

    const meta: XlsxMeta = {
        fileName: file.name,
        loadedAt: new Date().toISOString(),
        totalRows,
        totalOrders: orders.length,
    };

    await indexedDbService.saveOrders(orders);
    await indexedDbService.saveMeta(meta);

    // Sincronizar a Supabase para que todos los usuarios (vendedores, asesores, etc.) vean los datos
    try {
        await syncUploadedOrdersToSupabase(orders, (pct, msg) => {
            onProgress({ phase: "saving", pct, message: msg });
        });
    } catch (e) {
        console.warn("Sincronización en la nube:", e);
    }

    onProgress({ phase: "success", pct: 100, message: "Datos cargados y sincronizados exitosamente" });

    return { orders, meta };
}
