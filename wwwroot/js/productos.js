// =========================================================================
// 🛒 MÓDULO DE PRODUCTOS E INVENTARIO
// =========================================================================

window.ConfigInventario = window.ConfigInventario || {
    URL: "https://tu-app.railway.app/api",
    obtenerToken: () => localStorage.getItem("token")
};

window.categoriasMemoria = window.categoriasMemoria || [];
window.productosMemoria  = window.productosMemoria  || [];

// Inicialización al cargar la página
window.inicializarInventario = async function() {
    console.log("🚀 [Inventario] Sincronizando interfaz con Base de Datos C#...");
    await window.defaultCargarCategorias();
    await window.cargarProductosInventario();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.inicializarInventario);
} else {
    window.inicializarInventario();
}

// =========================================================================
// 📁 CATEGORÍAS — Carga y puebla los selects
// =========================================================================
window.defaultCargarCategorias = async function() {
    const token = window.ConfigInventario.obtenerToken();
    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/categorias`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });
        if (respuesta.ok) {
            window.categoriasMemoria = await respuesta.json();
            console.log("📁 Categorías cargadas desde BD:", window.categoriasMemoria);
            window.actualizarSelectsCategorias();
        }
    } catch (e) {
        console.error("❌ Error al traer categorías del backend:", e);
    }
};

window.actualizarSelectsCategorias = function() {
    const selectFiltro = document.getElementById("selectFiltroCategoria");
    const selectAdd    = document.getElementById("addCategoria");

    if (!window.categoriasMemoria || window.categoriasMemoria.length === 0) return;

    // Select de filtro
    if (selectFiltro) {
        let html = `<option value="">📁 Todas las Categorías</option>`;
        window.categoriasMemoria.forEach(c => {
            const cId     = c.id     ?? c.Id     ?? c.idCategoria;
            const cNombre = c.nombre ?? c.Nombre ?? "";
            html += `<option value="${cId}">${cNombre}</option>`;
        });
        selectFiltro.innerHTML = html;
    }

    // Select del formulario de agregar
    if (selectAdd) {
        let html = `<option value="">-- Seleccionar Categoría --</option>`;
        window.categoriasMemoria.forEach(c => {
            const cId     = c.id     ?? c.Id     ?? c.idCategoria;
            const cNombre = c.nombre ?? c.Nombre ?? "";
            html += `<option value="${cId}">${cNombre}</option>`;
        });
        selectAdd.innerHTML = html;
    }
};

// =========================================================================
// 📦 1. CARGA DE PRODUCTOS DESDE EL BACKEND
// =========================================================================
window.cargarProductosInventario = async function() {
    const token = window.ConfigInventario.obtenerToken();
    const tbody = document.getElementById("tablaProductosBody");

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/productos`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (!respuesta.ok) throw new Error("Error HTTP: " + respuesta.status);

        const prods = await respuesta.json();
        console.log("📦 Productos recibidos del backend:", prods);

        window.productosMemoria = prods;
        window.renderizarTablaProductosInventario(prods);

    } catch (error) {
        console.error("❌ Error al cargar productos:", error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-400 font-medium">
                No se pudo conectar con el servidor backend.
            </td></tr>`;
        }
    }
};

// =========================================================================
// 📊 2. RENDERIZADO DE FILAS
// FIX: Mapeo directo a los campos que devuelve el C# (camelCase)
// =========================================================================
window.renderizarTablaProductosInventario = function(lista) {
    const tbody = document.getElementById("tablaProductosBody");
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">
            No se encontraron prendas registradas.
        </td></tr>`;
        return;
    }

    let html = "";

    lista.forEach((p) => {
        // Mapeo directo a los campos que manda tu C# en el GET
        const pId    = p.id    ?? 0;
        const pNombre = p.nombre ?? "Prenda sin nombre";

        // FIX 1: C# ahora manda precioCosto y precio (venta)
        const pCosto = p.precioCosto ?? 0;
        const pVenta = p.precio      ?? 0;

        // FIX 2: C# manda categoria (nombre) y categoriaId directamente
        const nombreCategoria = p.categoria  ?? "Sin categoría";
        const catId           = p.categoriaId ?? "";

        // Stock: suma de todas las variantes
        const variantesRaw = p.variantes ?? [];
        let stockTotal = 0;
        if (Array.isArray(variantesRaw)) {
            stockTotal = variantesRaw.reduce((acc, v) => acc + parseInt(v.stock ?? 0), 0);
        }

        // Badge de stock
        let badgeStock;
        if (stockTotal === 0) {
            badgeStock = `<span class="bg-rose-950/60 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md font-bold font-mono text-xs">SIN STOCK</span>`;
        } else if (stockTotal <= 3) {
            badgeStock = `<span class="bg-amber-950/60 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md font-bold font-mono text-xs animate-pulse">⚠️ ${stockTotal} u.</span>`;
        } else {
            badgeStock = `<span class="bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md font-bold font-mono text-xs">${stockTotal} u.</span>`;
        }

        const safeNombre = pNombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');

        html += `
            <tr class="hover:bg-slate-900/30 transition-colors border-b border-slate-800/40">
                <td class="p-4 font-bold text-white text-sm">${pNombre}</td>
                <td class="p-4 text-slate-400 text-xs capitalize">${nombreCategoria}</td>
                <td class="p-4 text-slate-400 font-mono text-xs">$${Number(pCosto).toFixed(2)}</td>
                <td class="p-4 text-emerald-400 font-bold font-mono text-sm">$${Number(pVenta).toFixed(2)}</td>
                <td class="p-4 text-center">${badgeStock}</td>
                <td class="p-4 text-right space-x-1">
                    <button onclick="window.verVariantes(${pId})"
                        class="bg-indigo-950 hover:bg-indigo-900 text-indigo-400 text-xs px-2 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer">
                        👕 Variantes
                    </button>
                    <button onclick="window.abrirModalAgregarVariante(${pId})" 
                        class="bg-emerald-950/30 hover:bg-emerald-900/60 text-emerald-400 text-xs px-2 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer">
                        ➕ Variante
                    </button>
                    <button onclick="window.eliminarProducto(${pId}, '${safeNombre}')"
                        class="bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 text-xs px-2 py-1.5 rounded-lg border border-rose-500/20 cursor-pointer">
                        🗑️ Borrar
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
};

// =========================================================================
// 🔍 3. FILTRADO EN TIEMPO REAL
// FIX: Compara categoriaId directamente (campo que ahora manda el C#)
// =========================================================================
window.filtrarProductosInventario = function() {
    const txt      = (document.getElementById("inputBuscarProducto")?.value || "").toLowerCase().trim();
    const catFiltro = document.getElementById("selectFiltroCategoria")?.value || "";

    if (!window.productosMemoria) return;

    const filtrados = window.productosMemoria.filter(p => {
        const pNombre     = (p.nombre      ?? "").toLowerCase();
        const pDescripcion = (p.descripcion ?? "").toLowerCase();
        const coincideTxt = pNombre.includes(txt) || pDescripcion.includes(txt);

        if (catFiltro === "") return coincideTxt;

        // FIX: categoriaId viene directo del C# ahora
        const catId = String(p.categoriaId ?? "");
        return coincideTxt && catId === String(catFiltro);
    });

    window.renderizarTablaProductosInventario(filtrados);
};

// =========================================================================
// 🗑️ 4. ELIMINAR PRODUCTO (Soft Delete)
// FIX: Recarga desde la BD en vez de tocar memoria local
// =========================================================================
window.eliminarProducto = async function(id, nombre) {
    const ok = await window.confirmar(
        `¿Estás seguro de dar de baja <strong>"${nombre}"</strong>?<br>
        El historial de ventas quedará intacto.`,
        "Dar de baja", "rose"
    );
    if (!ok) return;

    const token      = window.ConfigInventario.obtenerToken();
    const urlDestino = `${window.ConfigInventario.URL}/productos/${id}`;

    try {
        console.log(`📡 Enviando DELETE a: ${urlDestino}`);
        const respuesta = await fetch(urlDestino, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }

        // FIX: Recarga desde la BD para reflejar el estado real
        await window.cargarProductosInventario();
        alert(`✅ "${nombre}" fue dado de baja correctamente.\nEl historial de ventas sigue intacto.`);

    } catch (error) {
        console.error("❌ Error en DELETE:", error);
        alert("No se pudo dar de baja el producto. Revisá la consola (F12).");
    }
};

// =========================================================================
// 👕 5. MODAL VARIANTES
// FIX: Mapeo directo a campos camelCase del C#
// =========================================================================
window.verVariantes = function(id) {
    if (!window.productosMemoria) return;

    const prod = window.productosMemoria.find(p => p.id === id);
    if (!prod) return;

    document.getElementById("modalVariantesTitulo").innerText = prod.nombre ?? "Producto";

    const tbody         = document.getElementById("modalVariantesBody");
    const listaVariantes = prod.variantes ?? [];
    let html = "";

    if (Array.isArray(listaVariantes) && listaVariantes.length > 0) {
        listaVariantes.forEach(v => {
            html += `
                <tr class="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td class="py-2.5 font-medium text-white capitalize">${v.talle ?? "-"}</td>
                    <td class="py-2.5 text-slate-400 capitalize">${v.color ?? "-"}</td>
                    <td class="py-2.5 text-right font-mono text-emerald-400 font-bold">${v.stock ?? 0} u.</td>
                </tr>
            `;
        });
    } else {
        html = `<tr><td colspan="3" class="py-6 text-center text-slate-500 italic text-xs">Sin variantes registradas.</td></tr>`;
    }

    if (tbody) tbody.innerHTML = html;
    document.getElementById("modalVariantes")?.classList.remove("hidden");
};

window.cerrarModalVariantes = function() {
    document.getElementById("modalVariantes")?.classList.add("hidden");
};

// =========================================================================
// ✨ 6. MODAL AGREGAR PRODUCTO — Abrir / Cerrar
// =========================================================================
window.abrirModalAgregar = function() {
    document.getElementById("modalAgregar")?.classList.remove("hidden");
};

window.cerrarModalAgregar = function() {
    document.getElementById("modalAgregar")?.classList.add("hidden");
    const form = document.getElementById("formAgregarProducto");
    if (form) form.reset();
};

// =========================================================================
// 💾 7. GUARDAR NUEVO PRODUCTO (Producto base + variante inicial)
// =========================================================================
window.guardarNuevoProducto = async function(event) {
    event.preventDefault();

    const token = window.ConfigInventario.obtenerToken();
    if (!token) {
        alert("⚠️ No hay sesión activa. Por favor volvé a iniciar sesión.");
        return;
    }

    // Leer campos del producto base
    const nombre      = document.getElementById("addNombre")?.value.trim();
    const precioCosto = parseFloat(document.getElementById("addPrecioCosto")?.value);
    const precioVenta = parseFloat(document.getElementById("addPrecioVenta")?.value);
    const categoriaId = parseInt(document.getElementById("addCategoria")?.value);

    // Leer campos de la variante inicial
    const talle        = document.getElementById("addTalle")?.value.trim();
    const color        = document.getElementById("addColor")?.value.trim();
    const codigoBarras = document.getElementById("addCodigoBarras")?.value.trim();
    const stockActual  = parseInt(document.getElementById("addStockActual")?.value);
    const stockMinimo  = parseInt(document.getElementById("addStockMinimo")?.value) || 2;

    // Validaciones
    if (!nombre || isNaN(precioCosto) || isNaN(precioVenta) || isNaN(categoriaId)) {
        alert("⚠️ Completá todos los campos del producto (nombre, precios y categoría).");
        return;
    }
    if (!talle || !color || !codigoBarras || isNaN(stockActual)) {
        alert("⚠️ Completá todos los campos de la variante (talle, color, código de barras y stock).");
        return;
    }

    // Payload exacto que espera tu Producto.cs
    // C# guarda el producto y la variante en una sola operación gracias a la relación Variantes = new List<>()
    const payload = {
        categoriaId:  categoriaId,
        nombre:       nombre,
        precioCosto:  precioCosto,
        precioVenta:  precioVenta,
        activo:       true,
        variantes: [
            {
                talle:        talle,
                color:        color,
                codigoBarras: codigoBarras,
                stockActual:  stockActual,
                stockMinimo:  stockMinimo
            }
        ]
    };

    console.log("📦 Enviando nuevo producto al backend:", payload);

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/productos`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            const errorTexto = await respuesta.text();
            console.error("❌ Error del servidor:", errorTexto);
            throw new Error(errorTexto);
        }

        alert("✅ ¡Producto guardado con éxito!");
        window.cerrarModalAgregar();
        await window.cargarProductosInventario();

    } catch (error) {
        console.error("❌ Error al guardar producto:", error);
        alert("No se pudo guardar el producto. Revisá la consola (F12) para ver el detalle.");
    }
};

