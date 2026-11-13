package pe.edu.utp.sistemaexamenes.service;

/**
 * Guarda imágenes (recortes, figuras, páginas escaneadas) y devuelve la URL con la que se muestran.
 * Implementaciones: local en disco (por defecto, funciona sin internet) o Cloudinary.
 * Se elige con la propiedad {@code app.imagenes.almacenamiento} = local | cloudinary.
 */
public interface AlmacenamientoImagenService {
    String uploadImage(byte[] imageBytes, String folder);
}
