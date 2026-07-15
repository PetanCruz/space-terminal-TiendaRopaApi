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

        // 2. HISTORIAL DE CIERRES (últimos 30)
        [HttpGet]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> GetCierres()
        {
            var cierres = await _context.CierresCaja
                .OrderByDescending(c => c.Fecha)
                .Take(30)
                .ToListAsync();
            return Ok(cierres);
        }

        // 3. RESUMEN DEL DÍA ACTUAL (para calcular antes de cerrar)
        [HttpGet("resumen-hoy")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> GetResumenHoy()
        {
            var hoy = DateTime.Today;
            var manana = hoy.AddDays(1);

            // 🌟 NUEVO: Traemos las ventas de hoy, pero EXCLUIMOS las cuentas corrientes/fiados
            // porque no es dinero físico que haya entrado a la caja.
            var ventasHoy = await _context.Ventas
                .Where(v => v.FechaHora >= hoy && v.FechaHora < manana 
                            && !v.MetodoPago.ToLower().Contains("cuenta corriente")
                            && !v.MetodoPago.ToLower().Contains("fiado"))
                .ToListAsync();

            var resumen = new
            {
                TotalEfectivo       = ventasHoy.Where(v => v.MetodoPago.ToLower().Contains("efectivo"))
                                               .Sum(v => v.Total),
                TotalTransferencia  = ventasHoy.Where(v => v.MetodoPago.ToLower().Contains("transfer") ||
                                                           v.MetodoPago.ToLower().Contains("qr"))
                                               .Sum(v => v.Total),
                TotalDebito         = ventasHoy.Where(v => v.MetodoPago.ToLower().Contains("débito") ||
                                                           v.MetodoPago.ToLower().Contains("debito"))
                                               .Sum(v => v.Total),
                TotalCredito        = ventasHoy.Where(v => v.MetodoPago.ToLower().Contains("crédito") ||
                                                           v.MetodoPago.ToLower().Contains("credito") ||
                                                           v.MetodoPago.ToLower().Contains("tarjeta"))
                                               .Sum(v => v.Total),
                TotalGeneral        = ventasHoy.Sum(v => v.Total),
                CantidadVentas      = ventasHoy.Count,
                Fecha               = hoy
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