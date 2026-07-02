// ============================================================
// xlsxParserService.ts
// Lee un archivo .xlsx del usuario, lo convierte a Order[]
// reutilizando la logica existente de visorService, y persiste
// en IndexedDB para que los datos sobrevivan al reload.
// ============================================================
import { VisorRow, Order } from "@/types";
import { groupRowsIntoOrders, mapOrdersToExecutive } from "./visorService";
import { indexedDbService, XlsxMeta } from "./indexedDbService";

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
    const utcDays = Math.floor(serial - 25569);
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

    // Fase 2: Parsear XLSX (bloqueante ~2-5s para 85k filas)
    onProgress({ phase: "parsing", pct: 15, message: "Analizando estructura del archivo..." });
    await yieldUI(); // asegura que React renderice el estado antes del bloqueo

    // @ts-ignore - Ignore type definitions for the dist bundle
    const xlsxModule = await import("xlsx/dist/xlsx.full.min.js");
    const XLSX = xlsxModule.default || xlsxModule;

    const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: false,   // mas rapido
        cellNF: false,
        cellStyles: false,
        sheetStubs: false,
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    onProgress({ phase: "parsing", pct: 40, message: "Convirtiendo filas..." });
    await yieldUI();

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: true,
    });

    // Corregir fechas seriales de Excel a formato YYYY-MM-DD
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
        pct: 85,
        message: `${orders.length.toLocaleString("es-CO")} ordenes generadas`,
        processedRows: totalRows,
        totalRows,
    });
    await yieldUI();

    // Fase 4: Guardar en IndexedDB
    onProgress({ phase: "saving", pct: 88, message: "Guardando datos en disco local..." });
    await yieldUI();

    const meta: XlsxMeta = {
        fileName: file.name,
        loadedAt: new Date().toISOString(),
        totalRows,
        totalOrders: orders.length,
    };

    await indexedDbService.saveOrders(orders);
    await indexedDbService.saveMeta(meta);

    onProgress({ phase: "success", pct: 100, message: "Datos cargados exitosamente" });

    return { orders, meta };
}
