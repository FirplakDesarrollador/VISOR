import { SearchFilters } from "@/components/FilterBar";

const STORAGE_KEY = 'visor_state';

export interface VisorState {
    filters: SearchFilters;
    activeStatusFilter: string | null;
    currentPage: number;
    hasSearched: boolean;
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
    }
};
