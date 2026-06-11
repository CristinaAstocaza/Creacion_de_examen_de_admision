package pe.edu.utp.sistemaexamenes.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ExamenVersionResponse(
        Long id,
        Integer numero,
        String codigoVersion,
        LocalDateTime fechaGeneracion,
        List<ExamenPreguntaVistaResponse> preguntas
) {
}
