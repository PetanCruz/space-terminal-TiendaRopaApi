using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SucursalesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SucursalesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetSucursales()
        {
            // Busca las sucursales que estén activas
            var sucursales = await _context.Sucursales
                .Where(s => s.Activo)
                .Select(s => new { s.Id, s.Nombre })
                .ToListAsync();

            return Ok(sucursales);
        }
    }
}