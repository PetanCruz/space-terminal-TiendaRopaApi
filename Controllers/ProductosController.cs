using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ProductosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. LEER TODOS (Formato Seguro y Limpio)
        [HttpGet]
        public async Task<IActionResult> GetProductos()
        {
            // Traemos los productos con sus tablas relacionadas de la base de datos
            var productos = await _context.Productos
                .Where(p => p.Activo == true)
                .Include(p => p.Categoria)
                .Include(p => p.Variantes)
                .ToListAsync();

            // Mapeamos de forma limpia. Al remover el condicional '? : ', C# compila perfecto.
            var resultado = productos.Select(p => new
            {
                id = p.Id,
                nombre = p.Nombre,
                precioCosto = p.PrecioCosto,
                precio = p.PrecioVenta, 
                categoria = p.Categoria != null ? p.Categoria.Nombre : "Sin categoría",
                categoriaId = p.CategoriaId,
                variantes = p.Variantes.Select(v => new
                {
                    id = v.Id,
                    talle = v.Talle,
                    color = v.Color,
                    stock = v.StockActual 
                }).ToList()
            }).ToList();

            return Ok(resultado);
        }

        // 2. LEER UNO
        [HttpGet("{id:int}")]
        public async Task<ActionResult<Producto>> GetProducto(int id)
        {
            var producto = await _context.Productos
                .Include(p => p.Categoria)
                .Include(p => p.Variantes)
                .FirstOrDefaultAsync(p => p.Id == id && p.Activo);

            if (producto == null) return NotFound(new { mensaje = "Producto no encontrado." });
            return Ok(producto);
        }

        // 3. CREAR PRODUCTO (Alta)
        // Permite crear el producto y pasarle una lista de variantes (talles/colores) de una sola vez
        [HttpPost]
        [Authorize(Roles = "administrador")]
        public async Task<ActionResult<Producto>> PostProducto([FromBody] Producto nuevoProducto)
        {
            // Validamos que la categoría exista antes de meter el producto
            var categoriaExiste = await _context.Categorias.AnyAsync(c => c.Id == nuevoProducto.CategoriaId);
            if (!categoriaExiste)
            {
                return BadRequest(new { mensaje = "La categoría especificada no existe." });
            }

            // 🛡️ EL ESCUDO DEFINITIVO:
            // Le indicamos a Entity Framework que la categoría YA EXISTE en la base de datos.
            // Al setear la propiedad de navegación en null, forzamos a que use únicamente el 'CategoriaId' numérico
            // y evitamos el error "Duplicate entry '1' for key 'categorias.PRIMARY'".
            nuevoProducto.Categoria = null;

            _context.Productos.Add(nuevoProducto);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProducto), new { id = nuevoProducto.Id }, nuevoProducto);
        }

        // 4. MODIFICAR PRODUCTO (Modificación)
        // Actualiza los datos generales del producto base (Precios, Nombre, etc.)
        [HttpPut("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> PutProducto(int id, [FromBody] Producto productoEditado)
        {
            var productoEnBase = await _context.Productos.FindAsync(id);
            if (productoEnBase == null || !productoEnBase.Activo)
            {
                return NotFound(new { mensaje = "El producto no existe o fue dado de baja." });
            }

            // Actualizamos solo los campos necesarios
            productoEnBase.Nombre = productoEditado.Nombre;
            productoEnBase.Descripcion = productoEditado.Descripcion;
            productoEnBase.PrecioCosto = productoEditado.PrecioCosto;
            productoEnBase.PrecioVenta = productoEditado.PrecioVenta;
            productoEnBase.CategoriaId = productoEditado.CategoriaId;

            await _context.SaveChangesAsync();
            return Ok(new { mensaje = "Producto actualizado con éxito." });
        }

        // 5. ELIMINAR PRODUCTO (Baja Lógica)
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> DeleteProducto(int id)
        {
            var producto = await _context.Productos.FindAsync(id);
            if (producto == null) return NotFound(new { mensaje = "Producto no encontrado." });

            producto.Activo = false; // Baja lógica
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Producto dado de baja correctamente." });
        }

        // 6. ADICIONAL: REPONER STOCK DE UNA VARIANTE
        [HttpPut("reponer-stock/{varianteId:int}")]
        [Authorize]
        public async Task<IActionResult> ReponerStock(int varianteId, [FromQuery] int cantidadAAgregar)
        {
            if (cantidadAAgregar <= 0) return BadRequest(new { mensaje = "La cantidad debe ser mayor a cero." });

            var variante = await _context.ProductoVariantes.FindAsync(varianteId);
            if (variante == null) return NotFound(new { mensaje = "La variante de talle/color no existe." });

            variante.StockActual += cantidadAAgregar;
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = $"Stock actualizado. Nuevo stock: {variante.StockActual}" });
        }
    }
}