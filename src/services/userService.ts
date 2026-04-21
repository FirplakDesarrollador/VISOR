import { supabase } from './supabase';

export interface UserManagement {
    id: number;
    email: string;
    nombre?: string;
    rol_visor?: string;
    permisos_visor?: string;
}

export const getUsers = async (): Promise<UserManagement[]> => {
    const { data, error } = await supabase
        .from('Usuarios')
        .select('*');
    
    if (error) {
        console.error('Error fetching users:', error);
        // Fallback to app_pedidos_usuarios if Usuarios doesn't exist
        const { data: data2, error: error2 } = await supabase
            .from('app_pedidos_usuarios')
            .select('*');
        
        if (error2) {
            console.error('Error fetching users from app_pedidos_usuarios:', error2);
            return [];
        }
        return data2 as UserManagement[];
    }
    
    return data as UserManagement[];
};

export const updateUserRole = async (userId: number, role: string): Promise<boolean> => {
    const { error } = await supabase
        .from('Usuarios')
        .update({ rol_visor: role })
        .eq('id', userId);
    
    if (error) {
        const { error: error2 } = await supabase
            .from('app_pedidos_usuarios')
            .update({ Rol_Visor: role })
            .eq('id', userId);
        
        if (error2) {
            console.error('Error updating user role:', error2);
            return false;
        }
    }
    
    return true;
};
