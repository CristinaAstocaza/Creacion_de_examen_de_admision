package pe.edu.utp.sistemaexamenes.dto.request;

/**
 * Configuración opcional de carátula enviada al descargar el PDF.
 * Permite aplicar el diseño actual del localStorage aunque el examen
 * se haya generado sin logo u otros datos de portada.
 */
public record CaratulaPdfRequest(
        String nombreUniversidad,
        String tituloExamen,
        String modalidad,
        String colorPortada,
        String logoUrl,
        String instruccionesPortada
) {
}
