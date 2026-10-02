# GUÍA DIDÁCTICA Y MANUAL DE OPERACIONES TÁCTICAS
## Simulador de Navegación Vectorial 3D y Pipeline Autónomo
**Destinatarios:** Docentes, Instructores de Robótica y Estudiantes (8 a 12 años)  
**Disciplina:** Ciencias de la Computación, Pensamiento Computacional, Robótica Educativa  

---

## 1. FUNDAMENTACIÓN PEDAGÓGICA Y METODOLOGÍA

El **Simulador Vectorial Táctico 3D** implementa un enfoque de aprendizaje por indagación y programación cooperativa basado en la metodología **Unplugged-to-Digital** (del plano físico en papel al entorno digital interactivo).

### 1.1 Metodología de Pipeline en Equipo (4 Roles)
En la industria del software y la ingeniería aeroespacial, los sistemas complejos no son programados por una sola persona en un bloque monolítico, sino mediante **arquitecturas desacopladas y canalizaciones (pipelines)**.

El aula se organiza en tripulaciones de 4 estudiantes:
* **Módulo 1 — Comandante Alfa (Despliegue e Inserción):** Conduce el rover desde la Base (`CP0`) hasta el primer hito táctico (`CP1`).
* **Módulo 2 — Navegante Beta (Navegación en Terreno Hostil):** Recibe la posta en `CP1` y debe guiar el rover a través de los obstáculos hasta `CP2`.
* **Módulo 3 — Especialista Gamma (Reconocimiento y Muestreo):** Asume el control en `CP2`, recolecta minerales geológicos o células de energía y arriba a `CP3`.
* **Módulo 4 — Ingeniero Delta (Aproximación y Certificación Final):** Toma el vehículo en `CP3` y realiza la maniobra de aterrizaje o acople en la Meta Final (`CP4`).

### 1.2 Pruebas Unitarias vs. Integración Continua (Pipeline)
* **Test Unitario (`TEST UNITARIO`):** Cada estudiante verifica su propio módulo de manera aislada. Si su código falla, el simulador reporta el error sin interferir con el trabajo de los compañeros.
* **Pipeline Completo (`EJECUTAR PIPELINE COMPLETO`):** Una vez que los 4 módulos han superado sus pruebas unitarias, el equipo une sus códigos para ejecutar la misión continua sin interrupciones.

---

## 2. DICCIONARIO DE COMANDOS TÁCTICOS

Los comandos se escriben en el editor o se insertan mediante la botonera rápida:

| Comando | Descripción | Ejemplo de Uso | Efecto en el Rover |
| :--- | :--- | :--- | :--- |
| `AVANZAR(n)` | Desplaza el vehículo $n$ celdas hacia adelante en su dirección actual. | `AVANZAR(3)` | Avanza 3 casillas en línea recta. |
| `GIRAR_DER()` | Rota el rover +90° en sentido horario. No cambia de casilla. | `GIRAR_DER()` | Si miraba al NORTE, ahora mira al ESTE. |
| `GIRAR_IZQ()` | Rota el rover -90° en sentido antihorario. No cambia de casilla. | `GIRAR_IZQ()` | Si miraba al NORTE, ahora mira al OESTE. |
| `SCAN()` | Emite un pulso de radar en un radio de 3.5 celdas. | `SCAN()` | Detecta obstáculos y desenmascara anomalías. |
| `LOOP(n) { ... }` | Estructura de bucle que repite las instrucciones interiores $n$ veces. | `LOOP(3) { AVANZAR(1) GIRAR_DER() }` | Optimiza memoria y comprime instrucciones. |

> [!IMPORTANT]
> **El rover no cambia de coordenadas al girar.** `GIRAR_DER()` y `GIRAR_IZQ()` únicamente modifican el vector de orientación (Heading Vector).

---

## 3. SISTEMA DE COORDENADAS Y ELEMENTOS DEL MAPA

El mundo táctico se proyecta sobre un plano cartesiano discreto de $12 \times 12$ baldosas:
* **Eje X (Columnas):** 1 a 12 (de Oeste a Este).
* **Eje Y (Filas):** 1 a 12 (de Sur a Norte).

