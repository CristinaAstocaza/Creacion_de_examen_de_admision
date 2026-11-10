# ── Stage 1: Build Java Application ──
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /build

# Copiar archivos de Maven
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN chmod +x ./mvnw

# Copiar código fuente y compilar
COPY src src
RUN ./mvnw clean package -DskipTests

# ── Stage 2: Runtime Image ──
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Instalar Python, pip y soporte de fuentes para renderizado de PDF / LaTeX
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    fontconfig \
    libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

# Crear alias de python -> python3
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Instalar dependencias de Python para scripts de IA y procesamiento de exámenes
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt 2>/dev/null || pip3 install --no-cache-dir -r requirements.txt

# Copiar scripts requeridos por los controllers
COPY scripts scripts

# Copiar el JAR compilado
COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Djava.awt.headless=true", "-jar", "app.jar"]

