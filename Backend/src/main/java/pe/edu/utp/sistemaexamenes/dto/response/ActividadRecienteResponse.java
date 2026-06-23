package pe.edu.utp.sistemaexamenes.dto.response;

import java.time.LocalDateTime;

public record ActividadRecienteResponse(
    Long id,
    String tiempo,
    String fecha,
    String iniciales,
    String usuario,
    String accion,
    String objetivo
) {}
