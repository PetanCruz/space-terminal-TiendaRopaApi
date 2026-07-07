using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("producto_variantes")]
    public class ProductoVariante
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Column("producto_id")]
        public int ProductoId { get; set; }

        [Required]
        [StringLength(20)]
        public string Talle { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string Color { get; set; } = string.Empty;

        [Required]
        [Column("codigo_barras")]
        [StringLength(50)]
        public string CodigoBarras { get; set; } = string.Empty;

        //[Required]
        //[Column("stock_actual")]
        //public int StockActual { get; set; } = 0;

       // [Required]
        //[Column("stock_minimo")]
        //public int StockMinimo { get; set; } = 2;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Relación: Cada variante pertenece a un único producto base
        [ForeignKey("ProductoId")]
        public Producto? Producto { get; set; }
    }
}