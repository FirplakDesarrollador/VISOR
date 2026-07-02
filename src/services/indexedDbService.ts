// ============================================================
// indexedDbService.ts
// Persistencia de Orders en IndexedDB (sin limite de tamano).
// localStorage tiene ~5 MB de limite; con 85k filas necesitamos
// IndexedDB que soporta cientos de MB.
// ============================================================

const DB_NAME = "visor_xlsx_v1";
const DB_VERSION = 1;
const STORE = "kv";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            reject(new Error("IndexedDB no disponible"));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            (e.target as IDBOpenDBRequest).result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function kvSet(key: string, value: unknown): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

async function kvGet<T>(key: string): Promise<T | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => { db.close(); resolve((req.result as T) ?? null); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

async function kvClear(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export interface XlsxMeta {
    fileName: string;
    loadedAt: string;
    totalRows: number;
    totalOrders: number;
}

export const indexedDbService = {
    async saveOrders(orders: unknown[]): Promise<void> {
        await kvSet("orders", orders);
    },

    async getOrders<T = unknown>(): Promise<T[]> {
        return (await kvGet<T[]>("orders")) ?? [];
    },

    async saveMeta(meta: XlsxMeta): Promise<void> {
        await kvSet("meta", meta);
    },

    async getMeta(): Promise<XlsxMeta | null> {
        return kvGet<XlsxMeta>("meta");
    },

    async hasData(): Promise<boolean> {
        const meta = await this.getMeta();
        return meta !== null;
    },

    async clearAll(): Promise<void> {
        await kvClear();
    },
};
