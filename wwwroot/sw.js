// =========================================================================
// 🔧 SERVICE WORKER — Space Terminal PWA
// Archivo: sw.js (va en la raíz de wwwroot)
// =========================================================================

const CACHE_NAME    = "space-terminal-v1";
const CACHE_ASSETS  = [
    "/login.html",
    "/dashboard.html",
    "/js/init.js",
    "/js/ventas.js",
    "/js/productos.js",
    "/js/usuarios.js",
    "/js/config.js",
    "/manifest.json",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    // Librerías externas cacheadas para funcionar sin CDN
    "https://cdn.tailwindcss.com",
    "https://cdn.jsdelivr.net/npm/chart.js"
];

// ── Instalación: cachear recursos estáticos ───────────────────────────────
self.addEventListener("install", event => {
    console.log("🔧 [SW] Instalando Space Terminal PWA...");
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cachear assets locales (críticos)
            return cache.addAll([
                "/login.html",
                "/dashboard.html",
                "/manifest.json",
                "/icons/icon-192.png",
                "/icons/icon-512.png"
            ]);
        }).then(() => {
            console.log("✅ [SW] Assets críticos cacheados");
            return self.skipWaiting();
        })
    );
});

// ── Activación: limpiar caches viejos ────────────────────────────────────
self.addEventListener("activate", event => {
    console.log("🚀 [SW] Space Terminal PWA activado");
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log(`🗑️ [SW] Eliminando cache viejo: ${key}`);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: estrategia Network First con fallback a cache ──────────────────
self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    // Las llamadas a la API siempre van a la red (nunca cachear datos dinámicos)
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Si la API no responde, devolver respuesta de error clara
                return new Response(
                    JSON.stringify({ mensaje: "Sin conexión al servidor." }),
                    { status: 503, headers: { "Content-Type": "application/json" } }
                );
            })
        );
        return;
    }

    // Para recursos estáticos: Network First, fallback a cache
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Si la red responde bien, actualizar cache y devolver
                if (response && response.status === 200 && response.type === "basic") {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Sin red: servir desde cache
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;

                    // Si es una navegación y no hay cache, mostrar página offline
                    if (event.request.mode === "navigate") {
                        return caches.match("/offline.html");
                    }
                });
            })
    );
});

// ── Mensaje para forzar actualización ────────────────────────────────────
self.addEventListener("message", event => {
    if (event.data === "skipWaiting") {
        self.skipWaiting();
    }
});
