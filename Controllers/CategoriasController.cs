using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriasController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CategoriasController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. LISTAR (Este es el "CONSEGUIR" que ya te aparece)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Categoria>>> GetCategorias()
        {
            return await _context.Categorias.ToListAsync();
        }

        // 2. CREAR (Este es el que te está faltando)
        [HttpPost]
        [Authorize(Roles = "administrador")]
        public async Task<ActionResult<Categoria>> PostCategoria([FromBody] Categoria nuevaCategoria)
        {
            if (string.IsNullOrWhiteSpace(nuevaCategoria.Nombre))
            {
                return BadRequest(new { mensaje = "El nombre es obligatorio." });
            }

            _context.Categorias.Add(nuevaCategoria);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCategorias), new { id = nuevaCategoria.Id }, nuevaCategoria);
        }

        // 3. MODIFICAR
        [HttpPut("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> PutCategoria(int id, [FromBody] Categoria categoriaEditada)
        {
            if (id != categoriaEditada.Id) return BadRequest(new { mensaje = "El ID no coincide." });

            var categoria = await _context.Categorias.FindAsync(id);
            if (categoria == null) return NotFound(new { mensaje = "No existe." });

            categoria.Nombre = categoriaEditada.Nombre;
            _context.Entry(categoria).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Actualizada." });
        }

        // 4. ELIMINAR
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "administrador")]
        public async Task<IActionResult> DeleteCategoria(int id)
        {
            var categoria = await _context.Categorias.FindAsync(id);
            if (categoria == null) return NotFound(new { mensaje = "No existe." });

            var tieneProductos = await _context.Productos.AnyAsync(p => p.CategoriaId == id);
            if (tieneProductos) return BadRequest(new { mensaje = "Tiene productos asociados." });

            _context.Categorias.Remove(categoria);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Eliminada." });
        }
    }
}