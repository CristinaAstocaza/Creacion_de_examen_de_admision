package pe.edu.utp.sistemaexamenes.service;

import pe.edu.utp.sistemaexamenes.dto.response.ArchivoDescargaResponse;

public interface ExamenPdfService {
    ArchivoDescargaResponse generarPdfVersion(Long examenId, String version);
    ArchivoDescargaResponse generarZipVersiones(Long examenId);
    ArchivoDescargaResponse generarPdfSolucionario(Long examenId, String version);
}
