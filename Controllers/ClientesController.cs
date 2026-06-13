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
    public class ClientesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ClientesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. LISTAR TODOS
        [HttpGet]
        public async Task<IActionResult> GetClientes()
        {
            var clientes = await _context.Clientes
                .Where(c => c.Activo)
                .OrderBy(c => c.Nombre)
                .Select(c => new {
                    c.Id, c.Nombre, c.Dni,
                    c.Telefono, c.Email,
                    c.PuntosAcumulados,
                    totalCompras = _context.Ventas
                        .Where(v => v.ClienteId == c.Id)
                        .Sum(v => (decimal?)v.Total) ?? 0,
                    cantidadVisitas = _context.Ventas
                        .Count(v => v.ClienteId == c.Id)
                })
                .ToListAsync();

            return Ok(clientes);
        }

        // 2. BUSCAR POR NOMBRE, DNI O TELÉFONO (para el buscador del punto de venta)
        [HttpGet("buscar")]
        public async Task<IActionResult> BuscarCliente([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new List<object>());

            var clientes = await _context.Clientes
                .Where(c => c.Activo && (
                    c.Nombre.Contains(q) ||
                    (c.Dni != null && c.Dni.Contains(q)) ||
                    (c.Telefono != null && c.Telefono.Contains(q))
                ))
                .Take(5) // Máximo 5 resultados para el autocomplete
                .Select(c => new { c.Id, c.Nombre, c.Dni, c.Telefono, c.Email })
                .ToListAsync();

            return Ok(clientes);
        }

        // 3. HISTORIAL DE COMPRAS DE UN CLIENTE
        [HttpGet("{id:int}/historial")]
        public async Task<IActionResult> GetHistorialCliente(int id)
        {
            var cliente = await _context.Clientes.FindAsync(id);
            if (cliente == null || !cliente.Activo)
                return NotFound(new { mensaje = "Cliente no encontrado." });

            var historial = await _context.Ventas
                .Where(v => v.ClienteId == id)
                .OrderByDescending(v => v.FechaHora)
                .Select(v => new {
                    v.Id,
                    v.FechaHora,
                    v.Total,
                    v.MetodoPago
                })
                .ToListAsync();

            return Ok(new {
                cliente = new { cliente.Id, cliente.Nombre, cliente.Telefono, cliente.Email, cliente.PuntosAcumulados },
                historial,
                totalGastado = historial.Sum(v => v.Total),
                cantidadVisitas = historial.Count
            });
        }

        // 4. CREAR CLIENTE
        [HttpPost]
        public async Task<IActionResult> PostCliente([FromBody] Cliente nuevoCliente)
        {
            // Verificar DNI duplicado
            if (!string.IsNullOrWhiteSpace(nuevoCliente.Dni)) {
                var dniExiste = await _context.Clientes
                    .AnyAsync(c => c.Dni == nuevoCliente.Dni && c.Activo);
                if (dniExiste)
                    return BadRequest(new { mensaje = "Ya existe un cliente con ese DNI." });
            }

            nuevoCliente.CreatedAt = DateTime.Now;
            _context.Clientes.Add(nuevoCliente);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Cliente registrado.", id = nuevoCliente.Id });
        }

        // 5. EDITAR CLIENTE
        [HttpPut("{id:int}")]
        public async Task<IActionResult> PutCliente(int id, [FromBody] Cliente datos)
        {
            var cliente = await _context.Clientes.FindAsync(id);
            if (cliente == null) return NotFound();

            cliente.Nombre   = datos.Nombre;
            cliente.Dni      = datos.Dni;
            cliente.Telefono = datos.Telefono;
            cliente.Email    = datos.Email;

            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Cliente actualizado." });
        }

        // 6. SOFT DELETE
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> DeleteCliente(int id)
        {
            var cliente = await _context.Clientes.FindAsync(id);
            if (cliente == null) return NotFound();

            cliente.Activo = false;
            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Cliente dado de baja." });
        }
    }
}