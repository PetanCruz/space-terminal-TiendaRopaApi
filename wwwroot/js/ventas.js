// ========================================================
// CONFIGURACIÓN GLOBAL Y ESTADO DE LA APP
// ========================================================
const API_URL = "https://space-terminal-tiendaropaapi-production.up.railway.app/api"; // Ajustá el puerto si usás otro
let productos = [];       // Guarda las prendas traídas de la API
let carrito = [];         // Guarda los artículos seleccionados para la venta

window.sucursalesParaVentas = [];
window.cargarSucursalesParaVentas = async function() {
    try {
        const resp = await fetch(`${API_URL}/sucursales`);
        if (resp.ok) window.sucursalesParaVentas = await resp.json();
    } catch(e) { console.error("Error cargando sucursales:", e); }
};
// Lo ejecutamos apenas carga el archivo
window.cargarSucursalesParaVentas();
window.ventasGlobales = []; // 📅 Almacén en memoria para filtros instantáneos de historial

// ========================================================
// 1. CARGAR PRODUCTOS EN EL CATÁLOGO
// ========================================================
async function cargarProductos() {
    const contenedor = document.getElementById("productosCatalogo");
    if (!contenedor) return;

    try {
        const token = localStorage.getItem("token");
        // Extraemos los datos del usuario guardados en el login
        const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
        const sucursalId = usuarioLocal.sucursalId || 1; // Si no hay, mandamos la 1 por defecto

        // Le pegamos el sucursalId a la URL
        const respuesta = await fetch(`${API_URL}/productos?sucursalId=${sucursalId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) throw new Error("Error de autenticación o servidor");
        
        productos = await respuesta.json();
        renderizarCatalogo(productos);
        console.log("✅ Catálogo cargado con éxito para la sucursal:", sucursalId);

        // 🌟 MAGIA: Inicializamos el Teletransportador si es Admin
        if (typeof window.inicializarSelectorAdmin === "function") {
            window.inicializarSelectorAdmin();
        }

    } catch (error) {
        console.error("Error al cargar productos:", error);
        contenedor.innerHTML = `<p class="text-rose-400 p-4">Error al cargar productos. Intentá recargar.</p>`;
    }
}

// ========================================================
// 2. DIBUJAR EL CATÁLOGO EN PANTALLA (CON PRIVILEGIOS)
// ========================================================
function renderizarCatalogo(productosAFiltrar) {
    const contenedor = document.getElementById("productosCatalogo");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    let prendasMostradas = 0;

    // 🌟 FIX: Lectura segura de rol
    const esAdmin = window.esAdmin();
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};

    if (!productosAFiltrar || productosAFiltrar.length === 0) {
        contenedor.innerHTML = `<div class="p-8 text-center text-slate-500 col-span-full border border-dashed border-slate-800 rounded-2xl">📦 No se encontraron prendas que coincidan con la búsqueda.</div>`;
        return;
    }

    productosAFiltrar.forEach((producto) => {
        const nombreBase = producto.nombre ?? producto.Nombre ?? "Prenda";
        const precio = producto.precio ?? producto.Precio ?? 0;
        const categoriaTexto = producto.categoria ?? producto.Categoria ?? "JEANS";
        const variantes = producto.variantes ?? producto.Variantes ?? [];

        variantes.forEach((variante) => {
            const varianteId = variante.id ?? variante.Id;
            const talle = variante.talle ?? variante.Talle ?? "N/A";
            const color = variante.color ?? variante.Color ?? "N/A";

            let stockGlobal = 0;
            let nombresSucursales = []; // 🌟 NUEVO: Guardamos dónde está la ropa

            if (variante.stockDetalle && Array.isArray(variante.stockDetalle)) {
                variante.stockDetalle.forEach(suc => {
                    if (suc.cantidad > 0) {
                        stockGlobal += suc.cantidad;
                        if (!nombresSucursales.includes(suc.sucursal)) {
                            nombresSucursales.push(suc.sucursal);
                        }
                    }
                });
            }

            const stockLocal = variante.stock ?? variante.Stock ?? 0;
            const stockAMostrar = esAdmin ? stockGlobal : stockLocal;

            if (stockAMostrar <= 0) return;

            const itemEnCarrito = carrito.find(item => item.id === varianteId && item.sucursalId === (usuarioLocal.sucursalId || 1));
            const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
            const stockDinamico = stockAMostrar - cantidadEnCarrito;

            // 🌟 MAGIA: Si es Admin, le inyectamos la ubicación en el talle
            let talleAMostrar = talle;
            if (esAdmin && nombresSucursales.length > 0) {
                talleAMostrar = `${talle} | 📍 ${nombresSucursales.join(", ")}`;
            }

            dibujarTarjetaHtml(contenedor, varianteId, nombreBase, precio, stockDinamico, talleAMostrar, color, categoriaTexto);
            prendasMostradas++;
        });
    });

    if (prendasMostradas === 0) {
        contenedor.innerHTML = `<div class="p-8 text-center text-slate-400 col-span-full border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
            📦 No hay prendas disponibles físicamente para vender.<br>
            ${!esAdmin ? '<span class="text-xs text-slate-500 mt-2 block">💡 TIP: Buscá en la pestaña de Inventario para vender desde otra sucursal.</span>' : ''}
        </div>`;
    }
}

// =========================================================================
// 🛒 AGREGAR AL CARRITO DESDE INVENTARIO (INTER-SUCURSAL)
// =========================================================================
window.venderDesdeInventario = function(varianteId, nombre, precio, talle, color, sucursalId) {
    const itemEnCarrito = carrito.find(item => item.id === varianteId && item.sucursalId === sucursalId);
    
    if (itemEnCarrito) {
        itemEnCarrito.cantidad++;
    } else {
        carrito.push({
            id: varianteId, 
            nombre: nombre,
            precio: precio,
            talle: talle,
            color: color,
            amount: 1, 
            cantidad: 1,
            sucursalId: sucursalId // 🌟 LA SUCURSAL DE ORIGEN REMOTA
        });
    }

    // Cerramos el modal de variantes
    if(typeof window.cerrarModalVariantes === 'function') window.cerrarModalVariantes();
    
    // Cambiamos a la pestaña de ventas
    if(typeof window.cambiarPantalla === 'function') window.cambiarPantalla('seccion-ventas');
    
    // Actualizamos ticket
    if(typeof window.actualizarInterfazCarrito === 'function') window.actualizarInterfazCarrito();
    if(typeof window.filtrarProductos === 'function') window.filtrarProductos();
};

// ========================================================
// 🎨 RENDERS: TARJETA CON ALERTA DE STOCK CRÍTICO
// ========================================================
function dibujarTarjetaHtml(contenedor, id, nombre, precio, stock, talle, color, categoria) {
    const tieneStock = stock > 0;
    const esCritico = tieneStock && stock <= 3; // 🔥 SE ACTIVA SI QUEDAN 3 O MENOS

    // Configuramos dinámicamente los estilos según el nivel de stock
    let claseStock = "text-slate-400";
    let textoStock = `Stock: ${stock} u.`;
    let badgeCritico = "";

    if (!tieneStock) {
        claseStock = "text-rose-400 font-medium";
        textoStock = "🚫 Sin Stock";
    } else if (esCritico) {
        claseStock = "text-amber-400 font-bold animate-pulse";
        textoStock = `⚠️ ¡Últimas ${stock} unidades!`;
        // Badge flotante arriba a la derecha
        badgeCritico = `
            <span class="bg-amber-950/80 text-amber-400 text-[9px] font-extrabold px-2 py-0.5 rounded-md border border-amber-500/30 animate-pulse">
                STOCK CRÍTICO
            </span>`;
    }

    const tarjeta = document.createElement("div");
    // Si es crítico, le ponemos un borde ámbar sutil y una leve sombra para destacar
    tarjeta.className = `bg-slate-900 p-4 rounded-2xl border ${esCritico ? 'border-amber-500/40 shadow-lg shadow-amber-950/20' : 'border-slate-800'} flex flex-col justify-between transition-all duration-300`;

    tarjeta.innerHTML = `
        <div>
            <div class="flex justify-between items-center">
                <span class="bg-indigo-950 text-indigo-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border border-indigo-500/20">
                    ${categoria}
                </span>
                ${badgeCritico}
            </div>
            
            <h3 class="text-white font-bold mt-2 text-base">${nombre}</h3>
            
            <div class="flex gap-2 mt-1">
                <span class="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Talle: ${talle}</span>
                <span class="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Color: ${color}</span>
            </div>
            
            <p class="text-xs ${claseStock} mt-3 flex items-center gap-1">
                ${textoStock}
            </p>
        </div>
        
        <div class="flex justify-between items-center mt-4">
            <span class="text-emerald-400 font-extrabold text-lg">$${precio}</span>
            <button 
                onclick="agregarAlCarritoPorId(${id})" 
                ${tieneStock ? '' : 'disabled'} 
                class="${tieneStock ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-bold text-xs px-4 py-2 rounded-xl transition-all">
                ${tieneStock ? 'Agregar' : 'Sin Stock'}
            </button>
        </div>
    `;
    contenedor.appendChild(tarjeta);
}

// ========================================================
// 🔍 LÓGICA DEL BUSCADOR EN TIEMPO REAL (CATÁLOGO)
// ========================================================
function filtrarProductos() {
    const buscador = document.getElementById("inputBuscador");
    if (!buscador) return;
    const textoBusqueda = buscador.value.toLowerCase();

    const productosFiltrados = productos.filter(item => {
        const nombre = (item.nombre || item.Nombre || "").toLowerCase();
        const talle = String(item.talle || item.Talle || "").toLowerCase();
        const color = (item.color || item.Color || "").toLowerCase();

        return nombre.includes(textoBusqueda) || 
               talle.includes(textoBusqueda) || 
               color.includes(textoBusqueda);
    });

    renderizarCatalogo(productosFiltrados);
}

// ========================================================
// GESTIÓN DEL CARRITO DE COMPRAS
// ========================================================
function agregarAlCarritoPorId(id) {
    const indexReal = productos.findIndex(p => {
        const variantes = p.variantes ?? p.Variantes ?? [];
        return variantes.some(v => (v.id ?? v.Id) === id);
    });

    if (indexReal !== -1) {
        agregarAlCarrito(indexReal, id); 
    } else {
        console.error("No se encontró ningún producto que tenga la variante con ID:", id);
    }
}

// Agregar al carrito
function agregarAlCarrito(index, varianteId) {
    const productoSeleccionado = productos[index];
    const variantes = productoSeleccionado.variantes ?? productoSeleccionado.Variantes ?? [];
    
    const varianteSeleccionada = variantes.find(v => (v.id ?? v.Id) === varianteId);
    if (!varianteSeleccionada) return;

    // 🌟 FIX: Lectura segura
    const esAdmin = window.esAdmin();
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};

    let stockGlobal = 0;
    if (varianteSeleccionada.stockDetalle && Array.isArray(varianteSeleccionada.stockDetalle)) {
        stockGlobal = varianteSeleccionada.stockDetalle.reduce((acc, suc) => acc + (suc.cantidad || 0), 0);
    }
    const stockLocal = varianteSeleccionada.stock ?? varianteSeleccionada.Stock ?? 0;
    
    const stockDisponible = esAdmin ? stockGlobal : stockLocal;
    const itemEnCarrito = carrito.find(item => item.id === varianteId && item.sucursalId === (usuarioLocal.sucursalId || 1));

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidad < stockDisponible) {
            itemEnCarrito.cantidad++;
        } else {
            alert("No podés agregar más unidades que las disponibles en stock.");
            return;
        }
    } else {
        carrito.push({
            id: varianteId, 
            nombre: productoSeleccionado.nombre,
            precio: productoSeleccionado.precio,
            talle: varianteSeleccionada.talle ?? varianteSeleccionada.Talle ?? "N/A",
            color: varianteSeleccionada.color ?? varianteSeleccionada.Color ?? "N/A",
            amount: 1, 
            cantidad: 1,
            sucursalId: usuarioLocal.sucursalId || 1 
        });
    }

    actualizarInterfazCarrito();
    filtrarProductos();
}

// Eliminar del Carrito
function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarInterfazCarrito();
    filtrarProductos();
}

// ========================================================
// 4. ACTUALIZAR EL TICKET VISUAL Y LOS TOTALES EN VIVO
// ========================================================
window.actualizarInterfazCarrito = function() {
    const contenedor = document.getElementById("carritoItems");
    const totalText = document.getElementById("totalVenta");
    const modalTotalText = document.getElementById("modalTotalVenta"); // El total nuevo adentro del cuadrito
    
    if (!contenedor || !totalText) return;

    contenedor.innerHTML = "";
    
    if (carrito.length === 0) {
        contenedor.innerHTML = `<div id="carritoVacio" class="text-slate-500 text-center py-8 text-sm">El ticket está vacío. Seleccioná una prenda.</div>`;
        totalText.textContent = "$0";
        if (modalTotalText) modalTotalText.textContent = "$0";
        return;
    }

    let totalBase = 0;
    carrito.forEach((item, index) => {
        totalBase += item.precio * item.cantidad;
        const row = document.createElement("div");
        row.className = "bg-slate-900 p-3 rounded-xl border border-slate-700/60 flex justify-between items-center text-sm mb-2";

        let opcionesSucursales = window.sucursalesParaVentas.map(s => 
            `<option value="${s.id}" ${s.id === item.sucursalId ? 'selected' : ''}>📍 ${s.nombre}</option>`
        ).join('');

        row.innerHTML = `
            <div class="flex-1 pr-2">
                <p class="font-bold text-white leading-tight">${item.nombre}</p>
                <p class="text-[11px] text-slate-400 mb-1.5">Talle ${item.talle} - ${item.color} x $${item.precio}</p>
                
                <select onchange="carrito[${index}].sucursalId = parseInt(this.value)" class="w-full max-w-[160px] bg-slate-950/80 border border-slate-700 text-[10px] text-indigo-300 font-bold uppercase tracking-wider rounded p-1 cursor-pointer focus:outline-none focus:border-indigo-500">
                    ${opcionesSucursales}
                </select>
            </div>
            <div class="flex items-center space-x-3">
                <span class="bg-slate-800 text-indigo-400 font-extrabold px-2.5 py-1 rounded border border-slate-700">x${item.cantidad}</span>
                <button onclick="eliminarDelCarrito(${index})" class="text-rose-400 hover:text-rose-500 font-bold text-xs p-1 cursor-pointer">❌</button>
            </div>
        `;
        contenedor.appendChild(row);
    });

    // LÓGICA DE DESCUENTOS LIMPIA
    const tipoMod = document.getElementById("tipoModificador")?.value || "nada";
    const valorMod = parseFloat(document.getElementById("valorModificador")?.value) || 0;
    
    let totalFinal = totalBase;

    if (tipoMod === "descuento_pct") totalFinal -= totalBase * (valorMod / 100);
    if (tipoMod === "descuento_fijo") totalFinal -= valorMod;
    if (tipoMod === "recargo_pct") totalFinal += totalBase * (valorMod / 100);
    if (tipoMod === "recargo_fijo") totalFinal += valorMod;

    if (totalFinal < 0) totalFinal = 0;
    
    // Actualizamos la pantalla de atrás y el modal al mismo tiempo
    const valorFormateado = `$${Math.round(totalFinal).toLocaleString('es-AR')}`;
    totalText.textContent = valorFormateado;
    if (modalTotalText) modalTotalText.textContent = valorFormateado;
};

// ========================================================
// 6. HISTORIAL DE VENTAS (Carga Base)
// ========================================================
async function cargarHistorialVentas() {
    try {
        const token = localStorage.getItem("token");

        console.log("🔑 TOKEN ENVIADO A VENTAS:", token);
        
        const respuesta = await fetch(`${API_URL}/ventas`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);

        const ventas = await respuesta.json();
        
        // 💾 Guardamos la copia completa original en nuestra memoria global
        window.ventasGlobales = ventas;
        
        // ⚙️ Activamos el motor de filtros (por defecto procesará e imprimirá todo)
        window.filtrarVentas();
        console.log("✅ Historial de ventas sincronizado con éxito.");

    } catch (error) {
        console.error("Error al obtener el historial:", error);
        const tbody = document.getElementById("tablaHistorialBody"); 
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-rose-500 p-6 text-center">Error al cargar historial. Asegurate de estar logueado.</td></tr>`;
        }
    }
}

