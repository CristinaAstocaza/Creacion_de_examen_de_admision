package pe.edu.utp.sistemaexamenes.dto.response;

import java.time.LocalDateTime;

public record CursoResponse(
        Long id,
        String nombre,
        String codigo,
        String descripcion,
        Boolean activo,
        LocalDateTime fechaCreacion
) {
}
