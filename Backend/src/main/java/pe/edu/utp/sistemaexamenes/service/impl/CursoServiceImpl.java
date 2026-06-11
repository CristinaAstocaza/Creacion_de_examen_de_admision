package pe.edu.utp.sistemaexamenes.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.CursoRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CursoResponse;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.mapper.CursoMapper;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.service.CursoService;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CursoServiceImpl implements CursoService {

    private final CursoRepository cursoRepository;

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
        cursoRepository.delete(buscarCurso(id));
    }

    private Curso buscarCurso(Long id) {
        return cursoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado: " + id));
    }
}
