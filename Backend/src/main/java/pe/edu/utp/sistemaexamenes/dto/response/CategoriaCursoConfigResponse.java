package pe.edu.utp.sistemaexamenes.dto.response;

import java.time.LocalDateTime;

public record CategoriaCursoConfigResponse(
        Long id,
        Long categoriaExamenId,
        String categoriaExamenNombre,
        Long cursoId,
        String cursoNombre,
        String cursoCodigo,
        Integer cantidadSugerida,
        Boolean activo,
        LocalDateTime fechaConfiguracion
) {
}
