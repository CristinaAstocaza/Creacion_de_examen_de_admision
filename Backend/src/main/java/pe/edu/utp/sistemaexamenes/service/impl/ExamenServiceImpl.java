package pe.edu.utp.sistemaexamenes.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenCursoRequest;
import pe.edu.utp.sistemaexamenes.dto.request.GenerarExamenRequest;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenSolucionarioResponse;
import pe.edu.utp.sistemaexamenes.dto.response.ExamenVersionResponse;
import pe.edu.utp.sistemaexamenes.enums.EstadoExamen;
import pe.edu.utp.sistemaexamenes.enums.FormatoHoja;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import java.util.regex.Pattern;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.enums.TipoAccion;
import pe.edu.utp.sistemaexamenes.exception.BusinessException;
import pe.edu.utp.sistemaexamenes.exception.ResourceNotFoundException;
import pe.edu.utp.sistemaexamenes.mapper.ExamenMapper;
import pe.edu.utp.sistemaexamenes.model.CategoriaExamen;
import pe.edu.utp.sistemaexamenes.model.Curso;
import pe.edu.utp.sistemaexamenes.model.Examen;
import pe.edu.utp.sistemaexamenes.model.ExamenConfiguracionCurso;
import pe.edu.utp.sistemaexamenes.model.ExamenPregunta;
import pe.edu.utp.sistemaexamenes.model.ExamenVersion;
import pe.edu.utp.sistemaexamenes.model.HistorialAccion;
import pe.edu.utp.sistemaexamenes.model.Pregunta;
import pe.edu.utp.sistemaexamenes.repository.CategoriaExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.CursoRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenRepository;
import pe.edu.utp.sistemaexamenes.repository.ExamenVersionRepository;
import pe.edu.utp.sistemaexamenes.repository.HistorialAccionRepository;
import pe.edu.utp.sistemaexamenes.repository.PreguntaRepository;
import pe.edu.utp.sistemaexamenes.service.ExamenService;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class ExamenServiceImpl implements ExamenService {

    /** Límite de seguridad; la cantidad real la decide quien arma el examen (100, 60, 40...). */
    private static final int MAX_PREGUNTAS_EXAMEN = 300;
    /** Letra o código del tema impreso en el examen: 1 a 5 letras/números (A, B, P, T1...). */
    private static final Pattern CODIGO_VERSION = Pattern.compile("^[A-Z0-9]{1,5}$");
    private static final List<LetraAlternativa> LETRAS = List.of(
            LetraAlternativa.A,
            LetraAlternativa.B,
            LetraAlternativa.C,
            LetraAlternativa.D,
            LetraAlternativa.E
    );

    private final ExamenRepository examenRepository;
    private final ExamenVersionRepository examenVersionRepository;
    private final CategoriaExamenRepository categoriaExamenRepository;
    private final CursoRepository cursoRepository;
    private final PreguntaRepository preguntaRepository;
    private final HistorialAccionRepository historialAccionRepository;

    @Override
    @Transactional
    public ExamenResponse generar(GenerarExamenRequest request) {
        validarRequest(request);
        CategoriaExamen categoria = buscarCategoria(request.idCategoria());
        List<Curso> cursos = validarYCargarCursos(request.cursos());
        List<Pregunta> preguntasBase = seleccionarPreguntasBase(request.cursos(), cursos);
        validarCantidadPreguntasBase(preguntasBase, totalSolicitado(request));

        Examen examen = Examen.builder()
                .codigo(generarCodigoExamen())
                .nombre(request.nombreExamen())
                .descripcion("Examen generado automáticamente")
                .duracionMinutos(120)
                .cantidadVersiones(request.cantidadVersiones())
                .aleatorizarPreguntas(request.aleatorizarPreguntas())
                .aleatorizarAlternativas(request.aleatorizarAlternativas())
                .estado(EstadoExamen.ACTIVO)
                .fechaPublicacion(LocalDateTime.now())
                .categoriaExamen(categoria)
                .nombreUniversidad(request.nombreUniversidad())
                .tituloExamen(request.tituloExamen())
                .modalidad(request.modalidad())
                .colorPortada(request.colorPortada())
                .logoUrl(request.logoUrl())
                .instruccionesPortada(request.instruccionesPortada())
                .tipoPrueba(request.tipoPrueba() == null || request.tipoPrueba().isBlank() ? null : request.tipoPrueba().trim())
                .formatoHoja(request.formatoHoja() == null ? FormatoHoja.A4 : request.formatoHoja())
                .build();

        agregarConfiguraciones(examen, request.cursos(), cursos);
        agregarVersiones(examen, request, preguntasBase);

        Examen examenGuardado = examenRepository.save(examen);
        registrarHistorial(examenGuardado);
        return ExamenMapper.toResponse(examenGuardado, false);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExamenResponse> listar() {
        return examenRepository.findAll().stream()
                .map(examen -> ExamenMapper.toResponse(examen, false))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ExamenResponse obtenerPorId(Long id) {
        return ExamenMapper.toResponse(buscarExamen(id), false);
    }

    @Override
    @Transactional(readOnly = true)
    public ExamenVersionResponse obtenerVersion(Long id, String version) {
        ExamenVersion examenVersion = examenVersionRepository.findByExamenIdAndCodigoVersion(id, version.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Versión de examen no encontrada: " + version));
        return ExamenMapper.toVersionResponse(examenVersion, true);
    }

    @Override
    @Transactional(readOnly = true)
    public ExamenSolucionarioResponse obtenerSolucionario(Long id) {
        return ExamenMapper.toSolucionarioResponse(buscarExamen(id));
    }

    private void validarRequest(GenerarExamenRequest request) {
        if (request.cantidadVersiones() == null || request.cantidadVersiones() < 1) {
            throw new BusinessException("La cantidad de versiones debe ser mayor o igual a 1");
        }
        if (request.cursos() == null || request.cursos().isEmpty()) {
            throw new BusinessException("Debe seleccionar al menos un curso");
        }
        request.cursos().forEach(curso -> {
            if (curso.cantidadTotal() == null || curso.cantidadTotal() < 1) {
                throw new BusinessException("La cantidad total por curso debe ser mayor a 0");
            }
        });
        int total = totalSolicitado(request);
        if (total < 1 || total > MAX_PREGUNTAS_EXAMEN) {
            throw new BusinessException("El examen debe tener entre 1 y " + MAX_PREGUNTAS_EXAMEN + " preguntas. Solicitadas: " + total);
        }
        resolverCodigosVersion(request);
    }

    private int totalSolicitado(GenerarExamenRequest request) {
        return request.cursos().stream().mapToInt(GenerarExamenCursoRequest::cantidadTotal).sum();
    }

    /**
     * Letras de tema de cada versión. Si no se envían se usan A, B, C...
     * Deben ser únicas dentro del examen.
     */
    private List<String> resolverCodigosVersion(GenerarExamenRequest request) {
        int cantidad = request.cantidadVersiones();
        List<String> enviados = request.codigosVersion();
        if (enviados == null || enviados.isEmpty()) {
            return IntStream.rangeClosed(1, cantidad).mapToObj(this::codigoVersion).toList();
        }
        if (enviados.size() != cantidad) {
            throw new BusinessException("Debe indicar una letra de tema por cada versión (" + cantidad + ").");
        }
        List<String> codigos = enviados.stream().map(this::normalizarCodigoVersion).toList();
        if (new HashSet<>(codigos).size() != codigos.size()) {
            throw new BusinessException("Las letras de tema de las versiones no pueden repetirse.");
        }
        return codigos;
    }

    private String normalizarCodigoVersion(String codigo) {
        String limpio = codigo == null ? "" : codigo.trim().toUpperCase();
        if (!CODIGO_VERSION.matcher(limpio).matches()) {
            throw new BusinessException("Letra de tema inválida: '" + codigo + "'. Usa de 1 a 5 letras o números, sin espacios.");
        }
        return limpio;
    }

    @Override
    @Transactional
    public ExamenResponse cambiarCodigoVersion(Long id, String versionActual, String nuevoCodigo) {
        Examen examen = buscarExamen(id);
        String codigo = normalizarCodigoVersion(nuevoCodigo);
        ExamenVersion version = examen.getVersiones().stream()
                .filter(v -> v.getCodigoVersion().equalsIgnoreCase(versionActual))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Versión de examen no encontrada: " + versionActual));
        boolean repetido = examen.getVersiones().stream()
                .anyMatch(v -> v != version && v.getCodigoVersion().equalsIgnoreCase(codigo));
        if (repetido) {
            throw new BusinessException("Ya existe otra versión con el tema " + codigo + " en este examen.");
        }
        version.setCodigoVersion(codigo);
        return ExamenMapper.toResponse(examenRepository.save(examen), false);
    }

    private List<Curso> validarYCargarCursos(List<GenerarExamenCursoRequest> cursosRequest) {
        List<Curso> cursos = new ArrayList<>();
        Set<Long> cursosUnicos = new HashSet<>();
        for (GenerarExamenCursoRequest cursoRequest : cursosRequest) {
            if (!cursosUnicos.add(cursoRequest.idCurso())) {
                throw new BusinessException("No debe repetir el mismo curso en la configuración del examen: " + cursoRequest.idCurso());
            }
            Curso curso = cursoRepository.findById(cursoRequest.idCurso())
                    .orElseThrow(() -> new ResourceNotFoundException("Curso no encontrado: " + cursoRequest.idCurso()));
            validarDistribucionCurso(cursoRequest, curso);
            cursos.add(curso);
        }
        return cursos;
    }

    private void validarDistribucionCurso(GenerarExamenCursoRequest request, Curso curso) {
        boolean usaDificultades = usaDificultades(request);
        if (usaDificultades) {
            int facil = valor(request.cantidadFacil());
            int medio = valor(request.cantidadMedio());
            int dificil = valor(request.cantidadDificil());
            if (facil + medio + dificil != request.cantidadTotal()) {
                throw new BusinessException("La suma por dificultad debe coincidir con la cantidad total del curso " + curso.getNombre());
            }
            validarDisponibilidad(curso, NivelDificultad.FACIL, facil);
            validarDisponibilidad(curso, NivelDificultad.MEDIO, medio);
            validarDisponibilidad(curso, NivelDificultad.DIFICIL, dificil);
        } else {
            int disponibles = preguntaRepository.findByCursoIdAndActivoTrue(curso.getId()).size();
            if (disponibles < request.cantidadTotal()) {
                throw new BusinessException("No hay suficientes preguntas activas en el curso " + curso.getNombre()
                        + " para generar el examen. Solicitadas: " + request.cantidadTotal() + ", disponibles: " + disponibles + ".");
            }
        }
    }

    private void validarDisponibilidad(Curso curso, NivelDificultad dificultad, int cantidad) {
        if (cantidad == 0) {
            return;
        }
        int disponibles = preguntaRepository.findByCursoIdAndDificultadAndActivoTrue(curso.getId(), dificultad).size();
        if (disponibles < cantidad) {
            throw new BusinessException("No hay suficientes preguntas " + dificultad + " en el curso " + curso.getNombre()
                    + ". Solicitadas: " + cantidad + ", disponibles: " + disponibles + ".");
        }
    }

    private void agregarConfiguraciones(Examen examen, List<GenerarExamenCursoRequest> cursosRequest, List<Curso> cursos) {
        for (int i = 0; i < cursosRequest.size(); i++) {
            GenerarExamenCursoRequest request = cursosRequest.get(i);
            ExamenConfiguracionCurso configuracion = ExamenConfiguracionCurso.builder()
                    .examen(examen)
                    .curso(cursos.get(i))
                    .cantidadPreguntas(request.cantidadTotal())
                    .cantidadFacil(request.cantidadFacil())
                    .cantidadMedio(request.cantidadMedio())
                    .cantidadDificil(request.cantidadDificil())
                    .puntajePorPregunta(1.0)
                    .build();
            examen.getConfiguracionesCurso().add(configuracion);
        }
    }

    private void agregarVersiones(Examen examen, GenerarExamenRequest request, List<Pregunta> preguntasBase) {
        List<String> codigos = resolverCodigosVersion(request);
        for (int i = 1; i <= request.cantidadVersiones(); i++) {
            String codigoVersion = codigos.get(i - 1);
            ExamenVersion version = ExamenVersion.builder()
                    .numero(i)
                    .codigoVersion(codigoVersion)
                    .examen(examen)
                    .build();

            List<Pregunta> seleccionadas = new ArrayList<>(preguntasBase);
            if (Boolean.TRUE.equals(request.aleatorizarPreguntas())) {
                Collections.shuffle(seleccionadas);
            }
            IntStream.range(0, seleccionadas.size()).forEach(index -> version.getPreguntas().add(
                    ExamenPregunta.builder()
                            .examenVersion(version)
                            .pregunta(seleccionadas.get(index))
                            .orden(index + 1)
                            .numeroOrden(index + 1)
                            .puntaje(1.0)
                            .alternativasOrdenadas(generarOrdenAlternativas(request.aleatorizarAlternativas()))
                            .build()
            ));
            validarVersionCompleta(version, preguntasBase.size());
            examen.getVersiones().add(version);
        }
    }

    private List<Pregunta> seleccionarPreguntasBase(List<GenerarExamenCursoRequest> cursosRequest, List<Curso> cursos) {
        List<Pregunta> seleccionadas = new ArrayList<>();
        for (int i = 0; i < cursosRequest.size(); i++) {
            seleccionadas.addAll(seleccionarPreguntasCurso(cursosRequest.get(i), cursos.get(i), true));
        }
        return seleccionadas;
    }

    private void validarCantidadPreguntasBase(List<Pregunta> preguntasBase, int total) {
        if (preguntasBase.size() != total) {
            throw new BusinessException("Se esperaban " + total + " preguntas y solo se pudieron seleccionar " + preguntasBase.size()
                    + ". Revise que cada curso tenga suficientes preguntas por dificultad.");
        }
        long unicas = preguntasBase.stream().map(Pregunta::getId).distinct().count();
        if (unicas != total) {
            throw new BusinessException("El conjunto base contiene preguntas repetidas. Revise la configuración de cursos.");
        }
    }

    private void validarVersionCompleta(ExamenVersion version, int esperado) {
        int total = version.getPreguntas().size();
        if (total != esperado) {
            throw new BusinessException("La versión " + version.getCodigoVersion()
                    + " debe tener " + esperado + " preguntas. Generadas: " + total);
        }
        long unicas = version.getPreguntas().stream()
                .map(examenPregunta -> examenPregunta.getPregunta().getId())
                .distinct()
                .count();
        if (unicas != esperado) {
            throw new BusinessException("La versión " + version.getCodigoVersion() + " contiene preguntas repetidas.");
        }
    }

    private List<Pregunta> seleccionarPreguntasCurso(GenerarExamenCursoRequest request, Curso curso, boolean aleatorizar) {
        boolean usaDificultades = usaDificultades(request);
        if (!usaDificultades) {
            return tomarPreguntas(preguntaRepository.findByCursoIdAndActivoTrue(curso.getId()), request.cantidadTotal(), aleatorizar);
        }

        Map<NivelDificultad, Integer> cantidades = new EnumMap<>(NivelDificultad.class);
        cantidades.put(NivelDificultad.FACIL, valor(request.cantidadFacil()));
        cantidades.put(NivelDificultad.MEDIO, valor(request.cantidadMedio()));
        cantidades.put(NivelDificultad.DIFICIL, valor(request.cantidadDificil()));

        List<Pregunta> preguntas = new ArrayList<>();
        cantidades.forEach((dificultad, cantidad) -> preguntas.addAll(
                tomarPreguntas(preguntaRepository.findByCursoIdAndDificultadAndActivoTrue(curso.getId(), dificultad), cantidad, aleatorizar)
        ));
        return preguntas;
    }

    private List<Pregunta> tomarPreguntas(List<Pregunta> disponibles, int cantidad, boolean aleatorizar) {
        List<Pregunta> copia = new ArrayList<>(disponibles);
        if (aleatorizar) {
            Collections.shuffle(copia);
        }
        return copia.stream().limit(cantidad).toList();
    }

    private String generarOrdenAlternativas(Boolean aleatorizarAlternativas) {
        List<LetraAlternativa> letras = new ArrayList<>(LETRAS);
        if (Boolean.TRUE.equals(aleatorizarAlternativas)) {
            Collections.shuffle(letras);
        }
        return letras.stream()
                .map(letra -> "\"" + letra.name() + "\"")
                .toList()
                .toString();
    }

    private void registrarHistorial(Examen examen) {
        historialAccionRepository.save(HistorialAccion.builder()
                .tipoAccion(TipoAccion.GENERAR_EXAMEN)
                .modulo("EXAMENES")
                .descripcion("Examen generado con código " + examen.getCodigo() + " y " + examen.getCantidadVersiones() + " versiones.")
                .usuarioResponsable("SISTEMA")
                .examen(examen)
                .build());
    }

    private CategoriaExamen buscarCategoria(Long id) {
        return categoriaExamenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría de examen no encontrada: " + id));
    }

    private Examen buscarExamen(Long id) {
        return examenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Examen no encontrado: " + id));
    }

    private String generarCodigoExamen() {
        return "EX-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String codigoVersion(int numero) {
        StringBuilder codigo = new StringBuilder();
        int valor = numero;
        while (valor > 0) {
            valor--;
            codigo.insert(0, (char) ('A' + (valor % 26)));
            valor /= 26;
        }
        return codigo.toString();
    }

    private int valor(Integer numero) {
        return numero == null ? 0 : numero;
    }

    private boolean usaDificultades(GenerarExamenCursoRequest request) {
        return valor(request.cantidadFacil()) > 0
                || valor(request.cantidadMedio()) > 0
                || valor(request.cantidadDificil()) > 0;
    }
}
