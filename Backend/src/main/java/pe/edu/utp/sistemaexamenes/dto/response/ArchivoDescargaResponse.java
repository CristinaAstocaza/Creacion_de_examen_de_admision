package pe.edu.utp.sistemaexamenes.dto.response;

public record ArchivoDescargaResponse(
        String nombreArchivo,
        String contentType,
        byte[] contenido
) {
}
