package pe.edu.utp.sistemaexamenes.dto.response;

import pe.edu.utp.sistemaexamenes.enums.EstadoExamen;

import java.time.LocalDateTime;
import java.util.List;

public record ExamenResponse(
        Long id,
        String codigo,
        String nombre,
        String descripcion,
        Integer duracionMinutos,
        Integer cantidadVersiones,
        Boolean aleatorizarPreguntas,
        Boolean aleatorizarAlternativas,
        EstadoExamen estado,
        LocalDateTime fechaCreacion,
        LocalDateTime fechaPublicacion,
        Long categoriaExamenId,
        String categoriaExamenNombre,
        List<ExamenCursoUsadoResponse> cursosUsados,
        List<ExamenVersionResponse> versiones
) {
}