// =========================================================================
// 🏷️ MÓDULO DE CATEGORÍAS — Nueva Categoría
// Pegá este bloque al final de tu productos.js
// =========================================================================

// ── Abrir / Cerrar modal ──────────────────────────────────────────────────
window.abrirModalAgregarCategoria = function() {
    document.getElementById("modalAgregarCategoria")?.classList.remove("hidden");
    document.getElementById("inputNombreCategoria")?.focus();
};

window.cerrarModalAgregarCategoria = function() {
    document.getElementById("modalAgregarCategoria")?.classList.add("hidden");
    document.getElementById("formAgregarCategoria")?.reset();
    document.getElementById("errorCategoria")?.classList.add("hidden");
};

// ── Guardar nueva categoría ───────────────────────────────────────────────
window.guardarNuevaCategoria = async function(event) {
    event.preventDefault();

    const token  = window.ConfigInventario.obtenerToken();
    const nombre = document.getElementById("inputNombreCategoria")?.value.trim();
    const divError = document.getElementById("errorCategoria");

    if (!nombre) {
        divError.textContent = "El nombre no puede estar vacío.";
        divError.classList.remove("hidden");
        return;
    }

    // Verificar duplicado en memoria antes de ir al servidor
    const yaExiste = window.categoriasMemoria.some(
        c => (c.nombre ?? c.Nombre ?? "").toLowerCase() === nombre.toLowerCase()
    );
    if (yaExiste) {
        divError.textContent = `Ya existe una categoría llamada "${nombre}".`;
        divError.classList.remove("hidden");
        return;
    }

    const payload = { nombre, activo: true };

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/categorias`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            const err = await respuesta.json().catch(() => ({ mensaje: "Error desconocido." }));
            throw new Error(err.mensaje || `Error HTTP ${respuesta.status}`);
        }

        const nueva = await respuesta.json();
        console.log("✅ Categoría creada:", nueva);

        // Actualizar memoria y selects al instante sin recargar la página
        window.categoriasMemoria.push(nueva);
        window.actualizarSelectsCategorias();

        window.cerrarModalAgregarCategoria();
        alert(`✅ Categoría "${nombre}" creada con éxito.`);

    } catch (error) {
        console.error("❌ Error al crear categoría:", error);
        divError.textContent = error.message || "No se pudo crear la categoría.";
        divError.classList.remove("hidden");
    }
};

// =========================================================================
// 👕 MÓDULO DE VARIANTES — Agregar variante a producto existente
// =========================================================================

// ── Abrir modal: carga el nombre del producto en el título ────────────────
window.abrirModalAgregarVariante = function(productoId) {
    const prod = window.productosMemoria.find(p => p.id === productoId);
    if (!prod) {
        alert("No se encontró el producto. Recargá la página.");
        return;
    }

    // Guardar el ID en el formulario para usarlo al guardar
    document.getElementById("varianteProductoId").value = productoId;

    // Mostrar nombre del producto en el título del modal
    document.getElementById("modalVarianteTitulo").textContent  = prod.nombre ?? "Producto";
    document.getElementById("modalVarianteSubtitulo").textContent = `Agregando variante a: ${prod.nombre}`;

    // Limpiar estado anterior
    document.getElementById("formAgregarVariante")?.reset();
    document.getElementById("varianteProductoId").value = productoId; // reset limpia el hidden, restaurar
    document.getElementById("errorVariante")?.classList.add("hidden");

    document.getElementById("modalAgregarVariante")?.classList.remove("hidden");
    document.getElementById("varianteTalle")?.focus();
};

window.cerrarModalAgregarVariante = function() {
    document.getElementById("modalAgregarVariante")?.classList.add("hidden");
    document.getElementById("formAgregarVariante")?.reset();
    document.getElementById("errorVariante")?.classList.add("hidden");
};

// ── Guardar variante ──────────────────────────────────────────────────────
window.guardarNuevaVariante = async function(event) {
    event.preventDefault();

    const token      = window.ConfigInventario.obtenerToken();
    const productoId = parseInt(document.getElementById("varianteProductoId")?.value);
    const talle      = document.getElementById("varianteTalle")?.value.trim();
    const color      = document.getElementById("varianteColor")?.value.trim();
    const codBarras  = document.getElementById("varianteCodigoBarras")?.value.trim();
    const stock      = parseInt(document.getElementById("varianteStock")?.value);
    const stockMin   = parseInt(document.getElementById("varianteStockMinimo")?.value) || 2;
    const divError   = document.getElementById("errorVariante");

    // Validaciones básicas
    if (!talle || !color || !codBarras || isNaN(stock) || isNaN(productoId)) {
        divError.textContent = "Completá todos los campos obligatorios.";
        divError.classList.remove("hidden");
        return;
    }

    // Verificar duplicado en memoria antes de llamar al servidor
    const prod = window.productosMemoria.find(p => p.id === productoId);
    if (prod) {
        const duplicado = (prod.variantes ?? []).some(
            v => v.talle?.toLowerCase() === talle.toLowerCase() &&
                 v.color?.toLowerCase() === color.toLowerCase()
        );
        if (duplicado) {
            divError.textContent = `Ya existe la variante talle "${talle}" / color "${color}" para este producto.`;
            divError.classList.remove("hidden");
            return;
        }
    }

    const payload = {
        productoId,
        talle,
        color,
        codigoBarras: codBarras,
        stockActual:  stock,
        stockMinimo:  stockMin
    };

    console.log("👕 Enviando nueva variante:", payload);

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/variantes`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            const err = await respuesta.json().catch(() => ({ mensaje: "Error del servidor." }));
            throw new Error(err.mensaje || `Error HTTP ${respuesta.status}`);
        }

        const nuevaVariante = await respuesta.json();
        console.log("✅ Variante creada:", nuevaVariante);

        // Actualizar memoria local al instante sin recargar toda la tabla
        if (prod) {
            prod.variantes = prod.variantes ?? [];
            prod.variantes.push(nuevaVariante);
        }

        window.cerrarModalAgregarVariante();
        await window.cargarProductosInventario(); // Recarga para mostrar el nuevo stock
        alert(`✅ Variante ${talle} / ${color} agregada con éxito.`);

    } catch (error) {
        console.error("❌ Error al guardar variante:", error);
        divError.textContent = error.message || "No se pudo guardar la variante.";
        divError.classList.remove("hidden");
    }
};

