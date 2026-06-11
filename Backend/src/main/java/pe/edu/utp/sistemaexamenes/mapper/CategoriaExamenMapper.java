package pe.edu.utp.sistemaexamenes.mapper;

import pe.edu.utp.sistemaexamenes.dto.request.CategoriaExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CategoriaExamenResponse;
import pe.edu.utp.sistemaexamenes.model.CategoriaExamen;

public class CategoriaExamenMapper {

    private CategoriaExamenMapper() {
    }

    public static CategoriaExamen toEntity(CategoriaExamenRequest request) {
        return CategoriaExamen.builder()
                .nombre(request.nombre())
                .descripcion(request.descripcion())
                .activo(request.activo() == null || request.activo())
                .build();
    }

    public static void updateEntity(CategoriaExamen categoria, CategoriaExamenRequest request) {
        categoria.setNombre(request.nombre());
        categoria.setDescripcion(request.descripcion());
        if (request.activo() != null) {
            categoria.setActivo(request.activo());
        }
    }

    public static CategoriaExamenResponse toResponse(CategoriaExamen categoria, Long totalPreguntas) {
        return new CategoriaExamenResponse(
                categoria.getId(),
                categoria.getNombre(),
                categoria.getDescripcion(),
                categoria.getActivo(),
                totalPreguntas,
                categoria.getFechaCreacion()
        );
    }
}
