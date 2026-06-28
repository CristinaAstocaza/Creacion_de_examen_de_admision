package pe.edu.utp.sistemaexamenes.service;

public interface CloudinaryService {
    String uploadImage(byte[] imageBytes, String folder);
}
