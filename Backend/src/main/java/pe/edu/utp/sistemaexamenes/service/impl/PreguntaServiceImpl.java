package pe.edu.utp.sistemaexamenes.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.AlternativaRequest;
import pe.edu.utp.sistemaexamenes.dto.request.PreguntaRequest;
import pe.edu.utp.sistemaexamenes.dto.response.PreguntaResponse;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.enums.TipoAlternativa;
import pe.edu.utp.sistemaexamenes.exception.BusinessException;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.mapper.PreguntaMapper;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.model.Pregunta;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.repository.PreguntaRepository;
import pe.edu.utp.sistemaexamenes.service.PreguntaService;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PreguntaServiceImpl implements PreguntaService {

    private final PreguntaRepository preguntaRepository;
    private final CursoRepository cursoRepository;

    @Override
    @Transactional(readOnly = true)
    public List<PreguntaResponse> listar(String search, Long cursoId, NivelDificultad dificultad) {
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();

        if (normalizedSearch == null && cursoId == null && dificultad == null) {
            return preguntaRepository.findAll().stream()
                    .map(PreguntaMapper::toResponse)
                    .toList();
        }

        return preguntaRepository.findAll(filtrarPreguntas(normalizedSearch, cursoId, dificultad)).stream()
                .map(PreguntaMapper::toResponse)
                .toList();
    }

    private Specification<Pregunta> filtrarPreguntas(String search, Long cursoId, NivelDificultad dificultad) {
        return (root, query, criteriaBuilder) -> {
            var predicate = criteriaBuilder.conjunction();

            if (search != null) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicate = criteriaBuilder.and(predicate, criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("codigo")), pattern),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("enunciado")), pattern)
                ));
            }

            if (cursoId != null) {
                predicate = criteriaBuilder.and(predicate, criteriaBuilder.equal(root.get("curso").get("id"), cursoId));
            }

            if (dificultad != null) {
                predicate = criteriaBuilder.and(predicate, criteriaBuilder.equal(root.get("dificultad"), dificultad));
            }

            return predicate;
        };
    }

    @Override
    @Transactional(readOnly = true)
    public PreguntaResponse obtenerPorId(Long id) {
        return PreguntaMapper.toResponse(buscarPregunta(id));
    }

    @Override
    @Transactional
    public PreguntaResponse crear(PreguntaRequest request) {
        validarAlternativas(request.alternativas());
        Curso curso = buscarCurso(request.cursoId());
        String codigo = resolverCodigo(request.codigo(), curso);
        Pregunta pregunta = PreguntaMapper.toEntity(request, curso, codigo);
        return PreguntaMapper.toResponse(preguntaRepository.save(pregunta));
    }

    @Override
    @Transactional
    public PreguntaResponse actualizar(Long id, PreguntaRequest request) {
        validarAlternativas(request.alternativas());
        Pregunta pregunta = buscarPregunta(id);
        Curso curso = buscarCurso(request.cursoId());
        String codigo = resolverCodigoActualizacion(request.codigo(), curso, pregunta);
        PreguntaMapper.updateEntity(pregunta, request, curso, codigo);
        return PreguntaMapper.toResponse(preguntaRepository.save(pregunta));
    }

    @Override
    @Transactional
    public void eliminar(Long id) {
        preguntaRepository.delete(buscarPregunta(id));
    }

    private void validarAlternativas(List<AlternativaRequest> alternativas) {
        if (alternativas == null || alternativas.size() != 5) {
            throw new BusinessException("La pregunta debe tener exactamente 5 alternativas");
        }

        Set<LetraAlternativa> letras = alternativas.stream()
                .map(AlternativaRequest::letra)
                .collect(Collectors.toSet());
        if (!letras.equals(EnumSet.allOf(LetraAlternativa.class))) {
            throw new BusinessException("Las alternativas deben tener exactamente las letras A, B, C, D y E");
        }

        alternativas.forEach(this::validarContenidoAlternativa);
    }

    private void validarContenidoAlternativa(AlternativaRequest alternativa) {
        if (alternativa.tipo() == TipoAlternativa.TEXTO && isBlank(alternativa.contenidoTexto())) {
            throw new BusinessException("Si el tipo de alternativa es TEXTO, contenidoTexto es obligatorio");
        }
        if (alternativa.tipo() == TipoAlternativa.IMAGEN && isBlank(alternativa.imagenUrl())) {
            throw new BusinessException("Si el tipo de alternativa es IMAGEN, imagenUrl es obligatorio");
        }
    }

    private String resolverCodigo(String codigoRequest, Curso curso) {
        String codigo = isBlank(codigoRequest) ? generarCodigo(curso) : codigoRequest.trim().toUpperCase();
        preguntaRepository.findByCodigoIgnoreCase(codigo)
                .ifPresent(pregunta -> {
                    throw new BusinessException("Ya existe una pregunta con el código: " + codigo);
                });
        return codigo;
    }

    private String resolverCodigoActualizacion(String codigoRequest, Curso curso, Pregunta preguntaActual) {
        String codigo = isBlank(codigoRequest) ? preguntaActual.getCodigo() : codigoRequest.trim().toUpperCase();
        preguntaRepository.findByCodigoIgnoreCase(codigo)
                .filter(pregunta -> !pregunta.getId().equals(preguntaActual.getId()))
                .ifPresent(pregunta -> {
                    throw new BusinessException("Ya existe una pregunta con el código: " + codigo);
                });
        return isBlank(codigo) ? generarCodigo(curso) : codigo;
    }

    private String generarCodigo(Curso curso) {
        String prefijo = curso.getCodigo() == null || curso.getCodigo().isBlank()
                ? curso.getNombre().substring(0, Math.min(3, curso.getNombre().length())).toUpperCase()
                : curso.getCodigo().toUpperCase();
        return prefijo + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private Pregunta buscarPregunta(Long id) {
        return preguntaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pregunta no encontrada: " + id));
    }

    private Curso buscarCurso(Long id) {
        return cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado: " + id));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
