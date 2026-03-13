export type UserRole = string;

export interface User {
    id: string;
    name?: string;
    email: string;
    role: UserRole;
}

export interface VisorRow {
    "Fecha de ingreso": string | null;
    "tipo orden de venta": string | null;
    "Orden de venta": number | null;
    "Orden de compra": string | null;
    "vendedor": string | null;
    "Código del cliente": string | null;
    "Nombre del cliente": string | null;
    "Nombre de la sala": string | null;
    "Código del producto": string | null;
    "Descripción del producto": string | null;
    "Cantidad pedida": string | null;
    "cantidad facturada": string | null;
    "cant - ent - despacho": string | null;
    "cant proc": string | null;
    "cant planif": string | null;
    "Componente": string | null;
    "situación item": string | null;
    "envio": string | null;
    "Envio"?: string | null;
    "envío"?: string | null;
    "Envío"?: string | null;
    "Familia": string | null;
    "Fecha de despacho": string | null;
    "Fecha real de despacho": string | null;
    "Fecha estimada de entrega": string | null;
    "Fecha estimada de entrega (real)": string | null;
    "Destino": string | null;
    "Estado despacho": string | null;
    "Estado de la orden": string | null;
    "Estado de la Orden"?: string | null;
    "Estado"?: string | null;
    "# Remisión": string | null;
    "Transportador": string | null;
    "# GUIA": string | null;
    "Fecha de entrega": string | null;
    "# Factura": string | null;
    "Fecha de la factura": string | null;
    id: number;
}

export type OrderState = string;

export interface OrderItem {
    codigo_producto: string;
    descripcion_producto: string;
    cantidad_pedida: number;
    cantidad_facturada: number;
    cantidad_despacho: number;
    cantidad_produccion: number;
    cantidad_planificada: number;
    cantidad_cedi?: number;
    precio_unitario?: number;
    valor_total?: number;
    estado_produccion: string;
    componente?: string;
    situacion_item?: string;
    familia?: string; // Added this line
    envio?: string;
    estado_orden?: string;
    numero_guia?: string;
    transportador?: string;
}

export interface Order {
    numero_orden_venta: string;
    numero_orden_compra?: string;
    tipo_orden_venta: string;
    ciudad_destino: string;
    fecha_ingreso: string;
    fecha_plan_despacho: string;
    fecha_real_despacho?: string;
    estado_orden: string;
    items: OrderItem[];
    // Totales agregados de cantidades (4 estados)
    total_pedida: number;
    total_facturada: number;
    total_despacho: number;
    total_produccion: number;
    total_planificada: number;
    nombre_cliente: string;
    nit_cliente: string;
    nombre_sala?: string;
    vendedor?: string;
    transportador?: string;
    numero_guia?: string;
    fecha_estimada_entrega?: string;
    fecha_entrega?: string;
    numero_factura?: string;
    fecha_factura?: string;
    envio?: string;
    estado_despacho?: string;
    estado_raw?: string;
    bloqueado_despacho?: boolean;
    nueva_fecha?: string;
    normalizedStatus: string;
}
