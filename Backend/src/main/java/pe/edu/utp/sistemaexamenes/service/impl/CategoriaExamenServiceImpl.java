package pe.edu.utp.sistemaexamenes.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.CategoriaCursoConfigRequest;
import pe.edu.utp.sistemaexamenes.dto.request.CategoriaExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaCursoConfigResponse;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaExamenResponse;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.mapper.CategoriaExamenMapper;
import pe.edu.utp.sistemaexamenes.model.CategoriaCursoConfig;
import pe.edu.utp.sistemaexamenes.model.CategoriaExamen;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.repository.CategoriaCursoConfigRepository;
import pe.edu.utp.sistemaexamenes.repository.CategoriaExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.service.CategoriaExamenService;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoriaExamenServiceImpl implements CategoriaExamenService {

    private final CategoriaExamenRepository categoriaExamenRepository;
    private final CategoriaCursoConfigRepository categoriaCursoConfigRepository;
    private final CursoRepository cursoRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CategoriaExamenResponse> listar() {
        return categoriaExamenRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CategoriaExamenResponse obtenerPorId(Long id) {
        return toResponse(buscarCategoria(id));
    }

    @Override
    @Transactional
    public CategoriaExamenResponse crear(CategoriaExamenRequest request) {
        CategoriaExamen categoria = CategoriaExamenMapper.toEntity(request);
        return toResponse(categoriaExamenRepository.save(categoria));
    }

    @Override
    @Transactional
    public CategoriaExamenResponse actualizar(Long id, CategoriaExamenRequest request) {
        CategoriaExamen categoria = buscarCategoria(id);
        CategoriaExamenMapper.updateEntity(categoria, request);
        return toResponse(categoriaExamenRepository.save(categoria));
    }

    @Override
    @Transactional
    public void eliminar(Long id) {
        CategoriaExamen categoria = buscarCategoria(id);
        categoriaExamenRepository.delete(categoria);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoriaCursoConfigResponse> listarCursosConfig(Long id) {
        buscarCategoria(id);
        return categoriaCursoConfigRepository.findByCategoriaExamenIdAndActivoTrue(id).stream()
                .map(this::toConfigResponse)
                .toList();
    }

    @Override
    @Transactional
    public CategoriaCursoConfigResponse crearCursoConfig(Long id, CategoriaCursoConfigRequest request) {
        CategoriaExamen categoria = buscarCategoria(id);
        Curso curso = buscarCurso(request.cursoId());
        CategoriaCursoConfig config = categoriaCursoConfigRepository.findByCategoriaExamenIdAndCursoId(id, request.cursoId())
                .map(asignacion -> {
                    asignacion.setActivo(true);
                    asignacion.setCantidadSugerida(request.cantidadSugerida());
                    return asignacion;
                })
                .orElseGet(() -> CategoriaCursoConfig.builder()
                        .categoriaExamen(categoria)
                        .curso(curso)
                        .cantidadSugerida(request.cantidadSugerida())
                        .activo(request.activo() == null || request.activo())
                        .build());

        return toConfigResponse(categoriaCursoConfigRepository.save(config));
    }

    @Override
    @Transactional
    public CategoriaCursoConfigResponse actualizarCursoConfig(Long id, Long idConfig, CategoriaCursoConfigRequest request) {
        buscarCategoria(id);
        CategoriaCursoConfig config = categoriaCursoConfigRepository.findByIdAndCategoriaExamenId(idConfig, id)
                .orElseThrow(() -> new ResourceNotFoundException("Configuración de curso no encontrada: " + idConfig));
        Curso curso = buscarCurso(request.cursoId());
        config.setCurso(curso);
        config.setCantidadSugerida(request.cantidadSugerida());
        if (request.activo() != null) {
            config.setActivo(request.activo());
        }
        return toConfigResponse(categoriaCursoConfigRepository.save(config));
    }

    @Override
    @Transactional
    public void eliminarCursoConfig(Long id, Long idConfig) {
        buscarCategoria(id);
        CategoriaCursoConfig config = categoriaCursoConfigRepository.findByIdAndCategoriaExamenId(idConfig, id)
                .orElseThrow(() -> new ResourceNotFoundException("Configuración de curso no encontrada: " + idConfig));
        config.setActivo(false);
        categoriaCursoConfigRepository.save(config);
    }

    private CategoriaExamen buscarCategoria(Long id) {
        return categoriaExamenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría de examen no encontrada: " + id));
    }

    private Curso buscarCurso(Long id) {
        return cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado: " + id));
    }

    private CategoriaExamenResponse toResponse(CategoriaExamen categoria) {
        long totalPreguntas = categoria.getCursosConfig().stream()
                .filter(CategoriaCursoConfig::getActivo)
                .map(CategoriaCursoConfig::getCurso)
                .mapToLong(curso -> curso.getPreguntas().size())
                .sum();
        return CategoriaExamenMapper.toResponse(categoria, totalPreguntas);
    }

    private CategoriaCursoConfigResponse toConfigResponse(CategoriaCursoConfig config) {
        return new CategoriaCursoConfigResponse(
                config.getId(),
                config.getCategoriaExamen().getId(),
                config.getCategoriaExamen().getNombre(),
                config.getCurso().getId(),
                config.getCurso().getNombre(),
                config.getCurso().getCodigo(),
                config.getCantidadSugerida(),
                config.getActivo(),
                config.getFechaConfiguracion()
        );
    }
}
