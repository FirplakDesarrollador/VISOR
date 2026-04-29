"use client";

import { useState, useEffect, useMemo } from 'react';
import { getUsers, updateUserRole, getDistinctVendedores, UserManagement as UserType } from '@/services/userService';
import { storageService } from '@/services/storageService';

interface UserManagementProps {
    onClose: () => void;
}

export default function UserManagement({ onClose }: UserManagementProps) {
    // Cargar datos iniciales desde el caché para que sea instantáneo
    const [users, setUsers] = useState<UserType[]>(() => storageService.getUsers());
    const [vendedores, setVendedores] = useState<string[]>(() => storageService.getVendedores());
    const [loading, setLoading] = useState(users.length === 0);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [openMultiSelect, setOpenMultiSelect] = useState<string | null>(null);

    const roles = ['Administrador', 'Vendedor', 'BackOffice'];

    useEffect(() => {
        const loadData = async () => {
            // No mostramos loading si ya tenemos datos del caché
            if (users.length === 0) setLoading(true);
            
            try {
                const [usersData, vendedoresData] = await Promise.all([
                    getUsers(),
                    getDistinctVendedores()
                ]);
                
                setUsers(usersData);
                setVendedores(vendedoresData);
                
                // Guardar en caché para la próxima vez
                storageService.saveUsers(usersData);
                storageService.saveVendedores(vendedoresData);
            } catch (err) {
                if (users.length === 0) setError('Error al cargar datos iniciales.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleRoleChange = async (userEmail: string, newRole: string, assignedVendors: string[] = []) => {
        setUpdating(userEmail);
        try {
            const success = await updateUserRole(userEmail, newRole, assignedVendors);
            if (success) {
                const updatedUsers = users.map(u => u.correo === userEmail ? { 
                    ...u, 
                    Rol_Visor: newRole,
                    Vendedor_asignado: assignedVendors
                } : u);
                setUsers(updatedUsers);
                storageService.saveUsers(updatedUsers); // Actualizar caché inmediatamente
            } else {
                alert('No se pudo actualizar el usuario. Verifica la conexión.');
            }
        } catch (error) {
            alert('Error de conexión.');
        } finally {
            setUpdating(null);
        }
    };

    const toggleVendor = (user: UserType, vendor: string) => {
        const current = user.Vendedor_asignado || [];
        const isSelected = current.includes(vendor);
        const updated = isSelected 
            ? current.filter(v => v !== vendor)
            : [...current, vendor];
        
        handleRoleChange(user.correo, 'Vendedor', updated);
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return users.filter(u => {
            const correoMatch = u.correo?.toLowerCase().includes(term);
            const nombreMatch = `${u.nombres || ''} ${u.apellidos || ''}`.toLowerCase().includes(term);
            return correoMatch || nombreMatch;
        });
    }, [users, searchTerm]);

    return (
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 w-full mb-8">
            <div className="bg-[#0A2A5C] px-8 py-5 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
                
                <div className="relative z-10">
                    <h2 className="text-xl font-black text-white uppercase tracking-[0.1em]">Gestión de Usuarios</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-0.5 bg-orange-500 rounded-full" />
                        <p className="text-white/50 text-[9px] font-bold uppercase tracking-[0.2em]">Administración de Accesos</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="relative z-10 p-2.5 bg-white/5 hover:bg-white/15 rounded-xl transition-all text-white/70 hover:text-white border border-white/10 hover:scale-105 active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-6">
                <div className="mb-6">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-lg group-focus-within:bg-blue-500/10 transition-all duration-500" />
                        <input 
                            type="text"
                            placeholder="Buscar por nombre, correo o rol..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="relative w-full pl-12 pr-6 py-3.5 bg-slate-50/50 border border-slate-200/60 rounded-[1rem] text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 outline-none transition-all duration-300 shadow-sm"
                        />
                        <svg className="w-5 h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="skeleton h-20 w-full rounded-[1.25rem] shadow-sm border border-slate-100/50"></div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{error}</h3>
                        <p className="text-slate-400 text-sm font-bold mt-2 mb-8 uppercase tracking-widest">Falla crítica en la sincronización</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-10 py-3 bg-[#0A2A5C] text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-900 transition-all shadow-xl shadow-blue-900/20 active:scale-95"
                        >
                            Reintentar Conexión
                        </button>
                    </div>
                ) : (
                    <div className="overflow-visible border border-slate-100/50 rounded-[1.5rem] shadow-sm bg-white/50 backdrop-blur-sm">
                        <div className="max-h-[550px] overflow-y-auto custom-scrollbar pb-60 px-1">
                            <table className="w-full text-left border-separate border-spacing-y-1.5">
                                <thead className="sticky top-0 z-[60] bg-white/80 backdrop-blur-md">
                                    <tr>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Usuario / Identidad</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Rol Asignado</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Asesores Vinculados</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Configuración</th>
                                    </tr>
                                </thead>
                                <tbody className="space-y-1">
                                    {filteredUsers.map((user) => (
                                        <tr 
                                            key={user.correo} 
                                            className={`group transition-all duration-300 rounded-xl ${
                                                openMultiSelect === user.correo 
                                                ? 'z-[50] relative bg-blue-50/40 shadow-md scale-[1.005]' 
                                                : 'hover:bg-slate-50'
                                            }`}
                                            style={{ zIndex: openMultiSelect === user.correo ? 50 : 1 }}
                                        >
                                            <td className="px-4 py-3 first:rounded-l-xl last:rounded-r-xl">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 tracking-tight group-hover:text-primary transition-colors">{`${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Usuario sin nombre'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 tracking-wide mt-0.5">{user.correo}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] shadow-sm ${
                                                    user.Rol_Visor === 'Administrador' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                    user.Rol_Visor === 'BackOffice' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                    user.Rol_Visor === 'Vendedor' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                    'bg-slate-50 text-slate-400 border border-slate-100'
                                                }`}>
                                                    {user.Rol_Visor || 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.Rol_Visor === 'Vendedor' ? (
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setOpenMultiSelect(openMultiSelect === user.correo ? null : user.correo)}
                                                            className={`flex items-center justify-between gap-3 px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest w-full shadow-sm hover:shadow-md ${
                                                                (user.Vendedor_asignado?.length || 0) > 0 
                                                                    ? 'bg-blue-600 border-blue-600 text-white' 
                                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
                                                            }`}
                                                        >
                                                            <span>{(user.Vendedor_asignado?.length || 0)} Seleccionados</span>
                                                            <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${openMultiSelect === user.correo ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>

                                                        {openMultiSelect === user.correo && (
                                                            <div className="absolute top-full left-0 mt-2 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
                                                                <div className="p-2 space-y-0.5">
                                                                    {vendedores.map(v => (
                                                                        <div 
                                                                            key={v}
                                                                            onClick={() => toggleVendor(user, v)}
                                                                            className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all ${
                                                                                user.Vendedor_asignado?.includes(v) 
                                                                                    ? 'bg-orange-50 border border-orange-100' 
                                                                                    : 'hover:bg-slate-50 border border-transparent'
                                                                     }`}
                                                                        >
                                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                                                                                user.Vendedor_asignado?.includes(v)
                                                                                    ? 'bg-orange-500 border-orange-500'
                                                                                    : 'border-slate-300 bg-white'
                                                                            }`}>
                                                                                {user.Vendedor_asignado?.includes(v) && (
                                                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                )}
                                                                            </div>
                                                                            <span className={`text-[9px] font-black uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${
                                                                                user.Vendedor_asignado?.includes(v) ? 'text-orange-700' : 'text-slate-600'
                                                                            }`}>
                                                                                {v}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="pt-2 sticky bottom-0 bg-white border-t border-slate-50">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); setOpenMultiSelect(null); }}
                                                                            className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-orange-600/30 active:scale-95"
                                                                        >
                                                                            Listo
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-300 italic uppercase tracking-[0.3em] pl-4">No Aplica</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right first:rounded-l-xl last:rounded-r-xl">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select 
                                                        disabled={updating === user.correo}
                                                        value={user.Rol_Visor || ''}
                                                        onChange={(e) => handleRoleChange(user.correo, e.target.value, e.target.value === 'Vendedor' ? user.Vendedor_asignado : [])}
                                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all cursor-pointer disabled:opacity-50 hover:bg-white"
                                                    >
                                                        <option value="" disabled>Rol</option>
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
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
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
