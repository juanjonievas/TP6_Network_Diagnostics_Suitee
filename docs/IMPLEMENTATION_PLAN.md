# Plan de Implementación Técnica — Network Diagnostics Suite (TP6)

**Materia:** Desarrollo de Aplicaciones Móviles (2026)  
**Proyecto:** Suite de Diagnóstico de Red para Técnicos de Campo  
**Estrategia:** Arquitectura Desacoplada, Offline-First, Verificación Automatizada 100% y Compilación Cloud con GitHub Actions.

---

## 1. Etapas de Desarrollo y Criterios de Aceptación

### Etapa 1 — Análisis, Matriz y Arquitectura Base
* **Objetivo:** Establecer la base documental, matriz de trazabilidad y estructura arquitectónica del proyecto.
* **Acciones:**
  * Creación de `.gitignore`, `.env.example`, `docs/REQUIREMENTS_MATRIX.md` y `docs/IMPLEMENTATION_PLAN.md`.
  * Definición de la estructura de carpetas modular (`src/`, `backend/`, `__tests__/`, `.github/`).
  * Inicialización del repositorio Git local y primer commit.
* **Criterio de Aceptación:** Documentación completa y aprobada, estructura de proyecto definida y trazable contra el PDF.

### Etapa 2 — Configuración del Entorno React Native y Pipeline Cloud (CI/CD)
* **Objetivo:** Disponer de un proyecto React Native CLI con TypeScript, configuración nativa Android y compilación automatizada en la nube sin requerir Android Studio local.
* **Acciones:**
  * Creación de `package.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `react-native.config.js`.
  * Estructuración del proyecto nativo Android (`android/settings.gradle`, `android/build.gradle`, `android/app/build.gradle`, `AndroidManifest.xml`).
  * Declaración de permisos de red, Wi-Fi multicast, cámara y ubicación de alta precisión.
  * Configuración del workflow de GitHub Actions (`.github/workflows/build-apk.yml`) para compilar la APK de depuración y generar el artefacto descargable.
* **Criterio de Aceptación:** Configuración válida de TypeScript (`tsc --noEmit`), dependencias resueltas y workflow de compilación cloud listo para ejecución.

### Etapa 3 — Base de Datos Local y Patrón Outbox (Offline-First)
* **Objetivo:** Garantizar la persistencia de datos en el dispositivo sin conexión a internet y el encolado atómico de acciones.
* **Acciones:**
  * Implementación del motor de persistencia local SQLite / motor de almacenamiento estructurado offline.
  * Creación de esquemas y modelos: `devices`, `diagnostics`, `installations`, `outbox`.
  * Implementación del servicio `OutboxService` (inserción de acciones pendientes con UUIDv4, timestamp, prioridad y payload JSON).
  * Repositorio de acceso a datos para historial de diagnósticos y registros técnicos (RF-07, RF-08).
* **Criterio de Aceptación:** Tests unitarios automatizados que comprueben guardado, recuperación, persistencia tras reinicio simulado y gestión de la cola outbox.

### Etapa 4 — Protocolos de Red (Descubrimiento LAN, SNMP v1/v2c y SSH)
* **Objetivo:** Comunicación con infraestructura de telecomunicaciones sobre sockets crudos de bajo nivel.
* **Acciones:**
  * **Descubrimiento LAN (RF-01):** Sondeo de subred mediante ping sweep / barrido de sockets TCP/UDP + soporte de mDNS/Zeroconf. Cálculo dinámico de subredes CIDR y resolución de hostnames.
  * **Motor SNMP BER/ASN.1 Propio (RF-02):**
    * Codificador BER de paquetes `GetRequest` (Sequence, Version, Community, RequestID, ErrorStatus, ErrorIndex, VarBindList).
    * Decodificador ASN.1 jerárquico para respuestas `GetResponse` (soporte de tipos primitivos y aplicaciones: `Integer`, `OctetString`, `TimeTicks`, `Counter32`, `IpAddress`).
    * OIDs estándar de la MIB-II: `sysUpTime`, `sysName`, `ifInOctets`, `ifOutOctets`.
    * Cliente UDP con manejo estricto de timeouts asincrónicos y sockets no bloqueantes.
  * **Diagnóstico SSH Seguro (RF-03):**
    * Módulo cliente SSH para ejecución controlada de comandos de diagnóstico (`uptime`, `show interfaces`, `ip addr`).
    * Servicio de almacenamiento seguro de credenciales mediante Android Keystore (`react-native-keychain`).
    * Validación de host key y política de cero texto plano en logs ni almacenamiento.
* **Criterio de Aceptación:** Suite completa de pruebas unitarias con paquetes binarios reales de SNMP y simulación UDP; tests de cifrado Keystore y ejecución SSH.

### Etapa 5 — Identificación Óptica, Captura de Evidencia y Reporte PDF
* **Objetivo:** Funcionalidades de campo multimedia y georreferenciadas.
* **Acciones:**
  * **QR / Código de Barras (RF-04):** Lector óptico con fallback manual para contingencias de campo, validación de formatos de equipo y vinculación con fichas técnicas.
  * **Evidencia Fotográfica y GPS (RF-05):** Servicio de geolocalización de alta precisión (latitud/longitud) con manejo de permisos y captura/almacenamiento de fotografías locales.
  * **Generador de Reportes PDF (RF-06):** Servicio de generación de documentos PDF con diseño formal, datos técnicos del equipo, georreferenciación, diagnóstico e imágenes fotográficas convertidas a Base64 para evitar enlaces rotos.
* **Criterio de Aceptación:** Tests automatizados de generación de plantillas HTML/PDF con Base64, parseo de QR y validación de coordenadas GPS.

### Etapa 6 — Backend de Sincronización Stub y Sincronización Diferida
* **Objetivo:** Servidor desacoplado y sincronización end-to-end con tolerancia a fallos.
* **Acciones:**
  * Creación del servidor backend en Node.js + Express con persistencia real (SQLite/JSON).
  * Endpoints REST: `POST /api/sync` (lotes de outbox con idempotencia), `GET /api/devices`, `GET /api/reports`, `GET /api/health`.
  * Implementación de `SyncManager` en la app móvil: escucha reactiva de red (`NetInfo`), lock de exclusión mutua, despacho por lotes, confirmación 200 OK y vaciado transaccional del outbox.
* **Criterio de Aceptación:** Test de integración end-to-end que valide el ciclo: crear registro offline -> simular reconexión de red -> sincronizar con backend -> verificar idempotencia ante reintentos.

### Etapa 7 — Interfaz de Usuario y Navegación
* **Objetivo:** Presentación visual moderna, responsiva y adaptada al trabajo técnico en campo.
* **Acciones:**
  * Navegación con React Navigation (`NativeStackNavigator`).
  * Pantallas:
    1. `HomeScreen` (Dashboard de estado, accesos rápidos y resumen de sincronización).
    2. `DiscoveryScreen` (Escáner de red local con barra de progreso y lista de dispositivos).
    3. `DeviceDetailScreen` (Ficha técnica del equipo, accesos a diagnósticos y acciones).
    4. `SNMPDiagnosticScreen` (Consola de telemetría SNMP en tiempo real).
    5. `SSHDiagnosticScreen` (Terminal SSH de comandos predefinidos con gestión segura de credenciales).
    6. `QRScannerScreen` (Escáner de código con modo manual).
    7. `InstallationFormScreen` (Formulario de instalación con captura de foto, GPS y notas).
    8. `DiagnosticHistoryScreen` (Historial consultable 100% offline).
    9. `SyncStatusScreen` (Monitor de cola outbox, estado de red y botón de sincronización forzada).
    10. `PDFViewerScreen` (Previsualización y exportación del reporte generado).
* **Criterio de Aceptación:** Interfaz modular, con estados de carga, manejo visible de errores y mensajes claros al usuario.

### Etapa 8 — Validación Integral, Documentación y Entregables Finales
* **Objetivo:** Consolidar el proyecto, asegurar que no queden errores y redactar todos los documentos exigidos.
* **Acciones:**
  * Ejecución de todas las pruebas automatizadas (unitarias, integración, TypeScript).
  * Redacción de `docs/TECHNICAL_DOCUMENT.md` (SNMP BER, SSH Keystore, Outbox Pattern).
  * Redacción de `docs/VIDEO_DEMO_SCRIPT.md` (Guion para grabación del video demo de 4 hitos).
  * Redacción de `README.md` completo con instrucciones para clonar, ejecutar tests, levantar backend y descargar APK.
  * Auditoría final de seguridad: verificación de que `.gitignore` excluye secretos y no hay contraseñas en código.
* **Criterio de Aceptación:** Proyecto libre de errores, suite de tests 100% pasando, pipeline de CI/CD validado y todos los entregables del PDF cubiertos.

---

## 2. Matriz de Dependencias Técnicas

| Módulo | Biblioteca / Herramienta | Versión Seleccionada | Justificación Técnica |
| :--- | :--- | :---: | :--- |
| **Runtime** | `react-native` / `react` | 0.74.x / 18.2.x | Versión madura, con máxima compatibilidad de librerías nativas y soporte probado en CI de GitHub Actions. |
| **Navegación** | `@react-navigation/native`, `@react-navigation/native-stack` | ^6.x | Sistema estándar de navegación nativa con transiciones fluidas. |
| **Red & Sockets** | `react-native-udp`, `react-native-tcp-socket` | ^4.1.x / ^6.2.x | Acceso a datagramas UDP y conexiones TCP crudas para SNMP y sondeo LAN. |
| **Seguridad** | `react-native-keychain` | ^8.2.x | Integración directa con Android Keystore System / Hardware TEE para credenciales SSH. |
| **Identificación** | `react-native-vision-camera` + decodificador matricial | ^4.x | API moderna de cámara en Android con soporte para captura y lectura de códigos. |
| **Geolocalización**| `react-native-geolocation-service` | ^5.3.x | Proveedor de ubicación satelital de alta precisión para Android. |
| **Estado de Red** | `@react-native-community/netinfo` | ^11.3.x | Monitoreo reactivo de conectividad para gatillar la sincronización de la cola outbox. |
| **Backend Stub** | `express`, `cors`, `sqlite3` / `better-sqlite3`, `uuid` | Últimas LTS | Servidor ligero, reproducible y desacoplado para pruebas de sincronización. |
| **Testing** | `jest`, `supertest`, `ts-jest`, `@types/jest` | ^29.x | Suite de ejecución de tests automatizados unitarios y de integración. |

---

## 3. Estrategia de Pruebas: Automatizadas vs Dispositivo Físico

| Capacidad | Verificación Automatizada (Headless en Node/Jest) | Verificación en Dispositivo Real (APK) |
| :--- | :--- | :--- |
| **Codificación BER SNMP** | **100% automatizada:** Pruebas unitarias de serialización de PDUs y comprobación byte a byte con fixtures hexadecimales. | Consulta SNMP UDP/161 real a router o servidor de pruebas en la LAN. |
| **Decodificación ASN.1** | **100% automatizada:** Pruebas unitarias deserializando TimeTicks, Counters, Strings, OIDs y manejando respuestas de error SNMP. | Visualización de valores reales en la pantalla de telemetría de la app. |
| **Cola Outbox y Sincronización** | **100% automatizada:** Simulación de fallos de red, persistencia en cola, reintentos con backoff exponencial, e idempotencia contra el backend. | Poner teléfono en modo avión, registrar instalación, reactivar red y observar sincronización automática. |
| **Generación de Reporte PDF** | **100% automatizada:** Validación de plantilla HTML, resolución de estilos CSS y conversión de imágenes en Base64. | Apertura del archivo PDF generado en el visor del celular y compartición por WhatsApp/Drive. |
| **Sondeo LAN (Ping Sweep)** | **100% automatizada:** Cálculo de rangos CIDR, máscaras de subred y ordenamiento de hosts descubiertos. | Detección de la puerta de enlace (gateway) y equipos conectados a la red Wi-Fi local. |
| **Cámara y Escaneo QR** | **100% automatizada:** Validación sintáctica de códigos QR válidos e inválidos, más modo de prueba manual. | Enfoque de cámara física hacia una etiqueta o pantalla para lectura en tiempo real. |
| **Cifrado Keystore** | **100% automatizada:** Mock de Keychain verificando hashing, unicidad de alias por IP y borrado de credenciales. | Almacenamiento respaldado por el chip criptográfico de hardware de Android. |
