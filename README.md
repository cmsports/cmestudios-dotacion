# CMEstudios · Demo de gestión de dotación

Demo funcional local para preparar la licitación **1126922-40-L126**. Interfaz inspirada en la vista de CMSports aportada por el usuario: menú blanco, fondo claro, tarjetas y acciones violetas. Proyecto separado de CMSports.

## Abrir

En este entorno la demo está en http://localhost:5173. El localhost pertenece al entorno de ejecución: si no lo ves desde tu equipo, usa el paquete descargable y ejecuta uno de estos métodos en tu computador.

### Paquete compilado (sin instalar dependencias JavaScript)

Con Python 3 instalado, descomprime el ZIP y abre `ABRIR_LOCALHOST_WINDOWS.bat` en Windows o `ABRIR_LOCALHOST_MAC.command` en Mac. El iniciador enciende el servidor de este computador y abre Google Chrome en http://localhost:5173 (o el navegador predeterminado si Chrome no está disponible). Mantén abierta la ventana del servidor mientras usas la demo. Los iniciadores de Windows y Mac están preparados, pero no se han probado en esos sistemas desde este entorno Linux.

Descomprime el ZIP y ejecuta dentro de su carpeta:

```bash
python3 iniciar_demo.py
```

En Windows puedes usar `py iniciar_demo.py`. Luego abre http://localhost:5173.

También puedes usar el servidor de Python directamente:

```bash
python3 -m http.server 5173 --directory dist
```

En Windows, si Python está instalado mediante el lanzador:

```powershell
py -m http.server 5173 --directory dist
```

Abre http://localhost:5173. Si el puerto está ocupado, elige otro puerto disponible y abre esa misma dirección con el número elegido.

### Desarrollo

Requiere Node.js 22.12 o superior compatible con Vite 8 y npm.

```bash
npm install
npm run dev
```

Los módulos en este entorno se reutilizan mediante un enlace a las dependencias ya instaladas en CMSports; el ZIP omite ese enlace y no necesita el otro proyecto. `npm install` instala sus propias dependencias en el equipo de destino.

## Funciona

- 52 establecimientos ficticios (25 escuelas regulares, 11 liceos —4 TP—, 2 escuelas especiales, 14 jardines VTF) y 4 microcentros que agrupan 25 escuelas rurales ficticias.
- 1.100 docentes y 1.100 asistentes ficticios, repartidos según el tamaño de cada modalidad, más cargos vacantes de ejemplo. Se usan IDs DEMO, no RUT reales.
- Menú en el orden de trabajo: datos (importar, establecimientos, dotación), análisis (cuadratura, indicadores PAL) y registro (bitácora). La vista general muestra los cuatro pasos.
- Indicadores PAL (Producto 4 de las bases): horas docentes vigentes, asistentes en personas y jornadas, educadoras y técnicas VTF, horas a suprimir, contratos no renovados, cargos vacantes, fuero gremial, tipos de hora (lectivas, no lectivas, directivas, técnico-pedagógicas), fuentes (general, SEP/PME, PIE, VTF), colación, horas por modalidad y por establecimiento, docentes por función, asistentes por categoría y PIE con NEE transitorias y permanentes. Cada tarjeta abre la lista de personas que la compone.
- Cuadratura por modalidad: liceos TP por formación general y diferenciada con especialidades; microcentros por escuela rural y cursos combinados; jardines VTF por nivel con coeficientes de escenario (opción de aplicarlos a todos los jardines); PIE con horas de apoyo por curso con o sin JEC.
- Cargos vacantes: se crean desde un déficit, entran a la cuadratura, a los indicadores y a la bitácora.
- Proyección por persona con horas de aumento o supresión; la no renovación solo se permite en plazo fijo o contrata, y el fuero gremial muestra una advertencia.
- Importación CSV masiva (archivo de ejemplo con más de 200 filas en todas las modalidades), con columnas opcionales `fuero`, `formacion_tp` y `escuela_rural`, validación integral, vista previa y actualización por ID.
- Exportaciones: un solo menú "Exportar" por pantalla. Los Excel llevan fórmulas vivas (capacidad, holgura, brechas, totales con SUBTOTAL que respetan filtros, resumen PAL calculado desde la hoja de personal con supuestos editables) y una hoja de notas. Ficha por establecimiento en PDF con espacio para firma del director y en Excel de trabajo. Carga horaria individual en PDF.
- Persistencia en localStorage del navegador y reinicio del escenario desde Bitácora.
- `ABRIR_DEMO.html` es la misma demo en un solo archivo, para abrir sin servidor (el asistente con IA no funciona ahí).