// =========================================================================
// ⚠️ MÓDULO DE ALERTAS DE STOCK CRÍTICO
// =========================================================================

// ── Cargar alertas y actualizar badge + tabla ─────────────────────────────
window.cargarStockCritico = async function() {
    const token = localStorage.getItem("token");

    try {
        const resp = await fetch(`${window.ConfigInventario.URL}/variantes/stock-critico`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error("Error al cargar stock crítico");

        const datos = await resp.json();
        const total    = datos.total    ?? datos.Total    ?? 0;
        const sinStock = datos.sinStock ?? datos.SinStock ?? 0;
        const criticos = datos.criticos ?? datos.Criticos ?? [];

        // ── Actualizar badge en el nav ────────────────────────────────────
        window.actualizarBadgeStock(total, sinStock);

        // ── Renderizar tabla de críticos en el inventario ─────────────────
        window.renderizarStockCritico(criticos);

        console.log(`⚠️ Stock crítico: ${total} variantes (${sinStock} sin stock)`);

    } catch (error) {
        console.error("❌ Error al cargar stock crítico:", error);
    }
};

// ── Badge en el botón de Inventario del nav ───────────────────────────────
window.actualizarBadgeStock = function(total, sinStock) {
    const btn = document.getElementById("btnNavInventario");
    if (!btn) return;

    // Quitar badge anterior si existe
    const badgeAnterior = document.getElementById("badgeStockCritico");
    if (badgeAnterior) badgeAnterior.remove();

    if (total === 0) return; // Sin alertas, no mostrar nada

    const color  = sinStock > 0 ? "#dc2626" : "#d97706";
    const badge  = document.createElement("span");
    badge.id     = "badgeStockCritico";
    badge.textContent = total;
    badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: ${color};
        color: white;
        font-size: 10px;
        font-weight: 800;
        min-width: 18px;
        height: 18px;
        border-radius: 9999px;
        padding: 0 5px;
        margin-left: 6px;
        vertical-align: middle;
        animation: pulse 2s infinite;
    `;

    // Inyectar animación pulse si no existe
    if (!document.getElementById("badgePulseStyle")) {
        const style = document.createElement("style");
        style.id = "badgePulseStyle";
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.75; transform: scale(1.1); }
            }
        `;
        document.head.appendChild(style);
    }

    btn.appendChild(badge);
};

