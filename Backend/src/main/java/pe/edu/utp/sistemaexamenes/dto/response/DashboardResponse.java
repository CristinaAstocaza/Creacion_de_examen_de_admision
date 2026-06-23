package pe.edu.utp.sistemaexamenes.dto.response;

import java.util.List;
import java.util.Map;

public record DashboardResponse(
    long totalPreguntas,
    long totalAreas,
    long totalExamenes,
    long pendientesRevision,
    List<Map<String, Object>> distribucionPorArea,
    List<Map<String, Object>> distribucionPorDificultad,
    List<Map<String, Object>> topAreas,
    List<ActividadRecienteResponse> actividadesRecientes
) {}
