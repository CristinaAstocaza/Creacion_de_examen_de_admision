package pe.edu.utp.sistemaexamenes.service.impl;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import pe.edu.utp.sistemaexamenes.service.AlmacenamientoImagenService;
import pe.edu.utp.sistemaexamenes.util.ImagenesLocales;

import java.io.IOException;

/** Guarda las imágenes en el disco del servidor. Es el almacenamiento por defecto (no requiere internet). */
@Service
@ConditionalOnProperty(name = "app.imagenes.almacenamiento", havingValue = "local", matchIfMissing = true)
public class AlmacenamientoLocalServiceImpl implements AlmacenamientoImagenService {

    @Override
    public String uploadImage(byte[] imageBytes, String folder) {
        try {
            return ImagenesLocales.guardar(imageBytes, folder);
        } catch (IOException e) {
            throw new RuntimeException("Error al guardar la imagen en el servidor", e);
        }
    }
}
