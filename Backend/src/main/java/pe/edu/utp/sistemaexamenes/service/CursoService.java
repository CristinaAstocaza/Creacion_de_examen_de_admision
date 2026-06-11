package pe.edu.utp.sistemaexamenes.service;

import pe.edu.utp.sistemaexamenes.dto.request.CursoRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CursoResponse;

import java.util.List;

public interface CursoService {
    List<CursoResponse> listar();
    CursoResponse obtenerPorId(Long id);
    CursoResponse crear(CursoRequest request);
    CursoResponse actualizar(Long id, CursoRequest request);
    void eliminar(Long id);
}
