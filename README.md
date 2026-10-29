# TP6 — Network Diagnostics Suite

> **Licenciatura en Sistemas de Información (FCFyT) — Desarrollo de Aplicaciones Móviles (2026)**  
> **Toolkit móvil de diagnóstico de infraestructura de telecomunicaciones para técnicos de campo.**  
> Área temática: Comunicaciones y Redes de Datos • Tecnología: React Native CLI con TypeScript • Arquitectura: Offline-First con sockets TCP/UDP de bajo nivel.

---

## 1. Descripción del Proyecto

**Network Diagnostics Suite** es una suite profesional diseñada para técnicos de campo que instalan, auditan y mantienen infraestructura de telecomunicaciones (ONTs GPON, switches de acceso, routers de borde y antenas de enlace).

A diferencia de aplicaciones móviles convencionales basadas en APIs HTTP, esta aplicación dialoga directamente sobre **sockets crudos TCP y UDP**, implementando:
1. **Barrido de subred LAN (RF-01):** Ping Sweep activo sobre puertos 80/443/22/53 y descubrimiento mDNS/Bonjour.
2. **Motor SNMP propio (RF-02):** Codificador BER y decodificador ASN.1 jerárquico sobre UDP/161 para consultar métricas estándar de la MIB-II (`sysName`, `sysUpTime`, `ifInOctets.1`, `ifOutOctets.1`, `sysDescr`).
3. **Control Remoto SSH Seguro (RF-03):** Ejecución de comandos de diagnóstico predefinidos con credenciales resguardadas en el chip criptográfico de hardware de Android (**Android Keystore / TEE / StrongBox**).
4. **Identificación Óptica (RF-04):** Lector de códigos QR/barras de activos con modo de contingencia manual.
5. **Relevamiento de Campo Georreferenciado (RF-05):** Captura de evidencia fotográfica y coordenadas satelitales GPS reales de alta precisión.
6. **Reportes PDF Autónomos (RF-06):** Generación de reportes formales con imágenes fotográficas embebidas en Base64 para evitar enlaces rotos.
7. **Arquitectura Offline-First con Patrón Outbox (RF-07):** Persistencia local transaccional inmediata y sincronización diferida automática al detectar conectividad con control de idempotencia (UUIDv4).
8. **Historial Offline (RF-08):** Auditorías pasadas consultables 100% sin conexión a internet.

---

## 2. Arquitectura del Sistema

```
                               ┌───────────────────────────────────────────────┐
                               │             PRESENTATION LAYER (UI)           │
                               │   React Navigation + Pantallas de Campo + UI  │
                               └───────────────────────┬───────────────────────┘
                                                       │
         ┌───────────────────┬─────────────────────────┼─────────────────────────┬───────────────────┐
         ▼                   ▼                         ▼                         ▼                   ▼
┌─────────────────┐ ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐ ┌─────────────────┐
│ Discovery Layer │ │  Protocol Layer │       │  Evidence Layer │       │   Local Store   │ │   Sync Layer    │
│  (Ping Sweep +  │ │ (SNMP BER PDU + │       │ (Camera + GPS + │       │ (Base de Datos  │ │ (Outbox Pattern │
│ mDNS Discovery) │ │   SSH Client)   │       │  QR Decoder)    │       │  Local Offline) │ │ + NetInfo Sync) │
└────────┬────────┘ └────────┬────────┘       └────────┬────────┘       └────────┬────────┘ └────────┬────────┘
         │                   │                         │                         │                   │
         └───────────────────┴─────────────────────────┼─────────────────────────┴───────────────────┘
                                                       ▼
                                       ┌───────────────────────────────┐
                                       │        Reporting Layer        │
                                       │ (PDF Generator + Base64 HTML) │
                                       └───────────────────────────────┘
```

---

## 3. Estructura de Entregables Oficiales

El repositorio contiene todos los entregables exigidos por la Sección 07 del PDF oficial:

* **Código fuente React Native CLI:** `src/`, `android/`, `App.tsx`, `index.js`.
* **Documento Técnico de Protocolos y Arquitectura (E-03):** [`docs/TECHNICAL_DOCUMENT.md`](docs/TECHNICAL_DOCUMENT.md)
* **Matriz de Requisitos y Trazabilidad (RF-01 a RF-08):** [`docs/REQUIREMENTS_MATRIX.md`](docs/REQUIREMENTS_MATRIX.md)
* **Plan de Implementación y Criterios de Aceptación:** [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

---

## 4. Instrucciones para Ejecutar Pruebas Automatizadas

La aplicación cuenta con una suite completa de pruebas unitarias y de integración que verifican la lógica de red, codificación BER, sincronización outbox e idempotencia sin requerir hardware físico:

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Ejecutar la suite completa de tests automatizados (Jest)
npm run test

# 3. Comprobar tipado estricto con TypeScript (0 errores)
npm run type-check
```

**Resultado de las pruebas:**
* 26 de 26 pruebas pasando exitosamente.
* Cobertura de BER/ASN.1, mock UDP SNMP, subredes CIDR, cola Outbox, endpoints del Backend e idempotencia.

---

## 5. Instrucciones para Ejecutar el Backend Stub

El backend de sincronización está completamente separado de la aplicación móvil y cuenta con persistencia real e idempotencia:

```bash
# 1. Acceder al directorio del backend
cd backend

# 2. Instalar dependencias de backend
npm install

# 3. Iniciar el servidor
npm start
```

El servidor escuchará en `http://0.0.0.0:3000` exponiendo:
* `POST /api/sync`: Recepción de lotes Outbox con deduplicación por UUIDv4.
* `GET /api/reports`: Listado de instalaciones sincronizadas.
* `GET /api/devices`: Listado de equipos registrados.
* `GET /api/health`: Estado de salud del servicio.

---

## 6. Compilación de la APK en la Nube (GitHub Actions CI/CD)

Dado que no se requiere instalar Android Studio ni SDK pesados localmente, el proyecto cuenta con un workflow de integración continua en [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml):

1. **Subir el código a GitHub:**
   ```bash
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin master
   ```
2. **Compilación remota automática:**
   * En cada push o manualmente desde la pestaña **Actions** en GitHub, se ejecuta el workflow `Build Android APK (Cloud CI/CD)`.
   * Los servidores de GitHub ejecutan los tests, configuran Android SDK 34 y JDK 17, compilan la APK de depuración (`./gradlew assembleDebug`) y generan el artefacto descargable.
3. **Descarga de la APK:**
   * Al finalizar la ejecución en GitHub Actions, descargar el archivo zip desde la sección **Artifacts** (`NetworkDiagnosticsSuite-debug-apk`).
   * Transferir el archivo `app-debug.apk` al celular e instalarlo.

---

## 7. Pruebas en el Celular Físico y Conexión en LAN

1. **Conectar celular y PC a la misma red Wi-Fi:**
   * Averiguar la IP de la computadora en la red local (`ipconfig` en Windows, ej: `192.168.1.100`).
2. **Configurar la App:**
   * En la pantalla **Sincronización & Outbox**, verificar o cambiar la URL a `http://192.168.1.100:3000`.
   * Presionar **"Probar Conexión con Servidor"**.
3. **Prueba Offline-First:**
   * Poner el celular en **Modo Avión**.
   * Registrar una instalación técnica con foto y GPS.
   * La app confirmará que quedó encolada localmente en el Outbox.
   * Desactivar el Modo Avión: la app sincronizará automáticamente y el registro aparecerá en el backend en `http://localhost:3000/api/reports`.
