# ESPECIFICACIÓN TÉCNICA: SIMULADOR TÁCTICO DE NAVEGACIÓN 3D

## 1. OBJETIVO DEL SISTEMA
Desarrollar una aplicación web interactiva 3D autónoma (sin servidores, sin npm, sin bundlers) orientada a estudiantes de ciencias de la computación (8-10 años).
Debe correr directamente abriendo index.html en cualquier navegador moderno con la librería Three.js cargada desde CDN.

## 2. ESTRUCTURA DE ARCHIVOS ESPERADA
- index.html
- css/styles.css
- js/scene3d.js
- js/parser.js
- js/app.js

## 3. ESPECIFICACIÓN VISUAL Y UI
- Tema: "Mission Control" / Ciberdefensa aeroespacial.
- Paleta: Fondo #080b11, bordes #1f2937, acento cian #00f0ff, éxito verde #10b981, alerta rojo #ef4444.
- Tipografía: JetBrains Mono o Consolas (monospace).
- Layout: 2 columnas principales.
  - Columna Izquierda (70%): Visor 3D con Three.js a pantalla completa y HUD de coordenadas.
  - Columna Derecha (30%): Panel de control con 4 pestañas de módulos (MOD 1 a MOD 4), barra de herramientas de inserción rápida, editor de texto, medidor de memoria y log de telemetría.

## 4. ESPECIFICACIÓN DEL MOTOR 3D (js/scene3d.js)
- Dependencia: Three.js r128 (https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js).
- Terreno: Cuadrícula isométrica 3D de 12x12 baldosas con coordenadas cartesianas visibles (Eje X: 1-12, Eje Y: 1-12).
- Balizas (Checkpoints): 5 postes cilíndricos con iluminación emisiva vertical:
  - CP0 (Origen): (1, 12)
  - CP1: (1, 6)
  - CP2: (7, 6)
  - CP3: (7, 1)
  - CP4 (Meta final): (12, 1)
- Vehículo: Dron/Rover espacial procedural (chasis hexagonal, punta de dirección y luz de empuje trasera cian).
- Animaciones:
  - Movimiento suave (interpolación) celda por celda.
  - Rotaciones de 90 grados suaves sobre el eje Y.
  - Trazado de línea de vector (trail) que dibuja la ruta recorrida.

## 5. GRAMÁTICA Y COMANDOS PERMITIDOS (js/parser.js)
El parser debe interpretar las siguientes instrucciones (ignorando mayúsculas/minúsculas y espacios en blanco):
- AVANZAR(n) -> Desplaza el vehículo n unidades hacia el frente.
- GIRAR_DER() -> Rotación de +90° horaria.
- GIRAR_IZQ() -> Rotación de -90° antihoraria.
- SCAN() -> Pulso visual de radar.
- LOOP(n) { ... } -> Bloque repetitivo de las instrucciones contenidas n veces.

El parser debe calcular:
1. instructionCount: Conteo de comandos antes de expandir el loop (métrica de eficiencia de memoria).
2. commandQueue: Lista secuencial plana de acciones primitivas para animar en 3D.
3. errors: Errores sintácticos en caso de llaves sin cerrar o comandos no reconocidos.

## 6. BARRA DE HERRAMIENTAS RÁPIDA (Sin memorizar comandos)
Encima del área de texto, deben existir botones cliqueables:
- Botón "+ AVANZAR(1)"
- Botón "+ GIRAR_DER()"
- Botón "+ GIRAR_IZQ()"
- Botón "+ LOOP(2) { }"
- Botón "+ SCAN()"
Al hacer clic, el texto se inserta en el editor en la posición del cursor.

## 7. LÓGICA DE MÓDULOS Y PIPELINE (js/app.js)
- 4 Módulos de Estudiante:
  - Módulo 1 (Alfa): Ruta de CP0 a CP1.
  - Módulo 2 (Beta): Ruta de CP1 a CP2.
  - Módulo 3 (Gamma): Ruta de CP2 a CP3.
  - Módulo 4 (Delta): Ruta de CP3 a CP4.
- Botón "TEST UNITARIO":
  - Sitúa al dron en el punto inicial del módulo activo.
  - Ejecuta únicamente el código del módulo seleccionado.
  - Si termina en el CP destino, marca el módulo como VALIDADO en verde.
  - Si choca o termina fuera del objetivo, marca ERROR en el log de telemetría sin afectar a los otros módulos.
- Botón "EJECUTAR PIPELINE COMPLETO":
  - Sitúa al dron en CP0.
  - Ejecuta consecutivamente los módulos 1, 2, 3 y 4 en una sola corrida continua hasta CP4.
- Medidor de Memoria:
  - Muestra la cantidad de instrucciones en tiempo real.
  - Si <= 4 instrucciones: indicador verde (Óptimo).
  - Si > 4 instrucciones: indicador ámbar/rojo (sugiriendo comprimir con LOOP).