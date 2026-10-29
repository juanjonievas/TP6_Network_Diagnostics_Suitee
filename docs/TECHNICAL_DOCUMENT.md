# Documento Técnico de Arquitectura y Protocolos — Network Diagnostics Suite (TP6)

**Materia:** Desarrollo de Aplicaciones Móviles (2026)  
**Carrera:** Licenciatura en Sistemas de Información (FCFyT)  
**Proyecto:** Suite Móvil de Diagnóstico de Red e Infraestructura de Telecomunicaciones  
**Entregable Oficial:** Especificación Técnica de SNMP, Manejo Seguro de Credenciales SSH y Arquitectura Offline-First (Outbox)

---

## 1. Subset del Protocolo SNMP Implementado (RF-02)

### 1.1 Motivación y Consideraciones de Plataforma
El protocolo SNMP (*Simple Network Management Protocol*) es el estándar universal para la supervisión y telemetría de activos de telecomunicaciones (switches, routers de borde, ONTs GPON, antenas de enlace). En el desarrollo móvil sobre React Native no existen bibliotecas nativas de SNMP activamente mantenidas.

**Decisión Arquitectónica:**
Para evitar bindings obsoletos o dependencias no compatibles, se implementó un **motor SNMP propio y autónomo** construido directamente sobre datagramas UDP (`react-native-udp` en el dispositivo móvil y `dgram` en entornos de verificación Node.js).

