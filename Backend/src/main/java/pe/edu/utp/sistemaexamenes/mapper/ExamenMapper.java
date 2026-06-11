package pe.edu.utp.sistemaexamenes.mapper;

import pe.edu.utp.sistemaexamenes.dto.response.ExamenAlternativaVistaResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenCursoUsadoResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenPreguntaVistaResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenSolucionarioResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenVersionResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenVersionSolucionarioResponse;
import pe.edu.utp.sistemaexamenes.dto.response.SolucionarioPreguntaResponse;
import pe.edu.utp.sistemaexamenes.model.Alternativa;
import pe.edu.utp.sistemaexamenes.model.Examen;
import pe.edu.utp.sistemaexamenes.model.ExamenConfiguracionCurso;
import pe.edu.utp.sistemaexamenes.model.ExamenPregunta;
import pe.edu.utp.sistemaexamenes.model.ExamenVersion;

import java.util.Comparator;
import java.util.List;

public class ExamenMapper {

    private ExamenMapper() {
    }

    public static ExamenResponse toResponse(Examen examen, boolean incluirPreguntas) {
        List<ExamenCursoUsadoResponse> cursos = examen.getConfiguracionesCurso().stream()
                .map(ExamenMapper::toCursoUsadoResponse)
                .toList();

        List<ExamenVersionResponse> versiones = examen.getVersiones().stream()
                .sorted(Comparator.comparing(ExamenVersion::getNumero))
                .map(version -> toVersionResponse(version, incluirPreguntas))
                .toList();

        return new ExamenResponse(
                examen.getId(),
                examen.getCodigo(),
                examen.getNombre(),
                examen.getDescripcion(),
                examen.getDuracionMinutos(),
                examen.getCantidadVersiones(),
                examen.getAleatorizarPreguntas(),
                examen.getAleatorizarAlternativas(),
                examen.getEstado(),
                examen.getFechaCreacion(),
                examen.getFechaPublicacion(),
                examen.getCategoriaExamen().getId(),
                examen.getCategoriaExamen().getNombre(),
                cursos,
                versiones
        );
    }

    public static ExamenVersionResponse toVersionResponse(ExamenVersion version, boolean incluirPreguntas) {
        List<ExamenPreguntaVistaResponse> preguntas = incluirPreguntas
                ? version.getPreguntas().stream()
                .sorted(Comparator.comparing(ExamenPregunta::getNumeroOrden))
                .map(ExamenMapper::toPreguntaVistaResponse)
                .toList()
                : List.of();

        return new ExamenVersionResponse(
                version.getId(),
                version.getNumero(),
                version.getCodigoVersion(),
                version.getFechaGeneracion(),
                preguntas
        );
    }

    public static ExamenSolucionarioResponse toSolucionarioResponse(Examen examen) {
        List<ExamenVersionSolucionarioResponse> versiones = examen.getVersiones().stream()
                .sorted(Comparator.comparing(ExamenVersion::getNumero))
                .map(ExamenMapper::toVersionSolucionarioResponse)
                .toList();

        return new ExamenSolucionarioResponse(
                examen.getId(),
                examen.getCodigo(),
                examen.getNombre(),
                versiones
        );
    }

    private static ExamenCursoUsadoResponse toCursoUsadoResponse(ExamenConfiguracionCurso configuracion) {
        return new ExamenCursoUsadoResponse(
                configuracion.getCurso().getId(),
                configuracion.getCurso().getNombre(),
                configuracion.getCantidadPreguntas(),
                configuracion.getCantidadFacil(),
                configuracion.getCantidadMedio(),
                configuracion.getCantidadDificil()
        );
    }

    private static ExamenPreguntaVistaResponse toPreguntaVistaResponse(ExamenPregunta examenPregunta) {
        List<ExamenAlternativaVistaResponse> alternativas = examenPregunta.getPregunta().getAlternativas().stream()
                .map(alternativa -> new ExamenAlternativaVistaResponse(
                        alternativa.getLetra(),
                        alternativa.getTipo(),
                        alternativa.getContenidoTexto(),
                        alternativa.getImagenUrl()
                ))
                .toList();

        return new ExamenPreguntaVistaResponse(
                examenPregunta.getNumeroOrden(),
                examenPregunta.getPregunta().getId(),
                examenPregunta.getPregunta().getCodigo(),
                examenPregunta.getPregunta().getEnunciado(),
                examenPregunta.getPregunta().getImagenUrl(),
                examenPregunta.getPregunta().getDificultad(),
                examenPregunta.getPregunta().getCurso().getNombre(),
                examenPregunta.getAlternativasOrdenadas(),
                alternativas
        );
    }

    private static ExamenVersionSolucionarioResponse toVersionSolucionarioResponse(ExamenVersion version) {
        List<SolucionarioPreguntaResponse> respuestas = version.getPreguntas().stream()
                .sorted(Comparator.comparing(ExamenPregunta::getNumeroOrden))
                .map(ExamenMapper::toSolucionarioPreguntaResponse)
                .toList();

        return new ExamenVersionSolucionarioResponse(version.getNumero(), version.getCodigoVersion(), respuestas);
    }

    private static SolucionarioPreguntaResponse toSolucionarioPreguntaResponse(ExamenPregunta examenPregunta) {
        Alternativa correcta = examenPregunta.getPregunta().getAlternativas().stream()
                .filter(alternativa -> Boolean.TRUE.equals(alternativa.getEsCorrecta()))
                .findFirst()
                .orElse(null);

        return new SolucionarioPreguntaResponse(
                examenPregunta.getNumeroOrden(),
                examenPregunta.getPregunta().getId(),
                examenPregunta.getPregunta().getCodigo(),
                correcta == null ? null : correcta.getLetra(),
                correcta == null ? null : correcta.getContenidoTexto()
        );
    }
}
