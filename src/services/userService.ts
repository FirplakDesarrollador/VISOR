import { supabase } from './supabase';

export interface UserManagement {
    id: number;
    correo: string;
    nombres?: string;
    apellidos?: string;
    Rol_Visor?: string;
    Vendedor_asignado?: string[]; // Array en la app, texto en la BD
}

export const getUsers = async (): Promise<UserManagement[]> => {
    try {
        console.log('Solicitando lista de usuarios...');
        const { data, error } = await supabase
            .from('Usuarios')
            .select('id, correo, nombres, apellidos, Rol_Visor, Vendedor_asignado')
            .order('correo');
        
        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        
        const processedData = (data || []).map(u => {
            const rawVendedores = u.Vendedor_asignado || '';
            const assignedVendors = rawVendedores.split(',')
                .map((v: string) => v.trim())
                .filter((v: string) => v !== '');
            
            return {
                ...u,
                Vendedor_asignado: assignedVendors
            };
        });

        // Eliminar duplicados por correo (priorizando el que tenga nombre)
        const uniqueUsersMap = new Map<string, any>();
        processedData.forEach(user => {
            if (!user.correo) return; // Ignorar registros sin correo
            
            const email = user.correo.toLowerCase();
            const existing = uniqueUsersMap.get(email);
            
            if (!existing || (!existing.nombres && user.nombres)) {
                uniqueUsersMap.set(email, user);
            }
        });

        const finalData = Array.from(uniqueUsersMap.values()) as UserManagement[];
        console.log(`Se cargaron ${finalData.length} usuarios únicos.`);
        return finalData;
    } catch (e: any) {
        console.error('Unexpected error in getUsers:', e.message || e);
        return [];
    }
};

export const getDistinctVendedores = async (): Promise<string[]> => {
    try {
        const { data, error } = await supabase
            .from('vendedores_distintos')
            .select('vendedor');

        if (error) {
            console.error('Error fetching distinct vendedores:', error);
            return [];
        }

        const vendors = data
            .map(r => r.vendedor?.trim())
            .filter(v => v && v !== 'null');
        
        return vendors;
    } catch (e: any) {
        console.error('Unexpected error in getDistinctVendedores:', e.message || e);
        return [];
    }
};

export const updateUserRole = async (userEmail: string, role: string, assignedVendors: string[] = []): Promise<boolean> => {
    const trimmedEmail = userEmail?.trim();
    if (!trimmedEmail) return false;

    try {
        console.log(`Actualizando rol y vendedores para ${trimmedEmail}...`);
        
        const updateData = {
            Rol_Visor: role,
            Vendedor_asignado: assignedVendors.join(',')
        };

        const { data, error } = await supabase
            .from('Usuarios')
            .update(updateData)
            .eq('correo', trimmedEmail)
            .select();
        
        if (error || !data || data.length === 0) {
            if (error) console.error('Error en Supabase (Update):', error);
            
            // Fallback: Si el registro no existe, intentamos upsert
            const { data: upsertData, error: upsertError } = await supabase
                .from('Usuarios')
                .upsert({ correo: trimmedEmail, ...updateData }, { onConflict: 'correo' })
                .select();
                
            if (upsertError) {
                console.error('Error en Supabase (Upsert Fallback):', upsertError);
                return false;
            }
            return !!(upsertData && upsertData.length > 0);
        }

        return true;
    } catch (e: any) {
        console.error('Error inesperado:', e.message || e);
        return false;
    }
};
