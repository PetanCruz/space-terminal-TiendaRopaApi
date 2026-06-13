using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("venta_detalles")]
    public class VentaDetalle
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Column("venta_id")]
        public int VentaId { get; set; }

        [Required]
        [Column("variante_id")]
        public int VarianteId { get; set; }

        [Required]
        public int Cantidad { get; set; } = 1;

        [Required]
        [Column("precio_unitario")]
        public decimal PrecioUnitario { get; set; }

        // Relaciones
        [ForeignKey("VentaId")]
        public Venta? Venta { get; set; }

        [ForeignKey("VarianteId")]
        public ProductoVariante? ProductoVariante { get; set; }
    }
}