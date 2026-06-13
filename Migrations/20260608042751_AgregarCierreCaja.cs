using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TiendaRopaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AgregarCierreCaja : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cierres_caja",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    fecha = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    total_efectivo = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    total_transferencia = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    total_debito = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    total_credito = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    total_general = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    cantidad_ventas = table.Column<int>(type: "int", nullable: false),
                    Observaciones = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    usuario_id = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cierres_caja", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cierres_caja");
        }
    }
}
