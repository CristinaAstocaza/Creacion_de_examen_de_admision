package pe.edu.utp.sistemaexamenes.dto.response;

import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;

import java.util.List;

public record ExamenPreguntaVistaResponse(
        Integer numeroOrden,
        Long preguntaId,
        String codigo,
        String enunciado,
        String imagenUrl,
        NivelDificultad dificultad,
        String cursoNombre,
        String alternativasOrdenadas,
        List<ExamenAlternativaVistaResponse> alternativas
) {
}
