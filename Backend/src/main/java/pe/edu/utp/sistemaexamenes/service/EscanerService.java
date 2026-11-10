package pe.edu.utp.sistemaexamenes.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import pe.edu.utp.sistemaexamenes.exception.BusinessException;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Comunica el sistema con escáneres / impresoras multifunción conectados a esta PC.
 * Usa WIA (Windows Image Acquisition), el servicio de escaneo que trae Windows,
 * así funciona con cualquier escáner que tenga su driver instalado (USB o red).
 */
@Service
public class EscanerService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final long TIMEOUT_LISTAR_SEG = 30;
    private static final long TIMEOUT_ESCANEO_SEG = 180;

    public record Dispositivo(String id, String nombre, String fabricante) {
    }

    private static final String SCRIPT_LISTAR = """
            $ErrorActionPreference = 'Stop'
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            $dm = New-Object -ComObject WIA.DeviceManager
            $lista = @()
            foreach ($d in $dm.DeviceInfos) {
              if ($d.Type -eq 1) {
                $fabricante = ''
                try { $fabricante = $d.Properties.Item('Manufacturer').Value } catch {}
                $lista += [pscustomobject]@{ id = $d.DeviceID; nombre = $d.Properties.Item('Name').Value; fabricante = $fabricante }
              }
            }
            ConvertTo-Json -InputObject @($lista) -Compress
            """;

    // Los parámetros llegan por variables de entorno (nunca concatenados en el script).
    private static final String SCRIPT_ESCANEAR = """
            $ErrorActionPreference = 'Stop'
            $png = '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}'
            $dm = New-Object -ComObject WIA.DeviceManager
            $info = $null
            foreach ($d in $dm.DeviceInfos) { if ($d.DeviceID -eq $env:ESC_ID) { $info = $d } }
            if ($null -eq $info) { throw 'ESCANER_NO_ENCONTRADO' }
            $dev = $info.Connect()
            $item = $dev.Items.Item(1)
            function Set-Prop($obj, $id, $valor) {
              foreach ($p in $obj.Properties) { if ($p.PropertyID -eq $id) { try { $p.Value = $valor } catch {} } }
            }
            Set-Prop $item 6146 ([int]$env:ESC_INTENT)
            Set-Prop $item 6147 ([int]$env:ESC_DPI)
            Set-Prop $item 6148 ([int]$env:ESC_DPI)
            $img = $item.Transfer($png)
            if ($img.FormatID -ne $png) {
              $ip = New-Object -ComObject WIA.ImageProcess
              $ip.Filters.Add($ip.FilterInfos.Item('Convert').FilterID)
              $ip.Filters.Item(1).Properties.Item('FormatID').Value = $png
              $img = $ip.Apply($img)
            }
            if (Test-Path $env:ESC_OUT) { Remove-Item $env:ESC_OUT }
            $img.SaveFile($env:ESC_OUT)
            Write-Output 'OK'
            """;

    public List<Dispositivo> listarDispositivos() {
        validarWindows();
        String salida = ejecutarPowerShell(SCRIPT_LISTAR, Map.of(), TIMEOUT_LISTAR_SEG);
        String json = salida.trim();
        int inicio = json.indexOf('[');
        if (inicio < 0) return List.of();
        try {
            List<Map<String, Object>> raw = MAPPER.readValue(json.substring(inicio), new TypeReference<>() {});
            List<Dispositivo> dispositivos = new ArrayList<>();
            for (Map<String, Object> d : raw) {
                dispositivos.add(new Dispositivo(
                        String.valueOf(d.get("id")),
                        String.valueOf(d.get("nombre")),
                        d.get("fabricante") == null ? "" : String.valueOf(d.get("fabricante"))));
            }
            return dispositivos;
        } catch (Exception e) {
            throw new BusinessException("No se pudo leer la lista de escáneres: " + e.getMessage());
        }
    }

    /**
     * Escanea una página y devuelve la imagen PNG.
     *
     * @param modo "color", "gris" o "texto" (blanco y negro).
     */
    public byte[] escanear(String dispositivoId, int dpi, String modo) {
        validarWindows();
        if (dispositivoId == null || dispositivoId.isBlank()) {
            throw new BusinessException("Selecciona un escáner.");
        }
        int dpiSeguro = Math.max(100, Math.min(dpi, 600));
        String intent = switch (modo == null ? "" : modo.toLowerCase()) {
            case "color" -> "1";
            case "texto" -> "4";
            default -> "2"; // escala de grises: buen equilibrio para leer texto y figuras
        };

        File salida = null;
        try {
            salida = File.createTempFile("escaneo_", ".png");
            ejecutarPowerShell(SCRIPT_ESCANEAR, Map.of(
                    "ESC_ID", dispositivoId,
                    "ESC_DPI", String.valueOf(dpiSeguro),
                    "ESC_INTENT", intent,
                    "ESC_OUT", salida.getAbsolutePath()
            ), TIMEOUT_ESCANEO_SEG);
            byte[] bytes = Files.readAllBytes(salida.toPath());
            if (bytes.length == 0) {
                throw new BusinessException("El escáner no devolvió ninguna imagen. ¿Hay una hoja en el vidrio?");
            }
            return bytes;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("No se pudo escanear: " + e.getMessage());
        } finally {
            if (salida != null) salida.delete();
        }
    }

    private String ejecutarPowerShell(String script, Map<String, String> entorno, long timeoutSeg) {
        File log = null;
        try {
            String codificado = Base64.getEncoder().encodeToString(script.getBytes(StandardCharsets.UTF_16LE));
            ProcessBuilder pb = new ProcessBuilder(
                    "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                    "-EncodedCommand", codificado);
            pb.environment().putAll(entorno);
            log = File.createTempFile("escaner_log_", ".txt");
            pb.redirectErrorStream(true);
            pb.redirectOutput(log);
            Process proceso = pb.start();
            proceso.getOutputStream().close();
            if (!proceso.waitFor(timeoutSeg, TimeUnit.SECONDS)) {
                proceso.destroyForcibly();
                throw new BusinessException("El escáner tardó demasiado en responder.");
            }
            String salida = new String(Files.readAllBytes(log.toPath()), StandardCharsets.UTF_8);
            if (proceso.exitValue() != 0) {
                throw new BusinessException(traducirError(salida));
            }
            return salida;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("No se pudo comunicar con el servicio de escaneo de Windows: " + e.getMessage());
        } finally {
            if (log != null) log.delete();
        }
    }

    private String traducirError(String salida) {
        String s = salida == null ? "" : salida;
        if (s.contains("ESCANER_NO_ENCONTRADO")) {
            return "El escáner ya no está disponible. Revisa que esté encendido y vuelve a buscarlo.";
        }
        if (s.contains("0x80210006")) return "El escáner está ocupado. Espera un momento e inténtalo de nuevo.";
        if (s.contains("0x80210003")) return "No hay papel en el alimentador del escáner.";
        if (s.contains("0x80210005")) return "El escáner está apagado o desconectado.";
        if (s.contains("0x80210015")) return "No se encontró el escáner. Revisa el cable o la red.";
        if (s.contains("0x80210064") || s.contains("0x80210001")) return "Se canceló el escaneo o el escáner reportó un error.";
        String limpio = s.lines().filter(l -> !l.isBlank()).findFirst().orElse("Error desconocido");
        return "Error del escáner: " + limpio.trim();
    }

    private void validarWindows() {
        if (!System.getProperty("os.name", "").toLowerCase().contains("win")) {
            throw new BusinessException("La conexión directa con escáneres solo está disponible cuando el sistema corre en Windows. "
                    + "Puedes subir el PDF o las imágenes escaneadas.");
        }
    }
}
