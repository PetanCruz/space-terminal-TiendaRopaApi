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

       // 1. LEER TODOS (Formato Seguro y Limpio - MULTISUCURSAL OMNICANAL)
        [HttpGet]
        public async Task<IActionResult> GetProductos([FromQuery] int sucursalId = 1)
        {
            var productos = await _context.Productos
                .Where(p => p.Activo == true)
                .Include(p => p.Categoria)
                .Include(p => p.Variantes)
                .ToListAsync();

            // 🌟 NUEVO: Traemos TODO el stock y TODAS las sucursales activas
            var todoElStock = await _context.StockSucursales.ToListAsync();
            var sucursales = await _context.Sucursales.Where(s => s.Activo).ToListAsync();

            var resultado = productos.Select(p => new
            {
                id = p.Id,
                nombre = p.Nombre,
                precioCosto = p.PrecioCosto,
                precio = p.PrecioVenta, 
                categoria = p.Categoria != null ? p.Categoria.Nombre : "Sin categoría",
                categoriaId = p.CategoriaId,
                variantes = p.Variantes.Select(v => 
                {
                    // Stock para la tabla principal (lo que hay físicamente donde está el usuario)
                    var stockLocal = todoElStock.FirstOrDefault(s => s.VarianteId == v.Id && s.SucursalId == sucursalId);
                    
                    // 🌟 NUEVO: Armamos la lista de cuánto hay en cada local para el Modal
                    var stockDesglose = sucursales.Select(suc => new {
                        sucursalId = suc.Id,
                        sucursal = suc.Nombre,
                        cantidad = todoElStock.FirstOrDefault(s => s.VarianteId == v.Id && s.SucursalId == suc.Id)?.StockActual ?? 0
                    }).ToList();

                    return new
                    {
                        id = v.Id,
                        talle = v.Talle,
                        color = v.Color,
                        stock = stockLocal != null ? stockLocal.StockActual : 0, 
                        stockDetalle = stockDesglose // Mandamos la lista desglosada al JS
                    };
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
        [HttpPost]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> PostProducto([FromBody] ProductoCreateRequest request)
        {
            // Validamos que la categoría exista antes de meter el producto
            var categoriaExiste = await _context.Categorias.AnyAsync(c => c.Id == request.CategoriaId);
            if (!categoriaExiste)
            {
                return BadRequest(new { mensaje = "La categoría especificada no existe." });
            }

            // Usamos una transacción para asegurar que no quede el producto suelto sin stock
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var nuevoProducto = new Producto
                {
                    CategoriaId = request.CategoriaId,
                    Nombre = request.Nombre,
                    Descripcion = request.Descripcion,
                    PrecioCosto = request.PrecioCosto,
                    PrecioVenta = request.PrecioVenta,
                    Activo = true,
                    Variantes = new List<ProductoVariante>()
                };

                // Agregamos las variantes al producto
                foreach(var vReq in request.Variantes)
                {
                    nuevoProducto.Variantes.Add(new ProductoVariante
                    {
                        Talle = vReq.Talle,
                        Color = vReq.Color,
                        CodigoBarras = vReq.CodigoBarras
                    });
                }

                _context.Productos.Add(nuevoProducto);
                await _context.SaveChangesAsync(); // Guardamos para que se generen los IDs en la base de datos

                // 🌟 MAGIA MULTI-SUCURSAL: Ahora que la variante existe, le creamos su stock
                for (int i = 0; i < nuevoProducto.Variantes.Count; i++)
                {
                    var stockSucursal = new StockSucursal
                    {
                        VarianteId = nuevoProducto.Variantes.ElementAt(i).Id,
                        SucursalId = request.SucursalId, // Lo guardamos en el local del cajero
                        StockActual = request.Variantes[i].StockActual,
                        StockMinimo = request.Variantes[i].StockMinimo
                    };
                    _context.StockSucursales.Add(stockSucursal);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { mensaje = "Producto creado con éxito", productoId = nuevoProducto.Id });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { mensaje = "Error interno", detalle = ex.Message });
            }
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

        // 6. ADICIONAL: REPONER STOCK DE UNA VARIANTE (Modificado para Multi-Sucursal)
        [HttpPut("reponer-stock/{varianteId:int}")]
        [Authorize]
        public async Task<IActionResult> ReponerStock(int varianteId, [FromQuery] int cantidadAAgregar, [FromQuery] int sucursalId = 1)
        {
            if (cantidadAAgregar <= 0) return BadRequest(new { mensaje = "La cantidad debe ser mayor a cero." });

            // 1. Verificamos que la variante base de ropa exista
            var varianteExiste = await _context.ProductoVariantes.AnyAsync(v => v.Id == varianteId);
            if (!varianteExiste) return NotFound(new { mensaje = "La variante de talle/color no existe." });

            // 2. Buscamos si ya hay un registro de stock para esta variante en la sucursal indicada
            var stockSucursal = await _context.StockSucursales
                .FirstOrDefaultAsync(s => s.VarianteId == varianteId && s.SucursalId == sucursalId);

            if (stockSucursal == null)
            {
                // Si el local nunca tuvo esta prenda, le creamos el registro desde cero
                stockSucursal = new StockSucursal
                {
                    VarianteId = varianteId,
                    SucursalId = sucursalId,
                    StockActual = cantidadAAgregar,
                    StockMinimo = 2 // Podés ajustar este valor si querés
                };
                _context.StockSucursales.Add(stockSucursal);
            }
            else
            {
                // Si ya la tenían, simplemente le sumamos la cantidad nueva
                stockSucursal.StockActual += cantidadAAgregar;
            }

            await _context.SaveChangesAsync();

            return Ok(new { mensaje = $"Stock actualizado. Nuevo stock: {stockSucursal.StockActual}" });
        }
    }

    // Modelos auxiliares para recibir los datos de Frontend de manera limpia
    public class ProductoCreateRequest
    {
        public int CategoriaId { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public decimal PrecioCosto { get; set; }
        public decimal PrecioVenta { get; set; }
        public int SucursalId { get; set; } = 1; // 🌟 Para saber dónde guardar el stock
        public List<VarianteCreateRequest> Variantes { get; set; } = new();
    }

    public class VarianteCreateRequest
    {
        public string Talle { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public string CodigoBarras { get; set; } = string.Empty;
        public int StockActual { get; set; }
        public int StockMinimo { get; set; }
    }
}