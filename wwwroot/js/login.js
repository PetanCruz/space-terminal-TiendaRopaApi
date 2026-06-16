const URL_API = "https://space-terminal-tiendaropaapi-production.up.railway.app/api/auth/login"; // <-- Asegurate de que este sea el puerto de tu API

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const divMensaje = document.getElementById("mensaje");

    // Limpiar mensajes anteriores
    divMensaje.classList.add("hidden");
    divMensaje.className = "mt-4 text-center text-sm font-semibold";

    try {
        const respuesta = await fetch(URL_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // ¡Login exitoso! Guardamos el token y los datos del usuario en el navegador
            localStorage.setItem("token", resultado.token);
            localStorage.setItem("usuario", JSON.stringify(resultado.usuario));

            divMensaje.textContent = "¡Ingreso correcto! Redireccionando...";
            divMensaje.classList.remove("hidden");
            divMensaje.classList.add("text-emerald-400");

            // Simulamos una demora de 1.5 segundos y pasamos al mostrador
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);

        } else {
            // La API rechazó las credenciales
            divMensaje.textContent = resultado.mensaje || "Error al iniciar sesión.";
            divMensaje.classList.remove("hidden");
            divMensaje.classList.add("text-rose-400");
        }

    } catch (error) {
        // La API está apagada o no se pudo conectar
        divMensaje.textContent = "No se pudo conectar con el servidor. ¿La API está corriendo?";
        divMensaje.classList.remove("hidden");
        divMensaje.classList.add("text-rose-400");
    }
});