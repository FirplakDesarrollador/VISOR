"use client";

import { useState, useEffect } from 'react';
import { getUsers, updateUserRole, UserManagement as UserType } from '@/services/userService';

interface UserManagementProps {
    onClose: () => void;
}

export default function UserManagement({ onClose }: UserManagementProps) {
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<number | null>(null);

    const roles = ['Administrador', 'Backoffice', 'Asesor', 'Externo'];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const data = await getUsers();
        setUsers(data);
        setLoading(false);
    };

    const handleRoleChange = async (userId: number, newRole: string) => {
        setUpdating(userId);
        const success = await updateUserRole(userId, newRole);
        if (success) {
            setUsers(users.map(u => u.id === userId ? { ...u, Rol_Visor: newRole } : u));
        }
        setUpdating(null);
    };

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
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando Usuarios...</p>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-bottom border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario / Email</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Rol Actual</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 tracking-tight">{`${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Sin Nombre'}</span>
                                                <span className="text-xs font-bold text-slate-400">{user.correo}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                user.Rol_Visor === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                                                user.Rol_Visor === 'Backoffice' || user.Rol_Visor === 'BackOffice' ? 'bg-blue-100 text-blue-700' :
                                                user.Rol_Visor === 'Asesor' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {user.Rol_Visor || 'SIN ROL'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <select 
                                                    disabled={updating === user.id}
                                                    value={user.Rol_Visor || ''}
                                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                    className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer disabled:opacity-50"
                                                >
                                                    <option value="" disabled>Asignar Rol</option>
                                                    {roles.map(role => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                </select>
                                                {updating === user.id && (
                                                    <div className="w-4 h-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                            No se encontraron usuarios en la tabla.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
