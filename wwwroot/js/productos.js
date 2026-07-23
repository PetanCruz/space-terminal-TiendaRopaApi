// =========================================================================
// 🛒 MÓDULO DE PRODUCTOS E INVENTARIO (LIMPIO Y UNIFICADO)
// =========================================================================

window.ConfigInventario = window.ConfigInventario || {
    URL: "https://space-terminal-tiendaropaapi-production.up.railway.app/api",
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
// 📁 1. CATEGORÍAS (Carga y Formulario)
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
            window.actualizarSelectsCategorias();
        }
    } catch (e) {
        console.error("❌ Error al traer categorías:", e);
    }
};

window.actualizarSelectsCategorias = function() {
    const selectFiltro = document.getElementById("selectFiltroCategoria");
    const selectAdd    = document.getElementById("addCategoria");

    if (!window.categoriasMemoria || window.categoriasMemoria.length === 0) return;

    if (selectFiltro) {
        let html = `<option value="">📁 Todas las Categorías</option>`;
        window.categoriasMemoria.forEach(c => {
            const cId = c.id ?? c.Id ?? c.idCategoria;
            const cNombre = c.nombre ?? c.Nombre ?? "";
            html += `<option value="${cId}">${cNombre}</option>`;
        });
        selectFiltro.innerHTML = html;
    }

    if (selectAdd) {
        let html = `<option value="">-- Seleccionar Categoría --</option>`;
        window.categoriasMemoria.forEach(c => {
            const cId = c.id ?? c.Id ?? c.idCategoria;
            const cNombre = c.nombre ?? c.Nombre ?? "";
            html += `<option value="${cId}">${cNombre}</option>`;
        });
        selectAdd.innerHTML = html;
    }
};

window.abrirModalAgregarCategoria = function() {
    document.getElementById("modalAgregarCategoria")?.classList.remove("hidden");
    document.getElementById("inputNombreCategoria")?.focus();
};

window.cerrarModalAgregarCategoria = function() {
    document.getElementById("modalAgregarCategoria")?.classList.add("hidden");
    document.getElementById("formAgregarCategoria")?.reset();
    document.getElementById("errorCategoria")?.classList.add("hidden");
};

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

    const yaExiste = window.categoriasMemoria.some(c => (c.nombre ?? c.Nombre ?? "").toLowerCase() === nombre.toLowerCase());
    if (yaExiste) {
        divError.textContent = `Ya existe una categoría llamada "${nombre}".`;
        divError.classList.remove("hidden");
        return;
    }

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/categorias`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, activo: true })
        });

        if (!respuesta.ok) throw new Error("Error HTTP al crear categoría");

        const nueva = await respuesta.json();
        window.categoriasMemoria.push(nueva);
        window.actualizarSelectsCategorias();
        window.cerrarModalAgregarCategoria();
        if(window.toast) window.toast.success(`✅ Categoría "${nombre}" creada.`);
        else alert(`✅ Categoría "${nombre}" creada.`);

    } catch (error) {
        console.error(error);
        divError.textContent = "No se pudo crear la categoría.";
        divError.classList.remove("hidden");
    }
};

// =========================================================================
// 📦 2. PRODUCTOS (Carga, Tabla, Filtro y Eliminación)
// =========================================================================
window.cargarProductosInventario = async function() {
    const token = window.ConfigInventario.obtenerToken();
    const tbody = document.getElementById("tablaProductosBody");
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const sucursalId = usuarioLocal.sucursalId || 1;

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/productos?sucursalId=${sucursalId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!respuesta.ok) throw new Error("Error HTTP");

        const prods = await respuesta.json();
        window.productosMemoria = prods;
        window.renderizarTablaProductosInventario(prods);
        
        // Cargamos el stock crítico directamente acá de forma segura
        if (window.cargarStockCritico) await window.cargarStockCritico();

    } catch (error) {
        console.error("❌ Error al cargar productos:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-400">Error de conexión.</td></tr>`;
    }
};

