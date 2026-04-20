import { supabase } from './supabase';
import { VisorRow } from '@/types';

/**
 * Obtiene TODOS los registros de la tabla VISOR sin ningún filtro (SELECT *).
 * Se pagina internamente para evitar el límite de 1000 filas de Supabase.
 */
export const getAllVisorRows = async (): Promise<VisorRow[]> => {
    const PAGE_SIZE = 1000;
    let allRows: VisorRow[] = [];
    let from = 0;
    let keepGoing = true;

    while (keepGoing) {
        const { data, error } = await supabase
            .from('VISOR')
            .select('*')
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('Error fetching VISOR raw data:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            keepGoing = false;
        } else {
            allRows = [...allRows, ...(data as VisorRow[])];
            if (data.length < PAGE_SIZE) {
                keepGoing = false;
            } else {
                from += PAGE_SIZE;
            }
        }
    }

    return allRows;
};
