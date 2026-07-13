// js/usuarios.js

// 1. CARGAR Y LISTAR USUARIOS
window.cargarUsuarios = async function() {
    try {
        const token = localStorage.getItem("token");
        const respuesta = await fetch(`${API_URL}/usuarios`, { 
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);

        const usuarios = await respuesta.json();
        const tbody = document.getElementById("tablaUsuariosBody");
        
        if (!tbody) return;
        tbody.innerHTML = ""; 

        usuarios.forEach(usuario => {
            tbody.innerHTML += `
                <tr class="hover:bg-slate-750 transition-colors border-b border-slate-700/50">
                    <td class="p-4 text-slate-500 text-sm">${usuario.id}</td>
                    <td class="p-4 font-medium text-white">${usuario.nombre}</td>
                    <td class="p-4 text-slate-400">${usuario.email}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${usuario.rol === 'administrador' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-700 text-slate-300'}">
                            ${usuario.rol || 'Empleado'}
                        </span>
                    </td>
                    <td class="p-4">
                        <button onclick="eliminarUsuario(${usuario.id}, '${usuario.nombre}')" class="text-rose-400 hover:text-rose-300 font-medium text-sm bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-all">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        console.log("✅ Lista de usuarios sincronizada.");

    } catch (error) {
        console.error("Error al obtener usuarios:", error);
    }
};

// 2. ELIMINAR USUARIO
window.eliminarUsuario = async function(id, nombre) {
    if (!confirm(`¿Estás seguro de que querés eliminar al usuario "${nombre}"?`)) {
        return; 
    }

    try {
        const token = localStorage.getItem("token");
        const respuesta = await fetch(`${API_URL}/usuarios/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!respuesta.ok) throw new Error("No se pudo eliminar el usuario.");

        alert("Usuario eliminado con éxito.");
        await cargarUsuarios(); // Recargar la tabla automáticamente

    } catch (error) {
        console.error("Error al eliminar:", error);
        alert("Hubo un error al intentar eliminar al usuario.");
    }
};

// 3. CONTROL DEL MODAL (ABRIR / CERRAR)
window.abrirModalUsuario = function() {
    document.getElementById("modalUsuario").classList.remove("hidden");
    window.cargarSucursalesSelect();
};

window.cerrarModalUsuario = function() {
    document.getElementById("modalUsuario").classList.add("hidden");
    document.getElementById("formUsuario").reset(); // Limpia los inputs al cerrar
};

// 4. GUARDAR NUEVO USUARIO (CONEXIÓN CON API/AUTH/REGISTRAR)
window.guardarUsuario = async function(event) {
    event.preventDefault(); // Evita que la página se recargue

    const nombre = document.getElementById("usuarioNombre").value;
    const email = document.getElementById("usuarioEmail").value;
    const password = document.getElementById("usuarioPassword").value;
    const rol = document.getElementById("usuarioRol").value;
    // NUEVO: Capturamos la sucursal elegida
    const sucursalId = document.getElementById("usuarioSucursal").value; 

    try {
        const respuesta = await fetch(`${API_URL}/auth/registrar`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // NUEVO: Enviamos el sucursalId (convertido a número) junto con el resto
            body: JSON.stringify({ 
                nombre, 
                email, 
                password, 
                rol, 
                sucursalId: parseInt(sucursalId) 
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.mensaje || "Error al registrar.");
        }

        alert("🎉 Usuario registrado con éxito en su sucursal.");
        cerrarModalUsuario();
        await cargarUsuarios(); // Actualiza la lista en tiempo real

    } catch (error) {
        console.error("Error al registrar usuario:", error);
        alert(error.message || "No se pudo crear el usuario.");
    }
};

// 5. CARGAR SUCURSALES DINÁMICAMENTE
window.cargarSucursalesSelect = async function() {
    try {
        const respuesta = await fetch(`${API_URL}/sucursales`);
        const sucursales = await respuesta.json();
        
        const select = document.getElementById("usuarioSucursal");
        const contenedor = document.getElementById("contenedorSucursal");
        
        select.innerHTML = ""; // Limpiamos opciones viejas

        if (sucursales.length <= 1) {
            // MAGIA: Si hay 1 sola sucursal (ej: Ferretería), se oculta visualmente
            contenedor.classList.add("hidden");
            if (sucursales.length === 1) {
                // Pero dejamos su ID guardado en secreto
                select.innerHTML = `<option value="${sucursales[0].id}">${sucursales[0].nombre}</option>`;
            }
        } else {
            // MAGIA 2: Si hay varias (ej: Monteros y San Miguel), le mostramos el menú al dueño
            contenedor.classList.remove("hidden");
            sucursales.forEach(s => {
                select.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
            });
        }
    } catch (error) {
        console.error("Error al buscar sucursales:", error);
    }
};