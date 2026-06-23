package pe.edu.utp.sistemaexamenes.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.utp.sistemaexamenes.dto.response.DashboardResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ActividadRecienteResponse;
import pe.edu.utp.sistemaexamenes.repository.PreguntaRepository;
import pe.edu.utp.sistemaexamenes.repository.CategoriaExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.HistorialAccionRepository;
import pe.edu.utp.sistemaexamenes.model.HistorialAccion;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final PreguntaRepository preguntaRepository;
    private final CategoriaExamenRepository categoriaRepository;
    private final ExamenRepository examenRepository;
    private final HistorialAccionRepository historialRepository;

    @GetMapping("/stats")
    public DashboardResponse obtenerStats() {
        long totalPreguntas = preguntaRepository.count();
        long totalAreas = categoriaRepository.count();
        long totalExamenes = examenRepository.count();
        
        // Simulación de pendientes (en una app real sería basado en un campo 'estado')
        long pendientes = preguntaRepository.count(); // Placeholder

        // Distribución por Área (limitado a top 5)
        List<Map<String, Object>> distArea = categoriaRepository.findAll().stream()
            .map(c -> {
                Map<String, Object> map = new HashMap<>();
                long count = c.getCursosConfig().stream()
                    .flatMap(config -> config.getCurso().getPreguntas().stream())
                    .count();
                map.put("name", c.getNombre());
                map.put("count", count);
                map.put("percentage", totalPreguntas > 0 ? (count * 100 / totalPreguntas) : 0);
                return map;
            })
            .sorted((a, b) -> Long.compare((long)b.get("count"), (long)a.get("count")))
            .limit(5)
            .collect(Collectors.toList());

        // Actividades Recientes
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd MMM");
        
        List<ActividadRecienteResponse> actividades = historialRepository.findAll().stream()
            .sorted((a, b) -> b.getFecha().compareTo(a.getFecha()))
            .limit(5)
            .map(h -> new ActividadRecienteResponse(
                h.getId(),
                h.getFecha().format(timeFormatter),
                h.getFecha().format(dateFormatter),
                h.getUsuario() != null ? h.getUsuario().substring(0, Math.min(2, h.getUsuario().length())).toUpperCase() : "SY",
                h.getUsuario() != null ? h.getUsuario() : "Sistema",
                h.getAccion(),
                h.getModulo()
            ))
            .collect(Collectors.toList());

        return new DashboardResponse(
            totalPreguntas, 
            totalAreas, 
            totalExamenes, 
            pendientes, 
            distArea, 
            new ArrayList<>(), // Dificultad (se puede expandir)
            new ArrayList<>(), // Top Areas
            actividades
        );
    }
}
