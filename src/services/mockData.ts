import { Order, UserRole, User } from '../types';

export const mockAuth = async (email: string, password: string): Promise<User | null> => {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API

    if (password !== '1234') return null;

    if (email === 'mayerly.marin@firplak.com') {
        return { id: '1', name: 'Mayerly Marin', email, role: 'Backoffice' };
    }

    if (email === 'monica.zuluaga@firplak.com') {
        return { id: '2', name: 'Monica Zuluaga', email, role: 'Vendedor' };
    }

    return null;
}

export const getOrders = async (role: UserRole, _userId?: string): Promise<Order[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));

    // Large mock dataset
    const allOrders: Order[] = [
        {
            numero_orden_venta: 'OV-1001',
            numero_orden_compra: 'OC-2234',
            tipo_orden_venta: 'Venta Directa',
            nombre_cliente: 'Distribuidora del Norte One',
            nit_cliente: '900123456-1',
            nombre_sala: 'Sala Principal - CC Norte',
            ciudad_destino: 'Bogotá',
            bloqueado_despacho: false,
            fecha_ingreso: '2023-11-15',
            fecha_plan_despacho: '2023-11-20',
            estado_orden: 'En producción',
            vendedor: 'Juan Perez',
            items: [
                { codigo_producto: 'B-001', descripcion_producto: 'Bañera Hidromasaje 140x70', cantidad_pedida: 5, cantidad_facturada: 0, cantidad_cedi: 2, precio_unitario: 1500000, valor_total: 7500000, estado_produccion: 'En Producción', componente: 'Bañera', situacion_item: 'En Fabricación', familia: 'BAÑERAS', envio: 'Completo', estado_orden: 'En producción' },
                { codigo_producto: 'G-105', descripcion_producto: 'Grifería Monocontrol Alta', cantidad_pedida: 5, cantidad_facturada: 0, cantidad_cedi: 5, precio_unitario: 250000, valor_total: 1250000, estado_produccion: 'Terminado', componente: 'Grifería', situacion_item: 'Listo para Despacho', familia: 'GRIFERÍA', envio: 'Incompleto', estado_orden: 'Pendiente' },
                { codigo_producto: 'F-999', descripcion_producto: 'FLETES LOGÍSTICOS', cantidad_pedida: 1, cantidad_facturada: 1, precio_unitario: 50000, valor_total: 50000, estado_produccion: 'Terminado', familia: 'FINANZAS', envio: 'Completo', estado_orden: 'Entregada' }
            ]
        },
        {
            numero_orden_venta: 'OV-1002',
            numero_orden_compra: 'OC-9988',
            tipo_orden_venta: 'Distribución',
            nombre_cliente: 'Constructora Bolivar S.A.',
            nit_cliente: '890987654-3',
            ciudad_destino: 'Medellín',
            bloqueado_despacho: false,
            fecha_ingreso: '2023-11-10',
            fecha_plan_despacho: '2023-11-14',
            fecha_real_despacho: '2023-11-14',
            fecha_estimada_entrega: '2023-11-16',
            estado_orden: 'En tránsito',
            vendedor: 'Monica Zuluaga',
            numero_guia: 'TCC-987654321',
            transportador: 'TCC',
            envio: 'Terrestre',
            estado_despacho: 'Despachado',
            items: [
                { codigo_producto: 'J-202', descripcion_producto: 'Jacuzzi Exterior 200x200', cantidad_pedida: 1, cantidad_facturada: 1, cantidad_cedi: 0, precio_unitario: 8500000, valor_total: 8500000, estado_produccion: 'Terminado', componente: 'Jacuzzi' }
            ]
        },
        // ... (truncated versions)
        {
            numero_orden_venta: 'OV-1003',
            tipo_orden_venta: 'Proyecto',
            nombre_cliente: 'Inversiones Los Pinos',
            nit_cliente: '800555666-9',
            ciudad_destino: 'Cali',
            bloqueado_despacho: true,
            fecha_ingreso: '2023-11-01',
            fecha_plan_despacho: '2023-11-08',
            nueva_fecha: '2023-11-25',
            nombre_sala: 'SALA NORTE',
            estado_orden: 'En producción',
            vendedor: 'Juan Perez',
            items: [
                { codigo_producto: 'L-505', descripcion_producto: 'Lavamanos Doble Resina', cantidad_pedida: 20, cantidad_facturada: 0, cantidad_cedi: 10, precio_unitario: 350000, valor_total: 7000000, estado_produccion: 'En Proceso', componente: 'Lavamanos' }
            ]
        },
        {
            numero_orden_venta: 'OV-1004',
            numero_orden_compra: 'OC-RETAIL-55',
            tipo_orden_venta: 'Retail',
            nombre_cliente: 'Homecenter Sodimac',
            nit_cliente: '860000123-4',
            ciudad_destino: 'Barranquilla',
            bloqueado_despacho: false,
            fecha_ingreso: '2023-10-20',
            fecha_plan_despacho: '2023-10-25',
            fecha_real_despacho: '2023-10-26',
            numero_factura: 'FE-90050',
            fecha_factura: '2023-10-27',
            estado_orden: 'Entregada',
            vendedor: 'Carlos Ruiz',
            transportador: 'Coordinadora',
            numero_guia: 'COO-112233',
            fecha_entrega: '2023-10-28',
            envio: 'Coordinadora Express',
            estado_despacho: 'Entregado',
            items: [
                { codigo_producto: 'T-Tina', descripcion_producto: 'Tina Isla 170x80', cantidad_pedida: 3, cantidad_facturada: 3, cantidad_cedi: 3, precio_unitario: 2100000, valor_total: 6300000, estado_produccion: 'Terminado', componente: 'Tina' }
            ]
        }
    ];

    // Fill more data
    for (let i = 0; i < 5; i++) {
        allOrders.push({
            numero_orden_venta: `OV-200${i}`,
            numero_orden_compra: `OC-GEN-${i}`,
            tipo_orden_venta: 'Mostrador',
            nombre_cliente: `Cliente General ${i + 1}`,
            nit_cliente: `1000${i}000-${i}`,
            ciudad_destino: 'Pereira',
            bloqueado_despacho: false,
            fecha_ingreso: '2023-11-19',
            fecha_plan_despacho: '2023-11-21',
            estado_orden: 'En producción',
            vendedor: i % 2 === 0 ? 'Monica Zuluaga' : 'Vendedor Tienda',
            items: [
                { codigo_producto: `GEN-${i}`, descripcion_producto: `Producto Genérico ${i}`, cantidad_pedida: 10, cantidad_facturada: 0, cantidad_cedi: 10, precio_unitario: 100000, valor_total: 1000000, estado_produccion: 'Terminado', componente: 'Genérico' }
            ]
        });
    }


    if (role === 'Backoffice') {
        return allOrders;
    }

    if (role === 'Vendedor') {
        // Show orders for Monica (which we assigned in mocks) + maybe others for demo depth
        return allOrders.filter(o => o.vendedor === 'Monica Zuluaga');
    }

    if (role === 'Externo') {
        // Public view can technically access anything IF they search exactly.
        // So the "getOrders" for 'Externo' might return the whole DB or we filter in frontend.
        // To simulate a secure backend, normally we'd only return what matches.
        // For this mock, we'll return ALL, but the frontend will be responsible to HIDE it unless exact match.
        return allOrders;
    }

    return [];
};