// ========================================================
// 📊 RENDERIZADO EXCLUSIVO DE LA TABLA DE HISTORIAL
// ========================================================
window.dibujarTablaVentas = function(ventasAProcesar) {
    const tbody = document.getElementById("tablaHistorialBody"); 
    if (!tbody) return;

    tbody.innerHTML = ""; 

    if (!ventasAProcesar || ventasAProcesar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 italic">No hay ventas registradas para este filtro.</td></tr>`;
        return;
    }

    ventasAProcesar.forEach(venta => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800 hover:bg-slate-900/50 transition-colors";
        
        const idVenta = venta.id || venta.Id || "---";
        const fechaValida = venta.fecha || venta.fechaHora || venta.fecha_venta;
        const fechaFormateada = fechaValida ? new Date(fechaValida).toLocaleString() : "Sin fecha";
        const metodo = venta.metodoPago || venta.medioPago || "Efectivo";
        const total = venta.total || venta.total_venta || 0;

        fila.innerHTML = `
            <td class="p-4 text-white font-mono font-bold">#${idVenta}</td>
            <td class="p-4 text-slate-400 text-xs">${fechaFormateada}</td>
            <td class="p-4 text-slate-400">${metodo}</td>
            <td class="p-4 text-emerald-400 font-bold">$${total}</td>
            <td class="p-4 text-center flex items-center justify-center gap-1">
                <button onclick="verDetalleFactura(${idVenta})" 
                        class="text-slate-400 hover:text-indigo-400 p-2 rounded-xl hover:bg-slate-900 transition-all inline-flex items-center justify-center cursor-pointer" 
                        title="Ver Detalle">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
                <button onclick="window.reimprimirTicket(${idVenta})"
                        class="text-slate-400 hover:text-emerald-400 p-2 rounded-xl hover:bg-slate-900 transition-all inline-flex items-center justify-center cursor-pointer"
                        title="Reimprimir Ticket">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </button>
            </td>
        `;

        tbody.appendChild(fila);
    });
};

// ========================================================
// ⚙️ MOTOR DE FILTRADO DE HISTORIAL EN TIEMPO REAL
// ========================================================
window.filtrarVentas = function() {
    const inputFecha = document.getElementById("filtroFecha")?.value; // Obtiene el formato "YYYY-MM-DD"
    
    let ventasFiltradas = [...window.ventasGlobales];

    if (inputFecha) {
        ventasFiltradas = window.ventasGlobales.filter(venta => {
            const fechaRaw = venta.fecha || venta.fechaHora || venta.fecha_venta || venta.createdAt;
            if (!fechaRaw) return false;
            
            // Forzamos la conversión a formato local exacto "YYYY-MM-DD" para matchear con el input
            const fechaVentaLocal = new Date(fechaRaw).toLocaleDateString('sv'); 
            return fechaVentaLocal === inputFecha;
        });
    }

    // 1. Recalculamos el Cierre de Caja basándonos en la lista filtrada
    window.actualizarCierreCaja(ventasFiltradas);

    // 2. Redibujamos la tabla únicamente con los elementos que corresponden al filtro
    window.dibujarTablaVentas(ventasFiltradas);
};

// Controladores rápidos de los botones del panel (Hoy, Ayer, Todos)
window.aplicarPreajusteFiltro = function(tipo) {
    const inputFecha = document.getElementById("filtroFecha");
    
    // Limpiamos los estilos de botón activo/inactivo de Tailwind
    ["btnFiltroHoy", "btnFiltroAyer", "btnFiltroTodos"].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.className = btn.className.replace("bg-indigo-600 text-white shadow-lg shadow-indigo-950/50", "bg-slate-800 text-slate-300");
            if (!btn.className.includes("bg-slate-800")) btn.className += " bg-slate-800 text-slate-300";
        }
    });

    // Encendemos el botón presionado
    const idActivo = tipo === 'hoy' ? 'btnFiltroHoy' : tipo === 'ayer' ? 'btnFiltroAyer' : 'btnFiltroTodos';
    const btnActivo = document.getElementById(idActivo);
    if (btnActivo) {
        btnActivo.className = btnActivo.className.replace("bg-slate-800 text-slate-300", "bg-indigo-600 text-white shadow-lg shadow-indigo-950/50");
    }

    if (tipo === 'todos') {
        if (inputFecha) inputFecha.value = ""; // Vaciamos input de fecha
    } else {
        const d = new Date();
        if (tipo === 'ayer') d.setDate(d.getDate() - 1);
        if (inputFecha) inputFecha.value = d.toLocaleDateString('sv'); // Asigna el día en formato YYYY-MM-DD
    }

    // Ejecuta el motor centralizado de filtrado
    window.filtrarVentas();
};

// ========================================================
// 📈 CÁLCULO AUTOMÁTICO DE CIERRE DE CAJA (FRONTEND)
// ========================================================
window.actualizarCierreCaja = function(listaDeVentas) {
    if (!Array.isArray(listaDeVentas)) return;

    let totalGeneral = 0; // Solo plata real
    let totalEfectivo = 0;
    let totalTransferencia = 0;

    listaDeVentas.forEach(venta => {
        const total = parseFloat(venta.total || venta.total_venta || 0);
        const metodo = (venta.metodoPago || venta.medioPago || "efectivo").toLowerCase();

        // 🌟 NUEVO: Ignoramos la Cuenta Corriente para que no ensucie la caja
        if (metodo.includes("cuenta corriente") || metodo.includes("fiado")) {
            return; // Cortamos acá, no suma ni a efectivo ni a general
        }

        totalGeneral += total;

        if (metodo.includes("efectivo")) {
            totalEfectivo += total;
        } else {
            // Tarjetas, Transferencias, MP, etc.
            totalTransferencia += total;
        }
    });

    if (document.getElementById("cierreTotal")) {
        document.getElementById("cierreTotal").textContent = `$${totalGeneral.toLocaleString('es-AR')}`;
    }
    if (document.getElementById("cierreEfectivo")) {
        document.getElementById("cierreEfectivo").textContent = `$${totalEfectivo.toLocaleString('es-AR')}`;
    }
    if (document.getElementById("cierreTransferencia")) {
        document.getElementById("cierreTransferencia").textContent = `$${totalTransferencia.toLocaleString('es-AR')}`;
    }
};

