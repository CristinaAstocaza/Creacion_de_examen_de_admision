package pe.edu.utp.sistemaexamenes.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.utp.sistemaexamenes.exception.BusinessException;
import pe.edu.utp.sistemaexamenes.service.CursoService;
import pe.edu.utp.sistemaexamenes.service.EscanerService;
import pe.edu.utp.sistemaexamenes.util.ImagenesLocales;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Escaneo desde impresoras/escáneres conectados y extracción de preguntas de las páginas escaneadas.
 */
@RestController
@RequestMapping("/api/v1/escaner")
@RequiredArgsConstructor
public class EscanerController {

    private static final long TIMEOUT_EXTRACCION_MIN = 15;

    private final EscanerService escanerService;
    private final CursoService cursoService;

    @Value("${cloudinary.cloud-name}")
    private String cloudinaryCloudName;

    @Value("${cloudinary.api-key}")
    private String cloudinaryApiKey;

    @Value("${cloudinary.api-secret}")
    private String cloudinaryApiSecret;

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    public record EscanearRequest(String dispositivoId, Integer dpi, String modo) {
    }

    @GetMapping("/dispositivos")
    public List<EscanerService.Dispositivo> listarDispositivos() {
        return escanerService.listarDispositivos();
    }

    @PostMapping(value = "/escanear", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> escanear(@RequestBody EscanearRequest request) {
        byte[] imagen = escanerService.escanear(
                request.dispositivoId(),
                request.dpi() == null ? 300 : request.dpi(),
                request.modo());
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(imagen);
    }

    /**
     * Recibe páginas escaneadas (imágenes o PDF) y devuelve todas las preguntas encontradas,
     * con las figuras ya recortadas. Mismo formato que /preguntas/importar/imagenes.
     */
    @PostMapping("/extraer")
    public ResponseEntity<String> extraerPreguntas(
            @RequestParam("paginas") MultipartFile[] paginas,
            @RequestParam("cursoId") Long cursoId) throws Exception {

        if (paginas == null || paginas.length == 0) {
            throw new BusinessException("Escanea o sube al menos una página.");
        }
        String cursoNombre = cursoService.obtenerPorId(cursoId).nombre();
        String carpeta = "examenes_admi/escaneos/" + cursoNombre.toLowerCase().replaceAll("[^a-z0-9]", "_");

        List<File> temporales = new ArrayList<>();
        List<String> comando = new ArrayList<>(Arrays.asList(
                "python", "scripts/procesar_escaneo.py",
                geminiApiKey, carpeta, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret));
        File log = File.createTempFile("escaneo_ia_", ".txt");
        try {
            for (int i = 0; i < paginas.length; i++) {
                String nombre = paginas[i].getOriginalFilename();
                String extension = nombre != null && nombre.contains(".") ? nombre.substring(nombre.lastIndexOf('.')) : ".png";
                File tmp = File.createTempFile("pagina_escaneada_" + i + "_", extension.toLowerCase());
                paginas[i].transferTo(tmp);
                temporales.add(tmp);
                comando.add(tmp.getAbsolutePath());
            }

            ProcessBuilder pb = new ProcessBuilder(comando);
            ImagenesLocales.configurarEntorno(pb);
            pb.redirectErrorStream(true);
            pb.redirectOutput(log);
            Process proceso = pb.start();
            if (!proceso.waitFor(TIMEOUT_EXTRACCION_MIN, TimeUnit.MINUTES)) {
                proceso.destroyForcibly();
                return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                        .body("{\"error\":\"La extracción tardó demasiado. Prueba con menos páginas.\"}");
            }
            String salida = new String(Files.readAllBytes(log.toPath()), StandardCharsets.UTF_8).trim();
            int inicio = salida.lastIndexOf("{\"total_preguntas\"");
            if (proceso.exitValue() != 0 || inicio < 0) {
                int inicioError = salida.lastIndexOf("{\"error\"");
                String error = inicioError >= 0 ? salida.substring(inicioError) : "{\"error\":\"No se pudieron extraer preguntas de las páginas.\"}";
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
            }
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(salida.substring(inicio));
        } finally {
            temporales.forEach(File::delete);
            log.delete();
        }
    }
}
