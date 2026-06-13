using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity; // Librería nativa para encriptar contraseñas
using TiendaRopaAPI.Data;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Ruta: api/auth
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _config;
        private readonly PasswordHasher<Usuario> _passwordHasher;

        public AuthController(ApplicationDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
            _passwordHasher = new PasswordHasher<Usuario>(); // Instanciamos el encriptador nativo
        }

        // 1. ENDPOINT PARA REGISTRAR UN USUARIO
        [HttpPost("registrar")]
        public async Task<IActionResult> Registrar([FromBody] RegistroRequest request)
        {
            if (await _context.Usuarios.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest(new { mensaje = "El correo ya está registrado." });
            }

            var nuevoUsuario = new Usuario
            {
                Email = request.Email,
                Nombre = request.Nombre,
                Rol = request.Rol
            };

            // Encriptamos la contraseña antes de guardarla en la base de datos
            nuevoUsuario.PasswordHash = _passwordHasher.HashPassword(nuevoUsuario, request.Password);

            _context.Usuarios.Add(nuevoUsuario);
            await _context.SaveChangesAsync();

            return Ok(new { mensaje = "Usuario registrado con éxito." });
        }

        // 2. ENDPOINT PARA INICIAR SESIÓN (LOGIN)
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (usuario == null)
            {
                return Unauthorized(new { mensaje = "Credenciales incorrectas." });
            }

            // Verificamos si la contraseña que ingresó coincide con el hash de la base de datos
            var resultadoVerificacion = _passwordHasher.VerifyHashedPassword(usuario, usuario.PasswordHash, request.Password);
            
            if (resultadoVerificacion == PasswordVerificationResult.Failed)
            {
                return Unauthorized(new { mensaje = "Credenciales incorrectas." });
            }

            // Si todo está bien, fabricamos el Token JWT
            var token = GenerarJwtToken(usuario);

            return Ok(new { 
                mensaje = "Login correcto", 
                token = token,
                usuario = new { usuario.Nombre, usuario.Email, usuario.Rol }
            });
        }

        // MÉTODO AUXILIAR PARA GENERAR EL TOKEN
        private string GenerarJwtToken(Usuario usuario)
        {
            var jwtKey = _config["Jwt:Key"] ?? throw new ArgumentNullException("Clave JWT no configurada.");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // Información que viaja encriptada dentro del token (Claims)
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                new Claim(ClaimTypes.Name, usuario.Nombre),
                new Claim(ClaimTypes.Email, usuario.Email),
                new Claim(ClaimTypes.Role, usuario.Rol)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8), // El token vence en 8 horas
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    // DTOs para recibir datos de forma limpia
    public class RegistroRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Rol { get; set; } = "Empleado"; 
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}