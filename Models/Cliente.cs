using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("clientes")]
    public class Cliente
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Nombre { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Dni { get; set; }

        [StringLength(20)]
        public string? Telefono { get; set; }

        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(200)]
        public string? Direccion { get; set; }

        public decimal LimiteCredito { get; set; } = 0.00m;

        // --- SALDO PARA EL FIADO ---
        public decimal SaldoCuentaCorriente { get; set; } = 0.00m; 

        [StringLength(500)]
        public string? Notas { get; set; }

        // --- SISTEMA DE FIDELIZACIÓN ---
        [Column("puntos_acumulados")]
        public int PuntosAcumulados { get; set; } = 0;

        public bool Activo { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Relación con ventas
        public List<Venta> Ventas { get; set; } = new();
    }
}