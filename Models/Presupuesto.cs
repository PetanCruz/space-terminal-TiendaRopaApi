using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    public class Presupuesto
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public string NumeroPresupuesto { get; set; } = string.Empty; // Ej: PRE-001234
        
        public DateTime FechaEmision { get; set; }
        public DateTime FechaVencimiento { get; set; }
        
        public string ClienteNombre { get; set; } = "Consumidor Final";
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal Total { get; set; }
        
        public string Estado { get; set; } = "Pendiente"; // Pendiente, Convertido, Vencido
        
        public int SucursalId { get; set; } = 1;
        
        // Relación con los detalles de la ropa
        public List<PresupuestoDetalle> Detalles { get; set; } = new();
    }

    public class PresupuestoDetalle
    {
        [Key]
        public int Id { get; set; }
        
        public int PresupuestoId { get; set; }
        public Presupuesto? Presupuesto { get; set; }
        
        public int VarianteId { get; set; }
        
        public string ProductoNombre { get; set; } = string.Empty;
        public string Talle { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        
        public int Cantidad { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal PrecioUnitario { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal Subtotal { get; set; }
    }
}