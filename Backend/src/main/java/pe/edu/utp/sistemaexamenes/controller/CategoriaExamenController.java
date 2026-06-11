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
import pe.edu.utp.sistemaexamenes.dto.request.CategoriaCursoConfigRequest;
import pe.edu.utp.sistemaexamenes.dto.request.CategoriaExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaCursoConfigResponse;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaExamenResponse;
import pe.edu.utp.sistemaexamenes.service.CategoriaExamenService;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/categorias", "/api/v1/categorias-examen"})
@RequiredArgsConstructor
public class CategoriaExamenController {

    private final CategoriaExamenService categoriaExamenService;

    @GetMapping
    public List<CategoriaExamenResponse> listar() {
        return categoriaExamenService.listar();
    }

    @GetMapping("/{id}")
    public CategoriaExamenResponse obtenerPorId(@PathVariable Long id) {
        return categoriaExamenService.obtenerPorId(id);
    }

    @PostMapping
    public ResponseEntity<CategoriaExamenResponse> crear(@Valid @RequestBody CategoriaExamenRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoriaExamenService.crear(request));
    }

    @PutMapping("/{id}")
    public CategoriaExamenResponse actualizar(@PathVariable Long id, @Valid @RequestBody CategoriaExamenRequest request) {
        return categoriaExamenService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        categoriaExamenService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/config-cursos")
    public List<CategoriaCursoConfigResponse> listarCursosConfig(@PathVariable Long id) {
        return categoriaExamenService.listarCursosConfig(id);
    }

    @PostMapping("/{id}/config-cursos")
    public ResponseEntity<CategoriaCursoConfigResponse> crearCursoConfig(@PathVariable Long id, @Valid @RequestBody CategoriaCursoConfigRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoriaExamenService.crearCursoConfig(id, request));
    }

    @PutMapping("/{id}/config-cursos/{idConfig}")
    public CategoriaCursoConfigResponse actualizarCursoConfig(@PathVariable Long id, @PathVariable Long idConfig, @Valid @RequestBody CategoriaCursoConfigRequest request) {
        return categoriaExamenService.actualizarCursoConfig(id, idConfig, request);
    }

    @DeleteMapping("/{id}/config-cursos/{idConfig}")
    public ResponseEntity<Void> eliminarCursoConfig(@PathVariable Long id, @PathVariable Long idConfig) {
        categoriaExamenService.eliminarCursoConfig(id, idConfig);
        return ResponseEntity.noContent().build();
    }
}