// ── Renderizar tabla de críticos dentro del inventario ────────────────────
window.renderizarStockCritico = function(criticos) {
    const contenedor = document.getElementById("seccionStockCritico");
    if (!contenedor) return;

    if (!criticos || criticos.length === 0) {
        contenedor.classList.add("hidden");
        return;
    }

    contenedor.classList.remove("hidden");

    const tbody = document.getElementById("tablaStockCriticoBody");
    if (!tbody) return;

    tbody.innerHTML = criticos.map(v => {
        const esSinStock = v.stockActual === 0;
        const badgeColor = esSinStock
            ? "bg-rose-950/60 text-rose-400 border-rose-500/20"
            : "bg-amber-950/60 text-amber-400 border-amber-500/20";
        const badgeTexto = esSinStock ? "SIN STOCK" : `${v.stockActual} u.`;
        const icono      = esSinStock ? "🔴" : "🟡";

        return `
            <tr class="hover:bg-slate-900/30 transition-colors border-b border-slate-800/40">
                <td class="p-3 text-white text-sm font-bold">${icono} ${v.producto}</td>
                <td class="p-3 text-slate-400 text-xs capitalize">${v.talle} / ${v.color}</td>
                <td class="p-3 text-center">
                    <span class="border px-2.5 py-1 rounded-md font-bold font-mono text-xs ${badgeColor}">
                        ${badgeTexto}
                    </span>
                </td>
                <td class="p-3 text-slate-500 text-xs text-center">mín: ${v.stockMinimo} u.</td>
                <td class="p-3 text-right">
                    <button onclick="window.abrirModalReponerStock(${v.varianteId}, '${v.producto.replace(/'/g, "\\'")}', '${v.talle}', '${v.color}', ${v.stockActual})"
                     class="bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer">
                         📦 Reponer Stock
                    </button>
                </td>
            </tr>
        `;
    }).join("");
};

