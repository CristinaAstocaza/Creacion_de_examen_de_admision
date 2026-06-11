package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.constraints.NotNull;

public record CategoriaCursoConfigRequest(
        @NotNull(message = "El curso es obligatorio")
        Long cursoId,

        Integer cantidadSugerida,

        Boolean activo
) {
}