// =========================================================================
// 🖨️ IMPRESIÓN MANUAL EN TICKETERA TÉRMICA (80mm / 58mm)
// =========================================================================
window.imprimirEnTicketera = function(id) {
    const modal = document.getElementById("modalDetalleFactura");
    if (!modal) {
        console.warn("⚠️ No se encontró el modal en pantalla para mandar a imprimir.");
        return;
    }

    // Extraemos los datos reflejados en el modal actual
    const metodoPago = modal.querySelector("span.bg-slate-800")?.textContent || "Efectivo";
    const total = modal.querySelector("span.text-emerald-400")?.textContent || "$0";
    
    const bloquesPrendas = modal.querySelectorAll(".bg-slate-900\\/60, .bg-slate-900");
    let itemsHTML = "";

    bloquesPrendas.forEach(el => {
        const nombre = el.querySelector("h4")?.textContent || "Prenda";
        const cant = el.querySelector("span.bg-indigo-950")?.textContent || "x1";
        const spansDetalle = el.querySelectorAll("span.text-\\[11px\\]");
        const talleColor = Array.from(spansDetalle).map(s => s.textContent).join(" | ");
        const subtotal = el.querySelector("span.text-white.font-bold")?.textContent || "$0";

        itemsHTML += `
            <tr>
                <td colspan="2" style="font-weight: bold; padding-top: 5px;">${nombre} ${cant}</td>
            </tr>
            <tr>
                <td style="font-size: 11px; color: #444;">${talleColor}</td>
                <td style="text-align: right; font-weight: bold; font-size: 12px;">${subtotal}</td>
            </tr>
            <tr>
                <td colspan="2" style="border-bottom: 1px dashed #000; padding-top: 3px;"></td>
            </tr>
        `;
    });

    const ventanaImpresion = window.open("", "_blank", "width=300,height=600");
    
    ventanaImpresion.document.write(`
        <html>
        <head>
            <title>Ticket #${id}</title>
            <style>
                @page { size: auto; margin: 0mm; }
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 260px; 
                    margin: 0; 
                    padding: 10px; 
                    color: #000; 
                    background: #fff; 
                    font-size: 12px; 
                    line-height: 1.2;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .header { font-size: 15px; margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; }
                .total-table { font-size: 14px; font-weight: bold; margin-top: 8px; }
                .footer { font-size: 10px; margin-top: 15px; }
                .linea-divisoria { border-bottom: 1px dashed #000; margin: 8px 0; }
            </style>
        </head>
        <body>
            <div class="center bold header">SPACE TERMINAL</div>
            <div class="center" style="font-size: 10px;">Gestión de Stock y Facturación</div>
            <div class="linea-divisoria"></div>
            
            <div class="bold">TICKET DE VENTA #${id}</div>
            <div style="margin-top: 4px;"><b>Forma de Pago:</b> ${metodoPago}</div>
            
            <div class="linea-divisoria"></div>
            <div class="bold" style="font-size: 11px;">ITEMS:</div>
            <table style="margin-top: 4px;">
                ${itemsHTML}
            </table>
            
            <table class="total-table">
                <tr>
                    <td>TOTAL COBRADO:</td>
                    <td style="text-align: right;">${total}</td>
                </tr>
            </table>
            
            <div class="linea-divisoria"></div>
            <div class="center footer">
                ¡Gracias por tu compra!<br>
                --- Sistema de Control Oficial ---
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 300);
                };
            <\/script>
        </body>
        </html>
    `);
    
    ventanaImpresion.document.close();
};
// =========================================================================
// 🎫 VISUALIZAR DETALLE DE FACTURA / TICKET (CON MENÚ DE OPCIONES)
// =========================================================================
async function verDetalleFactura(id, datosLocales = null) {
    console.log("🔍 Buscando detalle de la venta N°: " + id);
    const token = localStorage.getItem("token");

    let metodoPagoDesdeTabla = null;
    try {
        const todasLasFilas = document.querySelectorAll("tr");
        for (let fila of todasLasFilas) {
            if (fila.textContent.includes(`#${id}`) || fila.textContent.includes(`${id}`)) {
                const textoFila = fila.textContent.toLowerCase();
                if (textoFila.includes("transferencia") || textoFila.includes("qr")) {
                    metodoPagoDesdeTabla = "Transferencia"; break;
                } else if (textoFila.includes("débito") || textoFila.includes("debito")) {
                    metodoPagoDesdeTabla = "Débito"; break;
                } else if (textoFila.includes("crédito") || textoFila.includes("credito") || textoFila.includes("tarjeta")) {
                    metodoPagoDesdeTabla = "Crédito"; break;
                } else if (textoFila.includes("efectivo")) {
                    metodoPagoDesdeTabla = "Efectivo"; break;
                }
            }
        }
    } catch (domError) {
        console.log("No se pudo escanear la tabla visual:", domError);
    }

    try {
        let venta;

        if (datosLocales) {
            console.log("🎯 [SISTEMA] Usando datos locales para armar las opciones del ticket.");
            venta = datosLocales;
        } else {
            const respuesta = await fetch(`${API_URL}/ventas/${id}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            if (!respuesta.ok) throw new Error("No se pudo obtener el detalle.");
            venta = await respuesta.json();
        }
        
        let prendas = [];
        if (Array.isArray(venta)) {
            prendas = venta;
        } else if (venta && typeof venta === "object") {
            if (Array.isArray(venta.productos)) prendas = venta.productos;
            else if (Array.isArray(venta.items)) prendas = venta.items;
            else if (Array.isArray(venta.detalles)) prendas = venta.detalles;
            else {
                const keyLista = Object.keys(venta).find(k => Array.isArray(venta[k]));
                prendas = keyLista ? venta[keyLista] : [];
            }
        }

        if ((!prendas || prendas.length === 0) && venta && !Array.isArray(venta)) {
            if (venta.id || venta.Id || venta.venta_id) {
                prendas = venta.items || venta.productos || [];
            }
        }

        let datosGenerales = Array.isArray(venta) ? venta[0] : (venta.informacionVenta || venta);
        const metodoPago = metodoPagoDesdeTabla || datosGenerales.metodoPago || datosGenerales.medioPago || datosGenerales.metodo || datosGenerales.metodo_pago || "Efectivo";
        let totalFacturado = datosGenerales.total || datosGenerales.total_venta || datosGenerales.monto || 0;

        if (!totalFacturado && venta.total) totalFacturado = venta.total;

        let totalOriginalTeorico = 0;
        let contenedorPrendasHTML = "";

        if (!prendas || prendas.length === 0) {
            contenedorPrendasHTML = `<p class="text-slate-400 text-xs italic p-2 text-center">Detalle procesado correctamente.</p>`;
        } else {
            prendas.forEach((item) => {
                const nombrePrenda = item.productoNombre || item.ProductoNombre || item.nombre || item.Nombre || (item.Producto ? item.Producto.nombre : "Prenda");
                const talle = item.talle || item.Talle || "N/A"; 
                const color = item.color || item.Color || "N/A";
                const cantidad = item.cantidad || item.amount || 1;
                
                const precioCobradoUnitario = item.precio || item.precioUnitario || item.precio_unitario || 0;
                const subtotalCobrado = precioCobradoUnitario * cantidad;
                
                const precioListaUnitario = item.precioLista || item.precioOriginal || (datosGenerales.descuento ? (precioCobradoUnitario + Math.round(datosGenerales.descuento / cantidad)) : precioCobradoUnitario);
                
                totalOriginalTeorico += (precioListaUnitario * cantidad);
                const ahorroItem = (precioListaUnitario - precioCobradoUnitario) * cantidad;

                contenedorPrendasHTML += `
                    <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between text-sm mb-3">
                        <div>
                            <div class="flex justify-between items-start">
                                <h4 class="text-white font-bold text-sm max-w-[80%]">${nombrePrenda}</h4>
                                <span class="bg-indigo-950 text-indigo-400 font-extrabold text-xs px-2 py-0.5 rounded border border-indigo-500/20">x${cantidad}</span>
                            </div>
                            <div class="flex gap-2 mt-1">
                                <span class="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Talle: ${talle}</span>
                                <span class="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Color: ${color}</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/40">
                            <p class="text-xs text-slate-400">
                                <span class="line-through text-slate-500 mr-1.5">$${precioListaUnitario * cantidad}</span>
                                <span class="text-slate-300 font-medium">$${precioCobradoUnitario} u.</span>
                            </p>
                            <span class="text-white font-bold text-sm">$${subtotalCobrado}</span>
                        </div>
                    </div>
                `;
            });
        }

        if (totalOriginalTeorico === 0) totalOriginalTeorico = totalFacturado;
        const descuentoTotal = totalOriginalTeorico - totalFacturado;

        // 🎯 MODAL ACTUALIZADO: Agregamos el contenedor de doble acción abajo
        const modalHTML = `
        <div id="modalDetalleFactura" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div class="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                    <h3 class="text-white font-bold text-base flex items-center gap-2">📋 TICKET #${id}</h3>
                    <button id="btnCerrarModalX" onclick="document.getElementById('modalDetalleFactura').remove()" class="text-slate-400 hover:text-white transition-colors text-lg cursor-pointer">✕</button>
                </div>
                
                <div class="p-4 overflow-y-auto space-y-4 flex-1">
                    <div class="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-2.5 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-slate-400">💵 Método de Pago</span>
                            <span class="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-0.5 rounded-md font-medium text-xs">${metodoPago}</span>
                        </div>
                        <hr class="border-slate-800/60">
                        <div class="flex justify-between items-center pt-0.5">
                            <span class="text-white font-bold">👉 Total Cobrado:</span>
                            <span class="text-emerald-400 font-extrabold text-lg font-mono">$${totalFacturado}</span>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2 px-1">Prendas de la compra</h4>
                        ${contenedorPrendasHTML}
                    </div>
                </div>
                
                <div class="p-4 bg-slate-950/40 border-t border-slate-800 flex flex-col gap-2">
                    <div class="flex gap-2">
                        <button id="btnDescargarPDF" onclick="window.descargarPDF(${id})" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20 cursor-pointer">
                            📥 Guardar PDF
                        </button>
                        <button id="btnImprimirTicketera" onclick="window.imprimirEnTicketera(${id})" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-900/20 cursor-pointer">
                            🖨️ Enviar a Ticketera
                        </button>
                    </div>
                    <button id="btnEntendido" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold py-2 px-4 rounded-xl transition-colors cursor-pointer">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
        `;

        const modalExistente = document.getElementById("modalDetalleFactura");
        if (modalExistente) modalExistente.remove();
        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const btnEntendido = document.getElementById("btnEntendido");
        if (btnEntendido) {
            btnEntendido.onclick = () => {
                const modal = document.getElementById("modalDetalleFactura");
                if (modal) modal.remove();
            };
        }

    } catch (error) {
        console.error("Error historial detalle:", error);
        alert("No se pudo cargar el detalle de la factura de manera correcta.");
    }
}

// ========================================================
// 🚀 INICIALIZACIÓN AUTOMÁTICA DE LA APP
// ========================================================
//document.addEventListener("DOMContentLoaded", async () => {
 //   console.log("🚀 Página cargada por completo. Iniciando servicios...");
    
//    try {
//        await cargarProductos();
 //       console.log("✅ Catálogo inicializado con éxito.");
 //   } catch (err) {
//        console.error("❌ Error crítico al cargar catálogo inicial:", err);
//    }

  //  try {
    //    await cargarHistorialVentas();
  //      console.log("✅ Historial de ventas cargado.");
  //  } catch (err) {
    //    console.error("❌ Error crítico al cargar historial inicial:", err);
    //}
//});

// ========================================================
// 🚀 CONTROLADORES GLOBALES DE ACCIONES (HTML BINDINGS)
// ========================================================

// 1. Botón Salir / Cerrar Sesión
window.cerrarSesion = function() {
    console.log("🚪 [SISTEMA] Cerrando sesión...");
    localStorage.removeItem("token"); 
    window.location.href = "login.html"; 
};

// 2. VACIAR CARRITO
window.vaciarCarrito = async function() {
    if (!carrito || carrito.length === 0) {
        window.toast?.info("El carrito ya está vacío.");
        return;
    }

    const confirmado = await window.confirmar("⚠️ ¿Estás seguro de que querés vaciar todo el carrito actual?", "Vaciar Carrito", "rose");
    if (confirmado) {
        carrito = []; 
        actualizarInterfazCarrito();
        filtrarProductos();
        window.toast?.success("🛒 Carrito vaciado con éxito.");
    }
};

// =========================================================================
// 💲 CONFIRMAR VENTA EN LA BASE DE DATOS
// =========================================================================
window.confirmarVenta = async function() {
    if (carrito.length === 0) {
        alert("🛒 El carrito está vacío.");
        return;
    }

    const selectPago = document.getElementById("formaPago") || document.getElementById("metodoPago");
    const medioPago  = selectPago ? selectPago.value : "Efectivo";

    if (medioPago === "Cuenta Corriente" && !window.clienteSeleccionado) {
        alert("⚠️ Para anotar un fiado (Cuenta Corriente) DEBÉS buscar y seleccionar un cliente primero.");
        document.getElementById("inputClienteVenta")?.focus();
        return;
    }

    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalCajero = usuarioLocal.sucursalId || 1;

    const totalBase = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    const tipoMod = document.getElementById("tipoModificador")?.value || "nada";
    const valorMod = parseFloat(document.getElementById("valorModificador")?.value) || 0;
    
    let totalFinal = totalBase;
    if (tipoMod === "descuento_pct") totalFinal -= totalBase * (valorMod / 100);
    if (tipoMod === "descuento_fijo") totalFinal -= valorMod;
    if (tipoMod === "recargo_pct") totalFinal += totalBase * (valorMod / 100);
    if (tipoMod === "recargo_fijo") totalFinal += valorMod;
    if (totalFinal < 0) totalFinal = 0;

    const factorDescuento = totalBase > 0 ? totalFinal / totalBase : 1;

    const itemsMapeados = carrito.map(item => ({
        varianteId:     item.id,
        cantidad:       item.cantidad,
        precio:         Math.round(item.precio * factorDescuento * 100) / 100,
        sucursalId:     item.sucursalId || sucursalCajero // 🌟 MANDAMOS LA SUCURSAL ELEGIDA DE CADA PRENDA
    }));

    const payload = {
        metodoPago: medioPago,
        clienteId:  window.clienteSeleccionado || null,
        sucursalId: sucursalCajero, 
        items:      itemsMapeados
    };

    try {
        const token = localStorage.getItem("token");
        const respuesta = await fetch(`${API_URL}/ventas`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (respuesta.ok) {
            const resultado = await respuesta.json();
            const ticketId = resultado.ventaId || resultado.id || null;

            if (ticketId && typeof verDetalleFactura === "function") {
                await verDetalleFactura(ticketId);
            } else {
                alert(`✅ ¡Venta guardada con éxito!`);
            }

            carrito = [];
            actualizarInterfazCarrito();
            await cargarProductos();
            if (typeof cargarHistorialVentas === "function") await cargarHistorialVentas();
        } else {
            const errorTexto = await respuesta.text();
            alert(`❌ Error al guardar la venta: ${errorTexto}`);
        }
    } catch (error) {
        console.error("❌ Error en confirmarVenta:", error);
        alert("❌ Hubo un problema de red al procesar la venta.");
    }
};

// 4. DESCARGAR PDF
window.descargarPDF = function(id) {
    console.log("📄 [SISTEMA] Generando e imprimiendo el PDF del ticket N°:", id);
    window.print();
};

// ========================================================
// 🎯 DESCUENTOS Y RECARGOS EN TIEMPO REAL (Líneas Reparadas)
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
    const inputDescuento = document.getElementById("inputDescuentoRecargo");

    if (inputDescuento) {
        inputDescuento.addEventListener("input", function() {
            console.log("✍️ Escribiendo descuento o recargo:", this.value);
            // Ejecuta el re-dibujo automático calculando el total modificado al instante
            actualizarInterfazCarrito();
        });
    }
});

// =========================================================================
// 🎫 MÓDULO DE REIMPRESIÓN DE TICKETS v2
// =========================================================================

// ── 1. GENERAR HTML TICKET (FISCAL / NO FISCAL) + TICKET DE CAMBIO ──────────────────
window.generarHTMLTicket = function(id, total, metodoPago, prendas, fecha) {
    const dateObj = fecha ? new Date(fecha) : new Date();
    const strFecha = dateObj.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const strHora = dateObj.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // 🌟 LEER EL NOMBRE DEL CAJERO LOGUEADO
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const nombreCajero = (usuarioLocal.Nombre || usuarioLocal.nombre || "CAJERO 1").toUpperCase();

    // Leemos la config (Módulo Empresa) o usamos datos por defecto
    const config = JSON.parse(localStorage.getItem("configEmpresa")) || {
        nombreFantasia: "SPACE TERMINAL",
        razonSocial: "TU NOMBRE O RAZON SOCIAL",
        cuit: "20-00000000-0",
        iibb: "20-00000000-0",
        direccion: "San Miguel de Tucumán",
        inicioActividades: "01/01/2024",
        condicionIva: "IVA RESPONSABLE INSCRIPTO",
        logo: ""
    };

    let logoHtml = config.logo 
        ? `<div style="text-align:center; margin-bottom:10px;"><img src="${config.logo}" style="max-height: 60px; object-fit: contain;"></div>`
        : `<h1 class="center bold" style="font-size: 16px; margin-bottom: 5px;">${config.nombreFantasia.toUpperCase()}</h1>`;

    // 🌟 VERIFICAMOS SI SE PIDIÓ FACTURA ARCA
    const toggleArca = document.getElementById("toggleFacturaARCA");
    const esFiscal = toggleArca ? toggleArca.checked : false;

    let itemsHTML = "";
    let itemsCambioHTML = ""; 

    if (Array.isArray(prendas) && prendas.length > 0) {
        prendas.forEach(item => {
            const nombre   = (item.productoNombre || item.ProductoNombre || item.nombre || "ROPA").toUpperCase();
            const talle    = item.talle    || item.Talle    || "N/A";
            const color    = item.color    || item.Color    || "N/A";
            const cantidad = item.cantidad || item.Cantidad || 1;
            const precio   = item.precioUnitario || item.PrecioUnitario || item.precio || 0;
            const subtotal = item.subtotal || item.Subtotal || (precio * cantidad);

            itemsHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                    <span style="width: 70%;">${cantidad > 1 ? cantidad + 'x ' : ''}${nombre} (T:${talle})</span>
                    <span>$${Number(subtotal).toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            `;

            itemsCambioHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom:3px; padding-bottom:3px; border-bottom: 1px dashed #ddd;">
                    <span style="width: 80%;">${nombre}<br><span style="font-size:10px; color:#555;">Talle: ${talle} | Color: ${color}</span></span>
                    <span style="font-weight:bold; font-size: 13px;">x${cantidad}</span>
                </div>
            `;
        });
    } else {
        itemsHTML = `<div class="center" style="padding:10px;">Sin detalle</div>`;
        itemsCambioHTML = itemsHTML;
    }

    const mostrarTicketCambio = (id !== "PRESUPUESTO");
    const nroTicketStr = String(id === "PRESUPUESTO" ? "0" : id).padStart(8, '0');
    
    // 🌟 BLOQUES DINÁMICOS SEGÚN ARCA (FISCAL VS NO FISCAL)
    let datosEmpresaHtml = "";
    let pieTicketHtml = "";

    if (esFiscal) {
        const ivaContenido = total - (total / 1.21); 
        const urlQR = encodeURIComponent(`https://www.afip.gob.ar/fe/qr/?p={"cuit":"${config.cuit.replace(/-/g,'')}","nro":${id},"total":${total}}`);
        const hashCF = Math.random().toString(36).substring(2, 12).toUpperCase();

        datosEmpresaHtml = `
            <p>${config.razonSocial}</p>
            <p>CUIT Nro.: ${config.cuit}</p>
            <p>Ing. Brutos: ${config.iibb}</p>
            <p>Dirección:</p>
            <p>${config.direccion}</p>
            <p>Inicio de Actividades: ${config.inicioActividades}</p>
            <p>${config.condicionIva}</p>
            <p>A CONSUMIDOR FINAL</p>
            
            <div class="center" style="margin: 15px 0;">
                <p>Cód. 083 - TIQUE</p>
                <p>P.V. Nro. 00010 - Nro. T. ${nroTicketStr}</p>
            </div>
        `;

        pieTicketHtml = `
            <div class="center bold" style="margin-bottom: 5px;">TRANSPARENCIA FISCAL</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <span>IVA contenido:</span>
                <span>$${Number(ivaContenido).toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div style="text-align: right; margin-bottom: 5px;">CAJERO: ${nombreCajero}</div>
            
            <div class="qr-container">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${urlQR}" alt="QR AFIP">
            </div>
            
            <div class="info-grid" style="margin-top: 10px; font-weight: bold;">
                <span>CF ${hashCF}</span>
                <span>V: 1.02</span>
            </div>
        `;
    } else {
        // Formato Comprobante Interno (SIN Fiscal)
        datosEmpresaHtml = `
            <p>${config.direccion}</p>
            <p style="margin-top: 8px;">DOCUMENTO NO VÁLIDO COMO FACTURA</p>
            <p>COMPROBANTE INTERNO</p>
            
            <div class="center" style="margin: 15px 0;">
                <p>NRO. TICKET: ${nroTicketStr}</p>
            </div>
        `;

        pieTicketHtml = `
            <div style="text-align: right; margin-bottom: 5px;">CAJERO: ${nombreCajero}</div>
            <div class="center" style="margin-top: 15px;">
                <p>¡GRACIAS POR SU COMPRA!</p>
            </div>
        `;
    }

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Ticket #${id}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Courier New', Courier, monospace; width: 80mm; max-width: 80mm; margin: 0 auto; padding: 5px; color: #000; background: #fff; font-size: 12px; line-height: 1.2; text-transform: uppercase; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .ticket { padding: 10px 5px; }
                
                .datos-empresa { margin-bottom: 15px; }
                .datos-empresa p { margin-bottom: 2px; }
                
                .info-grid { display: flex; justify-content: space-between; margin: 4px 0; }
                
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
                .divider-thick { border-top: 2px solid #000; margin: 10px 0; }
                
                .total-box { margin-top: 10px; margin-bottom: 15px; }
                .total-line { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-bottom: 5px; }
                
                .qr-container { text-align: center; margin-top: 15px; }
                .qr-container img { width: 130px; height: 130px; }
                
                .salto-pagina { page-break-before: always; }
                
                @media print { 
                    html, body { width: 80mm; } 
                    @page { margin: 0; size: 80mm auto; } 
                }
            </style>
        </head>
        <body>
            <!-- TICKET DE COMPRA -->
            <div class="ticket">
                ${logoHtml}
                <div class="datos-empresa">
                    ${datosEmpresaHtml}
                </div>
                
                <div class="info-grid">
                    <span>FECHA ${strFecha}</span>
                    <span>HORA ${strHora}</span>
                </div>
                
                <div class="divider"></div>
                
                <div style="margin-bottom: 10px;">
                    ${itemsHTML}
                </div>
                
                <div class="divider"></div>
                
                <div class="total-box">
                    <div class="total-line">
                        <span>TOTAL</span>
                        <span>$${Number(total).toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <p>RECIBI(MOS)</p>
                    <div style="display: flex; justify-content: space-between;">
                        <span>${metodoPago}</span>
                        <span>$${Number(total).toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
                
                ${pieTicketHtml}
            </div>

            ${mostrarTicketCambio ? `
            <!-- 🌟 SALTO DE PÁGINA PARA EL CORTE AUTOMÁTICO DE LA TICKETERA -->
            <div class="salto-pagina"></div>
            
            <!-- TICKET DE CAMBIO (ESTILO FISCAL MONOSPACE) -->
            <div class="ticket">
                ${logoHtml}
                <div class="center bold" style="font-size: 14px; margin: 15px 0;">TICKET DE CAMBIO</div>
                
                <div class="info-grid">
                    <span>REF. COMPRA:</span>
                    <strong>#${nroTicketStr}</strong>
                </div>
                <div class="info-grid">
                    <span>FECHA:</span>
                    <span>${strFecha}</span>
                </div>
                
                <div class="divider-thick"></div>
                <p class="bold" style="margin-bottom: 5px;">PRENDAS A CAMBIAR:</p>
                
                <div style="margin-bottom: 10px;">
                    ${itemsCambioHTML}
                </div>
                
                <div class="center" style="margin-top: 25px;">
                    <p class="bold" style="font-size: 13px;">VÁLIDO POR 30 DÍAS</p>
                    <p style="margin-top: 8px; font-size: 10px; line-height: 1.4;">
                        LA PRENDA DEBE ESTAR SIN USO<br>
                        Y CON SU ETIQUETA ORIGINAL ADHERIDA.
                    </p>
                </div>
            </div>
            ` : ''}
            
            <script>
                window.onload = () => { 
                    setTimeout(() => { window.print(); }, 800); 
                };
            </script>
        </body>
        </html>
    `;
};

// ── 2. FUNCIÓN CENTRAL: Obtiene el detalle completo y abre la ventana ─────
// FIX: Llama a GET /api/ventas/{id} para traer ArticulosComprados
window.obtenerYImprimirTicket = async function(id, modoImpresion = "normal") {
    const token = localStorage.getItem("token");

    try {
        // Siempre busca el detalle completo desde /api/ventas/{id}
        // que devuelve { InformacionVenta, ArticulosComprados }
        const respuesta = await fetch(`${API_URL}/ventas/${id}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);

        const datos = await respuesta.json();
        console.log("🎫 Datos del ticket recibidos:", datos);

        // Mapeo exacto a la estructura que devuelve tu C#:
        // { InformacionVenta: {...}, ArticulosComprados: [...] }
        const info     = datos.informacionVenta || datos.InformacionVenta || datos;
        const prendas  = datos.articulosComprados || datos.ArticulosComprados
                      || datos.detalles || datos.items || datos.productos || [];

        const total      = info.total      || info.Total      || 0;
        const metodoPago = info.metodoPago || info.MetodoPago || "Efectivo";
        const fecha      = info.fechaHora  || info.FechaHora  || info.fecha;

        const htmlTicket = window.generarHTMLTicket(id, total, metodoPago, prendas, fecha);
        const ancho      = modoImpresion === "ticketera" ? "320" : "400";
        const ventanaImp = window.open("", "_blank", `width=${ancho},height=600,scrollbars=yes`);

        if (!ventanaImp) {
            alert("⚠️ El navegador bloqueó la ventana emergente. Permitila para este sitio e intentá de nuevo.");
            return;
        }

        ventanaImp.document.write(htmlTicket);
        ventanaImp.document.close();
        ventanaImp.onload = () => { ventanaImp.focus(); ventanaImp.print(); };

        console.log(`🖨️ Ticket #${id} enviado a impresión.`);

    } catch (error) {
        console.error("❌ Error al obtener el ticket:", error);
        alert("No se pudo obtener el detalle de la venta. Revisá la consola (F12).");
    }
};

// ── 3. BOTONES DEL MODAL ──────────────────────────────────────────────────
window.descargarPDF = function(id) {
    window.obtenerYImprimirTicket(id, "normal");
};

window.imprimirEnTicketera = function(id) {
    window.obtenerYImprimirTicket(id, "ticketera");
};

// ── 4. BOTÓN REIMPRIMIR EN LA TABLA DEL HISTORIAL ────────────────────────
window.reimprimirTicket = function(id) {
    window.obtenerYImprimirTicket(id, "normal");
};

// =========================================================================
// 💰 MÓDULO DE CONTROL DE CAJA
// Pegá este bloque al final de tu ventas.js
// =========================================================================

// ── Abrir modal y cargar resumen del día ─────────────────────────────────
window.abrirCierreCaja = async function() {
    const token = localStorage.getItem("token");
    const modal = document.getElementById("modalCierreCaja");
    if (!modal) return;

    // Mostrar el modal con estado de carga
    modal.classList.remove("hidden");
    document.getElementById("cajaCargando").classList.remove("hidden");
    document.getElementById("cajaContenido").classList.add("hidden");
    document.getElementById("cajaError").classList.add("hidden");

    // 🌟 NUEVO: Extraemos la sucursal activa del Teletransportador
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalActiva = localStorage.getItem("sucursalAdminActiva") || usuarioLocal.sucursalId || 1;

    try {
        // 🌟 NUEVO: Le enviamos el ID de la sucursal para que devuelva la caja correcta
        const respuesta = await fetch(`${API_URL}/cierrecaja/resumen-hoy?sucursalId=${sucursalActiva}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);

        const resumen = await respuesta.json();
        console.log("💰 Resumen de caja:", resumen);

        // Mapeo tolerante PascalCase / camelCase
        const efectivo      = resumen.totalEfectivo      ?? resumen.TotalEfectivo      ?? 0;
        const transferencia = resumen.totalTransferencia ?? resumen.TotalTransferencia ?? 0;
        const debito        = resumen.totalDebito        ?? resumen.TotalDebito        ?? 0;
        const credito       = resumen.totalCredito       ?? resumen.TotalCredito       ?? 0;
        const totalGeneral  = resumen.totalGeneral       ?? resumen.TotalGeneral       ?? 0;
        const cantVentas    = resumen.cantidadVentas     ?? resumen.CantidadVentas     ?? 0;

        // Guardar en dataset del modal para usar al confirmar cierre
        modal.dataset.efectivo      = efectivo;
        modal.dataset.transferencia = transferencia;
        modal.dataset.debito        = debito;
        modal.dataset.credito       = credito;
        modal.dataset.total         = totalGeneral;
        modal.dataset.ventas        = cantVentas;

        // Poblar los valores en pantalla
        document.getElementById("cajaEfectivo").textContent      = `$${Number(efectivo).toLocaleString("es-AR")}`;
        document.getElementById("cajaTransferencia").textContent = `$${Number(transferencia).toLocaleString("es-AR")}`;
        document.getElementById("cajaDebito").textContent        = `$${Number(debito).toLocaleString("es-AR")}`;
        document.getElementById("cajaCredito").textContent       = `$${Number(credito).toLocaleString("es-AR")}`;
        document.getElementById("cajaTotalGeneral").textContent  = `$${Number(totalGeneral).toLocaleString("es-AR")}`;
        document.getElementById("cajaCantVentas").textContent    = cantVentas;

        // Mostrar contenido y ocultar loader
        document.getElementById("cajaCargando").classList.add("hidden");
        document.getElementById("cajaContenido").classList.remove("hidden");

    } catch (error) {
        console.error("❌ Error al cargar resumen de caja:", error);
        document.getElementById("cajaCargando").classList.add("hidden");
        document.getElementById("cajaError").classList.remove("hidden");
    }
};

window.cerrarCierreCaja = function() {
    document.getElementById("modalCierreCaja")?.classList.add("hidden");
    document.getElementById("cajaObservaciones")?.value && 
        (document.getElementById("cajaObservaciones").value = "");
};

// ── Confirmar y guardar el cierre en la BD ────────────────────────────────
window.confirmarCierreCaja = async function() {
    const token = localStorage.getItem("token");
    const modal = document.getElementById("modalCierreCaja");
    const btn   = document.getElementById("btnConfirmarCierre");

    const observaciones = document.getElementById("cajaObservaciones")?.value.trim() || "";

    // 🌟 NUEVO: Extraemos la sucursal del cajero actual
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalCajero = usuarioLocal.sucursalId || 1;

    const payload = {
        totalEfectivo:      parseFloat(modal.dataset.efectivo      || 0),
        totalTransferencia: parseFloat(modal.dataset.transferencia || 0),
        totalDebito:        parseFloat(modal.dataset.debito        || 0),
        totalCredito:       parseFloat(modal.dataset.credito       || 0),
        totalGeneral:       parseFloat(modal.dataset.total         || 0),
        cantidadVentas:     parseInt(modal.dataset.ventas          || 0),
        observaciones:      observaciones,
        sucursalId:         sucursalCajero // 🌟 Se lo mandamos a C# por las dudas
    };

    // Deshabilitar botón mientras guarda
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

    try {
        const respuesta = await fetch(`${API_URL}/cierrecaja`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            // 🌟 FIX: Atrapamos el error EXACTO que manda C# para no tener que adivinar
            const errorTexto = await respuesta.text();
            throw new Error(errorTexto || `Error HTTP ${respuesta.status}`);
        }

        const resultado = await respuesta.json();
        console.log("✅ Cierre guardado:", resultado);

        window.cerrarCierreCaja();

        // Imprimir resumen automáticamente al cerrar
        window.imprimirResumenCaja(payload);

        window.toast?.success(`✅ Caja cerrada correctamente.`);

    } catch (error) {
        console.error("❌ Error al guardar cierre:", error);
        // 🌟 FIX: Te mostramos el motivo exacto en pantalla
        alert(`❌ Falló el cierre de caja. El servidor dice:\n${error.message}`);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✅ Confirmar Cierre de Caja"; }
    }
};

// ── Imprimir resumen de caja ──────────────────────────────────────────────
window.imprimirResumenCaja = function(datos) {
    const fecha = new Date().toLocaleString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

    const html = `
        <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Cierre de Caja - ${fecha}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Courier New',monospace; width:80mm; margin:0 auto; padding:8px; color:#000; }
            h1 { font-size:16px; text-align:center; font-weight:bold; letter-spacing:2px; }
            .sub { text-align:center; font-size:11px; color:#555; margin-bottom:8px; }
            .divider { border-top:1px dashed #000; margin:8px 0; }
            .fila { display:flex; justify-content:space-between; font-size:13px; margin:5px 0; }
            .total { display:flex; justify-content:space-between; font-size:16px; font-weight:bold; border-top:2px solid #000; padding-top:6px; margin-top:6px; }
            .footer { text-align:center; font-size:10px; color:#777; margin-top:12px; }
            @media print { @page { margin:0; size:80mm auto; } }
        </style></head><body>
        <h1>SPACE TERMINAL</h1>
        <p class="sub">CIERRE DE CAJA</p>
        <p class="sub">${fecha}</p>
        <div class="divider"></div>
        <div class="fila"><span>Ventas realizadas:</span><strong>${datos.cantidadVentas}</strong></div>
        <div class="divider"></div>
        <div class="fila"><span>💵 Efectivo:</span><span>$${Number(datos.totalEfectivo).toLocaleString("es-AR")}</span></div>
        <div class="fila"><span>📲 Transferencia:</span><span>$${Number(datos.totalTransferencia).toLocaleString("es-AR")}</span></div>
        <div class="fila"><span>💳 Débito:</span><span>$${Number(datos.totalDebito).toLocaleString("es-AR")}</span></div>
        <div class="fila"><span>💳 Crédito:</span><span>$${Number(datos.totalCredito).toLocaleString("es-AR")}</span></div>
        <div class="divider"></div>
        <div class="total"><span>TOTAL:</span><span>$${Number(datos.totalGeneral).toLocaleString("es-AR")}</span></div>
        ${datos.observaciones ? `<div class="divider"></div><div class="fila">Obs: ${datos.observaciones}</div>` : ""}
        <div class="footer"><p>Cierre registrado correctamente</p></div>
        </body></html>
    `;

    const ventana = window.open("", "_blank", "width=400,height=500");
    if (!ventana) return;
    ventana.document.write(html);
    ventana.document.close();
    ventana.onload = () => { ventana.focus(); ventana.print(); };
};

// =========================================================================
// 📊 MÓDULO DE ESTADÍSTICAS
// =========================================================================

window.cargarEstadisticas = async function() {
    const token = localStorage.getItem("token");

    // Mostrar skeletons de carga
    ["statTotalMes", "statVentasMes", "statTicketProm", "statMejorDia"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "...";
    });

    try {
        // Traer todas las ventas para procesar localmente
        const respuesta = await fetch(`${API_URL}/ventas`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!respuesta.ok) throw new Error("Error al cargar ventas");

        const ventas = await respuesta.json();
        console.log("📊 Ventas para estadísticas:", ventas);

        const ahora   = new Date();
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();

        // Filtrar ventas del mes actual
        const ventasMes = ventas.filter(v => {
            const fecha = new Date(v.fechaHora || v.FechaHora || v.fecha);
            return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual;
        });

        // ── KPIs principales ─────────────────────────────────────────────
        const totalMes    = ventasMes.reduce((acc, v) => acc + (v.total || v.Total || 0), 0);
        const cantVentas  = ventasMes.length;
        const ticketProm  = cantVentas > 0 ? totalMes / cantVentas : 0;

        // Mejor día del mes
        const porDia = {};
        ventasMes.forEach(v => {
            const dia = new Date(v.fechaHora || v.FechaHora || v.fecha).toLocaleDateString("es-AR");
            porDia[dia] = (porDia[dia] || 0) + (v.total || v.Total || 0);
        });
        const mejorDia = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];

        document.getElementById("statTotalMes").textContent   = `$${Number(totalMes).toLocaleString("es-AR")}`;
        document.getElementById("statVentasMes").textContent  = cantVentas;
        document.getElementById("statTicketProm").textContent = `$${Number(ticketProm).toFixed(0)}`;
        document.getElementById("statMejorDia").textContent   = mejorDia ? mejorDia[0] : "Sin datos";

        // ── Gráfico 1: Ventas por día (últimos 14 días) ───────────────────
        const labels14 = [];
        const data14   = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
            const key   = d.toLocaleDateString("es-AR");
            labels14.push(label);
            data14.push(porDia[key] || 0);
        }
        window.renderGraficoLinea("graficoPorDia", labels14, data14, "Ventas diarias ($)");

        // ── Gráfico 2: Métodos de pago ────────────────────────────────────
        const metodos = {};
        ventasMes.forEach(v => {
            const m = v.metodoPago || v.MetodoPago || "Efectivo";
            metodos[m] = (metodos[m] || 0) + (v.total || v.Total || 0);
        });
        window.renderGraficoDona("graficoMetodos",
            Object.keys(metodos),
            Object.values(metodos),
            "Métodos de pago"
        );

        // ── Gráfico 3: Ventas por día de la semana ────────────────────────
        const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        const porSemana  = [0, 0, 0, 0, 0, 0, 0];
        ventasMes.forEach(v => {
            const d = new Date(v.fechaHora || v.FechaHora || v.fecha).getDay();
            porSemana[d] += (v.total || v.Total || 0);
        });
        window.renderGraficoBarra("graficoPorSemana", diasSemana, porSemana, "Total por día de la semana ($)");

    } catch (error) {
        console.error("❌ Error al cargar estadísticas:", error);
        ["statTotalMes","statVentasMes","statTicketProm","statMejorDia"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Error";
        });
    }
};

// ── Helpers de gráficos (Chart.js) ───────────────────────────────────────
window.renderGraficoLinea = function(canvasId, labels, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    canvas._chartInstance = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: "#6366f1",
                backgroundColor: "rgba(99,102,241,0.15)",
                borderWidth: 2,
                pointBackgroundColor: "#6366f1",
                pointRadius: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { color: "#1e293b" } },
                y: { ticks: { color: "#94a3b8", font: { size: 10 }, callback: v => `$${Number(v).toLocaleString("es-AR")}` }, grid: { color: "#1e293b" } }
            }
        }
    });
};

window.renderGraficoBarra = function(canvasId, labels, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    canvas._chartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label,
                data,
                backgroundColor: "rgba(99,102,241,0.7)",
                borderColor: "#6366f1",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
                y: { ticks: { color: "#94a3b8", callback: v => `$${Number(v).toLocaleString("es-AR")}` }, grid: { color: "#1e293b" } }
            }
        }
    });
};

window.renderGraficoDona = function(canvasId, labels, data, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    canvas._chartInstance = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                label,
                data,
                backgroundColor: ["#6366f1","#10b981","#3b82f6","#f59e0b","#ec4899"],
                borderColor: "#0f172a",
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: "#94a3b8", font: { size: 11 }, padding: 12 }
                }
            }
        }
    });
};

// =========================================================================
// 👤 MÓDULO DE CLIENTES
// =========================================================================

window.clientesMemoria = [];

// ── Cargar y renderizar tabla de clientes ─────────────────────────────────
window.cargarClientes = async function() {
    const token = localStorage.getItem("token");
    const tbody = document.getElementById("tablaClientesBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500 text-sm animate-pulse">Cargando clientes...</td></tr>`;

    try {
        const resp = await fetch(`${API_URL}/clientes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al cargar clientes");

        const clientes = await resp.json();
        window.clientesMemoria = clientes;
        window.renderizarTablaClientes(clientes);

    } catch (error) {
        console.error("❌ Error clientes:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-rose-400 text-sm">No se pudo conectar con el servidor.</td></tr>`;
    }
};

window.renderizarTablaClientes = function(lista) {
    const tbody = document.getElementById("tablaClientesBody");
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 italic text-sm">No hay clientes registrados aún.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => `
        <tr class="hover:bg-slate-900/30 transition-colors border-b border-slate-800/40">
            <td class="p-4 font-bold text-white text-sm">${c.nombre}</td>
            <td class="p-4 text-slate-400 text-xs font-mono">${c.dni || "—"}</td>
            <td class="p-4 text-slate-400 text-xs">${c.telefono || "—"}</td>
            <td class="p-4 text-slate-400 text-xs">${c.email || "—"}</td>
            <td class="p-4 text-emerald-400 font-mono font-bold text-sm">$${Number(c.totalCompras || 0).toLocaleString("es-AR")}</td>
            <td class="p-4 text-right space-x-1">
                <button onclick="window.verHistorialCliente(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')"
                    class="bg-indigo-950 hover:bg-indigo-900 text-indigo-400 text-xs px-2 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer">
                    📋 Historial
                </button>
                <button onclick="window.eliminarCliente(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')"
                    class="bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 text-xs px-2 py-1.5 rounded-lg border border-rose-500/20 cursor-pointer">
                    🗑️ Baja
                </button>
            </td>
        </tr>
    `).join("");
};

window.filtrarClientes = function() {
    const txt = (document.getElementById("inputBuscarCliente")?.value || "").toLowerCase();
    const filtrados = window.clientesMemoria.filter(c =>
        (c.nombre || "").toLowerCase().includes(txt) ||
        (c.dni || "").includes(txt) ||
        (c.telefono || "").includes(txt) ||
        (c.email || "").toLowerCase().includes(txt)
    );
    window.renderizarTablaClientes(filtrados);
};

// ── Modal agregar cliente ─────────────────────────────────────────────────
window.abrirModalAgregarCliente = function() {
    document.getElementById("modalAgregarCliente")?.classList.remove("hidden");
    document.getElementById("clienteNombre")?.focus();
};

window.cerrarModalAgregarCliente = function() {
    document.getElementById("modalAgregarCliente")?.classList.add("hidden");
    document.getElementById("formAgregarCliente")?.reset();
    document.getElementById("errorCliente")?.classList.add("hidden");
};

window.guardarNuevoCliente = async function(event) {
    event.preventDefault();
    const token    = localStorage.getItem("token");
    const divError = document.getElementById("errorCliente");
    const btn      = event.submitter;
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Guardando...") : () => {};

    const payload = {
        nombre:   document.getElementById("clienteNombre")?.value.trim(),
        dni:      document.getElementById("clienteDni")?.value.trim() || null,
        telefono: document.getElementById("clienteTelefono")?.value.trim() || null,
        email:    document.getElementById("clienteEmail")?.value.trim() || null,
        activo:   true
    };

    try {
        const resp = await fetch(`${API_URL}/clientes`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ mensaje: "Error desconocido." }));
            throw new Error(err.mensaje);
        }

        window.cerrarModalAgregarCliente();
        await window.cargarClientes();
        alert(`✅ Cliente "${payload.nombre}" registrado con éxito.`);

    } catch (error) {
        divError.textContent = error.message || "No se pudo guardar el cliente.";
        divError.classList.remove("hidden");
    } finally {
        restaurar();
    }
};

// ── Ver historial de un cliente ───────────────────────────────────────────
window.verHistorialCliente = async function(id, nombre) {
    const token = localStorage.getItem("token");
    const modal = document.getElementById("modalHistorialCliente");
    if (!modal) return;

    document.getElementById("historialClienteNombre").textContent = nombre;
    document.getElementById("historialClienteBody").innerHTML =
        `<tr><td colspan="3" class="p-4 text-center text-slate-500 animate-pulse text-sm">Cargando historial...</td></tr>`;
    document.getElementById("historialClienteResumen").textContent = "";
    modal.classList.remove("hidden");

    try {
        const resp = await fetch(`${API_URL}/clientes/${id}/historial`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al cargar historial");

        const datos = await resp.json();
        const historial      = datos.historial      || datos.Historial      || [];
        const totalGastado   = datos.totalGastado   || datos.TotalGastado   || 0;
        const cantVisitas    = datos.cantidadVisitas || datos.CantidadVisitas || 0;

        document.getElementById("historialClienteResumen").innerHTML = `
            <span class="text-slate-400 text-xs">${cantVisitas} visitas —</span>
            <span class="text-emerald-400 font-bold text-sm ml-1">$${Number(totalGastado).toLocaleString("es-AR")} total</span>
        `;

        if (historial.length === 0) {
            document.getElementById("historialClienteBody").innerHTML =
                `<tr><td colspan="3" class="p-6 text-center text-slate-500 italic text-xs">Sin compras registradas.</td></tr>`;
            return;
        }

        document.getElementById("historialClienteBody").innerHTML = historial.map(v => `
            <tr class="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                <td class="py-2.5 text-slate-400 text-xs">
                    ${new Date(v.fechaHora || v.FechaHora).toLocaleDateString("es-AR")}
                </td>
                <td class="py-2.5 text-slate-300 text-xs capitalize">${v.metodoPago || v.MetodoPago}</td>
                <td class="py-2.5 text-right text-emerald-400 font-mono font-bold text-sm">
                    $${Number(v.total || v.Total).toLocaleString("es-AR")}
                </td>
            </tr>
        `).join("");

    } catch (error) {
        document.getElementById("historialClienteBody").innerHTML =
            `<tr><td colspan="3" class="p-4 text-center text-rose-400 text-xs">Error al cargar el historial.</td></tr>`;
    }
};

window.cerrarModalHistorialCliente = function() {
    document.getElementById("modalHistorialCliente")?.classList.add("hidden");
};

// ── Eliminar cliente (soft delete) ────────────────────────────────────────
window.eliminarCliente = async function(id, nombre) {
    const ok = window.confirmar
        ? await window.confirmar(`¿Dar de baja al cliente <strong>"${nombre}"</strong>?<br>Sus compras anteriores quedan intactas.`, "Dar de baja", "rose")
        : confirm(`¿Dar de baja al cliente "${nombre}"?`);
    if (!ok) return;

    const token = localStorage.getItem("token");
    try {
        const resp = await fetch(`${API_URL}/clientes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al dar de baja.");

        await window.cargarClientes();
        alert(`✅ Cliente "${nombre}" dado de baja correctamente.`);

    } catch (error) {
        alert(`❌ ${error.message}`);
    }
};

// ── Autocompletado de cliente en el punto de venta ────────────────────────
window.buscarClienteVenta = async function(query) {
    if (!query || query.length < 2) {
        document.getElementById("sugerenciasCliente")?.classList.add("hidden");
        return;
    }

    const token = localStorage.getItem("token");
    try {
        const resp = await fetch(`${API_URL}/clientes/buscar?q=${encodeURIComponent(query)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const clientes = await resp.json();
        const div = document.getElementById("sugerenciasCliente");
        if (!div) return;

        if (clientes.length === 0) { div.classList.add("hidden"); return; }

        div.innerHTML = clientes.map(c => `
            <div onclick="window.seleccionarClienteVenta(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')"
                class="px-3 py-2 hover:bg-slate-800 cursor-pointer text-sm text-slate-300 border-b border-slate-800/50 last:border-0">
                <span class="font-bold text-white">${c.nombre}</span>
                <span class="text-slate-500 text-xs ml-2">DNI: ${c.dni || "—"} · ${c.telefono || "—"}</span>
            </div>
        `).join("");
        div.classList.remove("hidden");

    } catch (e) { console.error("Error buscando cliente:", e); }
};

window.seleccionarClienteVenta = function(id, nombre) {
    window.clienteSeleccionado = id;
    const input = document.getElementById("inputClienteVenta");
    if (input) input.value = nombre;
    document.getElementById("sugerenciasCliente")?.classList.add("hidden");
    console.log(`👤 Cliente seleccionado: ${nombre} (ID: ${id})`);
};

window.limpiarClienteVenta = function() {
    window.clienteSeleccionado = null;
    const input = document.getElementById("inputClienteVenta");
    if (input) input.value = "";
};

// =========================================================================
// 📷 MÓDULO DE LECTOR DE CÓDIGO DE BARRAS
// Soporta: Lector USB/Bluetooth (teclado) + Cámara (html5-qrcode)
// =========================================================================

window.BarcodeScanner = (function() {

    let bufferCodigo = "";
    let timerBuffer  = null;
    let escaneandoCamara = false;
    let scannerCamara    = null;

    // ── Procesar código escaneado (desde cualquier fuente) ────────────────
    async function procesarCodigo(codigo, origen) {
        codigo = codigo.trim();
        if (!codigo) return;

        console.log(`📷 Código escaneado [${origen}]: ${codigo}`);

        const seccionActiva = obtenerSeccionActiva();

        if (seccionActiva === "seccion-ventas") {
            await agregarAlCarritoPorCodigo(codigo);
        } else if (seccionActiva === "seccion-productos") {
            buscarEnInventarioPorCodigo(codigo);
        } else {
            // Si no hay sección clara, intentar en ventas primero
            await agregarAlCarritoPorCodigo(codigo);
        }
    }

    function obtenerSeccionActiva() {
        const secciones = [
            "seccion-ventas",
            "seccion-productos",
            "seccion-usuarios",
            "seccion-estadisticas",
            "seccion-clientes"
        ];
        return secciones.find(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains("hidden");
        }) || "seccion-ventas";
    }

    // ── Agregar al carrito por código de barras ───────────────────────────
    async function agregarAlCarritoPorCodigo(codigo) {
        const token = localStorage.getItem("token");

        // 🌟 NUEVO: Obtenemos la sucursal del cajero
        const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
        const sucursalId = usuarioLocal.sucursalId || 1;

        try {
            // 🌟 NUEVO: Le inyectamos &sucursalId=${sucursalId} a la URL
            const resp = await fetch(
                `${window.ConfigInventario?.URL || API_URL}/variantes/buscar-codigo?codigo=${encodeURIComponent(codigo)}&sucursalId=${sucursalId}`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );

            if (resp.status === 404) {
                window.toast?.warning(`Código ${codigo} no encontrado en el sistema.`) ||
                alert(`⚠️ Código ${codigo} no encontrado.`);
                return;
            }
            if (!resp.ok) throw new Error("Error al buscar código");

            const variante = await resp.json();
            console.log("✅ Variante encontrada:", variante);

            // Usar la función de agregar al carrito que ya existe en ventas.js
            if (typeof window.agregarAlCarrito === "function") {
                window.agregarAlCarrito(
                    variante.productoId   ?? variante.ProductoId,
                    variante.id           ?? variante.Id,
                    variante.productoNombre ?? variante.ProductoNombre ?? "Producto",
                    variante.talle        ?? variante.Talle,
                    variante.color        ?? variante.Color,
                    variante.precioVenta  ?? variante.PrecioVenta ?? 0,
                    variante.stockActual  ?? variante.StockActual ?? 0
                );
                window.toast?.success(`➕ ${variante.productoNombre ?? "Producto"} (${variante.talle}/${variante.color}) agregado al carrito`) ||
                console.log("Agregado al carrito");
            }

        } catch (error) {
            console.error("❌ Error buscando código:", error);
            window.toast?.error("Error al buscar el código de barras.") ||
            alert("❌ Error al buscar el código de barras.");
        }
    }

    // ── Buscar en inventario por código ───────────────────────────────────
    function buscarEnInventarioPorCodigo(codigo) {
        const input = document.getElementById("inputBuscarProducto");
        if (input) {
            input.value = codigo;
            if (typeof window.filtrarProductosInventario === "function") {
                window.filtrarProductosInventario();
            }
            window.toast?.info(`🔍 Buscando código: ${codigo}`) ||
            console.log("Buscando:", codigo);
        }
    }

    // ── MODO 1: Lector USB/Bluetooth (captura de teclado global) ─────────
    function iniciarLectorTeclado() {
        document.addEventListener("keydown", function(e) {
            // Ignorar si el foco está en un input de texto normal
            const tag = document.activeElement?.tagName;
            const tipo = document.activeElement?.type;
            const ignorar = [
                "inputBuscarProducto", "inputBuscador", "inputClienteVenta",
                "inputNombreCategoria", "addNombre", "clienteNombre",
                "reponerCantidad", "varianteTalle", "varianteColor"
            ];
            if (ignorar.includes(document.activeElement?.id)) return;
            if (tag === "TEXTAREA") return;

            // El lector envía los caracteres muy rápido y termina con Enter
            if (e.key === "Enter") {
                if (bufferCodigo.length >= 4) {
                    const codigo = bufferCodigo;
                    bufferCodigo = "";
                    clearTimeout(timerBuffer);
                    procesarCodigo(codigo, "USB/BT");
                }
                bufferCodigo = "";
                return;
            }

            // Acumular caracteres en el buffer
            if (e.key.length === 1) {
                bufferCodigo += e.key;
                clearTimeout(timerBuffer);
                // Si pasan 100ms sin más teclas, limpiar el buffer
                // (los lectores envían todo en menos de 50ms)
                timerBuffer = setTimeout(() => {
                    bufferCodigo = "";
                }, 100);
            }
        });

        console.log("⌨️ Lector USB/Bluetooth activado");
    }

    // ── MODO 2: Cámara (html5-qrcode) ────────────────────────────────────
    function abrirCamara() {
        const modal = document.getElementById("modalCamaraScanner");
        if (!modal) return;

        modal.classList.remove("hidden");
        escaneandoCamara = true;

        // Inicializar el escáner de cámara
        if (typeof Html5Qrcode === "undefined") {
            document.getElementById("camaraError").textContent =
                "La librería de cámara no cargó. Verificá tu conexión.";
            document.getElementById("camaraError").classList.remove("hidden");
            return;
        }

        scannerCamara = new Html5Qrcode("camaraPreview");

        Html5Qrcode.getCameras().then(cameras => {
            if (!cameras || cameras.length === 0) {
                throw new Error("No se encontró ninguna cámara.");
            }

            // Usar la cámara trasera si existe, si no la primera disponible
            const camaraId = cameras.find(c =>
                c.label.toLowerCase().includes("back") ||
                c.label.toLowerCase().includes("trasera") ||
                c.label.toLowerCase().includes("rear")
            )?.id || cameras[0].id;

            scannerCamara.start(
                camaraId,
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (codigoDecodificado) => {
                    // Código detectado — procesar y cerrar cámara
                    cerrarCamara();
                    procesarCodigo(codigoDecodificado, "Cámara");
                },
                () => {} // Error silencioso por frame sin código
            ).catch(err => {
                console.error("Error cámara:", err);
                document.getElementById("camaraError").textContent =
                    "No se pudo acceder a la cámara. Verificá los permisos del navegador.";
                document.getElementById("camaraError").classList.remove("hidden");
            });

        }).catch(err => {
            document.getElementById("camaraError").textContent =
                "No se encontró ninguna cámara disponible.";
            document.getElementById("camaraError").classList.remove("hidden");
        });
    }

    function cerrarCamara() {
        const modal = document.getElementById("modalCamaraScanner");
        if (modal) modal.classList.add("hidden");

        if (scannerCamara && escaneandoCamara) {
            scannerCamara.stop().catch(() => {});
            scannerCamara = null;
        }
        escaneandoCamara = false;
    }

    // API pública
    return {
        init:         iniciarLectorTeclado,
        abrirCamara:  abrirCamara,
        cerrarCamara: cerrarCamara,
        procesar:     procesarCodigo
    };

})();

// Inicializar el lector de teclado automáticamente al cargar
window.BarcodeScanner.init();

// =========================================================================
// 💳 MÓDULO DE MERCADO PAGO
// =========================================================================

window.MercadoPagoIntegration = (function() {

    // ── Crear preferencia y mostrar QR + Link ────────────────────────────
    async function abrirPagoMP(ventaId, total, itemsCarrito) {
        const token = localStorage.getItem("token");
        const modal = document.getElementById("modalMercadoPago");
        if (!modal) return;

        // Mostrar modal con loader
        modal.classList.remove("hidden");
        document.getElementById("mpCargando").classList.remove("hidden");
        document.getElementById("mpContenido").classList.add("hidden");
        document.getElementById("mpError").classList.add("hidden");
        document.getElementById("mpTotal").textContent =
            `$${Number(total).toLocaleString("es-AR")}`;

        try {
            // Armar los ítems para MP desde el carrito
            const items = itemsCarrito.map(item => ({
                nombre:         item.nombre || "Prenda",
                cantidad:       item.cantidad || 1,
                precioUnitario: item.precio || 0
            }));

            const payload = {
                ventaId,
                urlBase: window.location.origin || "http://localhost:5000",
                items
            };

            const resp = await fetch(`${API_URL}/mercadopago/crear-preferencia`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ mensaje: "Error desconocido." }));
                throw new Error(err.mensaje || `Error HTTP ${resp.status}`);
            }

            const datos = await resp.json();
            console.log("✅ Preferencia MP creada:", datos);

            // ── Mostrar QR con la librería de MP ─────────────────────────
            const contenedorQR = document.getElementById("mpQRContenedor");
            if (contenedorQR) {
                contenedorQR.innerHTML = ""; // Limpiar QR anterior

                // Usar el SDK de MP para renderizar el QR
                if (typeof MercadoPago !== "undefined") {
                    const mp = new MercadoPago(
                        document.getElementById("mpPublicKey")?.value || "",
                        { locale: "es-AR" }
                    );
                    mp.bricks().create("wallet", "mpQRContenedor", {
                        initialization: { preferenceId: datos.preferenceId }
                    });
                } else {
                    // Fallback: mostrar QR como imagen vía API de QR
                    const urlQR = encodeURIComponent(datos.sandboxUrl || datos.initPoint);
                    contenedorQR.innerHTML = `
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${urlQR}"
                             alt="QR Mercado Pago"
                             class="rounded-xl mx-auto border-4 border-indigo-500/30">
                    `;
                }
            }

            // ── Mostrar link de pago ──────────────────────────────────────
            const linkPago = datos.initPoint || datos.initPoint;
            const btnLink  = document.getElementById("mpBtnLink");
            if (btnLink) btnLink.href = linkPago;

            // Guardar link para WhatsApp
            window._mpLinkActual = linkPago;
            window._mpTotalActual = total;

            // Ocultar loader y mostrar contenido
            document.getElementById("mpCargando").classList.add("hidden");
            document.getElementById("mpContenido").classList.remove("hidden");

        } catch (error) {
            console.error("❌ Error MP:", error);
            document.getElementById("mpCargando").classList.add("hidden");
            document.getElementById("mpError").textContent =
                error.message || "No se pudo conectar con Mercado Pago.";
            document.getElementById("mpError").classList.remove("hidden");
        }
    }

    function cerrarModal() {
        document.getElementById("modalMercadoPago")?.classList.add("hidden");
        window._mpLinkActual = null;
    }

    // ── Compartir por WhatsApp ────────────────────────────────────────────
    function compartirWhatsApp() {
        if (!window._mpLinkActual) return;
        const total = Number(window._mpTotalActual || 0).toLocaleString("es-AR");
        const msg   = encodeURIComponent(
            `Hola! Te comparto el link de pago por $${total} 👇\n${window._mpLinkActual}`
        );
        window.open(`https://wa.me/?text=${msg}`, "_blank");
    }

    // ── Copiar link al portapapeles ───────────────────────────────────────
    function copiarLink() {
        if (!window._mpLinkActual) return;
        navigator.clipboard.writeText(window._mpLinkActual).then(() => {
            window.toast?.success("Link copiado al portapapeles") ||
            alert("✅ Link copiado");
        });
    }

    return { abrirPagoMP, cerrarModal, compartirWhatsApp, copiarLink };

})();

window.cobrarConMercadoPago = async function() {
    if (!carrito || carrito.length === 0) {
        alert("🛒 El carrito está vacío.");
        return;
    }

    const quiereFactura = document.getElementById("toggleFacturaARCA")?.checked || false;

    // Calcular total con descuento
    const totalBase = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const inputDesc = document.getElementById("inputDescuentoRecargo");
    const modTxt    = inputDesc ? inputDesc.value.trim() : "";
    let totalFinal  = totalBase;
    let factor      = 1;

    if (modTxt) {
        if (modTxt.includes("%")) {
            const esDesc = modTxt.startsWith("-");
            const pct    = parseFloat(modTxt.replace(/[^0-9.]/g, ""));
            if (!isNaN(pct)) {
                const mod = totalBase * (pct / 100);
                totalFinal = esDesc ? totalBase - mod : totalBase + mod;
            }
        } else {
            const esDesc = modTxt.startsWith("-");
            const monto  = parseFloat(modTxt.replace(/[^0-9.]/g, ""));
            if (!isNaN(monto)) totalFinal = esDesc ? totalBase - monto : totalBase + monto;
        }
        if (totalFinal < 0) totalFinal = 0;
        factor = totalBase > 0 ? totalFinal / totalBase : 1;
    }

    const token = localStorage.getItem("token");
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalCajero = usuarioLocal.sucursalId || 1;

    const itemsMapeados = carrito.map(item => ({
        varianteId: item.id,
        cantidad:   item.cantidad,
        precio:     Math.round(item.precio * factor * 100) / 100,
        sucursalId: item.sucursalId || sucursalCajero // 🌟 MANDAMOS LA SUCURSAL ELEGIDA DE CADA PRENDA
    }));

    try {
        // 1. Registrar la venta con método Mercado Pago
        const resp = await fetch(`${API_URL}/ventas`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                metodoPago: "Mercado Pago",
                clienteId:  window.clienteSeleccionado || null,
                sucursalId: sucursalCajero,
                items:      itemsMapeados
            })
        });

        if (!resp.ok) throw new Error(await resp.text());

        const resultado = await resp.json();
        const ventaId   = resultado.ventaId || resultado.id;

        // 2. Si quiere factura y ARCA está configurado → facturar también
        if (quiereFactura) {
            const configurado = await window.arcaConfigurado?.() || false;
            if (configurado) {
                window.toast?.info("Generando factura electrónica...");
                // flujo ARCA — se implementa cuando el cliente tenga credenciales
            } else {
                window.toast?.warning("La venta se registró pero ARCA no está configurado para emitir factura.");
            }
        }

        // 3. Abrir modal de MP con QR y link
        await window.MercadoPagoIntegration.abrirPagoMP(ventaId, totalFinal, carrito);

        // 4. Limpiar carrito
        carrito = [];
        actualizarInterfazCarrito();
        await cargarProductos();
        if (typeof cargarHistorialVentas === "function") await cargarHistorialVentas();

    } catch (error) {
        console.error("❌ Error MP:", error);
        alert(`❌ Error al procesar: ${error.message}`);
    }
};

// ── Control de tabs del modal ─────────────────────────────────────────────
window.mpMostrarTab = function(tab) {
    const panelQR   = document.getElementById("panelQR");
    const panelLink = document.getElementById("panelLink");
    const tabQR     = document.getElementById("tabQR");
    const tabLink   = document.getElementById("tabLink");

    if (tab === "qr") {
        panelQR?.classList.remove("hidden");
        panelLink?.classList.add("hidden");
        tabQR?.classList.add("bg-indigo-600", "text-white");
        tabQR?.classList.remove("text-slate-400");
        tabLink?.classList.remove("bg-indigo-600", "text-white");
        tabLink?.classList.add("text-slate-400");
    } else {
        panelLink?.classList.remove("hidden");
        panelQR?.classList.add("hidden");
        tabLink?.classList.add("bg-indigo-600", "text-white");
        tabLink?.classList.remove("text-slate-400");
        tabQR?.classList.remove("bg-indigo-600", "text-white");
        tabQR?.classList.add("text-slate-400");
    }
};

// =========================================================================
// 🧠 PROCESAMIENTO INTELIGENTE DE VENTA
// Reemplazá la función window.cobrarConARCA en ventas.js
// y agregá window.procesarVentaInteligente al final del archivo
// =========================================================================

// ── Función central que decide qué flujo usar ─────────────────────────────
window.procesarVentaInteligente = async function() {
    if (!carrito || carrito.length === 0) {
        alert("⚠️ El carrito está vacío.");
        return;
    }

    const quiereFactura = document.getElementById("toggleFacturaARCA")?.checked || false;

    if (quiereFactura) {
        // Verificar si ARCA está configurado
        const configurado = await window.arcaConfigurado?.() || false;

        if (!configurado) {
            // Mostrar modal informativo de ARCA
            const modal = document.getElementById("modalARCANoConfigurado");
            if (modal) modal.classList.remove("hidden");
            return;
        }

        // ARCA configurado → flujo de factura electrónica
        // (se completa cuando el cliente tenga sus credenciales)
        window.toast?.info("Iniciando facturación electrónica con ARCA...");
        return;
    }

    // Sin factura → comprobante simple (flujo normal)
    await window.confirmarVenta();
};

// ── Actualizar texto del botón según el toggle ────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("toggleFacturaARCA");
    const btnProcesar = toggle?.closest(".pt-4")?.querySelector("button[onclick*='procesarVentaInteligente']");

    toggle?.addEventListener("change", function() {
        if (!btnProcesar) return;
        if (this.checked) {
            btnProcesar.innerHTML = "🏛️ Procesar + Factura ARCA";
            btnProcesar.classList.remove("bg-indigo-600", "hover:bg-indigo-500");
            btnProcesar.classList.add("bg-violet-700", "hover:bg-violet-600");
        } else {
            btnProcesar.innerHTML = "🧾 Procesar Venta";
            btnProcesar.classList.remove("bg-violet-700", "hover:bg-violet-600");
            btnProcesar.classList.add("bg-indigo-600", "hover:bg-indigo-500");
        }
    });
});

// ── Actualizar cobrarConMercadoPago para respetar el toggle de factura ─────
// Reemplaza la función anterior
window.cobrarConMercadoPago = async function() {
    if (!carrito || carrito.length === 0) {
        alert("🛒 El carrito está vacío.");
        return;
    }

    const quiereFactura = document.getElementById("toggleFacturaARCA")?.checked || false;

    // Calcular total con descuento
    const totalBase = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const inputDesc = document.getElementById("inputDescuentoRecargo");
    const modTxt    = inputDesc ? inputDesc.value.trim() : "";
    let totalFinal  = totalBase;
    let factor      = 1;

    if (modTxt) {
        if (modTxt.includes("%")) {
            const esDesc = modTxt.startsWith("-");
            const pct    = parseFloat(modTxt.replace(/[^0-9.]/g, ""));
            if (!isNaN(pct)) {
                const mod = totalBase * (pct / 100);
                totalFinal = esDesc ? totalBase - mod : totalBase + mod;
            }
        } else {
            const esDesc = modTxt.startsWith("-");
            const monto  = parseFloat(modTxt.replace(/[^0-9.]/g, ""));
            if (!isNaN(monto)) totalFinal = esDesc ? totalBase - monto : totalBase + monto;
        }
        if (totalFinal < 0) totalFinal = 0;
        factor = totalBase > 0 ? totalFinal / totalBase : 1;
    }

    const token = localStorage.getItem("token");
    const itemsMapeados = carrito.map(item => ({
        varianteId: item.id,
        cantidad:   item.cantidad,
        precio:     Math.round(item.precio * factor * 100) / 100
    }));

    try {
        // 1. Registrar la venta con método Mercado Pago
        const resp = await fetch(`${API_URL}/ventas`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                metodoPago: "Mercado Pago",
                clienteId:  window.clienteSeleccionado || null,
                items:      itemsMapeados
            })
        });

        if (!resp.ok) throw new Error(await resp.text());

        const resultado = await resp.json();
        const ventaId   = resultado.ventaId || resultado.id;

        // 2. Si quiere factura y ARCA está configurado → facturar también
        if (quiereFactura) {
            const configurado = await window.arcaConfigurado?.() || false;
            if (configurado) {
                window.toast?.info("Generando factura electrónica...");
                // flujo ARCA — se implementa cuando el cliente tenga credenciales
            } else {
                window.toast?.warning("La venta se registró pero ARCA no está configurado para emitir factura.");
            }
        }

        // 3. Abrir modal de MP con QR y link
        await window.MercadoPagoIntegration.abrirPagoMP(ventaId, totalFinal, carrito);

        // 4. Limpiar carrito
        carrito = [];
        actualizarInterfazCarrito();
        await cargarProductos();
        if (typeof cargarHistorialVentas === "function") await cargarHistorialVentas();

    } catch (error) {
        console.error("❌ Error MP:", error);
        alert(`❌ Error al procesar: ${error.message}`);
    }
};

// =========================================================================
// 🧾 MÓDULO ARCA — Preparado pero inactivo hasta configuración
// Pegá este bloque al final de tu ventas.js
// =========================================================================

// ── Verificar si ARCA está configurado ───────────────────────────────────
window.arcaConfigurado = async function() {
    try {
        const token = localStorage.getItem("token");
        const resp  = await fetch(`${API_URL}/facturas/estado`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) return false;
        const datos = await resp.json();
        return datos.configurado === true;
    } catch {
        return false;
    }
};

// ── Botón "Factura ARCA" ──────────────────────────────────────────────────
window.cobrarConARCA = async function() {
    const configurado = await window.arcaConfigurado();

    if (!configurado) {
        // ARCA no está configurado — mostrar mensaje al usuario
        const modal = document.getElementById("modalARCANoConfigurado");
        if (modal) {
            modal.classList.remove("hidden");
        } else {
            window.toast?.info(
                "La facturación electrónica con ARCA no está configurada aún. " +
                "Contactá al administrador del sistema para activarla."
            );
        }
        return;
    }

    // Si está configurado, proceder con la facturación
    // (esta parte se completa cuando el cliente tenga sus credenciales ARCA)
    window.toast?.info("Iniciando facturación electrónica con ARCA...");
};

// ── Abrir / cerrar modal de ARCA no configurado ───────────────────────────
window.cerrarModalARCANoConfigurado = function() {
    document.getElementById("modalARCANoConfigurado")?.classList.add("hidden");
};

// =========================================================================
// 📊 MÓDULO DE EXPORTACIÓN DE REPORTES — Excel + PDF
// =========================================================================

// ── UTILIDADES COMPARTIDAS ────────────────────────────────────────────────

// Obtener fecha formateada para nombres de archivo
function fechaArchivo() {
    return new Date().toLocaleDateString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric"
    }).replace(/\//g, "-");
}

