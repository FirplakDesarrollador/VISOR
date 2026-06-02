"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import OrderCard from '@/components/OrderCard';
import TableView from '@/components/TableView';
import OrderDetail from '@/components/OrderDetail';
import Dashboard from '@/components/Dashboard';
import FilterBar, { SearchFilters } from '@/components/FilterBar';
import LoginModal from '@/components/LoginModal';
import Pagination from '@/components/Pagination';
import UserManagement from '@/components/UserManagement';
import ExecutiveView from '@/components/ExecutiveView';
import { supabase } from '@/services/supabase';
import { storageService } from '@/services/storageService';
import { getOrdersFromVisor, mapOrdersToExecutive } from '@/services/visorService';
import { Order, User, UserRole, ExecutiveOrder } from '@/types';

export default function Home() {
  // --- CORE STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [executiveOrders, setExecutiveOrders] = useState<ExecutiveOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pedidos' | 'config'>('pedidos');
  const [viewMode, setViewMode] = useState<'operativa' | 'ejecutiva'>('operativa');

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loading, setLoading] = useState(true); // Start as loading to avoid flash
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  // --- PERSISTENCE INITIALIZATION ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filters, setFilters] = useState<SearchFilters>({
    ov: '', oc: '', clientName: '', nit: ''
  });
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>('EnProceso');
  const [envioFilter, setEnvioFilter] = useState<string | null>(null);
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
      if (saved.envioFilter !== undefined) setEnvioFilter(saved.envioFilter);
      if ((saved as any).viewMode !== undefined) setViewMode((saved as any).viewMode);
    }

    //Consolidated Auth Check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userEmail = session.user.email || '';
        
        try {
          const { data: dbUser } = await supabase
            .from('Usuarios')
            .select('Rol_Visor, nombres, apellidos, Vendedor_asignado')
            .ilike('correo', userEmail.trim())
            .maybeSingle();

          const dbRole = dbUser?.Rol_Visor || '';
          const rawVendedores = dbUser?.Vendedor_asignado || '';
          const assignedVendors = rawVendedores.split(',')
            .map((v: string) => v.trim())
            .filter((v: string) => v !== '');

          const adminEmails = [
            'mayerly.marin@firplak.com',
            'ismael.correa@firplak.com',
            'alejandro.isaza@firplak.com',
          ];

          const backofficeEmails = [
              'ximena.ballestas@firplak.com',
              'tatiana.duque@firplak.com',
              'auxiliar.digitacion@firplak.com',
              'luis.escobar@firplak.com',
              'daniela.castro@firplak.com',
              'juan.correa@firplak.com',
              'marketplace@firplak.com',
              'manuela.henao@firplak.com',
              'servicios@firplak.com',
              'servicios2@firplak.com',
              'isabel.jaramillo@firplak.com',
              'paula.guevara@firplak.com',
              'analista2.desarrollo@firplak.com',
            ];

          const rawRole = (session.user.user_metadata?.role as string) || 'Asesor';
          let normalizedRole = 'Asesor';
          
          if (dbRole) {
            normalizedRole = dbRole;
          } else if (adminEmails.includes(userEmail.toLowerCase()) || rawRole.toLowerCase().includes('admin')) {
            normalizedRole = 'Administrador';
          } else if (backofficeEmails.includes(userEmail.toLowerCase()) || rawRole.toLowerCase().includes('back')) {
            normalizedRole = 'Backoffice';
          }

          const fullName = dbUser ? `${dbUser.nombres || ''} ${dbUser.apellidos || ''}`.trim() : '';

          const emailName = userEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          setUser({
            id: session.user.id,
            email: userEmail,
            name: fullName || session.user.user_metadata?.full_name || session.user.user_metadata?.name || emailName,
            role: normalizedRole,
            assignedVendor: assignedVendors
          });
        } catch (error) {
          console.error("Auth sync error:", error);
        }
      } else {
        setUser(null);
      }
      setIsSessionChecked(true); // Signal that initial check is done
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- TAB REDIRECT: Ensure dashboard access only for users ---
  useEffect(() => {
    // Redirigir a Pedidos si no hay sesión o si es Vendedor (no tiene acceso a Dashboard)
    if ((!user || user.role === 'Vendedor') && activeTab === 'dashboard') {
      setActiveTab('pedidos');
    }
  }, [user, activeTab]);

  // --- PERSISTENCE SAVE ---
  useEffect(() => {
    storageService.saveState({ filters, activeStatusFilter, currentPage, hasSearched, envioFilter, viewMode } as any);
  }, [filters, activeStatusFilter, currentPage, hasSearched, envioFilter, viewMode]);

  // --- HELPERS (Memoized) ---
  const normalize = useCallback((str: string) =>
    (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

  const isItemInStatus = useCallback((item: any, order: Order, status: string) => {
    const itemState = normalize(item.estado_raw || order.estado_raw || '');
    const itemNormalized = normalize(item.estado_orden || order.estado_orden || '');

    if (status.startsWith('raw:')) {
      const rawVal = status.replace('raw:', '').toLowerCase();
      return itemState.includes(rawVal);
    } 
    
    switch (status) {
      case 'EnProceso':
        return itemNormalized.includes('pendiente') || itemNormalized === '' || itemNormalized.includes('produccion') || itemNormalized.includes('proceso');
      case 'Pendiente':
        return itemNormalized.includes('pendiente') || itemNormalized === '';
      case 'En Producción':
        return itemNormalized.includes('produccion') || itemNormalized.includes('proceso');
      case 'Transito':
        return (itemNormalized.includes('transito') || itemNormalized.includes('facturada') || itemNormalized.includes('despachada')) && !itemNormalized.includes('entregada');
      case 'Entregada':
        return itemNormalized.includes('entregada');
      default:
        return true;
    }
  }, [normalize]);

  // 1. Searched Orders (Apply text filters only)
  const searchedOrders = useMemo(() => {
    if (!user) {
      // Public search logic
      return allOrders.filter(order => {
        const matchOV = !filters.ov || normalize(order.numero_orden_venta) === normalize(filters.ov);
        const matchOC = !filters.oc || normalize(order.numero_orden_compra || '') === normalize(filters.oc);
        const matchNIT = !filters.nit || (order.nit_cliente || '').trim() === filters.nit.trim();
        return (filters.ov || filters.oc || filters.nit) && (matchOV && matchOC && matchNIT);
      });
    }

    // Backoffice search logic
    return allOrders.filter(order => {
      const ov = normalize(order.numero_orden_venta);
      const searchOV = normalize(filters.ov);
      const oc = normalize(order.numero_orden_compra || '');
      const searchOC = normalize(filters.oc);
      const client = normalize(order.nombre_cliente);
      const searchClient = normalize(filters.clientName);
      const nit = (order.nit_cliente || '').trim();
      const searchNIT = (filters.nit || '').trim();

      const matchOV = !searchOV || ov.includes(searchOV);
      const matchOC = !searchOC || oc.includes(searchOC);
      const matchClient = !searchClient || client.includes(searchClient);
      const matchNIT = !searchNIT || nit.includes(searchNIT);

      return matchOV && matchOC && matchClient && matchNIT;
    });
  }, [allOrders, filters, user, normalize]);

  // 2. Status Counts (Optimized: single pass over searched orders)
  const counts = useMemo(() => {
    let base = searchedOrders;
    
    if (envioFilter) {
      base = base.filter(order => {
        const orderEnvio = normalize(order.envio || '');
        const filterVal = normalize(envioFilter);
        return orderEnvio === filterVal || order.items.some(item => normalize(item.envio || '') === filterVal);
      });
    }

    const result = { pending: 0, production: 0, transit: 0, delivered: 0, enProceso: 0 };
    
    base.forEach(o => {
      let hasPending = false;
      let hasProduction = false;
      let hasTransit = false;
      let hasDelivered = false;
      let hasEnProceso = false;

      o.items.forEach(i => {
        if (!hasPending && isItemInStatus(i, o, 'Pendiente')) hasPending = true;
        if (!hasProduction && isItemInStatus(i, o, 'En Producción')) hasProduction = true;
        if (!hasTransit && isItemInStatus(i, o, 'Transito')) hasTransit = true;
        if (!hasDelivered && isItemInStatus(i, o, 'Entregada')) hasDelivered = true;
        if (!hasEnProceso && isItemInStatus(i, o, 'EnProceso')) hasEnProceso = true;
      });

      if (hasPending) result.pending++;
      if (hasProduction) result.production++;
      if (hasTransit) result.transit++;
      if (hasDelivered) result.delivered++;
      if (hasEnProceso) result.enProceso++;
    });

    return result;
  }, [searchedOrders, envioFilter, normalize, isItemInStatus]);

  // 3. Final Filtered Orders (Apply status filter)
  const finalOrders = useMemo(() => {
    let result = searchedOrders;

    if (user && activeStatusFilter) {
      result = searchedOrders.map(order => {
        const filteredItems = order.items.filter(item => isItemInStatus(item, order, activeStatusFilter));
        if (filteredItems.length === 0) return null;
        return { ...order, items: filteredItems };
      }).filter(Boolean) as Order[];
    }

    // Filter by Envio status if applicable
    if (envioFilter) {
      result = result.filter(order => {
        const orderEnvio = normalize(order.envio || '');
        const filterVal = normalize(envioFilter);
        
        // Match order level envio
        const matchOrderEnvio = orderEnvio === filterVal;
        
        // Match item level envio (if any item matches the filter)
        const hasMatchItemEnvio = order.items.some(item => normalize(item.envio || '') === filterVal);
        
        return matchOrderEnvio || hasMatchItemEnvio;
      });
    }

    // Sort by entry date (Descending)
    return [...result].sort((a, b) => {
      const dateA = a.fecha_ingreso || '';
      const dateB = b.fecha_ingreso || '';
      return dateB.localeCompare(dateA);
    });
  }, [searchedOrders, activeStatusFilter, envioFilter, user, normalize, isItemInStatus]);

  // 4. Executive Orders Filtering (Apply text filters only, executive table has its own column filters)
  const finalExecutiveOrders = useMemo(() => {
    return executiveOrders.filter(order => {
      const ov = normalize(order.ov);
      const searchOV = normalize(filters.ov);
      const oc = normalize(order.oc || '');
      const searchOC = normalize(filters.oc);
      const client = normalize(order.cliente || '');
      const searchClient = normalize(filters.clientName);
      const nit = (order.cod_cliente || '').trim();
      const searchNIT = (filters.nit || '').trim();

      const matchOV = !searchOV || ov.includes(searchOV);
      const matchOC = !searchOC || oc.includes(searchOC);
      const matchClient = !searchClient || client.includes(searchClient);
      const matchNIT = !searchNIT || nit.includes(searchNIT);

      return matchOV && matchOC && matchClient && matchNIT;
    });
  }, [executiveOrders, filters, normalize]);

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
        const vendedorFilter = role === 'Vendedor' ? user?.assignedVendor : undefined;

        const data = await getOrdersFromVisor(role === 'Vendedor' ? 'Asesor' : role, vendedorFilter);
        const execData = user ? mapOrdersToExecutive(data) : [];
        
        setAllOrders(data);
        setExecutiveOrders(execData);
      } catch (error) {
        console.error("Fetch orders failed", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, isSessionChecked]);

  const rawStatuses = useMemo(() => {
    const statuses = new Set<string>();
    allOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.estado_raw) statuses.add(item.estado_raw);
      });
      if (order.estado_raw) statuses.add(order.estado_raw);
    });
    return Array.from(statuses).sort();
  }, [allOrders]);

  const handleSearch = (newFilters: SearchFilters = filters, statusFilter: string | null = activeStatusFilter) => {
    setHasSearched(true);
    setCurrentPage(1);
    setFilters(newFilters);
    setActiveStatusFilter(statusFilter);
  };

  const handleDownload = () => {
    if (finalOrders.length === 0) return;

    // 1. Preparar la data plana (aplanar órdenes con sus ítems)
    const exportData = finalOrders.flatMap(order => 
      order.items.map((item, index) => ({
        "OV": order.numero_orden_venta,
        "OC": order.numero_orden_compra || '',
        "CÓD. CLIENTE": order.nit_cliente,
        "CLIENTE": order.nombre_cliente,
        "SALA / PROYECTO": order.nombre_sala || '',
        "ESTADO": order.estado_orden,
        "VENDEDOR": order.vendedor || '',
        "CIUDAD": order.ciudad_destino,
        "IT": index + 1,
        "CÓD. PRODUCTO": item.codigo_producto,
        "PRODUCTO": item.descripcion_producto,
        "FAMILIA": item.familia || '',
        "PED": item.cantidad_pedida,
        "FAC": item.cantidad_facturada,
        "DESP": item.cantidad_despacho,
        "PROD": item.cantidad_produccion,
        "PLAN": item.cantidad_planificada,
        "VALOR UNITARIO": item.precio_unitario ?? '',
        "VALOR TOTAL": item.valor_total ?? '',
        "ESTADO DESPACHO": item.estado_despacho || order.estado_despacho || '',
        "TRANSPORTADOR": item.transportador || order.transportador || '',
        "GUÍA": item.numero_guia || order.numero_guia || '',
        "FECHA OV": order.fecha_ingreso,
        "FECHA PROG DESP": item.fecha_plan_despacho || order.fecha_plan_despacho || '',
        "FECHA REAL DESP": item.fecha_real_despacho || '',
        "FECHA ESTIMADA": item.fecha_estimada_entrega || '',
        "FECHA ENTREGA": item.fecha_entrega || '',
        "FACTURA": item.numero_factura || '',
        "FECHA FACTURA": item.fecha_factura || '',
        "SITUACIÓN": item.situacion_item || '',
        "ENVÍO": order.envio || item.envio || ''
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
    XLSX.writeFile(workbook, `Reporte_Pedidos_Firplak_${new Date().toISOString().split('T')[0]}.xlsx`, { bookType: 'xlsx' });
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
              {/* Dashboard: Solo Admin */}
              {user && user.role === 'Administrador' && (
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

              {user?.role === 'Administrador' && (
                <button 
                  onClick={() => { setActiveTab('config'); setSelectedOrder(null); }}
                  className={`px-4 py-2 text-sm font-bold transition-all rounded-xl flex items-center gap-2 ${activeTab === 'config' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configuración
                </button>
              )}
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
          {loading ? (
            <div className="space-y-8">
              {/* Header Skeleton */}
              <div className="skeleton h-64 w-full shadow-lg shadow-slate-200/50"></div>
              
              {/* Cards Skeleton Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton h-32 w-full rounded-2xl shadow-sm"></div>
                ))}
              </div>

              {/* List Skeleton */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="skeleton h-20 w-full rounded-xl"></div>
                ))}
              </div>
            </div>
          ) : selectedOrder ? (
            <OrderDetail
              order={selectedOrder}
              role={user?.role || 'Externo'}
              onBack={() => setSelectedOrder(null)}
            />
          ) : activeTab === 'dashboard' ? (
            <Dashboard orders={allOrders} />
          ) : (
            <>
              <FilterBar
                user={user}
                onLoginClick={() => setIsLoginOpen(true)}
                onLogoutClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  storageService.clearState();
                }}
                onSearch={handleSearch}
                totalOrders={finalOrders.length}
                counts={counts}
                activeStatusFilter={activeStatusFilter}
                onStatusFilterChange={(status) => {
                  setActiveStatusFilter(status);
                  handleSearch(filters, status);
                }}
                rawStatuses={rawStatuses}
                filters={filters}
                onFilterChange={setFilters}
                onDownload={handleDownload}
                envioFilter={envioFilter}
                onEnvioFilterChange={setEnvioFilter}
                viewMode={user ? viewMode : undefined}
                onViewModeChange={user ? setViewMode : undefined}
              />

              <div className="relative min-h-[500px]">
                {activeTab === 'config' ? (
                  <UserManagement onClose={() => setActiveTab('pedidos')} />
                ) : finalOrders.length === 0 ? (
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
                  viewMode === 'ejecutiva' ? (
                    <ExecutiveView 
                      orders={finalExecutiveOrders} 
                      onOrderClick={(ov) => {
                        const matchedOrder = allOrders.find(o => o.numero_orden_venta === ov);
                        if (matchedOrder) {
                          setSelectedOrder(matchedOrder);
                        }
                      }}
                    />
                  ) : (
                    <TableView 
                      orders={finalOrders} 
                      onOrderClick={setSelectedOrder} 
                    />
                  )
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
                      {finalOrders
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
                        totalItems={finalOrders.length}
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
