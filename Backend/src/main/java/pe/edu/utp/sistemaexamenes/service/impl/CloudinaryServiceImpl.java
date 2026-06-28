package pe.edu.utp.sistemaexamenes.service.impl;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pe.edu.utp.sistemaexamenes.service.CloudinaryService;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CloudinaryServiceImpl implements CloudinaryService {

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
