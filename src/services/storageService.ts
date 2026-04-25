import { SearchFilters } from "@/components/FilterBar";

const STORAGE_KEY = 'visor_state';
const ORDERS_KEY = 'app_cache_orders';
const USERS_KEY = 'app_cache_users';
const VENDORS_KEY = 'app_cache_vendedores';

export interface VisorState {
    filters: SearchFilters;
    activeStatusFilter: string | null;
    currentPage: number;
    hasSearched: boolean;
    envioFilter?: string | null;
}

export const storageService = {
    saveState: (state: VisorState) => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.error("Error saving state to localStorage", e);
            }
        }
    },

    loadState: (): VisorState | null => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (e) {
                console.error("Error loading state from localStorage", e);
            }
        }
        return null;
    },

    clearState: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    },

    saveOrders(orders: any[]) {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 500)));
        } catch (e) {
            console.error("Storage save error", e);
        }
    },

    getOrders(): any[] {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(ORDERS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveUsers(users: any[]) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    },

    getUsers(): any[] {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(USERS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveVendedores(vendedores: string[]) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(VENDORS_KEY, JSON.stringify(vendedores));
    },

    getVendedores(): string[] {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(VENDORS_KEY);
        return data ? JSON.parse(data) : [];
    },

    clearAll() {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ORDERS_KEY);
        localStorage.removeItem(USERS_KEY);
        localStorage.removeItem(VENDORS_KEY);
    }
};
