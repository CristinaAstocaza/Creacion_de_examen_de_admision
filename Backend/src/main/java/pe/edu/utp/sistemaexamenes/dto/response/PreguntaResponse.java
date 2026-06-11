package pe.edu.utp.sistemaexamenes.dto.response;

import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;

import java.time.LocalDateTime;
import java.util.List;

public record PreguntaResponse(
        Long id,
        String codigo,
        String enunciado,
        String imagenUrl,
        NivelDificultad dificultad,
        Boolean activo,
        LocalDateTime fechaCreacion,
        Long cursoId,
        String cursoNombre,
        List<AlternativaResponse> alternativas
) {
}