// ── Inicializar al cargar el inventario ───────────────────────────────────
// Llamar a cargarStockCritico cuando se cargue el inventario
const _cargarOriginal = window.cargarProductosInventario;
window.cargarProductosInventario = async function() {
    await _cargarOriginal();
    await window.cargarStockCritico();
};

// =========================================================================
// 📦 MODAL REPONER STOCK DE VARIANTE EXISTENTE
// =========================================================================

// ── Abrir modal de reposición ─────────────────────────────────────────────
window.abrirModalReponerStock = function(varianteId, productoNombre, talle, color, stockActual) {
    // Guardar datos en el modal para usarlos al confirmar
    const modal = document.getElementById("modalReponerStock");
    if (!modal) return;

    modal.dataset.varianteId  = varianteId;
    modal.dataset.stockActual = stockActual;

    // Mostrar info de la variante en el modal
    document.getElementById("reponerProductoNombre").textContent = productoNombre;
    document.getElementById("reponerVarianteDetalle").textContent = `Talle ${talle} / ${color}`;
    document.getElementById("reponerStockActual").textContent = `${stockActual} u.`;
    document.getElementById("reponerCantidad").value = "";
    document.getElementById("reponerStockNuevo").textContent = `${stockActual} u.`;
    document.getElementById("errorReponerStock")?.classList.add("hidden");

    modal.classList.remove("hidden");
    document.getElementById("reponerCantidad")?.focus();
};

