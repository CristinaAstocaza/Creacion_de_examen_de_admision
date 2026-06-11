package pe.edu.utp.sistemaexamenes.dto.response;

import java.util.List;

public record ExamenSolucionarioResponse(
        Long examenId,
        String codigoExamen,
        String nombreExamen,
        List<ExamenVersionSolucionarioResponse> versiones
) {
}
