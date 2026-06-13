// =========================================================================
// ✨ MÓDULO DE PULIDO FINAL — Toasts + Loading States
// =========================================================================

// ── SISTEMA DE TOASTS ─────────────────────────────────────────────────────
// Reemplaza todos los alert() del sistema por notificaciones elegantes

window.toast = (function() {
    // Crear el contenedor de toasts si no existe
    function obtenerContenedor() {
        let c = document.getElementById("toastContenedor");
        if (!c) {
            c = document.createElement("div");
            c.id = "toastContenedor";
            c.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
                max-width: 360px;
                width: calc(100% - 40px);
            `;
            document.body.appendChild(c);
        }
        return c;
    }

    const iconos = {
        success: "✅",
        error:   "❌",
        warning: "⚠️",
        info:    "💡"
    };

    const colores = {
        success: { bg: "#052e16", border: "#16a34a", text: "#4ade80" },
        error:   { bg: "#2d0a0a", border: "#dc2626", text: "#f87171" },
        warning: { bg: "#2d1a00", border: "#d97706", text: "#fbbf24" },
        info:    { bg: "#0f1d3a", border: "#3b82f6", text: "#93c5fd" }
    };

    function mostrar(mensaje, tipo = "info", duracion = 3500) {
        const contenedor = obtenerContenedor();
        const color = colores[tipo] || colores.info;
        const icono = iconos[tipo] || "💡";

        const toast = document.createElement("div");
        toast.style.cssText = `
            background: ${color.bg};
            border: 1px solid ${color.border};
            color: ${color.text};
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-family: sans-serif;
            font-weight: 500;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            pointer-events: all;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.25s ease;
            cursor: pointer;
            line-height: 1.4;
        `;
        toast.innerHTML = `<span style="font-size:16px;flex-shrink:0">${icono}</span><span>${mensaje}</span>`;
        toast.onclick = () => cerrar(toast);

        contenedor.appendChild(toast);

        // Animación de entrada
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.opacity = "1";
                toast.style.transform = "translateX(0)";
            });
        });

        // Auto-cerrar
        const timer = setTimeout(() => cerrar(toast), duracion);
        toast._timer = timer;

        return toast;
    }

    function cerrar(toast) {
        clearTimeout(toast._timer);
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        setTimeout(() => toast.remove(), 250);
    }

    return {
        success: (msg, dur) => mostrar(msg, "success", dur),
        error:   (msg, dur) => mostrar(msg, "error",   dur || 5000),
        warning: (msg, dur) => mostrar(msg, "warning", dur),
        info:    (msg, dur) => mostrar(msg, "info",    dur)
    };
})();

// ── LOADING STATE EN BOTONES ──────────────────────────────────────────────
// Uso: const restaurar = window.btnLoading(btn, "Guardando...");
// Después: restaurar();

window.btnLoading = function(boton, textoLoading = "Procesando...") {
    if (!boton) return () => {};
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px">
            <svg style="animation:spin 1s linear infinite;width:14px;height:14px" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/>
            </svg>
            ${textoLoading}
        </span>
    `;
    boton.style.opacity = "0.75";
    boton.style.cursor  = "not-allowed";

    // Inyectar la animación de spin si no existe
    if (!document.getElementById("spinStyle")) {
        const style = document.createElement("style");
        style.id = "spinStyle";
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    return function restaurar() {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
        boton.style.opacity = "1";
        boton.style.cursor  = "pointer";
    };
};

// ── REEMPLAZAR alert() GLOBAL ─────────────────────────────────────────────
// Intercepta todos los alert() del sistema y los convierte en toasts
// Sin tocar ningún otro archivo
;(function() {
    const alertOriginal = window.alert.bind(window);
    window.alert = function(mensaje) {
        if (typeof mensaje !== "string") {
            alertOriginal(mensaje);
            return;
        }
        const msg = mensaje.toLowerCase();
        if (msg.includes("❌") || msg.includes("error") || msg.includes("no se pudo") || msg.includes("falló")) {
            window.toast.error(mensaje);
        } else if (msg.includes("⚠️") || msg.includes("advertencia") || msg.includes("cuidado") || msg.includes("bloqueó")) {
            window.toast.warning(mensaje);
        } else if (msg.includes("✅") || msg.includes("éxito") || msg.includes("correcto") || msg.includes("guardado") || msg.includes("baja")) {
            window.toast.success(mensaje);
        } else {
            window.toast.info(mensaje);
        }
    };
})();

// ── REEMPLAZAR confirm() CON MODAL ELEGANTE ───────────────────────────────
// Uso: const ok = await window.confirmar("¿Estás seguro?");
window.confirmar = function(mensaje, textoConfirmar = "Confirmar", textoColor = "rose") {
    return new Promise((resolve) => {
        const coloresBtn = {
            rose:    "background:#881337;color:#fda4af;border:1px solid #be123c",
            emerald: "background:#052e16;color:#4ade80;border:1px solid #16a34a",
            indigo:  "background:#1e1b4b;color:#a5b4fc;border:1px solid #4f46e5"
        };
        const estiloBtn = coloresBtn[textoColor] || coloresBtn.rose;

        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:9998;
            background:rgba(2,6,23,0.85);
            backdrop-filter:blur(4px);
            display:flex;align-items:center;justify-content:center;padding:16px;
        `;

        overlay.innerHTML = `
            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:16px;
                        padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.6);
                        font-family:sans-serif;">
                <p style="color:#e2e8f0;font-size:14px;line-height:1.6;margin-bottom:20px;">${mensaje}</p>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button id="confirmCancelar"
                        style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                               background:#1e293b;color:#94a3b8;border:1px solid #334155;">
                        Cancelar
                    </button>
                    <button id="confirmAceptar"
                        style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                               ${estiloBtn}">
                        ${textoConfirmar}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("#confirmAceptar").onclick = () => {
            overlay.remove(); resolve(true);
        };
        overlay.querySelector("#confirmCancelar").onclick = () => {
            overlay.remove(); resolve(false);
        };
        overlay.onclick = (e) => {
            if (e.target === overlay) { overlay.remove(); resolve(false); }
        };
    });
};
// js/init.js
window.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 Iniciando sistema...");

    // 1. Motor de navegación
    window.cambiarPantalla = (id) => {
        document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    };

    // 2. Control de seguridad con TU localStorage
    const token = localStorage.getItem("token");
    if (!token) {
        console.warn("⚠️ No hay token en el localStorage. Redirigiendo al login...");
        window.location.href = "login.html"; // Cambiá esto por el nombre de tu archivo de login
        return; 
    }

    // 3. Carga inicial segura
    try {
        if (typeof cargarProductos === 'function') await cargarProductos();
        if (typeof cargarHistorialVentas === 'function') await cargarHistorialVentas();
        if (typeof cargarUsuarios === 'function') await cargarUsuarios();
        if (typeof window.cargarStockCritico === 'function') await window.cargarStockCritico();
        
        // Pantalla inicial por defecto
        window.cambiarPantalla('seccion-ventas');
        window.inicializarSeguridad();
        console.log("🎉 ¡Todo el sistema sincronizado con éxito!");
    } catch (error) {
        console.error("❌ Error en el arranque del sistema:", error);
    }
});

// =========================================================================
// 🔐 MÓDULO DE ROLES Y SEGURIDAD
// =========================================================================

// ── Leer el rol del usuario desde el localStorage ────────────────────────
window.obtenerRolUsuario = function() {
    try {
        const usuarioRaw = localStorage.getItem("usuario");
        if (!usuarioRaw) return null;
        const usuario = JSON.parse(usuarioRaw);
        // Tu AuthController guarda: { Nombre, Email, Rol }
        return (usuario.Rol ?? usuario.rol ?? "").toLowerCase();
    } catch {
        return null;
    }
};

window.esAdmin = function() {
    return window.obtenerRolUsuario() === "administrador";
};

// ── Aplicar restricciones visuales según el rol ───────────────────────────
window.aplicarRestriccionesRol = function() {
    const rol = window.obtenerRolUsuario();
    console.log(`🔐 Rol detectado: ${rol}`);

    if (rol === "administrador") {
        // Admin ve todo — no hay nada que ocultar
        console.log("✅ Acceso total — Administrador");
        return;
    }

    // ── Empleado: ocultar todo excepto Punto de Venta ────────────────────

    // 1. Ocultar botones del nav (Inventario, Personal, Estadísticas, Caja)
    const botonesRestringidos = [
        "btnNavInventario",
        "btnNavPersonal",
        "btnNavEstadisticas",
        "btnNavCaja"
    ];
    botonesRestringidos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    // 2. Ocultar secciones completas
    ["seccion-productos", "seccion-usuarios", "seccion-estadisticas"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    // 3. Ocultar el historial de ventas dentro de seccion-ventas
    const historial = document.getElementById("seccionHistorialVentas");
    if (historial) historial.classList.add("hidden");

    // 4. Ocultar botones de acción dentro del inventario (por si navega directo)
    ["btnBorrarProducto", "btnAgregarCategoria"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    console.log("🔒 Modo Empleado — solo Punto de Venta habilitado");
};

// ── Cerrar sesión ─────────────────────────────────────────────────────────
window.cerrarSesion = function() {
    if (!confirm("¿Estás seguro de que querés cerrar la sesión?")) return;
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "login.html";
};

// ── Mostrar nombre del usuario logueado en el header ─────────────────────
window.mostrarUsuarioActual = function() {
    try {
        const usuarioRaw = localStorage.getItem("usuario");
        if (!usuarioRaw) return;
        const usuario = JSON.parse(usuarioRaw);
        const nombre = usuario.Nombre ?? usuario.nombre ?? "Usuario";
        const rol    = usuario.Rol    ?? usuario.rol    ?? "Empleado";

        const contenedor = document.getElementById("usuarioActualHeader");
        if (contenedor) {
            contenedor.innerHTML = `
                <span class="text-xs text-slate-400">
                    👤 <strong class="text-slate-200">${nombre}</strong>
                    <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        rol.toLowerCase() === "administrador"
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "bg-slate-700 text-slate-300"
                    }">${rol}</span>
                </span>
            `;
        }
    } catch (e) {
        console.warn("No se pudo mostrar el usuario:", e);
    }
};

// ── Inicializar seguridad al cargar ──────────────────────────────────────
window.inicializarSeguridad = function() {
    window.mostrarUsuarioActual();
    window.aplicarRestriccionesRol();
};

// =========================================================================
// 📱 PWA — Registro del Service Worker + Banner de instalación
// =========================================================================

// ── Registrar el Service Worker ───────────────────────────────────────────
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const registro = await navigator.serviceWorker.register("/sw.js");
            console.log("✅ [PWA] Service Worker registrado:", registro.scope);

            // Detectar actualizaciones disponibles
            registro.addEventListener("updatefound", () => {
                const nuevoSW = registro.installing;
                nuevoSW?.addEventListener("statechange", () => {
                    if (nuevoSW.statechange === "installed" && navigator.serviceWorker.controller) {
                        window.toast?.info("🔄 Nueva versión disponible. Recargá para actualizar.");
                    }
                });
            });

        } catch (error) {
            console.warn("⚠️ [PWA] Service Worker no pudo registrarse:", error);
        }
    });
}

