using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models; // <-- Nueva librería para configurar Swagger
using System.Text;
using System.Text.Json.Serialization;
using TiendaRopaAPI.Data;

var builder = WebApplication.CreateBuilder(args);


// =============================================================================
// 1. CONFIGURACIÓN DE SERVICIOS
// =============================================================================

// Evitar bucles infinitos en JSON
builder.Services.AddControllers()
    .AddJsonOptions(options => {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();

// --- CONFIGURACIÓN AVANZADA DE SWAGGER PARA JWT ---
builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo { Title = "Tienda Ropa API", Version = "v1" });

        // Configurar la interfaz para que pida el Token
        options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.ApiKey,
            Scheme = "Bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Ingresá el token de esta manera: Bearer {tu_token_aquí}"
        });

        // Hacer que todos los endpoints protegidos usen esta seguridad en la interfaz
        options.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    });

// Conexión a MySQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0))));  

// Configuración de Seguridad (JWT)
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new ArgumentNullException("La clave JWT no está configurada.");
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes)
    };
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirTodo", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();
// 🌟 ESTO OBLIGA A RAILWAY A ACTUALIZAR LA BASE DE DATOS AUTOMÁTICAMENTE
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<TiendaRopaAPI.Data.ApplicationDbContext>();
        context.Database.Migrate();
        Console.WriteLine("✅ Base de datos sincronizada correctamente.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error al migrar la BD: {ex.Message}");
    }
}
app.UseStaticFiles(); 


// =============================================================================
// 2. CONFIGURACIÓN DEL PIPELINE (Middlewares)
// =============================================================================

// Swagger disponible en todos los entornos para testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Tienda Ropa API v1");
    c.RoutePrefix = "swagger";
});
app.UseStaticFiles();

app.UseCors("PermitirTodo");
app.UseAuthentication(); // 1º ¿Quién sos?
app.UseAuthorization();  // 2º ¿Qué permisos tenés?

app.MapControllers();


using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocurrió un error al migrar la base de datos.");
    }
}

app.Run();