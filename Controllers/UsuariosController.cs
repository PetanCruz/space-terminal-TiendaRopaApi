using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Esto genera la ruta automática: api/usuarios
    [Authorize] // 🔑 Exige que el JS mande un Token válido para poder usar este controlador
    public class UsuariosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UsuariosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. GET: api/usuarios (Trae la lista para tu tabla)
        [HttpGet]
        public async Task<IActionResult> GetUsuarios()
        {
            // Traemos los usuarios de la base de datos mapeando solo los datos necesarios
            var listaUsuarios = await _context.Usuarios
                .Select(u => new {
                    u.Id,
                    u.Nombre,
                    u.Email,
                    u.Rol
                })
                .ToListAsync();

            return Ok(listaUsuarios);
        }

        // 2. DELETE: api/usuarios/5 (Para el botón eliminar)
        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarUsuario(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null)
            {
                return NotFound(new { mensaje = "Usuario no encontrado." });
            }

            _context.Usuarios.Remove(usuario);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Usuario eliminado con éxito." });
        }
    }
}