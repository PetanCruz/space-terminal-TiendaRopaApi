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
    public class PresupuestosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PresupuestosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. GUARDAR UN PRESUPUESTO
        [HttpPost]
        public async Task<IActionResult> CrearPresupuesto([FromBody] Presupuesto presupuesto)
        {
            try
            {
                // Configuración automática de seguridad
                presupuesto.FechaEmision = DateTime.Now;
                presupuesto.FechaVencimiento = DateTime.Now.AddDays(7); // Válido por 7 días
                presupuesto.Estado = "Pendiente";

                // Generamos un número de presupuesto aleatorio y único (Ej: PRE-845124)
                var random = new Random();
                presupuesto.NumeroPresupuesto = $"PRE-{random.Next(100000, 999999)}";

                _context.Presupuestos.Add(presupuesto);
                await _context.SaveChangesAsync();

                return Ok(new { 
                    mensaje = "Presupuesto guardado con éxito", 
                    id = presupuesto.Id, 
                    numero = presupuesto.NumeroPresupuesto 
                });
            }
            catch (Exception ex)
            {
                string errorReal = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, $"Error al guardar el presupuesto: {errorReal}");
            }
        }

        // 2. OBTENER TODOS LOS PRESUPUESTOS (Para verlos en el historial)
        [HttpGet]
        public async Task<IActionResult> GetPresupuestos([FromQuery] int sucursalId = 1)
        {
            var presupuestos = await _context.Presupuestos
                .Include(p => p.Detalles)
                .Where(p => p.SucursalId == sucursalId)
                .OrderByDescending(p => p.FechaEmision)
                .ToListAsync();

            return Ok(presupuestos);
        }

        // 3. OBTENER UN PRESUPUESTO ESPECÍFICO
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPresupuesto(int id)
        {
            var presupuesto = await _context.Presupuestos
                .Include(p => p.Detalles)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (presupuesto == null) return NotFound("Presupuesto no encontrado.");

            return Ok(presupuesto);
        }
    }
}