package pe.edu.utp.sistemaexamenes.dto.response;

import java.util.List;

public record ExamenVersionSolucionarioResponse(
        Integer numero,
        String codigoVersion,
        List<SolucionarioPreguntaResponse> respuestas
) {
}
