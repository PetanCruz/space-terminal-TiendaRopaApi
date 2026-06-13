// =========================================================================
// 🏛️ FACTURAS CONTROLLER — Stub para ARCA
// Creá este archivo en Controllers/FacturasController.cs
// Cuando el cliente tenga sus credenciales ARCA, se reemplaza por la versión completa
// =========================================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FacturasController : ControllerBase
    {
        private readonly IConfiguration _config;

        public FacturasController(IConfiguration config)
        {
            _config = config;
        }

        // GET /api/facturas/estado
        // Informa si ARCA está configurado para mostrar u ocultar el botón
        [HttpGet("estado")]
        public IActionResult GetEstado()
        {
            var cuit = _config["ARCA:CUIT"];
            var cert = _config["ARCA:CertificadoPath"];

            // Si no hay CUIT ni certificado configurados, ARCA está inactivo
            var configurado = !string.IsNullOrWhiteSpace(cuit) &&
                              !string.IsNullOrWhiteSpace(cert) &&
                              System.IO.File.Exists(cert ?? "");

            return Ok(new {
                configurado,
                mensaje = configurado
                    ? "ARCA configurado y listo."
                    : "ARCA no configurado. Requiere certificado digital y CUIT."
            });
        }

        // POST /api/facturas/autorizar
        // PENDIENTE: se implementa cuando el cliente tenga credenciales ARCA
        [HttpPost("autorizar")]
        public IActionResult AutorizarFactura()
        {
            return StatusCode(503, new {
                mensaje = "La facturación electrónica con ARCA aún no está activada en este sistema.",
                instrucciones = "Contactá al desarrollador para activar este módulo."
            });
        }
    }
}