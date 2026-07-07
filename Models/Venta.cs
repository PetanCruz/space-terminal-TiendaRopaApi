using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("ventas")]
    public class Venta
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Column("fecha_hora")]
        public DateTime FechaHora { get; set; } = DateTime.Now;

        [Required]
        public decimal Total { get; set; } = 0.00m;

        [Required]
        [Column("metodo_pago")]
        [StringLength(50)]
        public string MetodoPago { get; set; } = string.Empty; // Ej: 'Efectivo', 'Transferencia'

        public string? Comentarios { get; set; }

        [Column("cliente_id")]
        public int? ClienteId { get; set; }   // nullable: venta sin cliente identificado

        [ForeignKey("ClienteId")]
        public Cliente? Cliente { get; set; }

        public int? SucursalId { get; set; }
    }
}