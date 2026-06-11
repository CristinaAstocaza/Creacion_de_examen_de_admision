package pe.edu.utp.sistemaexamenes.service;

import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenSolucionarioResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenVersionResponse;

import java.util.List;

public interface ExamenService {
    ExamenResponse generar(GenerarExamenRequest request);
    List<ExamenResponse> listar();
    ExamenResponse obtenerPorId(Long id);
    ExamenVersionResponse obtenerVersion(Long id, String version);
    ExamenSolucionarioResponse obtenerSolucionario(Long id);
}
