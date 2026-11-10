package pe.edu.utp.sistemaexamenes.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.CursoRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CursoResponse;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.mapper.CursoMapper;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.model.Pregunta;
import pe.edu.utp.sistemaexamenes.repository.CategoriaCursoConfigRepository;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenConfiguracionCursoRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenPreguntaRepository;
import pe.edu.utp.sistemaexamenes.repository.PreguntaRepository;
import pe.edu.utp.sistemaexamenes.service.CursoService;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CursoServiceImpl implements CursoService {

    private final CursoRepository cursoRepository;
    private final CategoriaCursoConfigRepository categoriaCursoConfigRepository;
    private final ExamenConfiguracionCursoRepository examenConfiguracionCursoRepository;
    private final PreguntaRepository preguntaRepository;
    private final ExamenPreguntaRepository examenPreguntaRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CursoResponse> listar() {
        return cursoRepository.findAll().stream()
                .map(CursoMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CursoResponse obtenerPorId(Long id) {
        return CursoMapper.toResponse(buscarCurso(id));
    }

    @Override
    @Transactional
    public CursoResponse crear(CursoRequest request) {
        Curso curso = CursoMapper.toEntity(request);
        return CursoMapper.toResponse(cursoRepository.save(curso));
    }

    @Override
    @Transactional
    public CursoResponse actualizar(Long id, CursoRequest request) {
        Curso curso = buscarCurso(id);
        CursoMapper.updateEntity(curso, request);
        return CursoMapper.toResponse(cursoRepository.save(curso));
    }

    @Override
    @Transactional
    public void eliminar(Long id) {
        Curso curso = buscarCurso(id);

        // 1. Eliminar configuraciones de este curso en todas las áreas
        if (curso.getCategoriasCursoConfig() != null && !curso.getCategoriasCursoConfig().isEmpty()) {
            categoriaCursoConfigRepository.deleteAll(curso.getCategoriasCursoConfig());
        }

        // 2. Eliminar configuraciones de este curso en exámenes
        if (curso.getConfiguracionesExamen() != null && !curso.getConfiguracionesExamen().isEmpty()) {
            examenConfiguracionCursoRepository.deleteAll(curso.getConfiguracionesExamen());
        }

        // 3. Eliminar preguntas asociadas (y sus referencias en exámenes y alternativas)
        if (curso.getPreguntas() != null && !curso.getPreguntas().isEmpty()) {
            for (Pregunta pregunta : curso.getPreguntas()) {
                if (pregunta.getExamenesPregunta() != null && !pregunta.getExamenesPregunta().isEmpty()) {
                    examenPreguntaRepository.deleteAll(pregunta.getExamenesPregunta());
                }
            }
            preguntaRepository.deleteAll(curso.getPreguntas());
        }

        // 4. Eliminar el curso
        cursoRepository.delete(curso);
    }

    private Curso buscarCurso(Long id) {
        return cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado: " + id));
    }
}
