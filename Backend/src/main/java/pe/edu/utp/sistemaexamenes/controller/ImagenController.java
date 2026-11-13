package pe.edu.utp.sistemaexamenes.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.utp.sistemaexamenes.util.ImagenesLocales;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/** Sirve las imágenes guardadas en el disco del servidor (almacenamiento local). */
@RestController
@RequestMapping("/api/v1/imagenes")
public class ImagenController {

    @GetMapping("/**")
    public ResponseEntity<byte[]> obtener(HttpServletRequest request) throws IOException {
        String uri = request.getRequestURI();
        int i = uri.indexOf(ImagenesLocales.PREFIJO_URL);
        Path archivo = i < 0 ? null : ImagenesLocales.resolver(uri.substring(i + ImagenesLocales.PREFIJO_URL.length()));
        if (archivo == null) {
            return ResponseEntity.notFound().build();
        }
        MediaType tipo = MediaTypeFactory.getMediaType(archivo.getFileName().toString())
                .orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .contentType(tipo)
                // El nombre es único (UUID): la imagen nunca cambia.
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .body(Files.readAllBytes(archivo));
    }
}
