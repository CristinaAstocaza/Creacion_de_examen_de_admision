package pe.edu.utp.sistemaexamenes.service;

import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

public interface PdfExtractorService {
    Map<Integer, String> extractAndUploadImages(MultipartFile file, String folder);
}
