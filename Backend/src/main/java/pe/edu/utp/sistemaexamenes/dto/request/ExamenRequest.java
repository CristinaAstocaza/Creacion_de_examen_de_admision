package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ExamenRequest(
        @NotBlank(message = "El nombre del examen es obligatorio")
        @Size(max = 150, message = "El nombre del examen no debe superar los 150 caracteres")
        String nombre,

        @Size(max = 500, message = "La descripción no debe superar los 500 caracteres")
        String descripcion,

        @NotNull(message = "La duración del examen es obligatoria")
        Integer duracionMinutos,

        @NotNull(message = "La categoría del examen es obligatoria")
        Long categoriaExamenId,

        @Valid
        @Size(min = 1, message = "El examen debe tener al menos una configuración de curso")
        List<ExamenConfiguracionCursoRequest> configuracionesCurso
) {
}
