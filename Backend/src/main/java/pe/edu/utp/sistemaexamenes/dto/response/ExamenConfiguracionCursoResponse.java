package pe.edu.utp.sistemaexamenes.dto.response;

public record ExamenConfiguracionCursoResponse(
        Long id,
        Long cursoId,
        String cursoNombre,
        Integer cantidadPreguntas,
        Double puntajePorPregunta
) {
}
