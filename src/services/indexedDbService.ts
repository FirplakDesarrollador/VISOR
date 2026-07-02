// ============================================================
// indexedDbService.ts v2
// Usa REGISTROS INDIVIDUALES (no un blob gigante) para que
// getAll() en IndexedDB sea rapido con ~15k ordenes.
// Un blob de 50 MB tarda 20s en deserializar; registros
// individuales con keyPath se leen en <2s.
// ============================================================

const DB_NAME = "visor_xlsx_v2";
const DB_VERSION = 1;
const ORDERS_STORE = "orders";
const META_STORE = "meta";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            reject(new Error("IndexedDB no disponible"));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            // Ordenes: cada registro es una Order (keyPath = numero_orden_venta)
            if (!db.objectStoreNames.contains(ORDERS_STORE)) {
                db.createObjectStore(ORDERS_STORE, { keyPath: "numero_orden_venta" });
            }
            // Meta: id fijo = "meta"
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export interface XlsxMeta {
    fileName: string;
    loadedAt: string;
    totalRows: number;
    totalOrders: number;
}

export const indexedDbService = {
    /** Guarda cada orden como registro individual en una sola transaccion */
    async saveOrders(orders: any[]): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ORDERS_STORE, "readwrite");
            const store = tx.objectStore(ORDERS_STORE);
            store.clear();
            for (const order of orders) {
                store.put(order);
            }
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },

    /** Lee todas las ordenes. getAll() sobre registros individuales es mucho mas rapido que un blob */
    async getOrders<T = unknown>(): Promise<T[]> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ORDERS_STORE, "readonly");
            const req = tx.objectStore(ORDERS_STORE).getAll();
            req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
            req.onerror = () => { db.close(); reject(req.error); };
        });
    },

    async saveMeta(meta: XlsxMeta): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(META_STORE, "readwrite");
            tx.objectStore(META_STORE).put({ id: "meta", ...meta });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },

    async getMeta(): Promise<XlsxMeta | null> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(META_STORE, "readonly");
            const req = tx.objectStore(META_STORE).get("meta");
            req.onsuccess = () => {
                db.close();
                const result = req.result;
                if (!result) { resolve(null); return; }
                const { id, ...meta } = result;
                resolve(meta as XlsxMeta);
            };
            req.onerror = () => { db.close(); reject(req.error); };
        });
    },

    async hasData(): Promise<boolean> {
        const meta = await this.getMeta();
        return meta !== null;
    },

    async clearAll(): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([ORDERS_STORE, META_STORE], "readwrite");
            tx.objectStore(ORDERS_STORE).clear();
            tx.objectStore(META_STORE).clear();
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },
};
