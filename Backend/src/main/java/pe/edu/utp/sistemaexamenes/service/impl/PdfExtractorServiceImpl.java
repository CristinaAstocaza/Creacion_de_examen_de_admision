package pe.edu.utp.sistemaexamenes.service.impl;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.utp.sistemaexamenes.service.CloudinaryService;
import pe.edu.utp.sistemaexamenes.service.PdfExtractorService;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PdfExtractorServiceImpl implements PdfExtractorService {

    private static final int RENDER_DPI = 150;
    private static final float RENDER_DPI_F = 150f;
    private static final float PDF_DPI = 72f;
    private static final int PADDING = 12; // px de margen alrededor del recorte

    private final CloudinaryService cloudinaryService;

    /**
     * PASO 1: Intenta extraer imágenes embebidas (XObject) de cada página.
     * Si no hay imágenes embebidas en una página, esa página queda pendiente
     * para el recorte por bounding_box (PASO 2 — ver cropAndUpload).
     *
     * @return mapa página → URL de Cloudinary (solo páginas con imagen embebida)
     */
    @Override
    public Map<Integer, String> extractAndUploadImages(MultipartFile file, String folder) {
        Map<Integer, String> pageImageUrls = new HashMap<>();

        byte[] pdfBytes;
        try {
            pdfBytes = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Error al leer el PDF", e);
        }

        try (PDDocument document = Loader.loadPDF(new RandomAccessReadBuffer(pdfBytes))) {
            int pageNum = 1;
            for (PDPage page : document.getPages()) {
                PDResources resources = page.getResources();
                boolean found = false;

                for (COSName name : resources.getXObjectNames()) {
                    if (resources.isImageXObject(name) && !found) {
                        PDImageXObject img = (PDImageXObject) resources.getXObject(name);
                        BufferedImage bImage = img.getImage();

                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        ImageIO.write(bImage, "png", baos);
                        String url = cloudinaryService.uploadImage(baos.toByteArray(), folder);
                        pageImageUrls.put(pageNum, url);
                        found = true;
                    }
                }
                pageNum++;
            }
        } catch (IOException e) {
            throw new RuntimeException("Error al extraer imágenes del PDF", e);
        }

        return pageImageUrls;
    }

    /**
     * PASO 2: Renderiza una página completa a 150 DPI y recorta la región
     * indicada por el bounding_box que devuelve Gemini.
     * Aplica PADDING de 12px en todos los lados para no cortar bordes.
     *
     * @param pdfBytes   bytes del PDF original
     * @param pageIndex  índice base-0 de la página
     * @param bbox       lista [x1, y1, x2, y2] de coordenadas bounding_box de Gemini
     * @param folder     carpeta destino en Cloudinary
     * @return URL pública en Cloudinary del recorte subido
     */
    public String cropAndUpload(byte[] pdfBytes, int pageIndex, List<Integer> bbox, String folder) {
        try (PDDocument document = Loader.loadPDF(new RandomAccessReadBuffer(pdfBytes))) {
            PDPage page = document.getPage(pageIndex);
            float pageHeightPt = page.getMediaBox().getHeight();

            PDFRenderer renderer = new PDFRenderer(document);
            BufferedImage fullPage = renderer.renderImageWithDPI(pageIndex, RENDER_DPI);

            BufferedImage cropped = cropRegion(fullPage, bbox, pageHeightPt);

            // Pegar sobre fondo blanco para PNG limpio
            BufferedImage output = new BufferedImage(cropped.getWidth(), cropped.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = output.createGraphics();
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, cropped.getWidth(), cropped.getHeight());
            g.drawImage(cropped, 0, 0, null);
            g.dispose();

            System.out.println("📤 Subiendo imagen a Cloudinary");
            System.out.println("   Dimensiones: " + output.getWidth() + "x" + output.getHeight());

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(output, "png", baos);
            return cloudinaryService.uploadImage(baos.toByteArray(), folder);

        } catch (IOException e) {
            throw new RuntimeException("Error al recortar imagen del PDF (página " + pageIndex + ")", e);
        }
    }

    private BufferedImage cropRegion(BufferedImage pageImg, List<Integer> bbox, float pageHeightPt) {
        System.out.println("🔍 Entrando a cropRegion");
        System.out.println("   pageImg size: " + pageImg.getWidth() + "x" + pageImg.getHeight());
        System.out.println("   bbox recibido: " + bbox);
        System.out.println("   pageHeightPt: " + pageHeightPt);

        float scale = RENDER_DPI_F / PDF_DPI; // 2.0833

        // Convertir coordenadas + invertir eje Y
        int x      = Math.max(0, (int)(bbox.get(0) * scale) - PADDING);
        int y      = Math.max(0, (int)((pageHeightPt - bbox.get(3)) * scale) - PADDING);
        int width  = (int)((bbox.get(2) - bbox.get(0)) * scale) + PADDING * 2;
        int height = (int)((bbox.get(3) - bbox.get(1)) * scale) + PADDING * 2;

        // Clamp a límites reales de la imagen
        x      = Math.min(x, pageImg.getWidth()  - 1);
        y      = Math.min(y, pageImg.getHeight() - 1);
        width  = Math.min(width,  pageImg.getWidth()  - x);
        height = Math.min(height, pageImg.getHeight() - y);

        if (width <= 0 || height <= 0) {
            System.out.println("⚠️ Recorte inválido para bbox: " + bbox);
            return pageImg; // fallback: página completa
        }

        return pageImg.getSubimage(x, y, width, height);
    }
}
