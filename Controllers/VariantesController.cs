using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VariantesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public VariantesController(ApplicationDbContext context)
        {
            _context = context;
        }
        
        // GET /api/variantes/buscar-codigo?codigo=779123456&sucursalId=1
        [HttpGet("buscar-codigo")]
        public async Task<IActionResult> BuscarPorCodigo([FromQuery] string codigo, [FromQuery] int sucursalId = 1)
        {
            if (string.IsNullOrWhiteSpace(codigo))
                return BadRequest(new { mensaje = "El código no puede estar vacío." });

            var variante = await _context.ProductoVariantes
                .Include(v => v.Producto)
                .FirstOrDefaultAsync(v => v.CodigoBarras == codigo && v.Producto!.Activo);

            if (variante == null)
                return NotFound(new { mensaje = $"No se encontró ninguna variante con el código {codigo}." });

            // 🌟 NUEVO: Buscamos el stock de esa prenda en la sucursal del cajero
            var stockSucursal = await _context.StockSucursales
                .FirstOrDefaultAsync(s => s.VarianteId == variante.Id && s.SucursalId == sucursalId);

            return Ok(new {
                id             = variante.Id,
                productoId     = variante.ProductoId,
                productoNombre = variante.Producto!.Nombre,
                talle          = variante.Talle,
                color          = variante.Color,
                codigoBarras   = variante.CodigoBarras,
                precioVenta    = variante.Producto.PrecioVenta,
                stockActual    = stockSucursal != null ? stockSucursal.StockActual : 0 // 🌟 MODIFICADO
            });
        }

        // GET /api/variantes/stock-critico?sucursalId=1
        [HttpGet("stock-critico")]
        public async Task<IActionResult> GetStockCritico([FromQuery] int sucursalId = 1)
        {
            // 🌟 NUEVO: Cruzamos la tabla vieja de variantes con la nueva de stock para armar el reporte
            var criticosRaw = await _context.ProductoVariantes
                .Include(v => v.Producto)
                .Where(v => v.Producto!.Activo)
                .Select(v => new {
                    variante = v,
                    stock = _context.StockSucursales.FirstOrDefault(s => s.VarianteId == v.Id && s.SucursalId == sucursalId)
                })
                .Where(x => x.stock != null && x.stock.StockActual <= x.stock.StockMinimo)
                .ToListAsync();

            var criticos = criticosRaw
                .OrderBy(x => x.stock!.StockActual)
                .Select(x => new {
                    varianteId   = x.variante.Id,
                    productoId   = x.variante.ProductoId,
                    producto     = x.variante.Producto!.Nombre,
                    talle        = x.variante.Talle,
                    color        = x.variante.Color,
                    stockActual  = x.stock!.StockActual,
                    stockMinimo  = x.stock!.StockMinimo
                }).ToList();

            return Ok(new {
                total    = criticos.Count,
                sinStock = criticos.Count(c => c.stockActual == 0),
                criticos
            });
        }

        // POST /api/variantes
        [HttpPost]
        [Authorize(Roles = "administrador")]   
        public async Task<IActionResult> PostVariante([FromBody] VarianteCreateRequestDto request)
        {
            var productoExiste = await _context.Productos
                .AnyAsync(p => p.Id == request.ProductoId && p.Activo);

            if (!productoExiste)
                return NotFound(new { mensaje = "El producto no existe o está inactivo." });

            var yaExiste = await _context.ProductoVariantes.AnyAsync(v =>
                v.ProductoId == request.ProductoId &&
                v.Talle.ToLower() == request.Talle.ToLower() &&
                v.Color.ToLower() == request.Color.ToLower()
            );

            if (yaExiste)
                return BadRequest(new { mensaje = $"Ya existe una variante {request.Talle} / {request.Color} para este producto." });

            using var transaction = await _context.Database.BeginTransactionAsync();
            
            try
            {
                var nuevaVariante = new ProductoVariante
                {
                    ProductoId = request.ProductoId,
                    Talle = request.Talle,
                    Color = request.Color,
                    CodigoBarras = request.CodigoBarras
                };

                _context.ProductoVariantes.Add(nuevaVariante);
                await _context.SaveChangesAsync();

                // 🌟 NUEVO: Guardamos el stock inicial de esta variante en la sucursal indicada
                var stockSucursal = new StockSucursal
                {
                    VarianteId = nuevaVariante.Id,
                    SucursalId = request.SucursalId,
                    StockActual = request.StockActual,
                    StockMinimo = request.StockMinimo
                };
                _context.StockSucursales.Add(stockSucursal);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return CreatedAtAction(nameof(PostVariante), new { id = nuevaVariante.Id }, new
                {
                    id            = nuevaVariante.Id,
                    productoId    = nuevaVariante.ProductoId,
                    talle         = nuevaVariante.Talle,
                    color         = nuevaVariante.Color,
                    codigoBarras  = nuevaVariante.CodigoBarras,
                    stockActual   = stockSucursal.StockActual,
                    stockMinimo   = stockSucursal.StockMinimo
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { mensaje = "Error interno al crear variante", detalle = ex.Message });
            }
        }

        // PUT /api/variantes/{id}/stock
        [HttpPut("{id:int}/stock")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> ActualizarStock(int id, [FromBody] ActualizarStockDto dto)
        {
            if (dto.StockActual < 0)
                return BadRequest(new { mensaje = "El stock no puede ser negativo." });

            // 🌟 NUEVO: Buscamos o creamos el registro de la sucursal
            var stockSucursal = await _context.StockSucursales
                .FirstOrDefaultAsync(s => s.VarianteId == id && s.SucursalId == dto.SucursalId);

            if (stockSucursal == null)
            {
                var varianteExiste = await _context.ProductoVariantes.AnyAsync(v => v.Id == id);
                if (!varianteExiste) return NotFound(new { mensaje = "Variante no encontrada." });

                stockSucursal = new StockSucursal
                {
                    VarianteId = id,
                    SucursalId = dto.SucursalId,
                    StockActual = dto.StockActual,
                    StockMinimo = 2
                };
                _context.StockSucursales.Add(stockSucursal);
            }
            else
            {
                stockSucursal.StockActual = dto.StockActual;
            }

            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Stock actualizado.", nuevoStock = stockSucursal.StockActual });
        }

        // DELETE /api/variantes/{id}
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> DeleteVariante(int id)
        {
            var variante = await _context.ProductoVariantes.FindAsync(id);
            if (variante == null)
                return NotFound(new { mensaje = "Variante no encontrada." });

            _context.ProductoVariantes.Remove(variante);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Variante eliminada correctamente." });
        }
    }

    // 🌟 NUEVO: Clases DTO auxiliares adaptadas a Multi-Sucursal
    public class VarianteCreateRequestDto
    {
        public int ProductoId { get; set; }
        public string Talle { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public string CodigoBarras { get; set; } = string.Empty;
        public int StockActual { get; set; }
        public int StockMinimo { get; set; }
        public int SucursalId { get; set; } = 1;
    }

    public class ActualizarStockDto
    {
        public int StockActual { get; set; }
        public int SucursalId { get; set; } = 1;
    }
}