// ── Banner de instalación ─────────────────────────────────────────────────
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar el banner de instalación después de 3 segundos
    setTimeout(() => {
        mostrarBannerInstalacion();
    }, 3000);
});

function mostrarBannerInstalacion() {
    // No mostrar si ya está instalada
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (document.getElementById("pwaBanner")) return;

    const banner = document.createElement("div");
    banner.id = "pwaBanner";
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        background: #0f172a;
        border: 1px solid #6366f1;
        border-radius: 16px;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 8px 32px rgba(99,102,241,0.3);
        max-width: 360px;
        width: calc(100% - 40px);
        animation: slideUp 0.3s ease;
        font-family: sans-serif;
    `;

    banner.innerHTML = `
        <span style="font-size:28px;flex-shrink:0">👕</span>
        <div style="flex:1">
            <p style="color:#f8fafc;font-size:13px;font-weight:700;margin:0 0 2px">
                Instalar Space Terminal
            </p>
            <p style="color:#64748b;font-size:11px;margin:0">
                Agregá el sistema a tu pantalla de inicio
            </p>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
            <button onclick="document.getElementById('pwaBanner').remove()"
                style="background:#1e293b;color:#94a3b8;border:1px solid #334155;
                       border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer">
                Ahora no
            </button>
            <button onclick="window.instalarPWA()"
                style="background:#6366f1;color:white;border:none;
                       border-radius:8px;padding:6px 12px;font-size:12px;
                       font-weight:700;cursor:pointer">
                Instalar
            </button>
        </div>
    `;

    // Inyectar animación
    if (!document.getElementById("pwaStyle")) {
        const style = document.createElement("style");
        style.id = "pwaStyle";
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    // Auto-cerrar después de 15 segundos
    setTimeout(() => banner.remove(), 15000);
}

window.instalarPWA = async function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const resultado = await deferredPrompt.userChoice;
    console.log(`📱 [PWA] Instalación: ${resultado.outcome}`);
    deferredPrompt = null;
    document.getElementById("pwaBanner")?.remove();

    if (resultado.outcome === "accepted") {
        window.toast?.success("✅ ¡Space Terminal instalado con éxito!");
    }
};

// ── Detectar si ya está corriendo como PWA instalada ─────────────────────
window.addEventListener("load", () => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
        console.log("📱 [PWA] Corriendo como app instalada");
        document.documentElement.style.setProperty("--safe-area-bottom", "env(safe-area-inset-bottom)");
    }
});