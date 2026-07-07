using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiendaRopaAPI.Models
{
    [Table("cierres_caja")]
    public class CierreCaja
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Column("fecha")]
        public DateTime Fecha { get; set; } = DateTime.Now;

        [Column("total_efectivo")]
        public decimal TotalEfectivo { get; set; } = 0;

        [Column("total_transferencia")]
        public decimal TotalTransferencia { get; set; } = 0;

        [Column("total_debito")]
        public decimal TotalDebito { get; set; } = 0;

        [Column("total_credito")]
        public decimal TotalCredito { get; set; } = 0;

        [Column("total_general")]
        public decimal TotalGeneral { get; set; } = 0;

        [Column("cantidad_ventas")]
        public int CantidadVentas { get; set; } = 0;

        public string? Observaciones { get; set; }

        [Column("usuario_id")]
        public int? UsuarioId { get; set; }

        public int? SucursalId { get; set; }
    }
}