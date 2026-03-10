"use client";

import { UserRole } from '@/types';
import { useState } from 'react';

interface NavbarProps {
    currentRole: UserRole;
    onRoleChange: (role: UserRole) => void;
}

export default function Navbar({ currentRole, onRoleChange }: NavbarProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-opacity-80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex-shrink-0 flex items-center">
                        {/* Placeholder Logo - In real app use Image */}
                        <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                            FIRPLAK
                        </div>
                        <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Pedidos
                        </span>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Role Switcher for Demo */}
                        <div className="relative">
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <span>Vista: <span className="text-blue-600">{currentRole}</span></span>
                                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {(['Vendedor', 'Backoffice', 'Externo'] as UserRole[]).map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => {
                                                onRoleChange(role);
                                                setIsOpen(false);
                                            }}
                                            className={`block w-full text-left px-4 py-2 text-sm ${currentRole === role ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* User Avatar Placeholder */}
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white">
                            {currentRole[0]}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
