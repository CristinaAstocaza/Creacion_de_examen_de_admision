package pe.edu.utp.sistemaexamenes.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.utp.sistemaexamenes.dto.request.PreguntaRequest;
import pe.edu.utp.sistemaexamenes.dto.response.PreguntaResponse;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.service.CursoService;
import pe.edu.utp.sistemaexamenes.service.GeminiService;
import pe.edu.utp.sistemaexamenes.service.PdfExtractorService;
import pe.edu.utp.sistemaexamenes.service.PreguntaService;
import pe.edu.utp.sistemaexamenes.service.impl.PdfExtractorServiceImpl;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/preguntas")
@RequiredArgsConstructor
public class PreguntaController {

    private final PreguntaService preguntaService;
    private final PdfExtractorService pdfExtractorService;
    private final GeminiService geminiService;
    private final CursoService cursoService;

    @Value("${cloudinary.cloud-name}")
    private String cloudinaryCloudName;

    @Value("${cloudinary.api-key}")
    private String cloudinaryApiKey;

    @Value("${cloudinary.api-secret}")
    private String cloudinaryApiSecret;

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    @GetMapping
    public List<PreguntaResponse> listar(@RequestParam(required = false) String search,
                                          @RequestParam(required = false) String busqueda,
                                          @RequestParam(required = false) Long cursoId,
                                          @RequestParam(required = false) NivelDificultad dificultad) {
        String textoBusqueda = busqueda != null ? busqueda : search;
        return preguntaService.listar(textoBusqueda, cursoId, dificultad);
    }

    @GetMapping("/test-recorte")
    public ResponseEntity<?> testRecorte() throws Exception {
        // Simular el bounding_box que devolvió Gemini para pregunta 1:
        // bounding_box: [58, 597, 396, 680] con pageHeight=842pt
        
        List<Integer> bbox = List.of(58, 597, 396, 680);
        float pageHeightPt = 842f;
        float scale = 150f / 72f;
        int padding = 12;

        int x      = Math.max(0, (int)(bbox.get(0) * scale) - padding);
        int y      = Math.max(0, (int)((pageHeightPt - bbox.get(3)) * scale) - padding);
        int width  = (int)((bbox.get(2) - bbox.get(0)) * scale) + padding * 2;
        int height = (int)((bbox.get(3) - bbox.get(1)) * scale) + padding * 2;

        return ResponseEntity.ok(Map.of(
            "pageHeightPt", pageHeightPt,
            "scale", scale,
            "bbox_original", bbox,
            "x_calculado", x,
            "y_calculado", y,
            "width_calculado", width,
            "height_calculado", height,
            "formula_y", "(842 - 680) * 2.0833 - 12 = " + 
                         (((int)((pageHeightPt - bbox.get(3)) * scale)) - padding)
        ));
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

    @PostMapping("/guardar")
    public ResponseEntity<List<PreguntaResponse>> guardarLote(@Valid @RequestBody List<PreguntaRequest> requests) {
        List<PreguntaResponse> guardadas = requests.stream()
            .map(preguntaService::crear)
            .toList();
        return ResponseEntity.status(HttpStatus.CREATED).body(guardadas);
    }

    @PostMapping("/importar/pdf-texto")
    public ResponseEntity<String> importarPdfTexto(
            @RequestParam("pdf") MultipartFile file,
            @RequestParam("cursoId") Long cursoId) throws Exception {

        File tempPdf = File.createTempFile("examen_texto_", ".pdf");
        file.transferTo(tempPdf);

        try {
            ProcessBuilder pb = new ProcessBuilder(
                "python", "scripts/procesar_pdf_texto.py",
                tempPdf.getAbsolutePath(),
                geminiApiKey
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int exitCode = process.waitFor();
            
            if (exitCode != 0) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error al procesar PDF texto: " + output);
            }

            String jsonLimpio = output.trim();
            int inicioJson = jsonLimpio.lastIndexOf("{\"preguntas\"");
            if (inicioJson >= 0) {
                jsonLimpio = jsonLimpio.substring(inicioJson);
            } else if (jsonLimpio.contains("{")) {
                jsonLimpio = jsonLimpio.substring(jsonLimpio.indexOf("{"));
            }

            return ResponseEntity.ok(limpiarRespuestas(jsonLimpio));
        } finally {
            tempPdf.delete();
        }
    }

    @PostMapping("/importar/imagenes")
    public ResponseEntity<String> importarImagenes(
            @RequestParam("imagenes") MultipartFile[] files,
            @RequestParam("cursoId") Long cursoId) throws Exception {

        String cursoNombre = cursoService.obtenerPorId(cursoId).nombre();
        String folder = "examenes_admi/" + cursoNombre.toLowerCase().replaceAll("[^a-z0-9]", "_");
        
        List<File> tempImages = new ArrayList<>();
        List<String> command = new ArrayList<>(Arrays.asList(
            "python", "scripts/procesar_imagenes.py",
            geminiApiKey,
            folder,
            cloudinaryCloudName,
            cloudinaryApiKey,
            cloudinaryApiSecret
        ));

        for (int i = 0; i < files.length; i++) {
            String originalFilename = files[i].getOriginalFilename();
            String extension = ".jpg";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            File tempImg = File.createTempFile("img_pregunta_" + i + "_", extension);
            files[i].transferTo(tempImg);
            tempImages.add(tempImg);
            command.add(tempImg.getAbsolutePath());
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int exitCode = process.waitFor();
            
            if (exitCode != 0) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error al procesar imágenes: " + output);
            }

            String jsonLimpio = output.trim();
            int inicioJson = jsonLimpio.lastIndexOf("{\"total_preguntas\"");
            if (inicioJson >= 0) {
                jsonLimpio = jsonLimpio.substring(inicioJson);
            } else if (jsonLimpio.contains("{")) {
                jsonLimpio = jsonLimpio.substring(jsonLimpio.indexOf("{"));
            }

            return ResponseEntity.ok(limpiarRespuestas(jsonLimpio));
        } finally {
            for (File tempImg : tempImages) {
                tempImg.delete();
            }
        }
    }

    private String limpiarRespuestas(String jsonLimpio) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode resultado = mapper.readTree(jsonLimpio);
        
        JsonNode preguntasNode = resultado.get("preguntas");
        if (preguntasNode != null && preguntasNode.isArray()) {
            for (JsonNode preguntaNode : preguntasNode) {
                ObjectNode pregunta = (ObjectNode) preguntaNode;
                JsonNode altsNode = pregunta.get("alternativas");
                if (altsNode != null && altsNode.isArray()) {
                    ArrayNode alts = (ArrayNode) altsNode;
                    for (JsonNode altNode : alts) {
                        ObjectNode alt = (ObjectNode) altNode;
                        alt.remove("es_correcta");
                        alt.remove("respuesta_correcta");
                    }
                }
                pregunta.remove("respuesta_correcta");
                pregunta.remove("es_correcta");
                pregunta.remove("respuesta");
                pregunta.remove("solucion");
            }
        }
        return mapper.writeValueAsString(resultado);
    }

    @PostMapping("/importar/upload-recorte")
    public ResponseEntity<Map<String, String>> uploadRecorte(
            @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Archivo vacío"));
            }
            
            Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudinaryCloudName,
                "api_key", cloudinaryApiKey,
                "api_secret", cloudinaryApiSecret,
                "secure", true
            ));
            
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                "folder", "examenes/recortes",
                "resource_type", "image"
            ));
            
            String secureUrl = (String) uploadResult.get("secure_url");
            return ResponseEntity.ok(Map.of("url", secureUrl));
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al subir recorte: " + e.getMessage()));
        }
    }
}