window.renderizarTablaProductosInventario = function(lista) {
    const tbody = document.getElementById("tablaProductosBody");
    if (!tbody) return;

    // 🔥 FIX: Chequeo de administrador a prueba de fallos
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario")) || {};
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (usuarioLocal.rol === "administrador" || usuarioLocal.rol === "Administrador");

    const btnAddProd = document.querySelector("button[onclick='window.abrirModalAgregar()']");
    const btnAddCat = document.querySelector("button[onclick*='abrirModalAgregarCategoria']");
    
    if (btnAddProd) btnAddProd.style.display = esAdmin ? 'block' : 'none';
    if (btnAddCat) btnAddCat.style.display = esAdmin ? 'block' : 'none';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">No se encontraron prendas.</td></tr>`;
        return;
    }

    let html = "";
    lista.forEach((p) => {
        const pId = p.id ?? 0;
        const pNombre = p.nombre ?? "Prenda sin nombre";
        const pCosto = p.precioCosto ?? 0;
        const pVenta = p.precio ?? p.precioVenta ?? 0;
        const nombreCategoria = p.categoria ?? "Sin categoría";

        let stockTotal = 0;
        if (Array.isArray(p.variantes)) {
            p.variantes.forEach(v => {
                if (esAdmin && v.stockDetalle && Array.isArray(v.stockDetalle)) {
                    stockTotal += v.stockDetalle.reduce((acc, suc) => acc + (suc.cantidad || 0), 0);
                } else {
                    stockTotal += parseInt(v.stock ?? 0);
                }
            });
        }

        let badgeStock = stockTotal === 0 
            ? `<span class="bg-rose-950/60 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md font-bold text-xs">SIN STOCK</span>`
            : stockTotal <= 3
                ? `<span class="bg-amber-950/60 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md font-bold text-xs animate-pulse">⚠️ ${stockTotal} u.</span>`
                : `<span class="bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md font-bold text-xs">${stockTotal} u.</span>`;

        const safeNombre = pNombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        let precioCostoHtml = `<td class="p-4 text-slate-500 text-xs italic">***</td>`; 
        let botonesAdmin = "";
        
        if (esAdmin) {
            precioCostoHtml = `<td class="p-4 text-slate-400 text-xs">$${Number(pCosto).toFixed(2)}</td>`;
            botonesAdmin = `
                <button onclick="window.abrirModalAgregarVariante(${pId})" class="bg-emerald-950/30 hover:bg-emerald-900/60 text-emerald-400 text-xs px-2 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer">➕ Variante</button>
                <button onclick="window.eliminarProducto(${pId}, '${safeNombre}')" class="bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 text-xs px-2 py-1.5 rounded-lg border border-rose-500/20 cursor-pointer">🗑️ Borrar</button>
            `;
        }

        html += `
            <tr class="hover:bg-slate-900/30 transition-colors border-b border-slate-800/40">
                <td class="p-4 font-bold text-white text-sm">${pNombre}</td>
                <td class="p-4 text-slate-400 text-xs capitalize">${nombreCategoria}</td>
                ${precioCostoHtml}
                <td class="p-4 text-emerald-400 font-bold text-sm">$${Number(pVenta).toFixed(2)}</td>
                <td class="p-4 text-center">${badgeStock}</td>
                <td class="p-4 text-right space-x-1">
                    <button onclick="window.verVariantes(${pId})" class="bg-indigo-950 hover:bg-indigo-900 text-indigo-400 text-xs px-2 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer">👕 Variantes</button>
                    ${botonesAdmin}
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.filtrarProductosInventario = function() {
    const txt = (document.getElementById("inputBuscarProducto")?.value || "").toLowerCase().trim();
    const catFiltro = document.getElementById("selectFiltroCategoria")?.value || "";

    if (!window.productosMemoria) return;

    const filtrados = window.productosMemoria.filter(p => {
        const pNombre = (p.nombre ?? "").toLowerCase();
        const coincideTxt = pNombre.includes(txt) || (p.descripcion ?? "").toLowerCase().includes(txt);
        if (catFiltro === "") return coincideTxt;
        return coincideTxt && String(p.categoriaId ?? "") === String(catFiltro);
    });
    window.renderizarTablaProductosInventario(filtrados);
};

window.eliminarProducto = async function(id, nombre) {
    const ok = await window.confirmar(`¿Estás seguro de dar de baja <strong>"${nombre}"</strong>?`, "Dar de baja", "rose");
    if (!ok) return;

    const token = window.ConfigInventario.obtenerToken();
    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/productos/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!respuesta.ok) throw new Error("Error HTTP");
        await window.cargarProductosInventario();
        if(window.toast) window.toast.success(`✅ "${nombre}" fue dado de baja.`);
    } catch (error) {
        console.error(error);
        alert("No se pudo dar de baja el producto.");
    }
};

window.abrirModalAgregar = async function() {
    document.getElementById("modalAgregar")?.classList.remove("hidden");
    window.llenarSelectSucursales("addSucursalStock", "addSucursalStock".parentElement?.id);
};

window.cerrarModalAgregar = function() {
    document.getElementById("modalAgregar")?.classList.add("hidden");
    document.getElementById("formAgregarProducto")?.reset();
};

window.guardarNuevoProducto = async function(event) {
    event.preventDefault();
    const token = window.ConfigInventario.obtenerToken();

    const nombre      = document.getElementById("addNombre")?.value.trim();
    const precioCosto = parseFloat(document.getElementById("addPrecioCosto")?.value);
    const precioVenta = parseFloat(document.getElementById("addPrecioVenta")?.value);
    const categoriaId = parseInt(document.getElementById("addCategoria")?.value);
    const talle        = document.getElementById("addTalle")?.value.trim();
    const color        = document.getElementById("addColor")?.value.trim();
    const codigoBarras = document.getElementById("addCodigoBarras")?.value.trim();
    const stockActual  = parseInt(document.getElementById("addStockActual")?.value);
    const stockMinimo  = parseInt(document.getElementById("addStockMinimo")?.value) || 2;
    
    const selSuc = document.getElementById("addSucursalStock");
    const sucursalFinal = (selSuc && selSuc.value) ? parseInt(selSuc.value) : (JSON.parse(localStorage.getItem("usuario"))?.sucursalId || 1);

    if (!nombre || isNaN(precioCosto) || isNaN(precioVenta) || isNaN(categoriaId) || !talle || !color || !codigoBarras || isNaN(stockActual)) {
        alert("⚠️ Faltan completar campos obligatorios.");
        return;
    }

    const payload = {
        categoriaId, nombre, precioCosto, precioVenta, activo: true, sucursalId: sucursalFinal,
        variantes: [{ talle, color, codigoBarras, stockActual, stockMinimo }]
    };

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/productos`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) throw new Error(await respuesta.text());

        window.cerrarModalAgregar();
        await window.cargarProductosInventario();
        if(window.toast) window.toast.success("✅ Producto guardado con éxito.");
    } catch (error) {
        console.error(error);
        alert("Error al guardar producto: " + error.message);
    }
};