```
  Y ▲
 12 | [CP0 Base]  .   .   .   .   .   .   .   .   .   .   .
 11 |    .        .   .   .   .   .   .   .   .   .   .   .
 10 |    .        .   .   .   .   .   .   .   .   .   .   .
  9 |    .        .   .   .   .   .   .   .   .   .   .   .
  8 |    .        .   .   .   .   .   .   .   .   .   .   .
  7 |    .        .   .   .   .   .   .   .   .   .   .   .
  6 | [CP1]-----[CP2] .   .   .   .   .   .   .   .   .   .
  5 |    .        .   .   .   .   .   .   .   .   .   .   .
  4 |    .        .   .   .   .   .   .   .   .   .   .   .
  3 |    .        .   .   .   .   .   .   .   .   .   .   .
  2 |    .        .   .   .   .   .   .   .   .   .   .   .
  1 |    .        .   .   .   .   .   . [CP3]------------[CP4 Meta]
    +------------------------------------------------------------► X
         1        2   3   4   5   6   7   8   9  10  11  12
```

### 3.1 Entidades Tácticas

1. **Baliza de Inicio / Base (`CP0`):** Mástil con bandera swallowtail ondeante en $(1, 12)$.
2. **Balizas de Relevo (`CP1` a `CP4`):** Faros verticales iluminados con haces volumétricos y etiquetas elevadas identificativas de cada módulo.
3. **Pilón Defensivo (`PYLON` / ▲):** Torreta de contención fija. Chocar contra un pilón aborta la misión (`COLLISION`).
4. **Mina Explosiva (`MINE` / ☢):** Dispositivo subterráneo de alta detonación. Pisar una mina genera una explosión destructiva del vehículo.
5. **Muestra Geológica (`ROCK_SAMPLE` / ⬢):** Geoda rica en minerales exóticos. Al pasar sobre ella, el rover la recolecta automáticamente sumando puntos de ciencia.
6. **Célula de Energía (`ENERGY` / ◆):** Batería de recarga iónica. Al pasar sobre ella, recarga los sistemas auxiliares del rover y suma puntos.
7. **Grieta Inestable (`ANOMALY` / ♨):** Fisura dimensional inestable. Pisar una grieta sin escanear destruye el rover. Si se ejecuta `SCAN()` a 3.5 celdas de distancia, el radar estabiliza la grieta y revela su contenido oculto (energía, geoda o pilón).

---

## 4. SISTEMA DE PUNTUACIÓN Y RANGOS DE RENDIMIENTO

El simulador evalúa tanto la precisión en la llegada a los puntos de control como la eficiencia en el uso de memoria y la recolección de recursos.

| Acción / Logro | Puntos Otorgados | Criterio de Evaluación |
| :--- | :---: | :--- |
| **Llegada a Baliza de Control (`CP1` a `CP4`)** | **+250 PTS** | Por cada relevo y meta final completados con éxito. |
| **Extracción de Geoda (`ROCK_SAMPLE`)** | **+100 PTS** | Por cada muestra científica recogida en ruta. |
| **Recarga de Célula Energética (`ENERGY`)** | **+50 PTS** | Por cada unidad de combustible recuperada. |
| **Análisis de Anomalía con Radar (`SCAN()`)** | **+150 PTS** | Por cada fisura detectada y estabilizada a distancia. |
| **Bono de Eficiencia de Memoria** | **+200 PTS** | Otorgado si el código de los 4 módulos no excede el límite de memoria permitido. |

### Medallas y Rangos de Misión:
* 🥉 **RANGO BRONCE:** El rover completa el recorrido hasta la meta `CP4`.
* 🥈 **RANGO PLATA:** El rover llega a la meta y recolecta al menos el **50% de los recursos** del mapa.
* 🥇 **RANGO ORO:** El rover llega a la meta, recolecta el **100% de los recursos** (geodas y energía) y estabiliza todas las anomalías con `SCAN()`.

---

## 5. DINÁMICA DE CLASE PASO A PASO (60 A 90 MINUTOS)

### Fase 1: Planificación Desconectada en Papel (15 a 20 min)
1. El docente entrega a cada alumno una **Ficha de Trabajo Impresa** correspondiente al nivel del desafío.
2. Cada alumno recibe la asignación de su módulo (1, 2, 3 o 4).
3. **En la cuadrícula impresa**, el estudiante traza con lápiz:
   * Coordenada de partida $(X, Y)$ y orientación inicial.
   * Obstáculos que debe esquivar.
   * Recursos que desea recolectar en el camino.
   * Baliza de destino $(X, Y)$ del módulo.
