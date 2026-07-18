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
    public class EmpresaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public EmpresaController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. OBTENER LOS DATOS DE LA EMPRESA
        [HttpGet]
        [AllowAnonymous] // Permitimos que los PDFs lean esto sin pedir permisos extra
        public async Task<IActionResult> GetEmpresa()
        {
            // Buscamos el primer registro (solo debería haber uno para tu local)
            var empresa = await _context.Empresas.FirstOrDefaultAsync();
            
            if (empresa == null)
            {
                // Si no hay datos, devolvemos uno vacío para que el frontend no dé error
                return Ok(new Empresa()); 
            }
            
            return Ok(empresa);
        }

        // 2. GUARDAR O ACTUALIZAR LOS DATOS
        [HttpPost]
        public async Task<IActionResult> GuardarEmpresa([FromBody] Empresa datos)
        {
            try
            {
                var empresaExistente = await _context.Empresas.FirstOrDefaultAsync();

                if (empresaExistente == null)
                {
                    // Si no existe, lo creamos
                    _context.Empresas.Add(datos);
                }
                else
                {
                    // Si ya existe, simplemente lo actualizamos
                    empresaExistente.Nombre = datos.Nombre;
                    empresaExistente.Cuit = datos.Cuit;
                    empresaExistente.Direccion = datos.Direccion;
                    empresaExistente.Telefono = datos.Telefono;
                    empresaExistente.Email = datos.Email;
                    empresaExistente.MensajeTicket = datos.MensajeTicket;
                    
                    _context.Empresas.Update(empresaExistente);
                }

                await _context.SaveChangesAsync();
                return Ok(new { mensaje = "Datos de la empresa guardados correctamente." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { mensaje = $"Error al guardar: {ex.Message}" });
            }
        }

        // 3. BOTÓN INSTALADOR (Para crear la tabla a la fuerza)
        [HttpGet("instalar")]
        [AllowAnonymous]
        public IActionResult InstalarTabla()
        {
            try
            {
                _context.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS `Empresas` (
                        `Id` int NOT NULL AUTO_INCREMENT,
                        `Nombre` longtext NOT NULL,
                        `Cuit` longtext NOT NULL,
                        `Direccion` longtext NOT NULL,
                        `Telefono` longtext NOT NULL,
                        `Email` longtext NOT NULL,
                        `MensajeTicket` longtext NOT NULL,
                        PRIMARY KEY (`Id`)
                    );
                ");
                return Ok("✅ ÉXITO: Tabla de Empresa creada correctamente.");
            }
            catch (Exception ex)
            {
                string errorReal = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return StatusCode(500, $"❌ FALLÓ LA INYECCIÓN SQL: {errorReal}");
            }
        }
    }
}