// =========================================================================
// 👕 3. VARIANTES (Vista de detalle y Agregar Nueva)
// =========================================================================
window.verVariantes = function(id) {
    if (!window.productosMemoria) return;

    // 🌟 FIX JS: Tolerancia a tipos y mayúsculas
    const prod = window.productosMemoria.find(p => p.id == id || p.Id == id);
    if (!prod) {
        console.error(`Producto con ID ${id} no encontrado en memoria.`);
        return;
    }

    const titulo = document.getElementById("modalVariantesTitulo");
    if (titulo) titulo.innerText = prod.nombre ?? prod.Nombre ?? "Producto";

    const tbody = document.getElementById("modalVariantesBody");
    const listaVariantes = prod.variantes ?? [];
    let html = "";

    if (Array.isArray(listaVariantes) && listaVariantes.length > 0) {
        listaVariantes.forEach(v => {
            let detalleHtml = "";
            if (v.stockDetalle && v.stockDetalle.length > 0 && v.stockDetalle.length > 1) {
                detalleHtml = `<div class="mt-3 pt-3 border-t border-slate-700/50 flex flex-col gap-2 w-full">`;
                v.stockDetalle.forEach(d => {
                    const colorNum = d.cantidad > 0 ? "text-emerald-400" : "text-slate-500";
                    const esLocalActual = d.sucursalId === ((JSON.parse(localStorage.getItem("usuario")) || {}).sucursalId || 1);
                    
                    let btnVender = (d.cantidad > 0 && !esLocalActual) 
                        ? `<button onclick="window.venderDesdeInventario(${v.id}, '${(prod.nombre||"").replace(/'/g, "\\'")}', ${prod.precio||prod.precioVenta||0}, '${v.talle}', '${v.color}', ${d.sucursalId})" class="ml-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2 py-1 rounded shadow-md cursor-pointer">🛒 Vender</button>` 
                        : "";

                    detalleHtml += `
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-slate-300">${d.sucursal}</span>
                            <div class="flex items-center"><span class="font-mono font-bold text-base ${colorNum}">${d.cantidad} u.</span>${btnVender}</div>
                        </div>`;
                });
                detalleHtml += `</div>`;
            }

            // 🔥 FIX: Agregamos el botón de Reponer Stock alineado a la derecha
            html += `
                <tr class="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td class="py-4 font-medium text-white capitalize text-lg">${v.talle ?? "-"}</td>
                    <td class="py-4 text-slate-400 capitalize text-lg">${v.color ?? "-"}</td>
                    <td class="py-4 text-right min-w-[300px]">
                        <div class="flex items-center justify-end gap-2 mb-1">
                            <div class="font-mono text-white font-bold text-sm bg-slate-950/80 px-3 py-2 rounded-lg border border-indigo-500/30 shadow-md">
                                Local actual: <span class="text-indigo-400 text-xl ml-2">${v.stock ?? 0}</span>
                            </div>
                            <button onclick="window.abrirModalReponerStock(${v.id}, '${(prod.nombre||"").replace(/'/g, "\\'")}', '${v.talle}', '${v.color}', ${v.stock ?? 0})" class="px-3 py-2 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/80 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-md">
                                📦 Reponer
                            </button>
                        </div>
                        ${detalleHtml}
                    </td>
                </tr>`;
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

window.abrirModalAgregarVariante = function(productoId) {
    const prod = window.productosMemoria.find(p => p.id == productoId || p.Id == productoId);
    if (!prod) {
        alert("No se encontró el producto en memoria. Recargá la página.");
        return;
    }

    window.llenarSelectSucursales("varianteSucursal", "contenedorSucursalVariante");

    const inputId = document.getElementById("varianteProductoId");
    if (inputId) inputId.value = productoId;

    const titulo = document.getElementById("modalVarianteTitulo");
    if (titulo) titulo.textContent = prod.nombre ?? prod.Nombre ?? "Producto";

    const form = document.getElementById("formAgregarVariante");
    if (form) {
        form.reset();
        if (inputId) inputId.value = productoId;
    }

    document.getElementById("errorVariante")?.classList.add("hidden");
    document.getElementById("modalAgregarVariante")?.classList.remove("hidden");
};

window.cerrarModalAgregarVariante = function() {
    document.getElementById("modalAgregarVariante")?.classList.add("hidden");
    document.getElementById("formAgregarVariante")?.reset();
};

window.guardarNuevaVariante = async function(event) {
    event.preventDefault();
    const token = window.ConfigInventario.obtenerToken();
    const productoId = parseInt(document.getElementById("varianteProductoId")?.value);
    const talle      = document.getElementById("varianteTalle")?.value.trim();
    const color      = document.getElementById("varianteColor")?.value.trim();
    const codBarras  = document.getElementById("varianteCodigoBarras")?.value.trim();
    const stock      = parseInt(document.getElementById("varianteStock")?.value);
    const stockMin   = parseInt(document.getElementById("varianteStockMinimo")?.value) || 2;
    const divError   = document.getElementById("errorVariante");
    
    const sel = document.getElementById("varianteSucursal");
    const sucursalIdElegida = (sel && sel.value) ? parseInt(sel.value) : (JSON.parse(localStorage.getItem("usuario"))?.sucursalId || 1);

    if (!talle || !color || !codBarras || isNaN(stock) || isNaN(productoId)) {
        divError.textContent = "Completá todos los campos obligatorios.";
        divError.classList.remove("hidden");
        return;
    }

    const payload = {
        productoId: productoId, 
        talle: talle, 
        color: color, 
        codigoBarras: codBarras, 
        stockActual: stock,
        stockMinimo: stockMin,
        sucursalId: sucursalIdElegida
    };

    const btn = event.submitter;
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Guardando...") : () => {};

    try {
        const respuesta = await fetch(`${window.ConfigInventario.URL}/variantes`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!respuesta.ok) {
            let errorMsg = "Error del servidor (HTTP " + respuesta.status + ")";
            
            // 🔥 EL FIX: Leemos el texto de la respuesta UNA SOLA VEZ
            const textoRespuesta = await respuesta.text(); 
            
            try {
                // Intentamos interpretarlo como JSON (tu C# manda { mensaje: "..." })
                const errData = JSON.parse(textoRespuesta);
                errorMsg = errData.mensaje || errData.title || textoRespuesta;
            } catch (e) {
                // Si C# escupió texto plano, usamos eso
                if (textoRespuesta) errorMsg = textoRespuesta;
            }
            
            throw new Error(errorMsg);
        }

        window.cerrarModalAgregarVariante();
        await window.cargarProductosInventario(); 
        if (window.toast) window.toast.success(`✅ Variante ${talle} / ${color} agregada.`);
        else alert(`✅ Variante agregada.`);
        
    } catch (error) {
        console.error(error);
        divError.innerHTML = `<strong>Atención:</strong> ${error.message}`;
        divError.classList.remove("hidden");
    } finally {
        restaurar();
    }
};

// =========================================================================
// ⚠️ 4. ALERTAS DE STOCK Y REPOSICIÓN
// =========================================================================
window.cargarStockCritico = async function() {
    const token = localStorage.getItem("token");
    const sucursalId = (JSON.parse(localStorage.getItem("usuario")) || {}).sucursalId || 1;

    try {
        const resp = await fetch(`${window.ConfigInventario.URL}/variantes/stock-critico?sucursalId=${sucursalId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!resp.ok) return;

        const datos = await resp.json();
        const total = datos.total ?? datos.Total ?? 0;
        const sinStock = datos.sinStock ?? datos.SinStock ?? 0;
        const criticos = datos.criticos ?? datos.Criticos ?? [];

        window.actualizarBadgeStock(total, sinStock);
        window.renderizarStockCritico(criticos);
    } catch (e) {
        console.error("Error stock crítico:", e);
    }
};

window.actualizarBadgeStock = function(total, sinStock) {
    const btn = document.getElementById("btnNavInventario");
    if (!btn) return;
    const badgeAnterior = document.getElementById("badgeStockCritico");
    if (badgeAnterior) badgeAnterior.remove();
    if (total === 0) return; 

    const badge = document.createElement("span");
    badge.id = "badgeStockCritico";
    badge.textContent = total;
    badge.style.cssText = `display:inline-flex;align-items:center;justify-content:center;background:${sinStock > 0 ? "#dc2626" : "#d97706"};color:white;font-size:10px;font-weight:800;min-width:18px;height:18px;border-radius:9999px;padding:0 5px;margin-left:6px;animation:pulse 2s infinite;`;
    btn.appendChild(badge);
};

window.renderizarStockCritico = function(criticos) {
    const contenedor = document.getElementById("seccionStockCritico");
    const tbody = document.getElementById("tablaStockCriticoBody");
    if (!contenedor || !tbody) return;

    if (!criticos || criticos.length === 0) {
        contenedor.classList.add("hidden");
        return;
    }

    contenedor.classList.remove("hidden");
    tbody.innerHTML = criticos.map(v => {
        const sinStock = v.stockActual === 0;
        const bColor = sinStock ? "bg-rose-950/60 text-rose-400 border-rose-500/20" : "bg-amber-950/60 text-amber-400 border-amber-500/20";
        return `
            <tr class="hover:bg-slate-900/30 border-b border-slate-800/40">
                <td class="p-3 text-white text-sm font-bold">${sinStock ? "🔴" : "🟡"} ${v.producto}</td>
                <td class="p-3 text-slate-400 text-xs capitalize">${v.talle} / ${v.color}</td>
                <td class="p-3 text-center"><span class="border px-2.5 py-1 rounded-md font-bold font-mono text-xs ${bColor}">${sinStock ? "SIN STOCK" : v.stockActual+" u."}</span></td>
                <td class="p-3 text-slate-500 text-xs text-center">mín: ${v.stockMinimo}</td>
                <td class="p-3 text-right"><button onclick="window.abrirModalReponerStock(${v.varianteId}, '${v.producto.replace(/'/g, "\\'")}', '${v.talle}', '${v.color}', ${v.stockActual})" class="bg-emerald-950/40 text-emerald-400 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/20">📦 Reponer</button></td>
            </tr>`;
    }).join("");
};

window.abrirModalReponerStock = function(varianteId, productoNombre, talle, color, stockActual) {
    const modal = document.getElementById("modalReponerStock");
    if (!modal) return;
    modal.dataset.varianteId = varianteId;
    modal.dataset.stockActual = stockActual;
    document.getElementById("reponerProductoNombre").textContent = productoNombre;
    document.getElementById("reponerVarianteDetalle").textContent = `Talle ${talle} / ${color}`;
    document.getElementById("reponerStockActual").textContent = `${stockActual} u.`;
    document.getElementById("reponerCantidad").value = "";
    document.getElementById("reponerStockNuevo").textContent = `${stockActual} u.`;
    document.getElementById("errorReponerStock")?.classList.add("hidden");
    modal.classList.remove("hidden");
    window.llenarSelectSucursales("reponerSucursal", "contenedorSucursalReponer");
};

window.cerrarModalReponerStock = () => document.getElementById("modalReponerStock")?.classList.add("hidden");

window.previewNuevoStock = function() {
    const modal = document.getElementById("modalReponerStock");
    const actual = parseInt(modal?.dataset.stockActual || 0);
    const cant = parseInt(document.getElementById("reponerCantidad")?.value || 0);
    document.getElementById("reponerStockNuevo").textContent = `${isNaN(cant) || cant < 0 ? actual : actual + cant} u.`;
};

window.confirmarReposicion = async function(event) {
    event.preventDefault();
    const token = localStorage.getItem("token");
    const modal = document.getElementById("modalReponerStock");
    const divError = document.getElementById("errorReponerStock");
    const varianteId = parseInt(modal?.dataset.varianteId);
    const cantidad = parseInt(document.getElementById("reponerCantidad")?.value);
    
    if (isNaN(cantidad) || cantidad <= 0) {
        divError.textContent = "Ingresá una cantidad mayor a cero."; divError.classList.remove("hidden"); return;
    }

    const sel = document.getElementById("reponerSucursal");
    const sucursalId = (sel && sel.value) ? parseInt(sel.value) : (JSON.parse(localStorage.getItem("usuario"))?.sucursalId || 1);
    const btn = event.submitter;
    const restaurar = window.btnLoading ? window.btnLoading(btn, "Guardando...") : () => {};

    try {
        const resp = await fetch(`${window.ConfigInventario.URL}/productos/reponer-stock/${varianteId}?cantidadAAgregar=${cantidad}&sucursalId=${sucursalId}`, {
            method: "PUT", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });
        if (!resp.ok) throw new Error(await resp.text() || "Error del servidor.");
        window.cerrarModalReponerStock();
        await window.cargarProductosInventario();
        if(window.toast) window.toast.success("✅ Stock actualizado.");
    } catch (e) {
        divError.textContent = e.message; divError.classList.remove("hidden");
    } finally {
        restaurar();
    }
};

window.llenarSelectSucursales = async function(selectId, contenedorId) {
    try {
        const select = document.getElementById(selectId);
        const contenedor = document.getElementById(contenedorId);
        if (!select) return;
        const respuesta = await fetch(`${window.ConfigInventario.URL}/sucursales`);
        const sucursales = await respuesta.json();
        select.innerHTML = "";
        if (sucursales.length <= 1) {
            if (contenedor) contenedor.classList.add("hidden");
            if (sucursales.length === 1) select.innerHTML = `<option value="${sucursales[0].id}">${sucursales[0].nombre}</option>`;
        } else {
            if (contenedor) contenedor.classList.remove("hidden");
            sucursales.forEach(s => select.innerHTML += `<option value="${s.id}">${s.nombre}</option>`);
            const uLocal = JSON.parse(localStorage.getItem("usuario")) || {};
            if(uLocal.sucursalId) select.value = uLocal.sucursalId;
        }
    } catch(e) {}
};