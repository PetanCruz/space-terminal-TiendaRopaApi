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
            cierre.Fecha = DateTime.Now;
            _context.CierresCaja.Add(cierre);
            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Cierre registrado correctamente.", id = cierre.Id });
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
    }
}