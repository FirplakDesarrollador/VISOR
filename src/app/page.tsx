"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import XlsxUploadModal from '@/components/XlsxUploadModal';
import { supabase } from '@/services/supabase';
import { storageService } from '@/services/storageService';
import { indexedDbService, XlsxMeta } from '@/services/indexedDbService';
import { getOrdersFromVisor, mapOrdersToExecutive, ProgressCallback } from '@/services/visorService';
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
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true); // Start as loading to avoid flash
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; estimated: number } | null>(null);

  // null = sin datos xlsx | XlsxMeta = modo xlsx activo
  // Empieza en null para que Supabase arranque de inmediato si no hay xlsx.
  const [xlsxMeta, setXlsxMeta] = useState<XlsxMeta | null>(null);
  // true mientras se leen ordenes de IndexedDB (para mostrar loading especifico)
  const [xlsxLoadingFromDb, setXlsxLoadingFromDb] = useState(false);
  // Previene que el fetch de Supabase sobreescriba los datos del xlsx
  const xlsxOverrideRef = useRef(false);

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
    // 0. Verificar si hay datos xlsx en IndexedDB
    // Paso A: leer solo el metadata (rapido, <50ms)
    // Paso B: si hay meta, cargar ordenes (puede tardar 2-5s pero mostramos loading especifico)
    const loadXlsx = async () => {
      try {
        const meta = await indexedDbService.getMeta();
        if (!meta) return; // No hay datos xlsx, Supabase seguira su curso normal

        // Hay datos xlsx: mostrar inmediatamente que estamos cargando del archivo
        setXlsxMeta(meta);
        setXlsxLoadingFromDb(true);

        const orders = await indexedDbService.getOrders<Order>();
        if (orders.length > 0) {
          xlsxOverrideRef.current = true; // bloquea sobreescritura de Supabase
          setAllOrders(orders);
          setExecutiveOrders(mapOrdersToExecutive(orders));
          setLoading(false);
        } else {
          // Meta existe pero no hay ordenes — limpiar estado inconsistente
          setXlsxMeta(null);
        }
      } catch (e) {
        console.warn('IndexedDB check failed:', e);
        setXlsxMeta(null);
      } finally {
        setXlsxLoadingFromDb(false);
      }
    };
    loadXlsx(); // Fire-and-forget: no bloquea el fetch de Supabase

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
    let subscription: any;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setTimeout(async () => {
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
        }, 0);
      });
    subscription = data.subscription;
    } catch (error) {
      console.error("Auth state initialization error:", error);
      setIsSessionChecked(true);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
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
  const normalize = useCallback((str: any) =>
    (String(str || '')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), []);

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
      const dateA = String(a.fecha_ingreso || '');
      const dateB = String(b.fecha_ingreso || '');
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
  // Corre en paralelo con el check de IndexedDB.
  // Si xlsx llega primero (xlsxOverrideRef = true), el resultado de Supabase se descarta.
  useEffect(() => {
    if (!isSessionChecked) return;

    // Modo XLSX activo: datos ya cargados (o en proceso de cargarse desde IndexedDB)
    if (xlsxMeta !== null) {
      if (!xlsxLoadingFromDb) setLoading(false);
      return;
    }

    // Sin datos xlsx: flujo normal con Supabase.
    if (!user) {
      setAllOrders([]);
      setExecutiveOrders([]);
      setLoading(false);
      setLoadingProgress(null);
      return;
    }

    const fetchOrders = async () => {
      if (allOrders.length === 0) setLoading(true);
      try {
        const role = user ? user.role : 'Externo';
        const vendedorFilter = role === 'Vendedor' ? user?.assignedVendor : undefined;
        const onProgress: ProgressCallback = (loaded, estimated) => {
          setLoadingProgress({ loaded, estimated: estimated || loaded });
        };
        const data = await getOrdersFromVisor(role === 'Vendedor' ? 'Asesor' : role, vendedorFilter, onProgress);

        // Si xlsx llego mientras Supabase cargaba, no sobreescribir
        if (xlsxOverrideRef.current) return;

        const execData = user ? mapOrdersToExecutive(data) : [];
        setAllOrders(data);
        setExecutiveOrders(execData);
      } catch (error) {
        console.error("Fetch orders failed", error);
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    };

    fetchOrders();
  }, [user, isSessionChecked, xlsxMeta, xlsxLoadingFromDb]);

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

  const handleSearch = async (newFilters: SearchFilters = filters, statusFilter: string | null = activeStatusFilter) => {
    setHasSearched(true);
    setCurrentPage(1);
    setFilters(newFilters);
    setActiveStatusFilter(statusFilter);

    // Búsqueda en tiempo real desde la BD para usuarios no autenticados
    if (!user) {
      if (!newFilters.ov && !newFilters.oc && !newFilters.nit) {
        setAllOrders([]);
        return;
      }

      setLoading(true);
      setLoadingProgress({ loaded: 0, estimated: 1 });
      
      try {
        const onProgress: ProgressCallback = (loaded, estimated) => {
          setLoadingProgress({ loaded, estimated: estimated || loaded });
        };
        const data = await getOrdersFromVisor('Externo', undefined, onProgress, newFilters);
        setAllOrders(data);
      } catch (error) {
        console.error("Search order failed", error);
        setAllOrders([]);
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    }
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

          <div className="flex items-center gap-3">

             {/* Indicador de fuente de datos (xlsx vs Supabase) */}
             {xlsxMeta && (
               <div className="hidden md:flex items-center gap-2 py-1.5 px-3 bg-amber-500/20 rounded-full border border-amber-400/30">
                 <svg className="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                 </svg>
                 <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest whitespace-nowrap">
                   Archivo local
                 </span>
               </div>
             )}

             {/* Botón Cargar Archivo — solo Administrador */}
             {user?.role === 'Administrador' && (
               <button
                 onClick={() => setIsUploadOpen(true)}
                 className="flex items-center gap-2 py-1.5 px-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-all group"
               >
                 <svg className="w-3.5 h-3.5 text-white/80 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                 </svg>
                 <span className="text-[10px] font-black text-white/70 group-hover:text-white uppercase tracking-widest whitespace-nowrap hidden sm:block">
                   {xlsxMeta ? 'Actualizar archivo' : 'Cargar archivo'}
                 </span>
               </button>
             )}

             {/* Badge Conexión Segura */}
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
              {/* Barra de progreso de carga */}
              {loadingProgress ? (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                  <div className="w-full max-w-md mx-auto">
                    {/* Icono animado */}
                    <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <svg className="w-8 h-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Texto de progreso */}
                    <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Cargando datos del servidor</h3>
                    <p className="text-sm text-slate-500 text-center mb-6">
                      {loadingProgress.loaded.toLocaleString()} registros descargados
                      {loadingProgress.estimated > loadingProgress.loaded && (
                        <span className="text-slate-400"> — descargando más...</span>
                      )}
                    </p>
                    
                    {/* Barra de progreso */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                        style={{ 
                          width: loadingProgress.estimated > 0 
                            ? `${Math.min((loadingProgress.loaded / loadingProgress.estimated) * 100, 95)}%` 
                            : '30%' 
                        }}
                      />
                    </div>
                    
                    {/* Indicador de lotes */}
                    <p className="text-xs text-slate-400 text-center mt-3 font-medium">
                      Carga paralela optimizada • {Math.round((loadingProgress.loaded / loadingProgress.estimated) * 100)}%
                    </p>
                  </div>
                </div>
              ) : xlsxLoadingFromDb ? (
                /* Pantalla especifica para carga desde archivo local (IndexedDB) */
                <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
                  <div className="w-full max-w-md mx-auto text-center">
                    <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">Cargando datos del archivo local</h3>
                    <p className="text-sm text-slate-500 mb-2">{xlsxMeta?.fileName}</p>
                    <p className="text-sm font-bold text-amber-600 mb-6">
                      {xlsxMeta?.totalOrders.toLocaleString('es-CO')} órdenes · {xlsxMeta?.totalRows.toLocaleString('es-CO')} filas
                    </p>
                    {/* Barra animada indeterminada */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-3">Leyendo base de datos local del navegador...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header Skeleton (solo se muestra al inicio, antes del primer lote) */}
                  <div className="skeleton h-64 w-full shadow-lg shadow-slate-200/50"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="skeleton h-32 w-full rounded-2xl shadow-sm"></div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="skeleton h-20 w-full rounded-xl"></div>
                    ))}
                  </div>
                </>
              )}
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
          try {
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
              throw new Error('Configuración incompleta: Faltan las variables de conexión con la base de datos.');
            }
            // Usamos fetch nativo para evitar bloqueos (deadlocks) del SDK de Supabase (Web Locks API)
            const authPromise = fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
              method: 'POST',
              headers: {
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ email, password })
            }).then(res => res.json().then(data => ({ status: res.status, ok: res.ok, data })));

            const timeoutPromise = new Promise<any>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout de conexión con el servidor. Verifica tu internet o red corporativa.')), 10000)
            );
            
            const result = await Promise.race([authPromise, timeoutPromise]);
            
            if (!result.ok) {
               throw new Error(result.data?.error_description || result.data?.msg || 'Credenciales inválidas');
            }

            // Si el fetch funciona, forzamos la sesión en el SDK
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: result.data.access_token,
              refresh_token: result.data.refresh_token
            });

            if (sessionError) throw sessionError;
            
            return true;
          } catch (err: any) {
            console.error("Login falló o expiró:", err);
            throw err;
          }
        }}
      />

      {/* Modal de carga de archivo XLSX — solo visible para Administradores */}
      <XlsxUploadModal
        isOpen={isUploadOpen}
        currentMeta={xlsxMeta ?? null}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(orders, meta) => {
          setAllOrders(orders);
          setExecutiveOrders(mapOrdersToExecutive(orders));
          setXlsxMeta(meta);
          setIsUploadOpen(false);
        }}
        onClear={async () => {
          setXlsxMeta(null);
          setAllOrders([]);
          setExecutiveOrders([]);
          setIsUploadOpen(false);
          // Fuerza re-fetch desde Supabase
          setLoading(true);
        }}
      />
    </div>
  );
}
