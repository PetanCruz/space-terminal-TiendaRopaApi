using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("movimientos_cuenta")]
    public class MovimientoCuenta
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Column("cliente_id")]
        public int ClienteId { get; set; }

        [Required]
        [Column("fecha_hora")]
        public DateTime FechaHora { get; set; } = DateTime.Now;

        [Required]
        [StringLength(20)]
        public string Tipo { get; set; } = string.Empty; // "COMPRA" o "PAGO_PARCIAL"

        [Required]
        public decimal Monto { get; set; }

        [StringLength(200)]
        public string? Detalle { get; set; } // Ej: "Pago en efectivo", "Ticket #153"

        [Column("venta_id")]
        public int? VentaId { get; set; } // Opcional: Para saber de qué venta fue el fiado

        // Relaciones
        [ForeignKey("ClienteId")]
        public Cliente? Cliente { get; set; }

        [ForeignKey("VentaId")]
        public Venta? Venta { get; set; }
    }
}