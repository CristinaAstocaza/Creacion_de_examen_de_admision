package pe.edu.utp.sistemaexamenes.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.utp.sistemaexamenes.dto.request.CursoRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CursoResponse;
import pe.edu.utp.sistemaexamenes.repository.PreguntaRepository;
import pe.edu.utp.sistemaexamenes.service.CursoService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cursos")
@RequiredArgsConstructor
public class CursoController {

    private final CursoService cursoService;
    private final PreguntaRepository preguntaRepository;

    @GetMapping
    public List<CursoResponse> listar() {
        return cursoService.listar();
    }

    /** Preguntas del banco por curso (para la sección Cursos), sin descargar las preguntas. */
    @GetMapping("/conteo-preguntas")
    public List<Map<String, Object>> conteoPreguntas() {
        return preguntaRepository.contarPorCurso().stream()
                .map(fila -> Map.<String, Object>of(
                        "cursoId", fila[0],
                        "total", fila[1],
                        "activas", fila[2] == null ? 0L : fila[2]))
                .toList();
    }

    @GetMapping("/{id}")
    public CursoResponse obtenerPorId(@PathVariable Long id) {
        return cursoService.obtenerPorId(id);
    }

    @PostMapping
    public ResponseEntity<CursoResponse> crear(@Valid @RequestBody CursoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cursoService.crear(request));
    }

    @PutMapping("/{id}")
    public CursoResponse actualizar(@PathVariable Long id, @Valid @RequestBody CursoRequest request) {
        return cursoService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        cursoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