## Reglas y límites

Horas de contrato: 60 minutos. Horas pedagógicas: 45 minutos.

```
Requeridas = Σ(cursos × horas pedagógicas por curso)
Capacidad lectiva pedagógica = contrato × proporción lectiva × 60/45
Brecha = asignadas pedagógicas − requeridas pedagógicas
Sobrecarga individual = máximo(0, asignadas − capacidad configurada)
```

65/35 y 60/40 son parámetros de escenario por establecimiento. Debe validarse su aplicabilidad por funcionario, cargo y normativa antes de producción. La validación de jornada (máximo 44 horas) es una restricción simplificada de la demo y debe ajustarse por estatuto y cargo. Los planes, coeficientes, matrícula y nombres son ficticios; no afirmar que son datos o mallas oficiales del SLEP.

Las proyecciones y justificaciones se registran; marcar una no renovación no elimina automáticamente a la persona ni modifica el escenario vigente. El motor no resuelve todavía todos los criterios PIE/NEE, excepciones de cargo, fueros y horas gremiales. No optimiza automáticamente una dotación ni determina legalmente qué contrato debe terminar.

No hay servidor de datos, login, permisos seguros o 2FA. Las vistas por rol son una simulación visual, no un control de acceso. La bitácora local es editable desde el navegador y no es una auditoría de producción. No cargar datos personales reales. Los PDFs son formatos propios de demo, no layouts MINEDUC/DEP validados.

No debe declararse cumplimiento total de las bases basándose solo en esta versión. Para producción faltan normativa validada, formatos oficiales, autenticación y permisos reales, infraestructura con respaldos y condiciones operativas exigidas.

## Para completar la propuesta

Conseguir insumos de referencia sin datos personales: estructura real de maestro CSV, mallas de estudio, plantillas MINEDUC/DEP, criterios de aplicación de proporciones lectivas, reglas VTF por edad/nivel y reglas PIE/NEE. Validar cálculos con apoyo conocedor de dotación escolar. Después adaptar importador, motor de reglas y reportes; documentar lo implementado y lo pendiente con precisión.

## Verificación

```bash
npm test
npm run build
```

Las pruebas de lógica verifican cobertura, conversión de unidades, recálculo de brechas, parámetros VTF y CSV. Se incluye `tests/browser.cjs`, usado en este entorno con Playwright y Chromium para probar los recorridos, descargas, persistencia y vista móvil; sus rutas de navegador son específicas del entorno.

## Recorrido sugerido para video (4 minutos y medio)

Sigue los cinco parámetros que puntúa la comisión (bases, punto 10.2.2). Antes de grabar: Bitácora → Restablecer demo.

1. 00:00–00:45 · Plataforma 52 + 4: Establecimientos; declarar que los datos son ficticios.
2. 00:45–01:40 · Carga masiva: Importar datos → Usar el archivo de ejemplo → revisar → Confirmar.
3. 01:40–02:50 · Módulos por modalidad: abrir la cuadratura de una escuela (PIE), un liceo TP (formación general y diferenciada), un jardín VTF (configurar coeficientes) y un microcentro (escuelas rurales).
4. 02:50–03:40 · Cuadratura: editar una asignatura, ver el recálculo, crear un cargo vacante y exportar la ficha para firma.
5. 03:40–04:30 · Dashboard: Indicadores PAL, abrir una tarjeta (por ejemplo cargos vacantes) y exportar el Excel con fórmulas.

El guion es preparatorio. Grabar y presentar únicamente las capacidades reales, sin atribuir validación normativa o funcionalidades de producción a la demo.
