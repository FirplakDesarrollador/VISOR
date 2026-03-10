"use client";

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import OrderCard from '@/components/OrderCard';
import TableView from '@/components/TableView';
import OrderDetail from '@/components/OrderDetail';
import Dashboard from '@/components/Dashboard';
import FilterBar, { SearchFilters } from '@/components/FilterBar';
import LoginModal from '@/components/LoginModal';
import Pagination from '@/components/Pagination';
import { supabase } from '@/services/supabase';
import { getOrdersFromVisor } from '@/services/visorService';
import { storageService } from '@/services/storageService';
import { Order, User, UserRole } from '@/types';

export default function Home() {
  // --- CORE STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pedidos'>('pedidos');

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loading, setLoading] = useState(true); // Start as loading to avoid flash
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  // --- PERSISTENCE INITIALIZATION ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filters, setFilters] = useState<SearchFilters>({
    ov: '', oc: '', clientName: '', nit: ''
  });
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const itemsPerPage = 12;

  // --- INITIAL MOUNT: Load persistence and check session ---
  useEffect(() => {
    // 1. Restore from storageService
    const saved = storageService.loadState();
    if (saved) {
      if (saved.filters) setFilters(saved.filters);
      if (saved.activeStatusFilter !== undefined) setActiveStatusFilter(saved.activeStatusFilter);
      if (saved.currentPage) setCurrentPage(saved.currentPage);
      if (saved.hasSearched !== undefined) setHasSearched(saved.hasSearched);
    }

    // 2. Initial Auth Check
    const checkInitialAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userEmail = session.user.email || '';
          const rawRole = (session.user.user_metadata?.role as string) || 'Asesor';
          
          // Elevación de privilegios: Si el correo es de los autorizados o el rol contiene "back"
          const backofficeEmails = [
            'mayerly.marin@firplak.com',
            'ximena.ballestas@firplak.com',
            'tatiana.duque@firplak.com',
            'auxiliar.digitacion@firplak.com',
            'luis.escobar@firplak.com',
            'daniela.castro@firplak.com',
            'juan.correa@firplak.com',
            'marketplace@firplak.com',
            'manuela.henao@firplak.com',
            'ismael.correa@firplak.com',
            'alejandro.isaza@firplak.com',
            'servicios@firplak.com',
            'servicios2@firplak.com',
            'isabel.jaramillo@firplak.com',
            'paula.guevara@firplak.com',
            'analista2.desarrollo@firplak.com',
          ];
          const normalizedRole = backofficeEmails.includes(userEmail.toLowerCase()) || rawRole.toLowerCase().includes('back') 
            ? 'Backoffice' 
            : 'Asesor';
          
          setUser({
            id: session.user.id,
            email: userEmail,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            role: normalizedRole
          });
        }
      } catch (error) {
        console.error("Initial auth check failed", error);
      } finally {
        setIsSessionChecked(true); // Always proceed after check
      }
    };
    checkInitialAuth();

    // 3. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userEmail = session.user.email || '';
        const rawRole = (session.user.user_metadata?.role as string) || 'Asesor';
        const backofficeEmails = [
            'mayerly.marin@firplak.com',
            'ximena.ballestas@firplak.com',
            'tatiana.duque@firplak.com',
            'auxiliar.digitacion@firplak.com',
            'luis.escobar@firplak.com',
            'daniela.castro@firplak.com',
            'juan.correa@firplak.com',
            'marketplace@firplak.com',
            'manuela.henao@firplak.com',
            'ismael.correa@firplak.com',
            'alejandro.isaza@firplak.com',
            'servicios@firplak.com',
            'servicios2@firplak.com',
            'isabel.jaramillo@firplak.com',
            'paula.guevara@firplak.com',
            'analista2.desarrollo@firplak.com',
          ];
        const normalizedRole = backofficeEmails.includes(userEmail.toLowerCase()) || rawRole.toLowerCase().includes('back') 
          ? 'Backoffice' 
          : 'Asesor';

        setUser({
          id: session.user.id,
          email: userEmail,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
          role: normalizedRole
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- TAB REDIRECT: Ensure dashboard access only for users ---
  useEffect(() => {
    if (!user && activeTab === 'dashboard') {
      setActiveTab('pedidos');
    }
  }, [user, activeTab]);

  // --- PERSISTENCE SAVE ---
  useEffect(() => {
    storageService.saveState({ filters, activeStatusFilter, currentPage, hasSearched });
  }, [filters, activeStatusFilter, currentPage, hasSearched]);

  // --- HELPERS ---
  const applyFiltering = useCallback((data: Order[], searchFilters: SearchFilters, statusFilter: string | null) => {
    const normalize = (str: string) =>
      (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    let matches = data;

    if (user) {
      matches = data.filter(order => {
        const ov = normalize(order.numero_orden_venta);
        const searchOV = normalize(searchFilters.ov);
        const oc = normalize(order.numero_orden_compra || '');
        const searchOC = normalize(searchFilters.oc);
        const client = normalize(order.nombre_cliente);
        const searchClient = normalize(searchFilters.clientName);
        const nit = (order.nit_cliente || '').trim();
        const searchNIT = (searchFilters.nit || '').trim();

        const matchOV = !searchOV || ov.includes(searchOV);
        const matchOC = !searchOC || oc.includes(searchOC);
        const matchClient = !searchClient || client.includes(searchClient);
        const matchNIT = !searchNIT || nit.includes(searchNIT);

        let matchStatus = true;
        const state = normalize(order.estado_orden);

        if (statusFilter === 'Pendiente') {
          matchStatus = state.includes('pendiente') || state === '';
        } else if (statusFilter === 'En Producción') {
          matchStatus = state.includes('produccion') || state.includes('proceso');
        } else if (statusFilter === 'Transito') {
          matchStatus = (state.includes('transito') || state.includes('facturada') || state.includes('despachada')) && !state.includes('entregada');
        } else if (statusFilter === 'Entregada') {
          matchStatus = state.includes('entregada');
        }

        return matchOV && matchOC && matchClient && matchNIT && matchStatus;
      });
    } else {
      // Public search logic (exact match)
      matches = data.filter(order => {
        const matchOV = !searchFilters.ov || normalize(order.numero_orden_venta) === normalize(searchFilters.ov);
        const matchOC = !searchFilters.oc || normalize(order.numero_orden_compra || '') === normalize(searchFilters.oc);
        const matchNIT = !searchFilters.nit || (order.nit_cliente || '').trim() === searchFilters.nit.trim();
        return (searchFilters.ov || searchFilters.oc || searchFilters.nit) && (matchOV && matchOC && matchNIT);
      });
    }
    // Ordenar por fecha de ingreso (Descendente - más recientes primero)
    const sorted = [...matches].sort((a, b) => {
      const dateA = a.fecha_ingreso || '';
      const dateB = b.fecha_ingreso || '';
      return dateB.localeCompare(dateA);
    });

    setFilteredOrders(sorted);
  }, [user, hasSearched]);

  // --- DATA FETCHING ---
  // Only re-fetch when the user/role changes or session is first checked.
  useEffect(() => {
    if (!isSessionChecked) return;

    const fetchOrders = async () => {
      // Solo mostramos el esqueleto de carga si no tenemos datos previos
      // para evitar el "flickering" visual en actualizaciones de sesión.
      if (allOrders.length === 0) {
        setLoading(true);
      }
      
      try {
        const role = user ? user.role : 'Externo';

        // Mapa explícito de correo → nombre exacto en columna Vendedor de la BD
        // Usar cuando el nombre derivado del email no coincide con el nombre en la BD
        const emailToVendedorName: Record<string, string> = {
          'yaneth.rojas@firplak.com': 'Yaneth Rojas',
        };

        // Prioridad: mapa explícito > nombre de sesión > nombre derivado del email
        const nameFromEmail = user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ') : undefined;
        const mappedName = user?.email ? emailToVendedorName[user.email.toLowerCase()] : undefined;
        const vendedorFilter = role === 'Asesor' ? (mappedName || user?.name || nameFromEmail) : undefined;

        const data = await getOrdersFromVisor(role, vendedorFilter);
        setAllOrders(data);
      } catch (error) {
        console.error("Fetch orders failed", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, isSessionChecked]);

  // --- LOCAL FILTERING ---
  // This handles search and status filters locally without triggering the global loading state.
  useEffect(() => {
    applyFiltering(allOrders, filters, activeStatusFilter);
  }, [allOrders, filters, activeStatusFilter, applyFiltering]);

  const counts = (() => {
    const normalize = (str: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return {
      pending: allOrders.filter(o => {
        const s = normalize(o.estado_orden);
        return s.includes('pendiente') || s === '';
      }).length,
      production: allOrders.filter(o => {
        const s = normalize(o.estado_orden);
        return s.includes('produccion') || s.includes('proceso');
      }).length,
      transit: allOrders.filter(o => {
        const s = normalize(o.estado_orden);
        return (s.includes('transito') || s.includes('facturada') || s.includes('despachada')) && !s.includes('entregada');
      }).length,
      delivered: allOrders.filter(o => {
        const s = normalize(o.estado_orden);
        return s.includes('entregada');
      }).length
    };
  })();

  const handleSearch = (newFilters: SearchFilters = filters, statusFilter: string | null = activeStatusFilter) => {
    setHasSearched(true);
    setCurrentPage(1);
    setFilters(newFilters);
    applyFiltering(allOrders, newFilters, statusFilter);
  };

  const handleDownload = () => {
    if (allOrders.length === 0) return;

    // 1. Preparar la data plana (aplanar órdenes con sus ítems)
    const exportData = allOrders.flatMap(order => 
      order.items.map(item => ({
        "Fecha Ingreso": order.fecha_ingreso,
        "Orden Venta": order.numero_orden_venta,
        "Orden Compra": order.numero_orden_compra || '',
        "Tipo OV": order.tipo_orden_venta,
        "Cliente": order.nombre_cliente,
        "NIT": order.nit_cliente,
        "Sala": order.nombre_sala || '',
        "Vendedor": order.vendedor || '',
        "Estado General": order.estado_orden,
        "Ciudad Destino": order.ciudad_destino,
        "Familia": item.familia || '',
        "Código Producto": item.codigo_producto,
        "Descripción Producto": item.descripcion_producto,
        "Componente": item.componente || '',
        "Situación": item.situacion_item || '',
        "Cant. Pedida": item.cantidad_pedida,
        "Cant. Facturada": item.cantidad_facturada,
        "Cant. Despacho": item.cantidad_despacho,
        "Cant. Producción": item.cantidad_produccion,
        "Cant. Planificada": item.cantidad_planificada,
        "Estado Prod.": item.estado_produccion || 'Pendiente',
        "Fecha Despacho Plan": order.fecha_plan_despacho,
        "Fecha Real Despacho": order.fecha_real_despacho || '',
        "Transportadora": order.transportador || '',
        "Guía de Seguimiento": order.numero_guia || '',
        "Estado Despacho": order.estado_despacho || '',
        "Fecha Estimada Entrega": order.fecha_estimada_entrega || '',
        "Fecha Real Entrega": order.fecha_entrega || '',
        "Estado Real": item.cantidad_facturada >= item.cantidad_pedida ? "🟢 COMPLETADO" : 
                       item.cantidad_facturada > 0 ? "🟡 EN PROCESO" : "⚪ PENDIENTE",
        "Factura": order.numero_factura || '',
        "Fecha Factura": order.fecha_factura || '',
        "Envío": order.envio || item.envio || ''
      }))
    );

    // 2. Crear el libro y la hoja
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");

    // 3. Ajustar el ancho de las columnas automáticamente
    const max_widths = Object.keys(exportData[0]).map(key => ({
      wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key]).length)) + 2
    }));
    worksheet['!cols'] = max_widths;

    // 4. Agregar filtros automáticos a la fila de encabezados
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:Z1");
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

    // 5. Generar y descargar el archivo
    XLSX.writeFile(workbook, `Reporte_Pedidos_Firplak_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Premium Navigation Header */}
      <nav className="sticky top-0 z-50 bg-primary shadow-2xl shadow-primary/20 border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <div className="flex flex-col items-start">
                <span className="text-white font-black text-xl tracking-tight leading-none uppercase">Seguimiento de Pedidos</span>
                <span className="text-white/40 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Plataforma Logística</span>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-1 pl-6 border-l border-white/10">
              {user && (
                <button 
                  onClick={() => { setActiveTab('dashboard'); setSelectedOrder(null); }}
                  className={`px-4 py-2 text-sm font-bold transition-all rounded-xl ${activeTab === 'dashboard' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  Dashboard
                </button>
              )}
              <button 
                onClick={() => { setActiveTab('pedidos'); setSelectedOrder(null); }}
                className={`px-4 py-2 text-sm font-bold transition-all rounded-xl ${activeTab === 'pedidos' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                Pedidos
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Dynamic badges or user info could go here if needed in header */}
             <div className="hidden sm:flex items-center gap-2 py-1.5 px-3 bg-white/5 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest whitespace-nowrap">Conexión Segura</span>
             </div>
          </div>
        </div>
      </nav>

      <main className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 py-8">
        <div className="transition-all duration-700 ease-in-out">
          {loading ? (
            <div className="space-y-8 animate-pulse">
              <div className="h-64 bg-slate-200 rounded-[2rem]"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-32 bg-slate-200 rounded-2xl"></div>
                <div className="h-32 bg-slate-200 rounded-2xl"></div>
              </div>
            </div>
          ) : selectedOrder ? (
            <OrderDetail
              order={selectedOrder}
              role={user?.role === 'Asesor' ? 'Asesor' : 'Backoffice'}
              onBack={() => setSelectedOrder(null)}
            />
          ) : activeTab === 'dashboard' ? (
            <Dashboard orders={allOrders} />
          ) : (
            <>
              <FilterBar
                user={user ? { ...user, role: user.role === 'Asesor' ? 'Asesor' : 'Backoffice' } : null}
                onLoginClick={() => setIsLoginOpen(true)}
                onLogoutClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  storageService.clearState();
                }}
                totalOrders={filteredOrders.length}
                counts={counts}
                activeStatusFilter={activeStatusFilter}
                onStatusFilterChange={(status) => {
                  setActiveStatusFilter(status);
                  handleSearch(filters, status);
                }}
                filters={filters}
                onFilterChange={setFilters}
                onSearch={handleSearch}
                onDownload={handleDownload}
              />

              <div className="relative min-h-[500px]">
                {filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 border border-slate-200 shadow-inner">
                      <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {user ? (
                      <>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Sin órdenes encontradas</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-2 font-medium">No hay pedidos asignados que coincidan con los criterios actuales de búsqueda.</p>
                      </>
                    ) : (
                      <>
                        {hasSearched ? (
                          <>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Sin resultados exactos</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 font-medium">Asegúrate de haber ingresado el número de orden y NIT de forma idéntica a tu comprobante.</p>
                          </>
                        ) : (
                          <>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Bienvenido al Portal</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 font-medium">Ingresa los datos de tu pedido arriba para realizar la consulta en tiempo real.</p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : user ? (
                  <TableView 
                    orders={filteredOrders} 
                    onOrderClick={setSelectedOrder} 
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
                      {filteredOrders
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((order) => (
                          <OrderCard
                            key={order.numero_orden_venta}
                            order={order}
                            onClick={setSelectedOrder}
                          />
                        ))}
                    </div>

                    <div className="mt-12 flex justify-center">
                      <Pagination
                        currentPage={currentPage}
                        totalItems={filteredOrders.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="py-12 border-t border-slate-200 mt-20">
        <div className="max-w-[1600px] mx-auto px-6 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Firplak SA &copy; {new Date().getFullYear()} - Gestión de Pedidos</p>
        </div>
      </footer>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={async (email, password) => {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) return false;
          return !!data.user;
        }}
      />
    </div>
  );
}
