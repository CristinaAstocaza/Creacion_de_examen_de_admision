package pe.edu.utp.sistemaexamenes.service.impl;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import pe.edu.utp.sistemaexamenes.service.AlmacenamientoImagenService;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/** Sube las imágenes a Cloudinary (requiere internet). Se activa con app.imagenes.almacenamiento=cloudinary. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.imagenes.almacenamiento", havingValue = "cloudinary")
public class CloudinaryServiceImpl implements AlmacenamientoImagenService {

    private final Cloudinary cloudinary;

    @Override
    public String uploadImage(byte[] imageBytes, String folder) {
        try {
            Map uploadResult = cloudinary.uploader().upload(imageBytes, ObjectUtils.asMap(
                    "folder", folder,
                    "public_id", "examen_" + UUID.randomUUID().toString()
            ));
            return uploadResult.get("url").toString();
        } catch (IOException e) {
            throw new RuntimeException("Error al subir imagen a Cloudinary", e);
        }
    }
}
