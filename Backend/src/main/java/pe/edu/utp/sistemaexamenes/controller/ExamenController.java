package pe.edu.utp.sistemaexamenes.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.ArchivoDescargaResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenSolucionarioResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenVersionResponse;
import pe.edu.utp.sistemaexamenes.service.ExamenService;
import pe.edu.utp.sistemaexamenes.service.ExamenPdfService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/examenes")
@RequiredArgsConstructor
public class ExamenController {

    private final ExamenService examenService;
    private final ExamenPdfService examenPdfService;

    @PostMapping("/generar")
    public ResponseEntity<ExamenResponse> generar(@Valid @RequestBody GenerarExamenRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(examenService.generar(request));
    }

    @GetMapping
    public List<ExamenResponse> listar() {
        return examenService.listar();
    }

    @GetMapping("/{id}")
    public ExamenResponse obtenerPorId(@PathVariable Long id) {
        return examenService.obtenerPorId(id);
    }

    @GetMapping("/{id}/versiones/{version}")
    public ExamenVersionResponse obtenerVersion(@PathVariable Long id, @PathVariable String version) {
        return examenService.obtenerVersion(id, version);
    }

    @GetMapping("/{id}/solucionario")
    public ExamenSolucionarioResponse obtenerSolucionario(@PathVariable Long id) {
        return examenService.obtenerSolucionario(id);
    }

    @GetMapping("/{id}/versiones/{version}/pdf")
    public ResponseEntity<byte[]> descargarPdfVersion(@PathVariable Long id, @PathVariable String version) {
        return descargar(examenPdfService.generarPdfVersion(id, version));
    }

    @GetMapping("/{id}/pdfs")
    public ResponseEntity<byte[]> descargarPdfs(@PathVariable Long id) {
        return descargar(examenPdfService.generarZipVersiones(id));
    }

    @GetMapping("/{id}/versiones/{version}/solucionario-pdf")
    public ResponseEntity<byte[]> descargarPdfSolucionario(@PathVariable Long id, @PathVariable String version) {
        return descargar(examenPdfService.generarPdfSolucionario(id, version));
    }

    private ResponseEntity<byte[]> descargar(ArchivoDescargaResponse archivo) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(archivo.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + archivo.nombreArchivo() + "\"")
                .body(archivo.contenido());
    }
}
