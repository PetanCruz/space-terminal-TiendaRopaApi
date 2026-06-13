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
        
        // Agregá este método en VariantesController.cs

        // GET /api/variantes/buscar-codigo?codigo=779123456
        [HttpGet("buscar-codigo")]
         public async Task<IActionResult> BuscarPorCodigo([FromQuery] string codigo)
         {
            if (string.IsNullOrWhiteSpace(codigo))
             return BadRequest(new { mensaje = "El código no puede estar vacío." });

             var variante = await _context.ProductoVariantes
               .Include(v => v.Producto)
               .FirstOrDefaultAsync(v => v.CodigoBarras == codigo && v.Producto!.Activo);

            if (variante == null)
                return NotFound(new { mensaje = $"No se encontró ninguna variante con el código {codigo}." });

             return Ok(new {
                id             = variante.Id,
                productoId     = variante.ProductoId,
                productoNombre = variante.Producto!.Nombre,
                talle          = variante.Talle,
                color          = variante.Color,
                codigoBarras   = variante.CodigoBarras,
                precioVenta    = variante.Producto.PrecioVenta,
                stockActual    = variante.StockActual
            });
        }

        // GET /api/variantes/stock-critico
        [HttpGet("stock-critico")]
        public async Task<IActionResult> GetStockCritico()
    {
         var criticos = await _context.ProductoVariantes
          .Include(v => v.Producto)
          .Where(v => v.StockActual <= v.StockMinimo && v.Producto!.Activo)
          .OrderBy(v => v.StockActual)
          .Select(v => new {
            varianteId   = v.Id,
            productoId   = v.ProductoId,
            producto     = v.Producto!.Nombre,
            talle        = v.Talle,
            color        = v.Color,
            stockActual  = v.StockActual,
            stockMinimo  = v.StockMinimo
        })
          .ToListAsync();

      return Ok(new {
          total    = criticos.Count,
          sinStock = criticos.Count(c => c.stockActual == 0),
          criticos
      });
}
        // 1. AGREGAR VARIANTE A UN PRODUCTO EXISTENTE
        // POST /api/variantes
        [HttpPost]
        [Authorize(Roles = "administrador")]   
        public async Task<IActionResult> PostVariante([FromBody] ProductoVariante nuevaVariante)
        {
            // Verificar que el producto padre existe y está activo
            var productoExiste = await _context.Productos
                .AnyAsync(p => p.Id == nuevaVariante.ProductoId && p.Activo);

            if (!productoExiste)
                return NotFound(new { mensaje = "El producto no existe o está inactivo." });

            // Verificar que no exista ya la misma combinación talle+color para ese producto
            var yaExiste = await _context.ProductoVariantes.AnyAsync(v =>
                v.ProductoId == nuevaVariante.ProductoId &&
                v.Talle.ToLower() == nuevaVariante.Talle.ToLower() &&
                v.Color.ToLower() == nuevaVariante.Color.ToLower()
            );

            if (yaExiste)
                return BadRequest(new { mensaje = $"Ya existe una variante {nuevaVariante.Talle} / {nuevaVariante.Color} para este producto." });

            _context.ProductoVariantes.Add(nuevaVariante);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(PostVariante), new { id = nuevaVariante.Id }, new
            {
                id            = nuevaVariante.Id,
                productoId    = nuevaVariante.ProductoId,
                talle         = nuevaVariante.Talle,
                color         = nuevaVariante.Color,
                codigoBarras  = nuevaVariante.CodigoBarras,
                stockActual   = nuevaVariante.StockActual,
                stockMinimo   = nuevaVariante.StockMinimo
            });
        }

        // 2. MODIFICAR STOCK DE UNA VARIANTE
        // PUT /api/variantes/{id}/stock
        [HttpPut("{id:int}/stock")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> ActualizarStock(int id, [FromBody] ActualizarStockDto dto)
        {
            var variante = await _context.ProductoVariantes.FindAsync(id);
            if (variante == null)
                return NotFound(new { mensaje = "Variante no encontrada." });

            if (dto.StockActual < 0)
                return BadRequest(new { mensaje = "El stock no puede ser negativo." });

            variante.StockActual = dto.StockActual;
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Stock actualizado.", nuevoStock = variante.StockActual });
        }

        // 3. ELIMINAR UNA VARIANTE
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

    // DTO para actualizar stock (clase simple dentro del mismo archivo)
    public class ActualizarStockDto
    {
        public int StockActual { get; set; }
    }
   
    
}