// Abrir ventana de impresión limpia (igual que los tickets)
function abrirVentanaImpresion(html, titulo) {
    const ventana = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
    if (!ventana) {
        alert("⚠️ El navegador bloqueó la ventana emergente. Permitila para este sitio.");
        return;
    }
    ventana.document.write(html);
    ventana.document.close();
    ventana.onload = () => { ventana.focus(); ventana.print(); };
}

// Estilos base para todos los PDF
function estilosBasePDF() {
    return `
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
        h1  { font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 4px; }
        h2  { font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 16px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #6366f1; padding-bottom: 12px; }
        .header-right { text-align: right; font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        thead th { background: #6366f1; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tbody tr:hover { background: #f1f5f9; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .total-row td { font-weight: bold; background: #eef2ff; border-top: 2px solid #6366f1; }
        .badge-verde { color: #16a34a; font-weight: bold; }
        .badge-rojo  { color: #dc2626; font-weight: bold; }
        .badge-amber { color: #d97706; font-weight: bold; }
        .resumen { display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
        .resumen-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; flex: 1; min-width: 120px; }
        .resumen-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .resumen-item .valor { font-size: 18px; font-weight: bold; color: #6366f1; margin-top: 2px; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
        @media print { @page { margin: 1cm; } body { padding: 0; } }
    `;
}

