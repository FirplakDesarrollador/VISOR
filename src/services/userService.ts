import { supabase } from './supabase';

export interface UserManagement {
    id: number;
    correo: string;
    nombres?: string;
    apellidos?: string;
    Rol_Visor?: string;
}

export const getUsers = async (): Promise<UserManagement[]> => {
    const { data, error } = await supabase
        .from('Usuarios')
        .select('id, correo, nombres, apellidos, Rol_Visor');
    
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    
    return data as UserManagement[];
};

export const updateUserRole = async (userId: number, role: string): Promise<boolean> => {
    const { error } = await supabase
        .from('Usuarios')
        .update({ Rol_Visor: role })
        .eq('id', userId);
    
    if (error) {
        console.error('Error updating user role:', error);
        return false;
    }
    
    return true;
};