window.cerrarModalReponerStock = function() {
    document.getElementById("modalReponerStock")?.classList.add("hidden");
};

// ── Preview en tiempo real del nuevo stock ────────────────────────────────
window.previewNuevoStock = function() {
    const modal       = document.getElementById("modalReponerStock");
    const stockActual = parseInt(modal?.dataset.stockActual || 0);
    const cantidad    = parseInt(document.getElementById("reponerCantidad")?.value || 0);
    const nuevo       = isNaN(cantidad) || cantidad < 0 ? stockActual : stockActual + cantidad;
    document.getElementById("reponerStockNuevo").textContent = `${nuevo} u.`;
};

// ── Confirmar reposición ──────────────────────────────────────────────────
window.confirmarReposicion = async function(event) {
    event.preventDefault();

    const token     = localStorage.getItem("token");
    const modal     = document.getElementById("modalReponerStock");
    const varianteId = parseInt(modal?.dataset.varianteId);
    const stockActual = parseInt(modal?.dataset.stockActual || 0);
    const cantidad  = parseInt(document.getElementById("reponerCantidad")?.value);
    const divError  = document.getElementById("errorReponerStock");
    const btn       = event.submitter;
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Guardando...") : () => {};

    if (isNaN(cantidad) || cantidad <= 0) {
        divError.textContent = "Ingresá una cantidad mayor a cero.";
        divError.classList.remove("hidden");
        restaurar();
        return;
    }

    const nuevoStock = stockActual + cantidad;

    try {
        const resp = await fetch(
            `${window.ConfigInventario.URL}/variantes/${varianteId}/stock`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ stockActual: nuevoStock })
            }
        );

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ mensaje: "Error del servidor." }));
            throw new Error(err.mensaje || `Error HTTP ${resp.status}`);
        }

        window.cerrarModalReponerStock();
        await window.cargarProductosInventario(); // Recarga tabla + badge automáticamente
        alert(`✅ Stock actualizado correctamente. Nuevo stock: ${nuevoStock} u.`);

    } catch (error) {
        console.error("❌ Error al reponer stock:", error);
        divError.textContent = error.message || "No se pudo actualizar el stock.";
        divError.classList.remove("hidden");
    } finally {
        restaurar();
    }
};