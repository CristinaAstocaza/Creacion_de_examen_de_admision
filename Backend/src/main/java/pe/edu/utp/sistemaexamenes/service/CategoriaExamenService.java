package pe.edu.utp.sistemaexamenes.service;

import pe.edu.utp.sistemaexamenes.dto.request.CategoriaExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.request.CategoriaCursoConfigRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaExamenResponse;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaCursoConfigResponse;

import java.util.List;

public interface CategoriaExamenService {
    List<CategoriaExamenResponse> listar();
    CategoriaExamenResponse obtenerPorId(Long id);
    CategoriaExamenResponse crear(CategoriaExamenRequest request);
    CategoriaExamenResponse actualizar(Long id, CategoriaExamenRequest request);
    void eliminar(Long id);
    List<CategoriaCursoConfigResponse> listarCursosConfig(Long id);
    CategoriaCursoConfigResponse crearCursoConfig(Long id, CategoriaCursoConfigRequest request);
    CategoriaCursoConfigResponse actualizarCursoConfig(Long id, Long idConfig, CategoriaCursoConfigRequest request);
    void eliminarCursoConfig(Long id, Long idConfig);
}
