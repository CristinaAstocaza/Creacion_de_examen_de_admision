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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.utp.sistemaexamenes.dto.request.PreguntaRequest;
import pe.edu.utp.sistemaexamenes.dto.response.PreguntaResponse;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.service.PreguntaService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/preguntas")
@RequiredArgsConstructor
public class PreguntaController {

    private final PreguntaService preguntaService;

    @GetMapping
    public List<PreguntaResponse> listar(@RequestParam(required = false) String search,
                                          @RequestParam(required = false) String busqueda,
                                          @RequestParam(required = false) Long cursoId,
                                          @RequestParam(required = false) NivelDificultad dificultad) {
        String textoBusqueda = busqueda != null ? busqueda : search;
        return preguntaService.listar(textoBusqueda, cursoId, dificultad);
    }

    @GetMapping("/{id}")
    public PreguntaResponse obtenerPorId(@PathVariable Long id) {
        return preguntaService.obtenerPorId(id);
    }

    @PostMapping
    public ResponseEntity<PreguntaResponse> crear(@Valid @RequestBody PreguntaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(preguntaService.crear(request));
    }

    @PutMapping("/{id}")
    public PreguntaResponse actualizar(@PathVariable Long id, @Valid @RequestBody PreguntaRequest request) {
        return preguntaService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        preguntaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
