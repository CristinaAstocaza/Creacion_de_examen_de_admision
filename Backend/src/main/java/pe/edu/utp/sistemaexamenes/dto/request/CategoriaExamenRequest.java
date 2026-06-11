package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoriaExamenRequest(
        @NotBlank(message = "El nombre de la categoría es obligatorio")
        @Size(max = 120, message = "El nombre de la categoría no debe superar los 120 caracteres")
        String nombre,

        @Size(max = 500, message = "La descripción no debe superar los 500 caracteres")
        String descripcion,

        Boolean activo
) {
}
