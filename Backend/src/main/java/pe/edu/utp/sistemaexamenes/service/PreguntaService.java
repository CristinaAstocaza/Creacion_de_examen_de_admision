package pe.edu.utp.sistemaexamenes.service;

import pe.edu.utp.sistemaexamenes.dto.request.PreguntaRequest;
import pe.edu.utp.sistemaexamenes.dto.response.PreguntaResponse;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;

import java.util.List;

public interface PreguntaService {
    List<PreguntaResponse> listar(String search, Long cursoId, NivelDificultad dificultad);
    PreguntaResponse obtenerPorId(Long id);
    PreguntaResponse crear(PreguntaRequest request);
    PreguntaResponse actualizar(Long id, PreguntaRequest request);
    void eliminar(Long id);
}
