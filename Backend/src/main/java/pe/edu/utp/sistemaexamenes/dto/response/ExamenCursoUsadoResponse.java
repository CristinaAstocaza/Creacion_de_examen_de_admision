package pe.edu.utp.sistemaexamenes.dto.response;

public record ExamenCursoUsadoResponse(
        Long cursoId,
        String cursoNombre,
        Integer cantidadTotal,
        Integer cantidadFacil,
        Integer cantidadMedio,
        Integer cantidadDificil
) {
}
