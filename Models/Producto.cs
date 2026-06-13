using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("productos")]
    public class Producto
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Column("categoria_id")]
        public int CategoriaId { get; set; }

        [Required]
        [StringLength(150)]
        public string Nombre { get; set; } = string.Empty;

        public string? Descripcion { get; set; }

        [Required]
        [Column("precio_costo")]
        public decimal PrecioCosto { get; set; }

        [Required]
        [Column("precio_venta")]
        public decimal PrecioVenta { get; set; }

        public bool Activo { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Propiedades de Navegación (Relaciones)
        [ForeignKey("CategoriaId")]
        public Categoria? Categoria { get; set; }

        public List<ProductoVariante> Variantes { get; set; } = new();
    }
}