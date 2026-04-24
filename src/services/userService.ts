import { supabase } from './supabase';

export interface UserManagement {
    id: number;
    correo: string;
    nombres?: string;
    apellidos?: string;
    Rol_Visor?: string;
}

export const getUsers = async (): Promise<UserManagement[]> => {
    try {
        console.log('Solicitando lista de usuarios...');
        // Aumentamos el timeout a 30s y quitamos el ordenamiento temporalmente para probar velocidad
        const fetchPromise = supabase
            .from('Usuarios')
            .select('correo, nombres, apellidos, Rol_Visor');

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de 30 segundos')), 30000)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]) as any;
        const { data, error } = response;
        
        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        
        console.log('Usuarios recibidos:', data?.length || 0);
        return data as UserManagement[];
    } catch (e) {
        console.error('Unexpected error in getUsers:', e);
        return [];
    }
};

export const updateUserRole = async (userEmail: string, role: string): Promise<boolean> => {
    const trimmedEmail = userEmail?.trim();
    if (!trimmedEmail) {
        console.error('Error updating user role: No email provided');
        return false;
    }

    try {
        console.log(`Intentando upsert de rol ${role} para ${trimmedEmail}...`);
        
        // Timeout de 30 segundos
        const upsertPromise = supabase
            .from('Usuarios')
            .upsert({ 
                correo: trimmedEmail, 
                Rol_Visor: role 
            }, { onConflict: 'correo' })
            .select();

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de 30 segundos alcanzado')), 30000)
        );

        const response = await Promise.race([upsertPromise, timeoutPromise]) as any;
        const { data, error } = response;
        
        if (error) {
            console.error('Error en Supabase (Upsert):', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return false;
        }

        if (!data || data.length === 0) {
            console.warn('Upsert no devolvió datos. Es posible que no se tengan permisos de escritura (RLS).');
            return false;
        }
        
        console.log('Upsert exitoso:', data);
        return true;
    } catch (e: any) {
        console.error('Error inesperado:', e.message || e);
        return false;
    }
};