```
┌─────────────────────────────────────────────────────────────┐
│                   React Native / TypeScript                 │
│         [snmpClient.ts] <---> [berParser.ts]                │
└──────────────────────────────┬──────────────────────────────┘
                               │ Buffer Binario
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Capa Nativa UDP (Datagramas)                │
│       react-native-udp (java.net.DatagramSocket en Android) │
└──────────────────────────────┬──────────────────────────────┘
                               │ Puerto UDP 161 (SNMP)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Dispositivo de Red en Campo                 │
│                 (Router / Switch / ONT / OLT)               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Alcance del Subset SNMP
* **Versión:** SNMPv2c (RFC 1901 y RFC 3416).
* **Tipos de PDU:**
  * **`GetRequest` (0xA0):** Generación binaria y emisión de solicitudes para lectura de OIDs.
  * **`GetResponse` (0xA2):** Recepción y decodificación jerárquica de respuestas.
* **Operaciones Excluidas:** Se omiten deliberadamente `SetRequest`, `GetBulkRequest` y la recepción de `SNMP Traps`, garantizando que la aplicación actúe estrictamente como herramienta de auditoría de solo lectura, sin riesgo de alterar configuraciones de equipos en producción.
* **Autenticación:** *Community String* (por defecto `'public'`), transmitida en claro según especificación SNMPv1/v2c. Se mitiga el riesgo en la capa de transporte limitando las consultas a la red de gestión local y reservando la ejecución administrativa segura para el módulo SSH.

### 1.3 Codificación BER (Basic Encoding Rules) y Tipos ASN.1 Soportados
El motor implementa las reglas de codificación BER estructuradas según el estándar ITU-T X.690:

$$\text{PDU SNMP} = \text{Sequence} \, [\, \text{Version (Integer: 1)} \,+\, \text{Community (OctetString)} \,+\, \text{GetRequest} \, [\, \text{ReqID} \,+\, \text{ErrStatus (0)} \,+\, \text{ErrIndex (0)} \,+\, \text{VarBindList} \,]\, ]$$

El decodificador (`BerParser.decodeSnmpMessage`) procesa los siguientes identificadores de etiqueta (*tags*):
1. **`INTEGER` (0x02):** Decodificación de enteros con signo y números de control.
2. **`OCTET STRING` (0x04):** Textos descriptivos y hostnames convertidos a UTF-8.
3. **`NULL` (0x05):** Marcador de valor en solicitudes `GetRequest`.
4. **`OBJECT IDENTIFIER` (0x06):** Codificación y decodificación de identificadores jerárquicos (primer octeto $40 \cdot X + Y$ y subsecuentes en base 128 variable-length).
5. **`IP ADDRESS` (0x40 - Application 0):** Direcciones IPv4 en formato decimal punteado.
6. **`COUNTER32` (0x41 - Application 1):** Contadores enteros no negativos de 32 bits (métrica acumulada de tráfico).
7. **`GAUGE32` (0x42 - Application 2):** Valores enteros de lectura instantánea.
8. **`TIMETICKS` (0x43 - Application 3):** Tiempo transcurrido en centésimas de segundo, formateado por la app en formato humano legible: `X días, HH:MM:SS.cs`.

### 1.4 OIDs de la MIB-II Implementados
| OID MIB-II | Nombre | Tipo ASN.1 | Propósito Técnico |
| :--- | :--- | :--- | :--- |
| `1.3.6.1.2.1.1.1.0` | `sysDescr` | `OctetString` (0x04) | Descripción del sistema operativo, versión de firmware y hardware. |
| `1.3.6.1.2.1.1.3.0` | `sysUpTime` | `TimeTicks` (0x43) | Tiempo ininterrumpido desde el último reinicio del equipo. |
| `1.3.6.1.2.1.1.5.0` | `sysName` | `OctetString` (0x04) | Hostname o identificador FQDN asignado al nodo. |
| `1.3.6.1.2.1.2.2.1.10.1` | `ifInOctets.1` | `Counter32` (0x41) | Tráfico total recibido (RX) acumulado en la interfaz #1. |
| `1.3.6.1.2.1.2.2.1.16.1` | `ifOutOctets.1` | `Counter32` (0x41) | Tráfico total transmitido (TX) acumulado en la interfaz #1. |

### 1.5 Manejo de Timeouts y Errores
El socket UDP se enlaza a un puerto efímero aleatorio (`port 0`) y aplica un temporizador asincrónico estricto (por defecto 2500 ms). Si no se recibe datagrama de retorno antes del timeout, el socket se destruye (`socket.close()`) y se genera un objeto de error sin bloquear el hilo principal de JavaScript ni la interfaz de usuario.

---

## 2. Manejo Seguro de Credenciales SSH (RF-03, RNF-01)

### 2.1 Modelo de Amenazas en Dispositivos Móviles de Campo
En tareas de mantenimiento, el técnico debe autenticarse en switches y routers para ejecutar diagnósticos de nivel 2 y 3. Almacenar credenciales administrativas en SQLite estándar, `AsyncStorage` o código fuente expone a la organización a:
1. **Extracción por volcados de memoria y backups:** Herramientas como `adb backup` o extracción física de archivos `/data/data/...`.
2. **Dispositivos comprometidos (Rooted):** Lectura indiscriminada de bases de datos locales no cifradas.
3. **Exposición en registros (Logs):** Volcado involuntario de contraseñas en `logcat` o herramientas de telemetría.

### 2.2 Integración con Hardware Criptográfico (Android Keystore / iOS Keychain)
Para mitigar estas amenazas, se desacopló el almacenamiento de contraseñas de la base de datos de la aplicación mediante la biblioteca `react-native-keychain`:
* **Android Keystore System:** Las claves maestras se generan y almacenan dentro del microprocesador en un entorno de hardware aislado: el **TEE** (*Trusted Execution Environment*) o chips criptográficos dedicados (**StrongBox Keymaster**). La clave de cifrado simétrico nunca sale del silicio criptográfico.
* **iOS Keychain:** Integración con el coprocesador **Secure Enclave**.
* **Partición de Espacios de Nombres:** Las credenciales se indexan bajo alias únicos basados en la dirección IP o identificador del activo (`ssh_creds_${targetIp}`).
* **Nivel de Seguridad:** Se solicita explícitamente `Keychain.SECURITY_LEVEL.SECURE_HARDWARE` con accesibilidad `WHEN_UNLOCKED`.

### 2.3 Comandos de Diagnóstico Predefinidos
Para evitar inyección de comandos arbitrarios o alteraciones destructivas sobre equipamiento en producción, el cliente SSH expone una lista restringida de comandos de telemetría:
* `uptime`: Carga promedio y tiempo de funcionamiento.
* `ip -brief addr show || ifconfig`: Estado físico y lógico de interfaces y subredes.
* `ip route show || netstat -rn`: Tabla de rutas y verificación de puerta de enlace.
* `uname -a`: Versión del kernel y arquitectura del sistema.

Las contraseñas se cargan en memoria volátil únicamente durante la apertura de la sesión SSH y se descartan inmediatamente tras cerrar la conexión.

---

## 3. Arquitectura y Diseño de la Cola Offline (Offline-First) (RF-07, RF-08)

### 3.1 Problemática Operativa
Los técnicos de infraestructura operan en locaciones de nula o muy baja cobertura (subsuelos de centrales, salas de máquinas blindadas, azoteas, postes y gabinetes en rutas rurales). La aplicación debe garantizar que:
* Todos los datos, fotos en Base64, notas técnicas y coordenadas GPS se persistan de manera atómica e inmediata en el dispositivo.
* El trabajo técnico no se detenga ante la falta de conexión a internet.
* La sincronización con el servidor central se produzca de forma automática y transparente en cuanto el dispositivo recupere conectividad.

### 3.2 Patrón Arquitectónico: Transactional Outbox
La suite adopta el patrón de mensajería desacoplada **Transactional Outbox**:

```
[ Técnico de Campo ]
        │
  Registra Instalación / Diagnóstico
        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Persistencia Local Inmediata                │
