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
    public class VentasController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public VentasController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. REGISTRAR UNA VENTA (Modificado para aceptar descuentos/precios del frontend)
        [HttpPost]
        public async Task<IActionResult> RegistrarVenta([FromBody] VentaRequest request)
        {
            if (request.Items == null || !request.Items.Any())
            {
                return BadRequest(new { mensaje = "La venta debe contener al menos un producto." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var nuevaVenta = new Venta
                {
                    FechaHora = DateTime.Now,
                    MetodoPago = request.MetodoPago,
                    Comentarios = request.Comentarios,
                    ClienteId  = request.ClienteId,
                    SucursalId = request.SucursalId, // 🌟 AGREGADO
                    Total = 0
                };

                _context.Ventas.Add(nuevaVenta);
                await _context.SaveChangesAsync();

                decimal totalVenta = 0;

                foreach (var item in request.Items)
                {
                    var variante = await _context.ProductoVariantes
                        .Include(v => v.Producto)
                        .FirstOrDefaultAsync(v => v.Id == item.VarianteId);

                    if (variante == null)
                    {
                        return NotFound(new { mensaje = $"La variante con ID {item.VarianteId} no existe." });
                    }

                    // 🌟 CAMBIO: Buscamos el stock en la nueva tabla usando la sucursal
                    var stockSucursal = await _context.StockSucursales
                        .FirstOrDefaultAsync(s => s.VarianteId == item.VarianteId && s.SucursalId == request.SucursalId);

                    if (stockSucursal == null || stockSucursal.StockActual < item.Cantidad)
                    {
                        return BadRequest(new { 
                            mensaje = $"Stock insuficiente en esta sucursal para {variante.Producto?.Nombre}. Disponibles: {(stockSucursal != null ? stockSucursal.StockActual : 0)}" 
                        });
                    }

                    // 🌟 CAMBIO: Descontamos a la sucursal, ya no a la variante global
                    stockSucursal.StockActual -= item.Cantidad; 

                    // 🌟 RECALCULO INTELIGENTE: Si el frontend mandó un precio (con descuento), usamos ese. 
                    // Si no mandó nada (o es 0), usa el precio de venta original de la Base de Datos.
                    decimal precioUnitario = (item.Precio.HasValue && item.Precio.Value > 0) 
                        ? item.Precio.Value 
                        : (variante.Producto?.PrecioVenta ?? 0);

                    totalVenta += precioUnitario * item.Cantidad;

                    var detalle = new VentaDetalle
                    {
                        VentaId = nuevaVenta.Id,
                        VarianteId = variante.Id,
                        Cantidad = item.Cantidad,
                        PrecioUnitario = precioUnitario
                    };

                    _context.VentaDetalles.Add(detalle);
                }

                nuevaVenta.Total = totalVenta;
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new { mensaje = "Venta registrada con éxito", ventaId = nuevaVenta.Id, total = totalVenta });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { mensaje = "Error interno al procesar la venta", detalle = ex.Message });
            }
        }

        // 2. VER HISTORIAL DE VENTAS
        [HttpGet]
        [Authorize(Roles = "administrador")]
        public async Task<ActionResult<IEnumerable<Venta>>> GetVentas()
        {
            var ventas = await _context.Ventas
                .OrderByDescending(v => v.FechaHora)
                .ToListAsync();

            return Ok(ventas);
        }

        // 3. VER DETALLE DE UNA VENTA ESPECÍFICA (Modificado para enviar precio original)
        [HttpGet("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> GetVentaDetalle(int id)
        {
            var venta = await _context.Ventas.FindAsync(id);
            if (venta == null) return NotFound(new { mensaje = "La venta no existe." });

            var detalles = await _context.VentaDetalles
            .Where(d => d.VentaId == id)
            .Include(d => d.ProductoVariante)
            .ThenInclude(pv => pv!.Producto)
            .Select(d => new {
            d.Id,
            ProductoNombre = d.ProductoVariante != null && d.ProductoVariante.Producto != null ? d.ProductoVariante.Producto.Nombre : "Producto Eliminado",
            Talle = d.ProductoVariante != null ? d.ProductoVariante.Talle : "",
            Color = d.ProductoVariante != null ? d.ProductoVariante.Color : "",
            d.Cantidad,
            d.PrecioUnitario, // El precio con descuento que se cobró
            
            // 🌟 AGREGADO: Traemos el precio de lista original del producto
            PrecioOriginal = d.ProductoVariante != null && d.ProductoVariante.Producto != null ? d.ProductoVariante.Producto.PrecioVenta : d.PrecioUnitario,
            
            Subtotal = d.Cantidad * d.PrecioUnitario
        })
        .ToListAsync();

    return Ok(new {
        InformacionVenta = venta,
        ArticulosComprados = detalles
    });
}

        // 4. REPORTE GENERAL DE FACTURACIÓN
        [HttpGet("dashboard/resumen")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> GetResumenVentas()
        {
            var totalVendido = await _context.Ventas.SumAsync(v => v.Total);
            var cantidadVentas = await _context.Ventas.CountAsync();
            
            var porMetodoPago = await _context.Ventas
                .GroupBy(v => v.MetodoPago)
                .Select(g => new {
                    Metodo = g.Key,
                    TotalRecaudado = g.Sum(v => v.Total),
                    Operaciones = g.Count()
                })
                .ToListAsync();

            return Ok(new {
                CajaTotal = totalVendido,
                VentasTotales = cantidadVentas,
                DetalleMediosPago = porMetodoPago
            });
        }
    }

    // Modelos auxiliares para el POST
    public class VentaRequest
    {
        public string MetodoPago { get; set; } = string.Empty;
        public string? Comentarios { get; set; }
        public int? ClienteId { get; set; }
        public int SucursalId { get; set; } = 1;
        public List<VentaItemRequest> Items { get; set; } = new();
    }

    public class VentaItemRequest
    {
        public int VarianteId { get; set; }
        public int Cantidad { get; set; }
        public decimal? Precio { get; set; } // 🌟 AGREGADO: Para que .NET pueda recibir el precio del JS
    }
}