// =========================================================================
// 📅 1. REPORTE DE VENTAS
// =========================================================================

window.exportarVentasExcel = async function() {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById("btnExportarVentasExcel");
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Generando...") : () => {};

    try {
        const resp = await fetch(`${API_URL}/ventas`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al obtener ventas");
        const ventas = await resp.json();

        // Importar SheetJS dinámicamente
        const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");

        const datos = ventas.map(v => ({
            "ID Venta":       v.id        || v.Id,
            "Fecha":          new Date(v.fechaHora || v.FechaHora).toLocaleString("es-AR"),
            "Método de Pago": v.metodoPago || v.MetodoPago,
            "Total ($)":      v.total      || v.Total,
            "Comentarios":    v.comentarios || v.Comentarios || ""
        }));

        const hoja  = XLSX.utils.json_to_sheet(datos);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Ventas");

        // Ancho de columnas
        hoja["!cols"] = [
            { wch: 10 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 30 }
        ];

        XLSX.writeFile(libro, `Ventas_SpaceTerminal_${fechaArchivo()}.xlsx`);
        alert("✅ Reporte de ventas exportado a Excel.");

    } catch (error) {
        console.error("❌ Error Excel ventas:", error);
        alert("❌ No se pudo generar el Excel. Revisá la consola.");
    } finally {
        restaurar();
    }
};

window.exportarVentasPDF = async function() {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById("btnExportarVentasPDF");
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Generando...") : () => {};

    try {
        const resp = await fetch(`${API_URL}/ventas`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al obtener ventas");
        const ventas = await resp.json();

        const totalGeneral  = ventas.reduce((s, v) => s + (v.total || v.Total || 0), 0);
        const totalEfectivo = ventas.filter(v => (v.metodoPago || v.MetodoPago || "").toLowerCase().includes("efectivo"))
                                    .reduce((s, v) => s + (v.total || v.Total || 0), 0);
        const totalMP       = ventas.filter(v => (v.metodoPago || v.MetodoPago || "").toLowerCase().includes("mercado"))
                                    .reduce((s, v) => s + (v.total || v.Total || 0), 0);
        const totalTransf   = ventas.filter(v => (v.metodoPago || v.MetodoPago || "").toLowerCase().includes("transfer"))
                                    .reduce((s, v) => s + (v.total || v.Total || 0), 0);

        const filas = ventas.map(v => `
            <tr>
                <td>#${v.id || v.Id}</td>
                <td>${new Date(v.fechaHora || v.FechaHora).toLocaleString("es-AR")}</td>
                <td>${v.metodoPago || v.MetodoPago}</td>
                <td class="badge-verde">$${Number(v.total || v.Total).toLocaleString("es-AR")}</td>
            </tr>
        `).join("");

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Reporte de Ventas — Space Terminal</title>
        <style>${estilosBasePDF()}</style></head><body>
        <div class="header">
            <div><h1>👕 Space Terminal</h1><h2>Reporte de Ventas</h2></div>
            <div class="header-right">
                <div>Generado: ${new Date().toLocaleString("es-AR")}</div>
                <div>Total de registros: ${ventas.length}</div>
            </div>
        </div>
        <div class="resumen">
            <div class="resumen-item"><div class="label">Total general</div><div class="valor">$${Number(totalGeneral).toLocaleString("es-AR")}</div></div>
            <div class="resumen-item"><div class="label">Efectivo</div><div class="valor">$${Number(totalEfectivo).toLocaleString("es-AR")}</div></div>
            <div class="resumen-item"><div class="label">Transferencia</div><div class="valor">$${Number(totalTransf).toLocaleString("es-AR")}</div></div>
            <div class="resumen-item"><div class="label">Mercado Pago</div><div class="valor">$${Number(totalMP).toLocaleString("es-AR")}</div></div>
        </div>
        <table>
            <thead><tr><th>ID</th><th>Fecha y Hora</th><th>Método de Pago</th><th>Total</th></tr></thead>
            <tbody>
                ${filas}
                <tr class="total-row"><td colspan="3">TOTAL GENERAL</td><td>$${Number(totalGeneral).toLocaleString("es-AR")}</td></tr>
            </tbody>
        </table>
        <div class="footer">Space Terminal — Sistema de Punto de Venta</div>
        </body></html>`;

        abrirVentanaImpresion(html, "Reporte de Ventas");

    } catch (error) {
        console.error("❌ Error PDF ventas:", error);
        alert("❌ No se pudo generar el PDF.");
    } finally {
        restaurar();
    }
};

// =========================================================================
// 📦 2. REPORTE DE INVENTARIO
// =========================================================================

window.exportarInventarioExcel = async function() {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById("btnExportarInventarioExcel");
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Generando...") : () => {};

    try {
        const resp = await fetch(`${window.ConfigInventario.URL}/productos`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al obtener productos");
        const productos = await resp.json();

        const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");

        // Una fila por variante
        const datos = [];
        productos.forEach(p => {
            const variantes = p.variantes || p.Variantes || [];
            if (variantes.length === 0) {
                datos.push({
                    "Producto":       p.nombre || p.Nombre,
                    "Categoría":      p.categoria || p.Categoria || "General",
                    "Precio Costo":   p.precioCosto || p.PrecioCosto || 0,
                    "Precio Venta":   p.precio || p.PrecioVenta || 0,
                    "Talle":          "—",
                    "Color":          "—",
                    "Stock Actual":   0,
                    "Stock Mínimo":   0,
                    "Estado":         "SIN STOCK"
                });
            } else {
                variantes.forEach(v => {
                    const stock = v.stock || v.StockActual || 0;
                    const min   = v.stockMinimo || v.StockMinimo || 2;
                    datos.push({
                        "Producto":       p.nombre || p.Nombre,
                        "Categoría":      p.categoria || p.Categoria || "General",
                        "Precio Costo":   p.precioCosto || p.PrecioCosto || 0,
                        "Precio Venta":   p.precio || p.PrecioVenta || 0,
                        "Talle":          v.talle || v.Talle,
                        "Color":          v.color || v.Color,
                        "Stock Actual":   stock,
                        "Stock Mínimo":   min,
                        "Estado":         stock === 0 ? "SIN STOCK" : stock <= min ? "CRÍTICO" : "OK"
                    });
                });
            }
        });

        const hoja  = XLSX.utils.json_to_sheet(datos);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Inventario");
        hoja["!cols"] = [
            {wch:25},{wch:15},{wch:14},{wch:14},{wch:8},{wch:15},{wch:12},{wch:12},{wch:10}
        ];

        XLSX.writeFile(libro, `Inventario_SpaceTerminal_${fechaArchivo()}.xlsx`);
        alert("✅ Reporte de inventario exportado a Excel.");

    } catch (error) {
        console.error("❌ Error Excel inventario:", error);
        alert("❌ No se pudo generar el Excel.");
    } finally {
        restaurar();
    }
};

window.exportarInventarioPDF = async function() {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById("btnExportarInventarioPDF");
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Generando...") : () => {};

    try {
        const resp = await fetch(`${window.ConfigInventario.URL}/productos`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al obtener productos");
        const productos = await resp.json();

        let filas = "";
        let totalVariantes = 0;
        let sinStock = 0;
        let criticos = 0;

        productos.forEach(p => {
            const variantes = p.variantes || p.Variantes || [];
            variantes.forEach(v => {
                totalVariantes++;
                const stock = v.stock || v.StockActual || 0;
                const min   = v.stockMinimo || v.StockMinimo || 2;
                if (stock === 0) sinStock++;
                else if (stock <= min) criticos++;

                const estadoClass = stock === 0 ? "badge-rojo" : stock <= min ? "badge-amber" : "badge-verde";
                const estadoText  = stock === 0 ? "SIN STOCK" : stock <= min ? "CRÍTICO" : "OK";

                filas += `
                    <tr>
                        <td><strong>${p.nombre || p.Nombre}</strong></td>
                        <td>${p.categoria || "General"}</td>
                        <td>${v.talle || "—"} / ${v.color || "—"}</td>
                        <td>$${Number(p.precioCosto || 0).toLocaleString("es-AR")}</td>
                        <td>$${Number(p.precio || 0).toLocaleString("es-AR")}</td>
                        <td style="text-align:center"><strong>${stock}</strong></td>
                        <td style="text-align:center" class="${estadoClass}">${estadoText}</td>
                    </tr>`;
            });
        });

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Inventario — Space Terminal</title>
        <style>${estilosBasePDF()}</style></head><body>
        <div class="header">
            <div><h1>👕 Space Terminal</h1><h2>Reporte de Inventario</h2></div>
            <div class="header-right">
                <div>Generado: ${new Date().toLocaleString("es-AR")}</div>
                <div>Productos: ${productos.length} | Variantes: ${totalVariantes}</div>
            </div>
        </div>
        <div class="resumen">
            <div class="resumen-item"><div class="label">Total variantes</div><div class="valor">${totalVariantes}</div></div>
            <div class="resumen-item"><div class="label">Sin stock</div><div class="valor" style="color:#dc2626">${sinStock}</div></div>
            <div class="resumen-item"><div class="label">Stock crítico</div><div class="valor" style="color:#d97706">${criticos}</div></div>
            <div class="resumen-item"><div class="label">Stock OK</div><div class="valor" style="color:#16a34a">${totalVariantes - sinStock - criticos}</div></div>
        </div>
        <table>
            <thead><tr><th>Producto</th><th>Categoría</th><th>Talle/Color</th><th>P.Costo</th><th>P.Venta</th><th>Stock</th><th>Estado</th></tr></thead>
            <tbody>${filas}</tbody>
        </table>
        <div class="footer">Space Terminal — Sistema de Punto de Venta</div>
        </body></html>`;

        abrirVentanaImpresion(html, "Inventario");

    } catch (error) {
        console.error("❌ Error PDF inventario:", error);
        alert("❌ No se pudo generar el PDF.");
    } finally {
        restaurar();
    }
};

// =========================================================================
// 💰 3. REPORTE DE CIERRE DE CAJA
// =========================================================================

window.exportarCajaExcel = async function() {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById("btnExportarCajaExcel");
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Generando...") : () => {};

    try {
        const resp = await fetch(`${API_URL}/cierrecaja`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al obtener cierres");
        const cierres = await resp.json();

        const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");

        const datos = cierres.map(c => ({
            "Fecha":            new Date(c.fecha || c.Fecha).toLocaleString("es-AR"),
            "Ventas":           c.cantidadVentas || c.CantidadVentas || 0,
            "Efectivo ($)":     c.totalEfectivo  || c.TotalEfectivo  || 0,
            "Transferencia ($)":c.totalTransferencia || c.TotalTransferencia || 0,
            "Débito ($)":       c.totalDebito    || c.TotalDebito    || 0,
            "Crédito ($)":      c.totalCredito   || c.TotalCredito   || 0,
            "Total General ($)":c.totalGeneral   || c.TotalGeneral   || 0,
            "Observaciones":    c.observaciones  || c.Observaciones  || ""
        }));

        const hoja  = XLSX.utils.json_to_sheet(datos);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Cierres de Caja");
        hoja["!cols"] = [
            {wch:22},{wch:8},{wch:14},{wch:16},{wch:12},{wch:12},{wch:16},{wch:30}
        ];

        XLSX.writeFile(libro, `CierreCaja_SpaceTerminal_${fechaArchivo()}.xlsx`);
        alert("✅ Reporte de caja exportado a Excel.");

    } catch (error) {
        console.error("❌ Error Excel caja:", error);
        alert("❌ No se pudo generar el Excel.");
    } finally {
        restaurar();
    }
};

window.exportarCajaPDF = async function() {
    const token = localStorage.getItem("token");
    const btn   = document.getElementById("btnExportarCajaPDF");
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Generando...") : () => {};

    try {
        const resp = await fetch(`${API_URL}/cierrecaja`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al obtener cierres");
        const cierres = await resp.json();

        const totalAcumulado = cierres.reduce((s, c) => s + (c.totalGeneral || c.TotalGeneral || 0), 0);

        const filas = cierres.map(c => `
            <tr>
                <td>${new Date(c.fecha || c.Fecha).toLocaleString("es-AR")}</td>
                <td style="text-align:center">${c.cantidadVentas || 0}</td>
                <td>$${Number(c.totalEfectivo     || 0).toLocaleString("es-AR")}</td>
                <td>$${Number(c.totalTransferencia|| 0).toLocaleString("es-AR")}</td>
                <td>$${Number(c.totalDebito       || 0).toLocaleString("es-AR")}</td>
                <td>$${Number(c.totalCredito      || 0).toLocaleString("es-AR")}</td>
                <td class="badge-verde"><strong>$${Number(c.totalGeneral || 0).toLocaleString("es-AR")}</strong></td>
            </tr>
        `).join("");

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Cierres de Caja — Space Terminal</title>
        <style>${estilosBasePDF()}</style></head><body>
        <div class="header">
            <div><h1>👕 Space Terminal</h1><h2>Historial de Cierres de Caja</h2></div>
            <div class="header-right">
                <div>Generado: ${new Date().toLocaleString("es-AR")}</div>
                <div>Cierres registrados: ${cierres.length}</div>
            </div>
        </div>
        <div class="resumen">
            <div class="resumen-item"><div class="label">Cierres</div><div class="valor">${cierres.length}</div></div>
            <div class="resumen-item"><div class="label">Total acumulado</div><div class="valor">$${Number(totalAcumulado).toLocaleString("es-AR")}</div></div>
        </div>
        <table>
            <thead><tr><th>Fecha</th><th>Ventas</th><th>Efectivo</th><th>Transferencia</th><th>Débito</th><th>Crédito</th><th>Total</th></tr></thead>
            <tbody>
                ${filas}
                <tr class="total-row"><td colspan="6">TOTAL ACUMULADO</td><td>$${Number(totalAcumulado).toLocaleString("es-AR")}</td></tr>
            </tbody>
        </table>
        <div class="footer">Space Terminal — Sistema de Punto de Venta</div>
        </body></html>`;

        abrirVentanaImpresion(html, "Cierres de Caja");

    } catch (error) {
        console.error("❌ Error PDF caja:", error);
        alert("❌ No se pudo generar el PDF.");
    } finally {
        restaurar();
    }
};

// =========================================================================
// 📝 1. DIBUJAR DISEÑO A4 DEL PRESUPUESTO (PREMIUM)
// =========================================================================
window.generarHTMLPresupuestoA4 = function(total, prendas, fecha, numeroPresupuestoReal = null) {
    const fechaObj = new Date(fecha);
    const fechaFormateada = fechaObj.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    
    const fechaVencimiento = new Date(fecha);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
    const vencFormateada = fechaVencimiento.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    // 🌟 MAGIA: Si el servidor nos dio un número real lo usamos, sino inventamos uno de emergencia
    const nroPresupuesto = numeroPresupuestoReal || `PRE-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

    // 🌟 PREPARACIÓN PARA EL MÓDULO EMPRESA
    const config = JSON.parse(localStorage.getItem("configEmpresa")) || {
        nombreFantasia: "SPACE TERMINAL",
        razonSocial: "Indumentaria y Calzado",
        cuit: "CUIT: 30-00000000-0",
        direccion: "San Miguel de Tucumán",
        telefono: "Tel: +54 381 000-0000",
        logo: "" 
    };

    let logoHtml = config.logo 
        ? `<img src="${config.logo}" style="max-height: 85px; object-fit: contain; margin-bottom: 10px;">`
        : `<h1 style="margin: 0 0 5px 0; font-size: 32px; color: #0f172a; font-weight: 900; letter-spacing: -1px;">${config.nombreFantasia}</h1>`;

    let itemsHTML = "";
    prendas.forEach((item, index) => {
        const subtotal = item.cantidad * item.precioUnitario;
        const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc"; // Filas cebra
        itemsHTML += `
            <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 14px; font-size: 13px; color: #1e293b;">
                    <strong style="font-size: 14px;">${item.productoNombre}</strong><br>
                    <span style="font-size: 11px; color: #64748b;">Talle: ${item.talle} | Color: ${item.color}</span>
                </td>
                <td style="padding: 14px; font-size: 13px; text-align: center; color: #1e293b; font-weight: bold;">${item.cantidad}</td>
                <td style="padding: 14px; font-size: 13px; text-align: right; color: #475569;">$${item.precioUnitario.toLocaleString("es-AR", {minimumFractionDigits: 2})}</td>
                <td style="padding: 14px; font-size: 14px; text-align: right; font-weight: 800; color: #0f172a;">$${subtotal.toLocaleString("es-AR", {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Presupuesto ${nroPresupuesto}</title>
            <style>
                @page { size: A4; margin: 0; }
                body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #cbd5e1; margin: 0; padding: 40px; display: flex; justify-content: center; }
                .hoja { background: #ffffff; width: 100%; max-width: 794px; min-height: 1123px; padding: 60px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); box-sizing: border-box; position: relative; }
                .ribbon { position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, #4f46e5 0%, #0ea5e9 100%); }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 30px; margin-bottom: 35px; margin-top: 10px;}
                .empresa-info p { margin: 3px 0; color: #64748b; font-size: 13px; }
                .doc-info { text-align: right; }
                .doc-info h2 { margin: 0 0 10px 0; font-size: 38px; color: #4f46e5; font-weight: 900; letter-spacing: 1px; }
                .nro-box { display: inline-block; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; font-size: 16px; font-weight: bold; color: #334155; border: 1px solid #e2e8f0;}
                .grid-datos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                .dato-box { background: #f8fafc; padding: 15px 20px; border-radius: 10px; border-left: 4px solid #4f46e5; }
                .dato-box span { display: block; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 800; margin-bottom: 5px; }
                .dato-box strong { font-size: 15px; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                th { background: #0f172a; color: #ffffff; padding: 15px 14px; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
                th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
                th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right; }
                th:nth-child(2) { text-align: center; }
                th:nth-child(3) { text-align: right; }
                .totales { display: flex; justify-content: flex-end; }
                .totales-box { width: 350px; background: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }
                .total-line { display: flex; justify-content: space-between; font-size: 15px; color: #475569; margin-bottom: 10px; }
                .total-line.final { border-top: 2px dashed #cbd5e1; font-size: 24px; font-weight: 900; color: #4f46e5; padding-top: 15px; margin-top: 5px; margin-bottom: 0; }
                .footer { margin-top: 60px; padding-top: 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
                @media print { body { background: white; padding: 0; display: block; } .hoja { box-shadow: none; padding: 15mm; } }
            </style>
        </head>
        <body>
            <div class="hoja">
                <div class="ribbon"></div>
                
                <div class="header">
                    <div class="empresa-info">
                        ${logoHtml}
                        <p><strong>${config.razonSocial}</strong></p>
                        <p>${config.cuit}</p>
                        <p>${config.direccion} | ${config.telefono}</p>
                    </div>
                    <div class="doc-info">
                        <h2>PRESUPUESTO</h2>
                        <div class="nro-box">N° ${nroPresupuesto}</div>
                    </div>
                </div>
                
                <div class="grid-datos">
                    <div class="dato-box">
                        <span>Fecha de Emisión</span>
                        <strong>${fechaFormateada}</strong>
                    </div>
                    <div class="dato-box">
                        <span>Válido Hasta</span>
                        <strong>${vencFormateada}</strong>
                    </div>
                    <div class="dato-box">
                        <span>Cliente</span>
                        <strong>${document.getElementById('inputClienteVenta')?.value || "Consumidor Final"}</strong>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th>Cant.</th>
                            <th>Precio Unit.</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div class="totales">
                    <div class="totales-box">
                        <div class="total-line">
                            <span>Subtotal:</span>
                            <span>$${total.toLocaleString("es-AR", {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="total-line final">
                            <span>TOTAL:</span>
                            <span>$${total.toLocaleString("es-AR", {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <p>Los precios detallados en este documento se mantendrán vigentes únicamente hasta la fecha de validez indicada.</p>
                    <p><strong>Este documento no es válido como factura ni comprobante de pago.</strong></p>
                </div>
            </div>
            <script>
                window.onload = () => { setTimeout(() => { window.print(); }, 800); };
            </script>
        </body>
        </html>
    `;
};

// =========================================================================
// 📝 2. FUNCIÓN PARA GUARDAR E IMPRIMIR EL PRESUPUESTO
// =========================================================================
window.generarPresupuesto = async function() {
    if (!carrito || carrito.length === 0) {
        window.toast?.warning("El carrito está vacío. Agregá prendas para armar el presupuesto.") || alert("Carrito vacío");
        return;
    }

    // 1. Calculamos los totales
    const totalBase = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const tipoMod = document.getElementById("tipoModificador")?.value || "nada";
    const valorMod = parseFloat(document.getElementById("valorModificador")?.value) || 0;
    
    let totalFinal = totalBase;
    if (tipoMod === "descuento_pct") totalFinal -= totalBase * (valorMod / 100);
    if (tipoMod === "descuento_fijo") totalFinal -= valorMod;
    if (tipoMod === "recargo_pct") totalFinal += totalBase * (valorMod / 100);
    if (tipoMod === "recargo_fijo") totalFinal += valorMod;
    if (totalFinal < 0) totalFinal = 0;

    const factor = totalBase > 0 ? totalFinal / totalBase : 1;

    // 2. Datos del entorno
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalActiva = localStorage.getItem("sucursalAdminActiva") || usuarioLocal.sucursalId || 1;
    const clienteNombre = document.getElementById('inputClienteVenta')?.value || "Consumidor Final";

    // 🌟 3. CREAMOS TODOS LOS DATOS ACÁ PARA QUE C# NO RECHACE EL PAQUETE
    const numeroOficial = `PRE-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    const fechaEmision = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaEmision.getDate() + 7);

    const payload = {
        numeroPresupuesto: numeroOficial,
        fechaEmision: fechaEmision.toISOString(),
        fechaVencimiento: fechaVencimiento.toISOString(),
        clienteNombre: clienteNombre,
        total: totalFinal,
        estado: "Pendiente",
        sucursalId: parseInt(sucursalActiva),
        detalles: carrito.map(item => {
            const precioCalculado = Math.round(item.precio * factor * 100) / 100;
            return {
                varianteId: item.id,
                productoNombre: item.nombre,
                talle: item.talle,
                color: item.color,
                cantidad: item.cantidad,
                precioUnitario: precioCalculado,
                subtotal: precioCalculado * item.cantidad
            };
        })
    };

    try {
        if(window.toast) window.toast.info("Guardando presupuesto en el servidor...");
        const token = localStorage.getItem("token");

        // 4. Mandamos el paquete
        const respuesta = await fetch(`${API_URL}/presupuestos`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${token}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(payload)
        });

        // 🌟 5. MICRÓFONO AL ERROR: Si C# dice que no, leemos por qué exactamente
        if (!respuesta.ok) {
            const errorTexto = await respuesta.text();
            throw new Error(errorTexto || "Error desconocido del servidor");
        }

        if(window.toast) window.toast.success(`Presupuesto ${numeroOficial} guardado con éxito!`);

        // 6. Generamos el PDF con el número oficial
        const htmlPresupuesto = window.generarHTMLPresupuestoA4(totalFinal, payload.detalles, fechaEmision.toISOString(), numeroOficial);

        const ventanaImp = window.open("", "_blank");
        if (ventanaImp) {
            ventanaImp.document.write(htmlPresupuesto);
            ventanaImp.document.close();
        } else {
            alert("El navegador bloqueó la ventana de impresión. Habilitá las ventanas emergentes.");
        }

        // 7. Vaciamos el carrito
        carrito = [];
        if (typeof actualizarInterfazCarrito === "function") actualizarInterfazCarrito();
        
    } catch (error) {
        console.error("❌ Error al generar presupuesto:", error);
        // 🌟 AHORA EL CARTEL ROJO TE VA A ESCUPIR LA RAZÓN EXACTA DE POR QUÉ FALLÓ
        if(window.toast) window.toast.error(`❌ Falló la carga: ${error.message}`);
        else alert(`❌ Falló la carga: ${error.message}`);
    }
};

// 🌟 INYECTOR DEL TELETRANSPORTADOR PARA ADMINISTRADORES (CORREGIDO)
window.inicializarSelectorAdmin = function() {
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const esAdmin = (usuarioLocal.Rol === "administrador" || usuarioLocal.rol === "administrador");

    if (!esAdmin) return;

    // Buscamos la barra de búsqueda real de tu sistema
    const cajaBusqueda = document.querySelector("#inputBuscador")?.parentElement;
    
    if (cajaBusqueda && !document.getElementById("teletransportadorAdmin")) {
        cajaBusqueda.style.display = "flex";
        cajaBusqueda.style.gap = "10px";

        const select = document.createElement("select");
        select.id = "teletransportadorAdmin";
        select.className = "form-select bg-dark border-secondary";
        select.style.maxWidth = "280px";
        select.style.fontWeight = "bold";
        select.style.color = "#00ff9d"; 
        select.style.cursor = "pointer";

        const sucursalActiva = localStorage.getItem("sucursalAdminActiva") || usuarioLocal.sucursalId || 1;

        select.innerHTML = `
            <option value="1" ${sucursalActiva == 1 ? "selected" : ""}>✈️ Operando en: San Miguel</option>
            <option value="2" ${sucursalActiva == 2 ? "selected" : ""}>✈️ Operando en: Monteros</option>
        `;

        cajaBusqueda.appendChild(select);

        select.addEventListener("change", (e) => {
            const nuevaSucursal = parseInt(e.target.value);
            
            localStorage.setItem("sucursalAdminActiva", nuevaSucursal);
            usuarioLocal.sucursalId = nuevaSucursal;
            localStorage.setItem("usuario", JSON.stringify(usuarioLocal));

            // Vaciamos el carrito silenciosamente para no cruzar facturas
            carrito = [];
            if (typeof actualizarInterfazCarrito === "function") actualizarInterfazCarrito();
            
            // Recargamos los productos apuntando a la nueva sucursal
            if (typeof cargarProductos === "function") cargarProductos();

            if (window.toast) {
                window.toast.success("🔄 Te teletransportaste a: " + select.options[select.selectedIndex].text.replace("✈️ Operando en: ", ""));
            } else {
                alert("🔄 Teletransportado a: " + select.options[select.selectedIndex].text.replace("✈️ Operando en: ", ""));
            }
        });

        if (usuarioLocal.sucursalId != sucursalActiva) {
            usuarioLocal.sucursalId = parseInt(sucursalActiva);
            localStorage.setItem("usuario", JSON.stringify(usuarioLocal));
        }
    }
};

// =========================================================================
// 🗂️ HISTORIAL VISUAL DE CIERRES DE CAJA (MODAL DINÁMICO)
// =========================================================================
window.verHistorialCierres = async function() {
    const token = localStorage.getItem("token");
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalActiva = localStorage.getItem("sucursalAdminActiva") || usuarioLocal.sucursalId || 1;
    
    // Mostramos un mensajito de carga
    if(window.toast) window.toast.info("Cargando historial de cajas...");

    try {
        const respuesta = await fetch(`${API_URL}/cierrecaja?sucursalId=${sucursalActiva}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!respuesta.ok) throw new Error("Error al obtener cierres");
        const cierres = await respuesta.json();

        // Armamos las filas de la tabla
        let filasHTML = "";
        if (cierres.length === 0) {
            filasHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 italic">No hay cierres de caja registrados en esta sucursal.</td></tr>`;
        } else {
            cierres.forEach(c => {
                const fecha = new Date(c.fecha || c.Fecha).toLocaleString("es-AR", {day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute:"2-digit"});
                const total = Number(c.totalGeneral || c.TotalGeneral || 0).toLocaleString("es-AR");
                const obs = c.observaciones || c.Observaciones || "-";
                
                filasHTML += `
                    <tr class="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                        <td class="p-4 text-slate-300 text-xs">${fecha}</td>
                        <td class="p-4 text-slate-400 text-center">${c.cantidadVentas || 0}</td>
                        <td class="p-4 text-emerald-400 font-bold">$${total}</td>
                        <td class="p-4 text-slate-500 text-xs italic truncate max-w-[150px]" title="${obs}">${obs}</td>
                        <td class="p-4 text-center">
                            <button onclick='window.imprimirResumenCaja(${JSON.stringify(c)})' class="text-indigo-400 hover:text-indigo-300 p-2 rounded hover:bg-indigo-950/50 transition-colors cursor-pointer" title="Reimprimir">
                                🖨️
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        // Creamos el Modal Inyectado
        const modalHTML = `
        <div id="modalHistorialCajas" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div class="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2">🗄️ Historial de Cajas Cerradas</h3>
                    <button onclick="document.getElementById('modalHistorialCajas').remove()" class="text-slate-400 hover:text-white transition-colors text-xl cursor-pointer">✕</button>
                </div>
                
                <div class="overflow-y-auto w-full p-0 flex-1">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider sticky top-0">
                            <tr>
                                <th class="p-4 font-medium">Fecha y Hora</th>
                                <th class="p-4 font-medium text-center">Ventas</th>
                                <th class="p-4 font-medium">Total</th>
                                <th class="p-4 font-medium">Observaciones</th>
                                <th class="p-4 font-medium text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm text-slate-300">
                            ${filasHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `;

        // Borramos si había uno viejo y agregamos el nuevo
        const viejo = document.getElementById("modalHistorialCajas");
        if (viejo) viejo.remove();
        document.body.insertAdjacentHTML("beforeend", modalHTML);

    } catch (error) {
        console.error(error);
        alert("❌ Hubo un error al cargar el historial de cajas.");
    }
};

// =========================================================================
// 💳 CONTROLADOR DEL MODAL DE COBRO (UX PREMIUM)
// =========================================================================
window.abrirModalCobro = function() {
    if (!carrito || carrito.length === 0) {
        if(window.toast) window.toast.warning("El ticket está vacío. Agregá prendas primero.");
        else alert("El ticket está vacío. Agregá prendas primero.");
        return;
    }
    const modal = document.getElementById("modalOpcionesCobro");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }

    
};

window.ejecutarCobro = function(metodo) {
    const select = document.getElementById("formaPago");
    if (select) select.value = metodo; // Elige el cuadrito que tocaste en secreto
    window.cerrarModalCobro();
    window.procesarVentaInteligente(); // Dispara la venta
};

window.cerrarModalCobro = function() {
    const modal = document.getElementById("modalOpcionesCobro");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
};

// =========================================================================
// 📋 MÓDULO DE RECUPERACIÓN Y BÚSQUEDA DE PRESUPUESTOS
// =========================================================================

// Memoria global para filtrar al instante
window.presupuestosMemoria = []; 

window.cargarPresupuestos = async function() {
    const tbody = document.getElementById("tablaPresupuestosBody");
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 animate-pulse text-sm">Cargando presupuestos...</td></tr>`;
    
    try {
        const token = localStorage.getItem("token");
        const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
        const sucursalActiva = localStorage.getItem("sucursalAdminActiva") || usuarioLocal.sucursalId || 1;

        const respuesta = await fetch(`${API_URL}/presupuestos?sucursalId=${sucursalActiva}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!respuesta.ok) throw new Error("Error al cargar presupuestos");
        const presupuestos = await respuesta.json();
        
        window.presupuestosMemoria = presupuestos; // 🌟 Guardamos la copia para el buscador
        window.renderizarTablaPresupuestos(window.presupuestosMemoria);

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-400 text-sm">Error de conexión al cargar presupuestos.</td></tr>`;
    }
};

// 🌟 NUEVO: Separamos la lógica de dibujar la tabla para poder re-usarla al buscar
window.renderizarTablaPresupuestos = function(lista) {
    const tbody = document.getElementById("tablaPresupuestosBody");
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 italic text-sm">No se encontraron presupuestos con ese criterio.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const fechaEmision = new Date(p.fechaEmision).toLocaleDateString("es-AR");
        const fechaVenc = new Date(p.fechaVencimiento);
        const vencimientoStr = fechaVenc.toLocaleDateString("es-AR");
        
        // Lógica inteligente de vencimiento
        const hoy = new Date();
        const estaVencido = hoy > fechaVenc && p.estado !== "Convertido";
        
        let badgeEstado = `<span class="bg-indigo-900/50 text-indigo-400 border border-indigo-700/50 px-2 py-0.5 rounded text-xs ml-2">Pendiente</span>`;
        if (estaVencido) badgeEstado = `<span class="bg-rose-900/50 text-rose-400 border border-rose-700/50 px-2 py-0.5 rounded text-xs ml-2">Vencido</span>`;
        if (p.estado === "Convertido") badgeEstado = `<span class="bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 px-2 py-0.5 rounded text-xs ml-2">Vendido</span>`;

        return `
        <tr class="hover:bg-slate-900/50 transition-colors border-b border-slate-800">
            <td class="p-4 font-bold text-white">${p.numeroPresupuesto} ${badgeEstado}</td>
            <td class="p-4 text-slate-400 text-xs">${fechaEmision}</td>
            <td class="p-4 text-slate-300 font-medium">${p.clienteNombre}</td>
            <td class="p-4 text-slate-400 text-xs">${vencimientoStr}</td>
            <td class="p-4 text-emerald-400 font-bold">$${Number(p.total).toLocaleString("es-AR")}</td>
            <td class="p-4 text-center">
                <button onclick="window.retomarPresupuesto(${p.id})" ${estaVencido || p.estado === "Convertido" ? "disabled" : ""} class="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-md cursor-pointer">
                    🛒 Volcar al Carrito
                </button>
            </td>
        </tr>
        `;
    }).join("");
};

// 🌟 NUEVO: El motor de búsqueda que filtra mientras escribís
window.filtrarPresupuestos = function() {
    const input = document.getElementById("inputBuscarPresupuesto");
    if (!input) return;
    
    const textoBuscado = input.value.toLowerCase().trim();
    
    const presupuestosFiltrados = window.presupuestosMemoria.filter(p => {
        const numero = (p.numeroPresupuesto || "").toLowerCase();
        const cliente = (p.clienteNombre || "").toLowerCase();
        
        return numero.includes(textoBuscado) || cliente.includes(textoBuscado);
    });
    
    window.renderizarTablaPresupuestos(presupuestosFiltrados);
};

window.retomarPresupuesto = async function(id) {
    try {
        if(window.toast) window.toast.info("Recuperando datos del presupuesto...");
        const token = localStorage.getItem("token");
        const resp = await fetch(`${API_URL}/presupuestos/${id}`, { 
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if(!resp.ok) throw new Error("Error al obtener presupuesto");
        const pres = await resp.json();
        
        // 1. Vaciamos el carrito
        carrito = [];
        
        // 2. Llenamos el carrito
        pres.detalles.forEach(det => {
            carrito.push({
                id: det.varianteId,
                nombre: det.productoNombre,
                precio: det.precioUnitario, // Congelamos el precio cotizado
                talle: det.talle,
                color: det.color,
                cantidad: det.cantidad,
                sucursalId: pres.sucursalId
            });
        });

        // 3. Cargamos el cliente
        const inputCliente = document.getElementById("inputClienteVenta");
        if(inputCliente && pres.clienteNombre !== "Consumidor Final") {
            inputCliente.value = pres.clienteNombre;
        }

        // 4. Cambiamos a ventas
        if (typeof window.cambiarPantalla === "function") window.cambiarPantalla('seccion-ventas');
        window.actualizarInterfazCarrito();
        
        // 5. Alerta
        alert(`⚠️ ¡ATENCIÓN!\nEl presupuesto fue cargado en el ticket con los precios congelados.\n\nPor favor, verificá visualmente que las prendas sigan estando disponibles en el estante antes de cobrarle al cliente.`);

    } catch (e) {
        console.error(e);
        alert("❌ Ocurrió un error al intentar volcar el presupuesto al carrito.");
    }
};