│                                                             │
│   1. Guarda registro técnico en tabla 'installations'       │
│   2. Encola acción en tabla 'outbox' (Status: 'pending')    │
│      - Genera UUIDv4 global como token de idempotencia      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    ¿Hay Conectividad a Internet?
                    /                             \
             [ SÍ ]                                 [ NO ]
              /                                       \
             ▼                                         ▼
   POST /api/sync al Backend                 Permanece en cola local
   (Lotes con syncId UUIDv4)                 NetInfo en escucha pasiva
             │                                         │
     Respuesta 200 OK                                  │
             │                                         ▼
             ▼                               Reintento automático al
   Marca instalación como 'synced'           detectar señal con
   y elimina ítem del outbox                 Backoff Exponencial
```

### 3.3 Esquema de la Cola Outbox
Cada ítem encolado posee la siguiente estructura inmutable:
* **`id` (UUIDv4):** Identificador global único generado por el cliente. Sirve como **token de idempotencia** para que el backend reconozca envíos duplicados provocados por cortes de red durante la respuesta.
* **`actionType`:** Tipo de operación tipada (`SYNC_INSTALLATION`, `SYNC_DEVICE`, `SYNC_DIAGNOSTIC`).
* **`entityId`:** Clave foránea del registro local vinculado.
* **`payload`:** Objeto serializado con los datos completos del registro (latitud, longitud, notas, fotos Base64, telemetría).
* **`status`:** Estado de la transacción (`pending` -> `syncing` -> `completed` / `failed`).
* **`retryCount`:** Cantidad de reintentos fallidos ejecutados.
* **`nextRetryAt`:** Marca de tiempo epoch que calcula el siguiente reintento aplicando **Backoff Exponencial**:
  $$\text{Backoff} = \min(2^{\text{retryCount}}, 60) \text{ segundos}$$

### 3.4 Sincronización Automática e Idempotencia
1. **Detección Reactiva de Red:** `SyncManager` se suscribe a `@react-native-community/netinfo`. Cuando `isConnected` y `isInternetReachable !== false`, se gatilla `syncNow()`.
2. **Lock de Exclusión Mutua (`isSyncing`):** Evita colisiones o condiciones de carrera ante múltiples eventos de red simultáneos.
3. **Despacho por Lotes:** La app empaqueta todos los ítems pendientes en un único `POST /api/sync`.
4. **Idempotencia en el Backend:** El servidor mantiene un registro (`Set`) de los `syncId` procesados. Si recibe un `syncId` que ya fue guardado previamente (por ejemplo, si la app envió los datos pero perdió la señal antes de recibir el 200 OK), el backend no duplica el registro y responde exitosamente con dicho ID en `processedSyncIds`.
5. **Confirmación Transaccional:** Solo tras recibir la confirmación del servidor con código HTTP 200, la app actualiza el flag `synced = true` en la instalación y elimina el ítem de la tabla `outbox`.

---

## 4. Generación de Reportes PDF Autónomos (RF-06)

* **Autonomía Documental:** Para evitar imágenes rotas o dependientes de rutas temporales del sistema de archivos (`file:///data/user/0/...`), las fotografías de la evidencia de campo se convierten a **Base64 inline** (`data:image/jpeg;base64,...`) y se incrustan directamente en el HTML del reporte.
* **Estructura Técnica del Documento:**
  1. Cabecera corporativa con ID de registro, timestamp y técnico responsable.
  2. Ficha de identificación técnica (IP, MAC, Hostname, Tipo de dispositivo, Código QR/Barras).
  3. Evidencia de campo georreferenciada con coordenadas satelitales (Latitud, Longitud, Precisión), hipervínculo a Google Maps y observaciones técnicas.
  4. Galería fotográfica de gabinetes y racks de telecomunicaciones.
  5. Registro histórico de telemetría SNMP (sysName, sysUpTime, contadores de tráfico).
  6. Registro de auditoría de consola SSH (comandos ejecutados, tiempos de respuesta y salida de terminal).
