package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;

import java.util.List;

public record PreguntaRequest(
        @Size(max = 30, message = "El código no debe superar los 30 caracteres")
        String codigo,

        @NotBlank(message = "El enunciado de la pregunta es obligatorio")
        @Size(max = 4000, message = "El enunciado no debe superar los 4000 caracteres")
        String enunciado,

        @Size(max = 1000, message = "La URL de imagen no debe superar los 1000 caracteres")
        String imagenUrl,

        Boolean tieneImagen,

        @NotNull(message = "La dificultad de la pregunta es obligatoria")
        NivelDificultad dificultad,

        Boolean activo,

        @NotNull(message = "El curso de la pregunta es obligatorio")
        Long cursoId,

        @Valid
        @NotNull(message = "Las alternativas son obligatorias")
        @Size(min = 5, max = 5, message = "La pregunta debe tener exactamente 5 alternativas")
        List<AlternativaRequest> alternativas
) {
}
