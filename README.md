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
- 1.100 docentes y 1.100 asistentes ficticios. Se usan IDs DEMO, no RUT reales.
- Dashboard calculado a partir de la dotación, filtros por modalidad y vista simulada de establecimiento.
- Importación CSV: separador coma/punto y coma, BOM, comillas, validación integral, vista previa y actualización por ID. No borra personas ausentes del archivo.
- Edición de establecimiento, proporción lectiva, proyección y justificación; edición de jornadas y planes; recálculo de brechas y alertas de sobrecarga.
- Jardines VTF con parámetros de coeficientes explícitos y cálculo de puestos requeridos, redondeados hacia arriba. Sin valores legales precargados.
- Planes separados para TP, escuela especial y microcentros.
- Exportación CSV, Excel XLSX y PDF, ficha individual en PDF y bitácora exportable.
- Persistencia en localStorage del navegador y reinicio del escenario desde Bitácora.

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

## Recorrido sugerido para video (4 minutos)

1. 00:00–00:40: dashboard y cobertura; declarar que se muestran datos ficticios.
2. 00:40–01:30: Importar datos → Probar archivo de ejemplo → revisar → confirmar.
3. 01:30–02:20: mostrar planes de una escuela, un liceo TP, un jardín VTF y un microcentro.
4. 02:20–03:15: modificar horas de un plan o jornada con justificación y mostrar recálculo.
5. 03:15–04:00: exportar reporte y revisar bitácora.

El guion es preparatorio. Grabar y presentar únicamente las capacidades reales, sin atribuir validación normativa o funcionalidades de producción a la demo.
