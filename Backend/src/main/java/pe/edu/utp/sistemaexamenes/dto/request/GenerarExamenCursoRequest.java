package pe.edu.utp.sistemaexamenes.dto.request;

import jakarta.validation.constraints.NotNull;

public record GenerarExamenCursoRequest(
        @NotNull(message = "El curso es obligatorio")
        Long idCurso,

        @NotNull(message = "La cantidad total por curso es obligatoria")
        Integer cantidadTotal,

        Integer cantidadFacil,

        Integer cantidadMedio,

        Integer cantidadDificil
) {
}
