package pe.edu.utp.sistemaexamenes.mapper;

import pe.edu.utp.sistemaexamenes.dto.request.CursoRequest;
import pe.edu.utp.sistemaexamenes.dto.response.CursoResponse;
import pe.edu.utp.sistemaexamenes.model.Curso;

public class CursoMapper {

    private CursoMapper() {
    }

    public static Curso toEntity(CursoRequest request) {
        return Curso.builder()
                .nombre(request.nombre())
                .codigo(request.codigo())
                .descripcion(request.descripcion())
                .activo(request.activo() == null || request.activo())
                .build();
    }

    public static void updateEntity(Curso curso, CursoRequest request) {
        curso.setNombre(request.nombre());
        curso.setCodigo(request.codigo());
        curso.setDescripcion(request.descripcion());
        if (request.activo() != null) {
            curso.setActivo(request.activo());
        }
    }

    public static CursoResponse toResponse(Curso curso) {
        return new CursoResponse(
                curso.getId(),
                curso.getNombre(),
                curso.getCodigo(),
                curso.getDescripcion(),
                curso.getActivo(),
                curso.getFechaCreacion()
        );
    }
}
