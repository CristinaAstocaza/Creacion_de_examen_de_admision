package pe.edu.utp.sistemaexamenes;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import pe.edu.utp.sistemaexamenes.dto.request.CaratulaPdfRequest;
import pe.edu.utp.sistemaexamenes.enums.FormatoHoja;
import pe.edu.utp.sistemaexamenes.enums.LetraAlternativa;
import pe.edu.utp.sistemaexamenes.enums.NivelDificultad;
import pe.edu.utp.sistemaexamenes.enums.TipoAlternativa;
import pe.edu.utp.sistemaexamenes.model.*;
import pe.edu.utp.sistemaexamenes.service.impl.ExamenPdfServiceImpl;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.geom.Arc2D;
import java.awt.geom.Path2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Genera un examen de prueba de 20 preguntas en memoria (sin base de datos):
 * 4 con figura, 1 con alternativas gráficas, 3 con fórmulas y 12 de solo texto.
 * También verifica que nunca se imprima la clave ("Respuesta: x") que a veces se cuela al importar.
 * El PDF queda en target/prueba-examen-20-preguntas.pdf para revisarlo a mano.
 */
class ExamenPdfPruebaTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final Random random = new Random(7);
    private final Map<String, Curso> cursos = new HashMap<>();

    @Test
    void generaExamenDe20Preguntas() throws Exception {
        Examen examen = Examen.builder()
                .codigo("EX-PRUEBA20")
                .nombre("Examen de prueba")
                .nombreUniversidad("Universidad Nacional San Luis Gonzaga")
                .tituloExamen("Examen de Admisión 2026-I")
                .modalidad("Modalidad Ordinario")
                .colorPortada("#1e3a5f")
                .build();
        // Tema elegido a mano (no "A"): debe imprimirse en la portada y en cada hoja.
        ExamenVersion version = ExamenVersion.builder().numero(1).codigoVersion("P").examen(examen).build();

        List<Pregunta> preguntas = new ArrayList<>();

        // ── Razonamiento Matemático: figura + alternativas con figuras ──
        preguntas.add(pregunta("Razonamiento Matemático",
                bloques(texto("El gráfico muestra las ventas (en miles de soles) de una tienda durante el primer semestre. ¿En qué porcentaje aumentaron las ventas de enero a junio?"),
                        imagen(graficoBarras())),
                "25 %", "40 %", "50 %", "60 %", "75 %"));
        preguntas.add(preguntaConAlternativasGraficas("Razonamiento Matemático",
                "Una flecha apunta hacia arriba y en cada paso gira 90° en sentido horario. ¿Hacia dónde apuntará después de 3 pasos?",
                flecha(0), flecha(90), flecha(180), flecha(270), flecha(45)));

        // ── Álgebra: fórmula ──
        preguntas.add(pregunta("Álgebra",
                bloques(texto("Si"), latex("x_1"), texto("y"), latex("x_2"), texto("son las raíces de la ecuación"),
                        latex("x^2 - 5x + 6 = 0"), texto(", calcule el valor de"), latex("E = \\sqrt{x_1^2 + x_2^2}")),
                "$\\sqrt{13}$", "$\\sqrt{11}$", "$5$", "$\\frac{13}{2}$", "$2\\sqrt{3}$"));

        // ── Geometría: 2 figuras ──
        Pregunta triangulo = pregunta("Geometría",
                bloques(texto("En el triángulo rectángulo mostrado, calcule el valor de x."), imagen(trianguloRectangulo())),
                "8", "9", "10", "11", "12");
        // Simula una pregunta importada por imagen: la captura completa quedó guardada en imagenUrl
        // pero la figura ya fue recortada. La captura NO debe imprimirse.
        triangulo.setImagenUrl("https://res.cloudinary.com/demo/image/upload/examenes_admi/geometria/captura.png");
        preguntas.add(triangulo);
        preguntas.add(pregunta("Geometría",
                bloques(texto("En la figura, ABCD es un cuadrado de lado 4 cm y la circunferencia está inscrita en él. Calcule el área de la región sombreada."),
                        imagen(cuadradoCirculo())),
                "$16 - 4\\pi$ cm²", "$16 - 2\\pi$ cm²", "$8 - \\pi$ cm²", "$4\\pi$ cm²", "$16\\pi$ cm²"));

        // ── Física: figura + fórmula ──
        preguntas.add(pregunta("Física",
                bloques(texto("Un bloque de 10 kg reposa sobre un plano inclinado liso como se muestra. Determine el módulo de la fuerza F paralela al plano necesaria para mantenerlo en equilibrio (g = 10 m/s²)."),
                        imagen(planoInclinado())),
                "25 N", "50 N", "75 N", "86,6 N", "100 N"));
        preguntas.add(pregunta("Física",
                bloques(texto("Un proyectil se lanza con rapidez"), latex("v_0 = 20\\,\\text{m/s}"),
                        texto("formando 37° con la horizontal. Si la altura máxima se calcula con"),
                        latex("H = \\frac{v_0^{2}\\,\\sin^{2}\\theta}{2g}"),
                        texto(", halle H considerando"), latex("g = 10\\,\\text{m/s}^2"), texto("y"), latex("\\sin 37^\\circ = \\frac{3}{5}")),
                "$7{,}2\\ \\text{m}$", "$9{,}6\\ \\text{m}$", "$12{,}8\\ \\text{m}$", "$14{,}4\\ \\text{m}$", "$20\\ \\text{m}$"));

        // ── Química: fórmula + texto con subíndices Unicode ──
        preguntas.add(pregunta("Química",
                bloques(texto("Balancee la siguiente ecuación química e indique la suma de los coeficientes estequiométricos:"),
                        latex("\\text{C}_3\\text{H}_8 + \\text{O}_2 \\rightarrow \\text{CO}_2 + \\text{H}_2\\text{O}")),
                "10", "11", "12", "13", "14"));
        preguntas.add(pregunta("Química",
                bloques(texto("¿Cuántos átomos de oxígeno hay en una molécula de ácido sulfúrico H₂SO₄?")),
                "2", "3", "4", "5", "6"));

        // ── Solo texto ──
        preguntas.add(pregunta("Biología", bloques(texto("La unidad básica estructural y funcional de los seres vivos es la:")),
                "Molécula", "Célula", "Tejido", "Órgano", "Organela"));
        preguntas.add(pregunta("Biología", bloques(texto("El organelo encargado de la respiración celular y la producción de ATP es:")),
                "Ribosoma", "Lisosoma", "Mitocondria", "Aparato de Golgi", "Vacuola"));
        preguntas.add(pregunta("Biología", bloques(texto("La fotosíntesis se realiza principalmente en los:")),
                "Cloroplastos", "Peroxisomas", "Centriolos", "Ribosomas", "Núcleos"));
        preguntas.add(pregunta("Historia", bloques(texto("La independencia del Perú fue proclamada por José de San Martín en el año:")),
                "1810", "1814", "1821", "1824", "1828"));
        preguntas.add(pregunta("Historia", bloques(texto("La capital del Tahuantinsuyo fue la ciudad de:")),
                "Cajamarca", "Cusco", "Quito", "Lima", "Tumbes"));
        preguntas.add(pregunta("Historia", bloques(texto("¿Qué batalla selló definitivamente la independencia de América del Sur?")),
                "Junín", "Ayacucho", "Pichincha", "Maipú", "Boyacá"));
        // "Camión" trae pegado el texto de un chat de IA, como pasó al importar un .txt copiado de ChatGPT.
        preguntas.add(pregunta("Lenguaje", bloques(texto("Señale la alternativa que presenta una palabra *esdrújula*.")),
                "Canción", "Árbol", "Música", "Reloj",
                "Camión\n    Respuesta: c\n\n---\n\nSi quieres, puedo llevarlo al siguiente nivel:\n\n"
                        + "🔥 **Simulacro completo de verbal con tiempo**\n\nSolo dime 👍"));
        preguntas.add(pregunta("Lenguaje", bloques(texto("En la oración «Los estudiantes de Ica resolvieron el examen con calma», el núcleo del sujeto es:")),
                "Los", "estudiantes", "Ica", "examen", "calma"));
        preguntas.add(pregunta("Lenguaje", bloques(texto("¿Cuál de las siguientes palabras está correctamente escrita?")),
                "Exhuberante", "Expontáneo", "Excepción", "Escusa", "Exéptico"));
        preguntas.add(pregunta("Geografía", bloques(texto("El río más largo del Perú que desemboca en el océano Pacífico es el:")),
                // La "Respuesta: d" simula la clave que se cuela al importar desde .txt
                "Santa", "Ica", "Majes", "Tumbes", "Rímac\n    Respuesta: d"));
        preguntas.add(pregunta("Geografía", bloques(texto("La región natural del Perú conocida como «Yunga» se ubica aproximadamente entre los:")),
                "0 y 500 msnm", "500 y 2300 msnm", "2300 y 3500 msnm", "3500 y 4000 msnm", "4000 y 4800 msnm"));

        for (int i = 0; i < preguntas.size(); i++) {
            List<String> orden = new ArrayList<>(List.of("A", "B", "C", "D", "E"));
            Collections.shuffle(orden, random);
            version.getPreguntas().add(ExamenPregunta.builder()
                    .examenVersion(version)
                    .pregunta(preguntas.get(i))
                    .orden(i + 1)
                    .numeroOrden(i + 1)
                    .alternativasOrdenadas(MAPPER.writeValueAsString(orden))
                    .build());
        }

        byte[] pdf = new ExamenPdfServiceImpl(null, null).generarPdfExamen(version, new CaratulaPdfRequest(
                "UNIVERSIDAD NACIONAL", "EXAMEN DE ADMISIÓN 2025", "MODALIDAD ORDINARIO", "#ec4899", null,
                "Lea cuidadosamente cada pregunta y marque solo una alternativa.", null));
        Path salida = Path.of("target", "prueba-examen-20-preguntas.pdf");
        Files.createDirectories(salida.getParent());
        Files.write(salida, pdf);
        assertTrue(pdf.length > 10_000, "El PDF parece vacío");
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String texto = new PDFTextStripper().getText(doc);
            assertFalse(texto.contains("Respuesta"), "La clave de respuestas no debe imprimirse en el examen");
            assertTrue(texto.contains("Rímac"), "Falta el texto de una alternativa");
            assertFalse(texto.contains("Si quieres") || texto.contains("Solo dime") || texto.contains("*"),
                    "El texto sobrante de chats de IA no debe imprimirse");
            assertTrue(texto.contains("esdrújula"), "Debe quedar la palabra sin asteriscos");
            assertFalse(texto.contains("No se pudo cargar"), "La captura completa de la importación no debe imprimirse");
            assertTrue(texto.contains("EXAMEN DE ADMISIÓN 2025"), "La portada debe usar la configuración enviada");
            assertEquals(4, doc.getNumberOfPages(), "Carátula + 3 hojas de preguntas");
            assertTrue(texto.contains("TEMA P"), "La cabecera debe usar la letra de tema guardada");
            assertEquals(595f, doc.getPage(0).getMediaBox().getWidth(), 1f, "A4 por defecto");
        }

        // Mismo examen en hoja Oficio (8,5 x 13 pulgadas)
        examen.setFormatoHoja(FormatoHoja.OFICIO);
        byte[] oficio = new ExamenPdfServiceImpl(null, null).generarPdfExamen(version, null);
        Files.write(Path.of("target", "prueba-examen-oficio.pdf"), oficio);
        try (PDDocument doc = Loader.loadPDF(oficio)) {
            assertEquals(612f, doc.getPage(0).getMediaBox().getWidth(), 1f, "Ancho oficio");
            assertEquals(936f, doc.getPage(0).getMediaBox().getHeight(), 1f, "Alto oficio");
        }
        System.out.println("PDF de prueba generado en: " + salida.toAbsolutePath());
    }

    // ─────────────────────────── helpers de datos ───────────────────────────

    private Pregunta pregunta(String curso, String enunciadoJson, String... textos) throws Exception {
        Pregunta p = base(curso, enunciadoJson);
        for (int i = 0; i < 5; i++) {
            p.getAlternativas().add(alternativa(p, i, bloquesDesdeTexto(textos[i]), null));
        }
        return p;
    }

    private Pregunta preguntaConAlternativasGraficas(String curso, String enunciado, String... imagenes) throws Exception {
        Pregunta p = base(curso, bloques(texto(enunciado)));
        for (int i = 0; i < 5; i++) {
            Alternativa a = alternativa(p, i, bloques(imagen(imagenes[i])), null);
            a.setTipo(TipoAlternativa.IMAGEN);
            p.getAlternativas().add(a);
        }
        return p;
    }

    private Pregunta base(String curso, String enunciadoJson) {
        Curso c = cursos.computeIfAbsent(curso, n -> Curso.builder().nombre(n).build());
        return Pregunta.builder()
                .codigo("T-" + UUID.randomUUID().toString().substring(0, 6))
                .enunciado(enunciadoJson)
                .dificultad(NivelDificultad.MEDIO)
                .curso(c)
                .build();
    }

    private Alternativa alternativa(Pregunta p, int indice, String contenido, String imagenUrl) {
        return Alternativa.builder()
                .letra(LetraAlternativa.values()[indice])
                .tipo(TipoAlternativa.TEXTO)
                .contenidoTexto(contenido)
                .imagenUrl(imagenUrl)
                .ordenVisualizacion(indice + 1)
                .pregunta(p)
                .build();
    }

    /** "$\\sqrt{13}$" → bloque latex; cualquier otra cosa → bloque de texto. */
    private String bloquesDesdeTexto(String texto) throws Exception {
        if (texto.startsWith("$")) {
            int fin = texto.indexOf('$', 1);
            String formula = texto.substring(1, fin);
            String resto = texto.substring(fin + 1).trim();
            return resto.isEmpty() ? bloques(latex(formula)) : bloques(latex(formula), texto(resto));
        }
        return bloques(texto(texto));
    }

    @SafeVarargs
    private String bloques(Map<String, String>... bloques) throws Exception {
        return MAPPER.writeValueAsString(List.of(bloques));
    }

    private Map<String, String> texto(String v) { return Map.of("tipo", "texto", "valor", v); }
    private Map<String, String> latex(String v) { return Map.of("tipo", "latex", "valor", v); }
    private Map<String, String> imagen(String url) { return Map.of("tipo", "imagen", "url", url); }

    // ─────────────────────────── figuras de prueba ───────────────────────────

    private interface Dibujo { void dibujar(Graphics2D g); }

    private String figura(int ancho, int alto, Dibujo dibujo) throws Exception {
        BufferedImage img = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        // Fondo blanco, como los recortes de capturas reales.
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, ancho, alto);
        g.setColor(Color.BLACK);
        g.setStroke(new BasicStroke(4f));
        g.setFont(new Font("SansSerif", Font.BOLD, 34));
        dibujo.dibujar(g);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
    }

    private String graficoBarras() throws Exception {
        return figura(720, 420, g -> {
            int[] valores = {40, 45, 50, 55, 60, 64};
            String[] meses = {"Ene", "Feb", "Mar", "Abr", "May", "Jun"};
            g.drawLine(80, 360, 690, 360);
            g.drawLine(80, 360, 80, 30);
            g.setFont(new Font("SansSerif", Font.PLAIN, 24));
            for (int i = 0; i < valores.length; i++) {
                int x = 110 + i * 95;
                int h = valores[i] * 4;
                g.setColor(new Color(120, 120, 120));
                g.fillRect(x, 360 - h, 60, h);
                g.setColor(Color.BLACK);
                g.drawRect(x, 360 - h, 60, h);
                g.drawString(String.valueOf(valores[i]), x + 8, 350 - h);
                g.drawString(meses[i], x + 8, 395);
            }
        });
    }

    private String trianguloRectangulo() throws Exception {
        return figura(520, 380, g -> {
            int[] xs = {80, 80, 440};
            int[] ys = {320, 60, 320};
            g.drawPolygon(xs, ys, 3);
            g.drawRect(80, 290, 30, 30);
            g.drawString("6", 40, 200);
            g.drawString("8", 250, 365);
            g.drawString("x", 275, 175);
        });
    }

    private String cuadradoCirculo() throws Exception {
        return figura(420, 420, g -> {
            g.setColor(new Color(150, 150, 150));
            g.fillRect(60, 60, 300, 300);
            g.setColor(Color.WHITE);
            g.fillOval(60, 60, 300, 300);
            g.setColor(Color.BLACK);
            g.drawRect(60, 60, 300, 300);
            g.drawOval(60, 60, 300, 300);
            g.drawString("A", 22, 50);
            g.drawString("B", 372, 50);
            g.drawString("C", 372, 400);
            g.drawString("D", 22, 400);
        });
    }

    private String planoInclinado() throws Exception {
        return figura(620, 360, g -> {
            g.drawLine(40, 320, 580, 320);
            g.drawLine(40, 320, 580, 10);
            g.drawLine(580, 320, 580, 10);
            g.draw(new Arc2D.Double(-40, 240, 160, 160, 0, 30, Arc2D.OPEN));
            g.drawString("30°", 130, 305);
            // bloque sobre el plano
            AffineTransform original = g.getTransform();
            g.rotate(-Math.toRadians(30), 300, 165);
            g.setColor(new Color(170, 170, 170));
            g.fillRect(260, 95, 90, 70);
            g.setColor(Color.BLACK);
            g.drawRect(260, 95, 90, 70);
            g.drawString("10 kg", 262, 140);
            // fuerza F paralela al plano (hacia arriba)
            g.drawLine(350, 130, 450, 130);
            g.fillPolygon(new int[]{450, 430, 430}, new int[]{130, 120, 140}, 3);
            g.drawString("F", 455, 120);
            g.setTransform(original);
        });
    }

    /** Flecha que apunta hacia arriba girada {@code grados} en sentido horario. */
    private String flecha(int grados) throws Exception {
        return figura(200, 200, g -> {
            g.drawRect(8, 8, 184, 184);
            g.rotate(Math.toRadians(grados), 100, 100);
            Path2D p = new Path2D.Double();
            p.moveTo(100, 30);
            p.lineTo(150, 90);
            p.lineTo(118, 90);
            p.lineTo(118, 170);
            p.lineTo(82, 170);
            p.lineTo(82, 90);
            p.lineTo(50, 90);
            p.closePath();
            g.fill(p);
        });
    }
}
