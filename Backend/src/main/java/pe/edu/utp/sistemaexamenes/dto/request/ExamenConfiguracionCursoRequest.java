package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.constraints.NotNull;

public record ExamenConfiguracionCursoRequest(
        @NotNull(message = "El curso es obligatorio")
        Long cursoId,

        @NotNull(message = "La cantidad de preguntas es obligatoria")
        Integer cantidadPreguntas,

        @NotNull(message = "El puntaje por pregunta es obligatorio")
        Double puntajePorPregunta
) {
}
