using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CuentasCorrientesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CuentasCorrientesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. Obtener historial y saldo de un cliente específico
        [HttpGet("{clienteId}")]
        public async Task<IActionResult> GetEstadoCuenta(int clienteId)
        {
            var cliente = await _context.Clientes.FindAsync(clienteId);
            if (cliente == null) return NotFound("Cliente no encontrado.");

            var movimientos = await _context.MovimientosCuenta
                .Where(m => m.ClienteId == clienteId)
                .OrderByDescending(m => m.FechaHora)
                .Select(m => new {
                    m.Id,
                    m.FechaHora,
                    m.Tipo,
                    m.Monto,
                    m.Detalle
                })
                .ToListAsync();

            // Lógica para la alerta del día 10 que pediste
            bool estaVencida = (DateTime.Now.Day > 10) && (cliente.SaldoCuentaCorriente > 0);

            return Ok(new {
                ClienteId = cliente.Id,
                Nombre = cliente.Nombre,
                Telefono = cliente.Telefono,
                SaldoTotal = cliente.SaldoCuentaCorriente,
                CuentaVencida = estaVencida, // Esto le dirá a tu JS si debe mostrar la alerta roja y el botón de WhatsApp
                Movimientos = movimientos
            });
        }

        // 2. Registrar un PAGO PARCIAL
        [HttpPost("{clienteId}/pagar")]
        public async Task<IActionResult> RegistrarPago(int clienteId, [FromBody] decimal montoPago)
        {
            if (montoPago <= 0) return BadRequest("El monto debe ser mayor a cero.");

            var cliente = await _context.Clientes.FindAsync(clienteId);
            if (cliente == null) return NotFound("Cliente no encontrado.");

            if (cliente.SaldoCuentaCorriente < montoPago)
                return BadRequest("El pago es mayor a la deuda actual.");

            // Descontamos la plata de la deuda
            cliente.SaldoCuentaCorriente -= montoPago;

            // Registramos el movimiento (esto sumará a la caja diaria luego)
            var movimiento = new MovimientoCuenta
            {
                ClienteId = clienteId,
                Tipo = "PAGO_PARCIAL",
                Monto = montoPago,
                Detalle = "Entrega a cuenta",
                FechaHora = DateTime.Now
            };

            _context.MovimientosCuenta.Add(movimiento);
            await _context.SaveChangesAsync();

            return Ok(new { 
                mensaje = "Pago registrado correctamente.",
                nuevoSaldo = cliente.SaldoCuentaCorriente 
            });
        }
    }
}