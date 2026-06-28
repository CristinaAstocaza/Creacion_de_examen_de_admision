package pe.edu.utp.sistemaexamenes.mapper;

import pe.edu.utp.sistemaexamenes.dto.request.AlternativaRequest;
import pe.edu.utp.sistemaexamenes.dto.request.PreguntaRequest;
import pe.edu.utp.sistemaexamenes.dto.response.AlternativaResponse;
import pe.edu.utp.sistemaexamenes.dto.response.PreguntaResponse;
import pe.edu.utp.sistemaexamenes.model.Alternativa;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.model.Pregunta;

import java.util.Comparator;
import java.util.List;

public class PreguntaMapper {

    private PreguntaMapper() {
    }

    public static Pregunta toEntity(PreguntaRequest request, Curso curso, String codigo) {
        Pregunta pregunta = Pregunta.builder()
                .codigo(codigo)
                .enunciado(request.enunciado())
                .imagenUrl(request.imagenUrl())
                .tieneImagen(request.tieneImagen() != null ? request.tieneImagen() : false)
                .dificultad(request.dificultad())
                .activo(request.activo() == null || request.activo())
                .curso(curso)
                .build();

        List<Alternativa> alternativas = request.alternativas().stream()
                .map(alternativaRequest -> toAlternativaEntity(alternativaRequest, pregunta))
                .toList();
        pregunta.getAlternativas().addAll(alternativas);

        return pregunta;
    }

    public static void updateEntity(Pregunta pregunta, PreguntaRequest request, Curso curso, String codigo) {
        pregunta.setCodigo(codigo);
        pregunta.setEnunciado(request.enunciado());
        pregunta.setImagenUrl(request.imagenUrl());
        pregunta.setTieneImagen(request.tieneImagen() != null ? request.tieneImagen() : false);
        pregunta.setDificultad(request.dificultad());
        pregunta.setCurso(curso);
        if (request.activo() != null) {
            pregunta.setActivo(request.activo());
        }

        pregunta.getAlternativas().clear();
        request.alternativas().stream()
                .map(alternativaRequest -> toAlternativaEntity(alternativaRequest, pregunta))
                .forEach(pregunta.getAlternativas()::add);
    }

    public static PreguntaResponse toResponse(Pregunta pregunta) {
        List<AlternativaResponse> alternativas = pregunta.getAlternativas().stream()
                .sorted(Comparator.comparing(Alternativa::getLetra))
                .map(PreguntaMapper::toAlternativaResponse)
                .toList();

        return new PreguntaResponse(
                pregunta.getId(),
                pregunta.getCodigo(),
                pregunta.getEnunciado(),
                pregunta.getImagenUrl(),
                pregunta.getTieneImagen(),
                pregunta.getDificultad(),
                pregunta.getActivo(),
                pregunta.getFechaCreacion(),
                pregunta.getCurso().getId(),
                pregunta.getCurso().getNombre(),
                alternativas
        );
    }

    private static Alternativa toAlternativaEntity(AlternativaRequest request, Pregunta pregunta) {
        return Alternativa.builder()
                .letra(request.letra())
                .tipo(request.tipo())
                .contenidoTexto(request.contenidoTexto())
                .imagenUrl(request.imagenUrl())
                .esCorrecta(false)
                .ordenVisualizacion(request.ordenVisualizacion())
                .pregunta(pregunta)
                .build();
    }

    private static AlternativaResponse toAlternativaResponse(Alternativa alternativa) {
        return new AlternativaResponse(
                alternativa.getId(),
                alternativa.getLetra(),
                alternativa.getTipo(),
                alternativa.getContenidoTexto(),
                alternativa.getImagenUrl(),
                alternativa.getEsCorrecta(),
                alternativa.getOrdenVisualizacion(),
                alternativa.getPregunta().getId()
        );
    }
}
