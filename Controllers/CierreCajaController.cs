using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CierreCajaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CierreCajaController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. REGISTRAR CIERRE DE CAJA
        [HttpPost]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> RegistrarCierre([FromBody] CierreCaja cierre)
        {
            try
            {
                cierre.Fecha = DateTime.Now;
                _context.CierresCaja.Add(cierre);
                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Cierre registrado correctamente.", id = cierre.Id });
            }
            catch (Exception ex)
            {
                // 🌟 MAGIA: Si la base de datos choca, le mandamos el texto exacto del error al cartel rojo del frontend
                string errorReal = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, $"Error en BD: {errorReal}");
            }
        }

        // 2. HISTORIAL DE CIERRES (últimos 30 de la sucursal actual)
        [HttpGet]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> GetCierres([FromQuery] int sucursalId = 1)
        {
            var cierres = await _context.CierresCaja
                .Where(c => c.SucursalId == sucursalId)
                .OrderByDescending(c => c.Fecha)
                .Take(30)
                .ToListAsync();
            return Ok(cierres);
        }

        // 3. RESUMEN DEL TURNO ACTUAL (Calcula desde el último cierre para volver a $0)
        [HttpGet("resumen-hoy")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> GetResumenHoy([FromQuery] int sucursalId = 1)
        {
            // 🌟 Buscamos cuándo fue la ÚLTIMA vez que cerraron ESTA caja
            var ultimoCierre = await _context.CierresCaja
                .Where(c => c.SucursalId == sucursalId)
                .OrderByDescending(c => c.Fecha)
                .FirstOrDefaultAsync();

            // Si hay un cierre anterior, contamos desde esa hora. Si es nueva, desde las 00:00 de hoy.
            DateTime fechaInicio = ultimoCierre != null ? ultimoCierre.Fecha : DateTime.Today;

            // 🌟 Traemos solo las ventas que se hicieron DESPUÉS del último cierre
            var ventasNuevas = await _context.Ventas
                .Where(v => v.SucursalId == sucursalId 
                            && v.FechaHora > fechaInicio 
                            && !v.MetodoPago.ToLower().Contains("cuenta corriente")
                            && !v.MetodoPago.ToLower().Contains("fiado"))
                .ToListAsync();

            var resumen = new
            {
                TotalEfectivo       = ventasNuevas.Where(v => v.MetodoPago.ToLower().Contains("efectivo")).Sum(v => v.Total),
                TotalTransferencia  = ventasNuevas.Where(v => v.MetodoPago.ToLower().Contains("transfer") || v.MetodoPago.ToLower().Contains("qr")).Sum(v => v.Total),
                TotalDebito         = ventasNuevas.Where(v => v.MetodoPago.ToLower().Contains("débito") || v.MetodoPago.ToLower().Contains("debito")).Sum(v => v.Total),
                TotalCredito        = ventasNuevas.Where(v => v.MetodoPago.ToLower().Contains("crédito") || v.MetodoPago.ToLower().Contains("credito") || v.MetodoPago.ToLower().Contains("tarjeta")).Sum(v => v.Total),
                TotalGeneral        = ventasNuevas.Sum(v => v.Total),
                CantidadVentas      = ventasNuevas.Count,
                FechaInicioTurno    = fechaInicio
            };

            return Ok(resumen);
        }

        // 🌟 CABALLO DE TROYA V2: Misil Rastreador Inteligente
        [HttpGet("forzar-parche")]
        [AllowAnonymous]
        public IActionResult ForzarParche()
        {
            try
            {
                string nombreTablaReal = "";
                
                // 1. Buscamos el nombre EXACTO de la tabla en la base de datos
                using (var command = _context.Database.GetDbConnection().CreateCommand())
                {
                    command.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) LIKE '%cierre%caja%';";
                    _context.Database.OpenConnection();
                    using (var result = command.ExecuteReader())
                    {
                        if (result.Read())
                        {
                            nombreTablaReal = result.GetString(0);
                        }
                    }
                }

                if (string.IsNullOrEmpty(nombreTablaReal))
                {
                    return Ok("❌ FRACASO: No se encontró ninguna tabla que se llame parecido a CierreCaja en tu servidor.");
                }

                // 2. Ahora que sabemos el nombre exacto (ej: 'CierreCajas'), le inyectamos la columna a la fuerza
                try 
                {
                    _context.Database.ExecuteSqlRaw($"ALTER TABLE `{nombreTablaReal}` ADD COLUMN SucursalId INT NOT NULL DEFAULT 1;");
                    return Ok($"✅ ÉXITO TOTAL: Encontré la tabla oculta (se llamaba '{nombreTablaReal}') y le inyecté la columna SucursalId perfectamente.");
                } 
                catch (Exception ex) 
                {
                    // Si tira error acá, es porque la tabla existe pero la columna ya se había inyectado antes
                    return Ok($"⚠️ AVISO: La tabla real es '{nombreTablaReal}'. Intenté inyectarle la columna pero me dijo: {ex.Message} (Probablemente ya la tenía).");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"❌ ERROR FATAL DEL MISIL: {ex.Message}");
            }
        }
    }
}