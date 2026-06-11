package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CursoRequest(
        @NotBlank(message = "El nombre del curso es obligatorio")
        @Size(max = 120, message = "El nombre del curso no debe superar los 120 caracteres")
        String nombre,

        @Size(max = 20, message = "El código del curso no debe superar los 20 caracteres")
        String codigo,

        @Size(max = 500, message = "La descripción no debe superar los 500 caracteres")
        String descripcion,

        Boolean activo
) {
}
