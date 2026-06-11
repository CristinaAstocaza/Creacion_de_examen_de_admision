package pe.edu.utp.sistemaexamenes.dto.response;

import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;

public record SolucionarioPreguntaResponse(
        Integer numeroOrden,
        Long preguntaId,
        String codigo,
        LetraAlternativa respuestaCorrecta,
        String contenidoRespuesta
) {
}
