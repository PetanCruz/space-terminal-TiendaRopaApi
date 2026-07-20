// =========================================================================
// ⚙️ MÓDULO EMPRESA (CONFIGURACIÓN CON LOGO DINÁMICO)
// =========================================================================

window.cargarDatosEmpresa = async function() {
    try {
        // 1. EL TRUCO INVISIBLE: Llamamos a la instalación en segundo plano.
        await fetch(`${API_URL}/empresa/instalar`).catch(() => {});

        // 2. Traer los datos reales
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresa`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 🌟 Recuperamos el config viejo por si la base de datos de C# aún no tiene la columna "logo"
        const configLocal = JSON.parse(localStorage.getItem("configEmpresa")) || {};

        if (response.ok) {
            const data = await response.json();
            
            if (data && data.nombre) {
                document.getElementById('empresaNombre').value = data.nombre || '';
                document.getElementById('empresaCuit').value = data.cuit || '';
                document.getElementById('empresaDireccion').value = data.direccion || '';
                document.getElementById('empresaTelefono').value = data.telefono || '';
                document.getElementById('empresaMensaje').value = data.mensajeTicket || '';
                
                // 🌟 Buscamos el logo en la API, y si no está, usamos el que quedó en memoria
                const logoGuardado = data.logo || configLocal.logo || '';
                if(document.getElementById('empresaLogo')) {
                    document.getElementById('empresaLogo').value = logoGuardado;
                }
                
                // 3. Guardamos todo en memoria para que Ventas y PDFs lo puedan leer
                localStorage.setItem("configEmpresa", JSON.stringify({
                    nombreFantasia: data.nombre,
                    razonSocial: data.nombre, 
                    cuit: `CUIT: ${data.cuit}`,
                    direccion: data.direccion,
                    telefono: `Tel: ${data.telefono}`,
                    mensajeTicket: data.mensajeTicket || "¡Gracias por su compra!",
                    logo: logoGuardado // 🔥 Guardamos el logo
                }));

                window.aplicarBrandingEmpresa(); // Disparamos el cambio visual
            }
        }
    } catch (error) {
        console.error("Error al cargar datos de empresa:", error);
    }
};

window.guardarDatosEmpresa = async function(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    const btn = e.submitter;
    const restaurarBtn = window.btnLoading ? window.btnLoading(btn, "Guardando...") : () => {};

    // 🌟 Leemos el nuevo input del logo
    const logoInput = document.getElementById('empresaLogo') ? document.getElementById('empresaLogo').value.trim() : '';

    const payload = {
        nombre: document.getElementById('empresaNombre').value,
        cuit: document.getElementById('empresaCuit').value,
        direccion: document.getElementById('empresaDireccion').value,
        telefono: document.getElementById('empresaTelefono').value,
        email: "sin-email@local.com", 
        mensajeTicket: document.getElementById('empresaMensaje').value || "¡Gracias por su compra!",
        logo: logoInput // 🔥 Lo mandamos a la API (si C# lo ignora, no pasa nada)
    };

    try {
        const response = await fetch(`${API_URL}/empresa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            if(window.toast) {
                window.toast.success("Datos del negocio actualizados correctamente.");
            } else {
                alert("✅ Datos guardados con éxito.");
            }

            // Actualizamos la memoria local al instante
            localStorage.setItem("configEmpresa", JSON.stringify({
                nombreFantasia: payload.nombre,
                razonSocial: payload.nombre,
                cuit: `CUIT: ${payload.cuit}`,
                direccion: payload.direccion,
                telefono: `Tel: ${payload.telefono}`,
                mensajeTicket: payload.mensajeTicket,
                logo: payload.logo // 🔥 Refrescamos el logo en memoria
            }));

            window.aplicarBrandingEmpresa();
            
        } else {
            if(window.toast) window.toast.error("Error al guardar la configuración.");
        }
    } catch (error) {
        if(window.toast) window.toast.error("Problema de conexión al guardar.");
    } finally {
        restaurarBtn();
    }
};

window.aplicarBrandingEmpresa = function() {
    const configRaw = localStorage.getItem("configEmpresa");
    if (configRaw) {
        const config = JSON.parse(configRaw);
        const nombreLocal = config.nombreFantasia || "SPACE TERMINAL";
        
        const brandLogo = document.getElementById("brandLogoText");
        if (brandLogo) {
            brandLogo.innerText = nombreLocal; 
        }
        
        const brandTitle = document.getElementById("brandTitle");
        if (brandTitle) {
            brandTitle.innerText = `${nombreLocal} - Sistema POS`;
        }

        // 🌟 LA MAGIA DEL LOGO EN EL MENÚ LATERAL
        const brandIconContainer = document.getElementById("brandLogoIcon")?.parentElement;
        if (brandIconContainer && config.logo) {
            brandIconContainer.innerHTML = `<img src="${config.logo}" alt="Logo" class="w-full h-full object-cover rounded-lg">`;
            brandIconContainer.classList.remove("bg-gradient-to-br", "from-indigo-500", "to-purple-600");
            brandIconContainer.classList.add("bg-transparent", "border-transparent");
        } else if (brandIconContainer && !config.logo) {
            // Si borran el logo, vuelve la remera original
            brandIconContainer.innerHTML = `<span id="brandLogoIcon">👕</span>`;
            brandIconContainer.classList.add("bg-gradient-to-br", "from-indigo-500", "to-purple-600");
            brandIconContainer.classList.remove("bg-transparent", "border-transparent");
        }
    }
};

// Que se ejecute apenas arranca el sistema para pintar el menú
document.addEventListener("DOMContentLoaded", () => {
    window.aplicarBrandingEmpresa();
});