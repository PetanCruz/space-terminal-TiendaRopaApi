using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MercadoPago.Config;
using MercadoPago.Client.Preference;
using MercadoPago.Resource.Preference;
using TiendaRopaAPI.Data;

namespace TiendaRopaAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MercadoPagoController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly ApplicationDbContext _context;

        public MercadoPagoController(IConfiguration config, ApplicationDbContext context)
        {
            _config = config;
            _context = context;
        }

        // POST /api/mercadopago/crear-preferencia
        // Recibe el total y los items del carrito, crea la preferencia en MP
        [HttpPost("crear-preferencia")]
        public async Task<IActionResult> CrearPreferencia([FromBody] PreferenciaRequest request)
        {
            try
            {
                // Configurar el Access Token
                MercadoPagoConfig.AccessToken = _config["MercadoPago:AccessToken"]
                    ?? throw new Exception("Access Token de MP no configurado.");

                var cliente = new PreferenceClient();

                // Armar los ítems para MP
                var items = request.Items.Select(i => new PreferenceItemRequest
                {
                    Title       = i.Nombre,
                    Quantity    = i.Cantidad,
                    UnitPrice   = i.PrecioUnitario,
                    CurrencyId  = "ARS"
                }).ToList();

                var preferencia = new PreferenceRequest
                {
                     Items = items,
                      ExternalReference = request.VentaId?.ToString() ?? "sin-referencia",
                        // Sin BackUrls ni AutoReturn para desarrollo local
                        //  Cuando se deploya a producción se agregan las URLs reales del dominio,
                    
                };

                Preference resultado = await cliente.CreateAsync(preferencia);

                return Ok(new {
                    preferenceId = resultado.Id,
                    initPoint    = resultado.InitPoint,      // Link de pago completo
                    sandboxUrl   = resultado.SandboxInitPoint // Link de prueba
                });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"❌ Error MP: {ex.Message}");
                return StatusCode(500, new { mensaje = "Error al crear la preferencia de pago.", detalle = ex.Message });
            }
        }
    }

    // DTO para recibir los datos del carrito
    public class PreferenciaRequest
    {
        public int? VentaId       { get; set; }
        public string UrlBase     { get; set; } = "http://localhost:5000";
        public List<ItemMP> Items { get; set; } = new();
    }

    public class ItemMP
    {
        public string Nombre        { get; set; } = string.Empty;
        public int Cantidad         { get; set; }
        public decimal PrecioUnitario { get; set; }
    }
}