4. **En la tabla de código de la ficha**, el alumno redacta a mano la secuencia de instrucciones (`AVANZAR`, `GIRAR_DER`, etc.).

### Fase 2: Protocolo de Acoplamiento en Equipo (10 a 15 min)
1. Los 4 integrantes de la tripulación colocan sus hojas juntas sobre la mesa.
2. **Auditoría de Relevos:** Verifican que la casilla final y orientación del Módulo 1 coincidan exactamente con el inicio del Módulo 2, y así sucesivamente.
3. Si hay discrepancias, las corrigen en papel antes de encender las computadoras.

### Fase 3: Pruebas Unitarias en el Simulador (15 a 20 min)
1. Cada estudiante se sienta frente a la computadora (o trabajan por turnos en una misma máquina).
2. Seleccionan el **NIVEL DE CAMPAÑA** correspondiente.
3. Cada alumno ingresa su código en su respectiva pestaña (`MOD 1`, `MOD 2`, etc.).
4. Presionan **`TEST UNITARIO`**:
   * Si el indicador se pone **VERDE**, el módulo está calificado.
   * Si hay colisión o fuera de límites, leen el log de telemetría, depuran el error y vuelven a probar.

### Fase 4: Lanzamiento del Pipeline Completo y Certificación (10 a 15 min)
1. Con los 4 módulos calificados en verde, el equipo pulsa **`EJECUTAR PIPELINE COMPLETO`**.
2. Observan la trayectoria continua del rover desde `CP0` hasta `CP4`.
3. Revisan la puntuación final obtenida y la insignia de rango (`BRONCE`, `PLATA` u `ORO`).
4. Anotan su puntuación en su ficha de trabajo física para el registro docente.

---

## 6. CATÁLOGO RESUMEN DE LOS 10 NIVELES DE CAMPAÑA

| Nivel | Título de la Misión | Dimensiones | Desafío Táctico | Elementos en Mapa |
| :---: | :--- | :---: | :--- | :--- |
| **1** | Vector de Inserción | $12 \times 12$ | Maniobra en «S» con giros obligatorios. | 1 Energía, 2 Pilones. |
| **2** | Maniobra Ortogonal | $12 \times 12$ | Giro ortogonal bordeando pilones centrales. | 1 Geoda, 3 Pilones. |
| **3** | La Grieta Misteriosa | $12 \times 12$ | Cruce con escaneo de radar obligatorio. | 1 Anomalía, 1 Energía, 3 Pilones. |
| **4** | Muestreo Científico | $12 \times 12$ | Ruta en «U» recolectando 2 muestras geológicas. | 2 Geodas, 1 Energía, 4 Pilones. |
| **5** | Campo Minado y Fisuras | $12 \times 12$ | Navegación entre minas explosivas y grietas. | 2 Minas, 1 Anomalía, 1 Energía, 4 Pilones. |
| **6** | Canal en Zigzag | $12 \times 12$ | Desfiladero estrecho con tres curvas sucesivas. | 1 Geoda, 1 Energía, 7 Pilones. |
| **7** | Falla Tectónica | $12 \times 12$ | Paso transversal con múltiples anomalías. | 2 Anomalías, 1 Mina, 1 Energía, 1 Geoda, 4 Pilones. |
| **8** | Laberinto de Basalto | $12 \times 12$ | Trayectoria no lineal con alta densidad de giros. | 2 Geodas, 1 Energía, 1 Mina, 6 Pilones. |
| **9** | Expedición Geo-Espacial | $14 \times 14$ | Circuito ampliado con 3 muestras y minas perimetrales. | 3 Geodas, 2 Energías, 2 Minas, 6 Pilones. |
| **10** | La Brecha del Titán | $14 \times 14$ | Certificación táctica extrema con todos los elementos. | 3 Geodas, 2 Energías, 2 Minas, 2 Anomalías, 6 Pilones. |

---
**Simulador Táctico 3D &copy; Departamento de Ciencias de la Computación.**
