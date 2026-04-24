"use client";

import { useState, useEffect } from 'react';
import { getUsers, updateUserRole, UserManagement as UserType } from '@/services/userService';

interface UserManagementProps {
    onClose: () => void;
}

export default function UserManagement({ onClose }: UserManagementProps) {
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const roles = ['Administrador', 'Vendedor', 'BackOffice'];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getUsers();
            if (data.length === 0) {
                // Si la función devuelve [] pero no tiró excepción, puede ser un error silencioso
                // o que realmente no hay usuarios (poco probable para un administrador).
            }
            setUsers(data);
        } catch (err) {
            setError('La base de datos tardó demasiado en responder.');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userEmail: string, newRole: string) => {
        setUpdating(userEmail);
        try {
            const success = await updateUserRole(userEmail, newRole);
            if (success) {
                setUsers(users.map(u => u.correo === userEmail ? { ...u, Rol_Visor: newRole } : u));
            } else {
                alert('No se pudo actualizar el rol. Verifica los permisos en Supabase (RLS).');
            }
        } catch (error) {
            alert('Error de conexión al actualizar el rol.');
        } finally {
            setUpdating(null);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter(u => 
        u.correo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${u.nombres} ${u.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-[#0A2A5C] px-8 py-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">Gestión de Usuarios</h2>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mt-1">Configuración de roles y accesos</p>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-8">
                <div className="mb-6">
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Buscar por nombre o correo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                        <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Usuarios...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{error}</h3>
                        <p className="text-slate-500 text-sm font-medium mt-2 mb-6">Parece que la conexión con Supabase es inestable o hay muchos datos.</p>
                        <button 
                            onClick={fetchUsers}
                            className="px-6 py-2 bg-[#0A2A5C] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20"
                        >
                            Reintentar Conexión
                        </button>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                    <tr className="border-bottom border-slate-100">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario / Email</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Rol Actual</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.correo} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 tracking-tight">{`${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Sin Nombre'}</span>
                                                    <span className="text-xs font-bold text-slate-400">{user.correo}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    user.Rol_Visor === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                                                    user.Rol_Visor === 'BackOffice' || user.Rol_Visor === 'Backoffice' ? 'bg-blue-100 text-blue-700' :
                                                    user.Rol_Visor === 'Vendedor' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {user.Rol_Visor || 'SIN ROL'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select 
                                                        disabled={updating === user.correo}
                                                        value={user.Rol_Visor || ''}
                                                        onChange={(e) => handleRoleChange(user.correo, e.target.value)}
                                                        className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="" disabled>Asignar Rol</option>
                                                        {roles.map(role => (
                                                            <option key={role} value={role}>{role}</option>
                                                        ))}
                                                    </select>
                                                    {updating === user.correo && (
                                                        <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                                No se encontraron usuarios coincidentes.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
