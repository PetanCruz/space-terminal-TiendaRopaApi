using Microsoft.EntityFrameworkCore;
using TiendaRopaAPI.Models;

namespace TiendaRopaAPI.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        // Mapeo completo de las 5 tablas del sistema
        public DbSet<Categoria> Categorias { get; set; }
        public DbSet<Producto> Productos { get; set; }
        public DbSet<ProductoVariante> ProductoVariantes { get; set; }
        public DbSet<Venta> Ventas { get; set; }
        public DbSet<VentaDetalle> VentaDetalles { get; set; }
        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<CierreCaja> CierresCaja { get; set; }
        public DbSet<Cliente> Clientes { get; set; }
        public DbSet<StockSucursal> StockSucursales { get; set; }
        public DbSet<Sucursal> Sucursales { get; set; }
        public DbSet<Presupuesto> Presupuestos { get; set; }
        public DbSet<PresupuestoDetalle> PresupuestoDetalles { get; set; }
        public DbSet<Empresa> Empresas { get; set; }
    }
}