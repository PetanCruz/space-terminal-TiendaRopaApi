// =========================================================================
// ⚙️ MÓDULO EMPRESA (CONFIGURACIÓN)
// =========================================================================

window.cargarDatosEmpresa = async function() {
    try {
        // 1. EL TRUCO INVISIBLE: Llamamos a la instalación en segundo plano.
        // Si la tabla no existe en la base de datos de Railway, se crea sola.
        // Si ya existe, falla en silencio y no molesta a nadie.
        await fetch(`${API_URL}/empresa/instalar`).catch(() => {});

        // 2. Traer los datos reales
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresa`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            
            // Si la base de datos nos devolvió información, llenamos los inputs
            if (data && data.nombre) {
                document.getElementById('empresaNombre').value = data.nombre || '';
                document.getElementById('empresaCuit').value = data.cuit || '';
                document.getElementById('empresaDireccion').value = data.direccion || '';
                document.getElementById('empresaTelefono').value = data.telefono || '';
                document.getElementById('empresaMensaje').value = data.mensajeTicket || '';
                
                // 3. LA MAGIA: Alimentamos tu código existente de PDFs
                // Guardamos en localStorage usando la misma estructura que espera tu archivo ventas.js
                localStorage.setItem("configEmpresa", JSON.stringify({
                    nombreFantasia: data.nombre,
                    razonSocial: data.nombre, // Usamos el mismo para simplificar
                    cuit: `CUIT: ${data.cuit}`,
                    direccion: data.direccion,
                    telefono: `Tel: ${data.telefono}`,
                    mensajeTicket: data.mensajeTicket || "¡Gracias por su compra!"
                }));
            }
        }
    } catch (error) {
        console.error("Error al cargar datos de empresa:", error);
    }
};

window.guardarDatosEmpresa = async function(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    // Usamos tu función de carga elegante del init.js
    const btn = e.submitter;
    const restaurarBtn = window.btnLoading ? window.btnLoading(btn, "Guardando...") : () => {};

    const payload = {
        nombre: document.getElementById('empresaNombre').value,
        cuit: document.getElementById('empresaCuit').value,
        direccion: document.getElementById('empresaDireccion').value,
        telefono: document.getElementById('empresaTelefono').value,
        email: "sin-email@local.com", // Por ahora lo dejamos fijo si no se usa
        mensajeTicket: document.getElementById('empresaMensaje').value || "¡Gracias por su compra!"
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
            // Usamos tu sistema de Toasts del init.js
            if(window.toast) {
                window.toast.success("Datos del negocio actualizados correctamente.");
            } else {
                alert("✅ Datos guardados con éxito.");
            }

            // Actualizamos la memoria local al instante para que el próximo ticket salga con estos datos
            localStorage.setItem("configEmpresa", JSON.stringify({
                nombreFantasia: payload.nombre,
                razonSocial: payload.nombre,
                cuit: `CUIT: ${payload.cuit}`,
                direccion: payload.direccion,
                telefono: `Tel: ${payload.telefono}`,
                mensajeTicket: payload.mensajeTicket
            }));
        } else {
            if(window.toast) window.toast.error("Error al guardar la configuración.");
        }
    } catch (error) {
        if(window.toast) window.toast.error("Problema de conexión al guardar.");
    } finally {
        restaurarBtn();
    }
};