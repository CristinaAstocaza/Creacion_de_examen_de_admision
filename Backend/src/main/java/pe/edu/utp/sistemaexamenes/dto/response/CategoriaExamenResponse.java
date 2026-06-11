package pe.edu.utp.sistemaexamenes.dto.response;

import java.time.LocalDateTime;

public record CategoriaExamenResponse(
        Long id,
        String nombre,
        String descripcion,
        Boolean activo,
        Long totalPreguntas,
        LocalDateTime fechaCreacion
) {
}
