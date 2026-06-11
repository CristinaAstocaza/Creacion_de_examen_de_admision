package pe.edu.utp.sistemaexamenes.dto.response;

import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.enums.TipoAlternativa;

public record AlternativaResponse(
        Long id,
        LetraAlternativa letra,
        TipoAlternativa tipo,
        String contenidoTexto,
        String imagenUrl,
        Boolean esCorrecta,
        Integer ordenVisualizacion,
        Long preguntaId
) {
}
