# Retando nuestros sentidos

Prototipo de la experiencia del proyecto final *AI for Good*, categoría **Pensar críticamente**, del curso «Pensar, sentir y aprender en tiempos de IA» (CBU, Uniandes).

**Pregunta guía:** ¿basta con mirar o escuchar algo para saber si es real?

**Trampa que el diseño evita:** que la gente termine creyendo que nada es real, o que confíe de más en sus sentidos. Para evitarla:

- Las rondas mezclan contenido real y contenido generado.
- La pista de cada contenido real explica por qué lo «raro» es normal.
- El panel mide cuántos contenidos reales se marcaron como IA.
- El cierre lleva la verificación más allá de los sentidos.

Es un sitio estático (HTML + CSS + JS) sin dependencias externas, pensado para celular y listo para GitHub Pages. Una sesión dura entre 12 y 15 minutos.

---

## Estructura

```
index.html            Experiencia del participante
panel.html            Panel del equipo (clave en config.js)
config.js             Endpoint de Google Sheets, clave del panel, límite de reproducciones
estimulos.json        Estímulos y casos de cierre (editable)
css/estilos.css
js/datos.js           localStorage, cola de envío con reintentos, CSV
js/reproductor.js     Reproductor con forma de onda (Web Audio + canvas, sin WaveSurfer)
js/app.js             Flujo de la experiencia
js/panel.js           Indicadores, mapas de calor, histogramas, exportación
media/ronda1/  media/ronda2/  media/cierre/  media/prueba_sonido.mp3
apps_script/Codigo.gs Receptor para Google Sheets
herramientas/generar_placeholders.py
docs/guion_facilitador.md   docs/bitacora_IA.md
robots.txt  .nojekyll
```

## Flujo

1. **Consentimiento**, con casilla obligatoria de mayoría de edad. Se genera un código anónimo (`P-XXXX`).
2. **Audífonos y prueba de sonido.**
3. **Confianza inicial**, en dos escalas de 1 a 5 (imagen y audio).
4. **Ronda 1** (4 imágenes + 3 audios intercalados, dificultad baja-media) y **Ronda 2** (otros 4 + 3, dificultad alta). Cada estímulo sigue el mismo ciclo:
   - **Observar o escuchar.** La imagen se ve a pantalla completa con zoom; el audio se puede reproducir hasta 3 veces.
   - **Decidir y dar la confianza.**
   - **Señalar el detalle (obligatorio).** Se toca la imagen o la onda y se elige una categoría; el texto es opcional.
   - **Pista.** Se muestra la zona clave resaltada o el fragmento clave, que se puede volver a reproducir.
5. **Cierre.** Estrategias de verificación y dos casos de práctica: una imagen viral y una nota de voz que pide dinero.
6. **Confianza final**, con las mismas dos escalas y una reflexión corta.
7. **Revelación.** Resumen personal y galería con marcas de agua «SINTÉTICO, generado con IA para fines educativos».

El botón **Salir** está visible en todas las pantallas y borra los datos de la persona.

---

## Agregar imágenes y audios

**Reglas de contenido (obligatorias):**

- Ningún rostro de personas reales. Las imágenes sintéticas solo muestran personas ficticias, lugares u objetos. Las reales son fotos propias de lugares y objetos.
- **Prohibido clonar o imitar la voz de cualquier persona real.** Las voces sintéticas son voces genéricas del catálogo de una herramienta TTS. Los audios reales son sonidos ambientales o la voz de un integrante que dé su consentimiento leyendo un guion neutro y ficticio.

**Formatos:**

- **Imágenes:** JPG o WebP de 1200–1600 px en el lado largo y menos de 400 KB. Elimina los metadatos de ubicación (EXIF/GPS) de las fotos propias.
- **Audios:** MP3 mono de 44,1 kHz y 96–128 kbps, con clips de **8 a 15 segundos** y **normalizados** al mismo volumen. Con ffmpeg:
  ```bash
  ffmpeg -i original.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1 -codec:a libmp3lame -b:a 128k media/ronda1/r1_a1.mp3
  ```
  Recorta con `-ss 00:00:02 -t 12` si hace falta. Evita M4A u OGG: MP3 es el formato que funciona igual en Safari de iOS y en Chrome de Android.

**Pasos:**

1. Reemplaza los archivos de `media/…` manteniendo el nombre, o cambia el nombre en `archivo`.
2. Opcional: quema la marca de agua en el archivo sintético, además de la que añade la galería con CSS.
3. Los placeholders se regeneran con `python3 herramientas/generar_placeholders.py`. Necesita Pillow y ffmpeg, y no sobrescribe archivos existentes salvo que uses `--forzar`.

## Editar `estimulos.json`

Cada estímulo tiene estos campos:

| Campo | Descripción |
|---|---|
| `id` | Único, por ejemplo `R1-I1` |
| `archivo` | Ruta relativa, por ejemplo `media/ronda1/r1_i1.jpg` |
| `medio` | `imagen` o `audio` |
| `ronda` | `1` o `2` |
| `orden` | Posición dentro de la ronda (intercala imagen y audio) |
| `tipo` | `real` o `ia` |
| `herramienta_generadora` | Herramienta y versión (vacío si es real) |
| `prompt_o_guion_usado` | Prompt de imagen, guion del audio o descripción de la foto real |
| `zona_clave` | Imagen: `{"x":62,"y":38,"radio":14}` en % del ancho/alto (el radio en % del ancho). Audio: `{"inicio_s":3.0,"fin_s":6.5}` |
| `explicacion_pista` | Texto de la pista. Si es real, explica por qué lo «raro» es normal |
| `dificultad` | `baja`, `media` o `alta` |

Cada ronda debe tener **4 imágenes y 3 audios**. Si no cuadra, la consola muestra un aviso.

`cierre` contiene los dos casos. Cada opción lleva `"sensorial": true/false`, que alimenta el indicador 4. Si cambias `version`, ese valor queda registrado en cada fila.

**Revisión manual:** abre `panel.html` y ve a «Revisión de estímulos». Ahí verás cada pista con la zona clave dibujada encima. Úsalo para ubicar bien las coordenadas y revisar a mano los textos preparados con IA.

---

## Probar localmente

El sitio debe servirse por HTTP, porque `file://` no permite cargar `estimulos.json`:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Para probarlo en un celular de la misma red, usa `http://IP-del-computador:8000`.

## Desplegar en GitHub Pages

1. Crea un repositorio (puede ser privado si tienen GitHub Pro o Education; si no, público) y sube todo el contenido de esta carpeta a la raíz.
2. Ve a **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**.
3. En 1–2 minutos el sitio queda en `https://USUARIO.github.io/REPO/`. El panel está en `…/panel.html`.
4. Antes de publicar, **cambia `CLAVE_PANEL`** en `config.js`.

`robots.txt` y la etiqueta `noindex` piden a los buscadores no indexar el sitio, pero la URL sigue siendo pública: compártanla solo en el salón.

## Conectar Google Sheets

1. Crea una hoja de cálculo nueva en Google Sheets.
2. Ve a **Extensiones → Apps Script**, borra el contenido y pega `apps_script/Codigo.gs`.
3. Cambia `CLAVE_LECTURA` por el mismo valor que pusiste en `CLAVE_PANEL` de `config.js`.
4. Ve a **Implementar → Nueva implementación → Tipo: Aplicación web** y configura:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona**
5. Autoriza los permisos y copia la URL que termina en `/exec`.
6. Pégala en `config.js` → `ENDPOINT_SHEETS: "https://script.google.com/macros/s/…/exec"` y vuelve a subir el archivo.
7. Para comprobarlo, abre la URL en el navegador. Debe responder `{"ok":true,"mensaje":"Endpoint activo"}`.

Cada vez que edites el script, ve a **Implementar → Administrar implementaciones → Editar → Versión nueva**. Así la URL no cambia.

**Cómo funciona el envío:**

- Las respuestas se guardan primero en `localStorage`. Se envían a Sheets **solo cuando la persona completa la confianza final**, de modo que quien sale antes no deja ningún dato.
- Si no hay conexión, las respuestas quedan en cola y se reintenta cada 20 s y al recuperar la red. El script descarta duplicados por `id_registro`.
- Si la persona pulsa **Salir** después del envío, se manda una orden de **retiro** que borra en Sheets todas las filas de su código.
- Si alguien pide retirarse cuando ya tocó «Terminar», busca su código en la hoja y borra esas filas a mano.

## Panel del equipo (`panel.html`)

Se abre con la clave de `config.js`. Es una barrera mínima, no seguridad real: el archivo es público.

**Fuentes de datos:** Google Sheets, este dispositivo o uno o varios CSV importados. Se combinan sin duplicar filas.

**Indicadores**, separados por imagen, audio y total:

1. % de aciertos en R1 frente a R2, en total y por persona, más el % de contenidos reales marcados como IA (indicador de la trampa).
2. % de justificaciones con un detalle concreto frente a «fue intuición», y las categorías usadas.
3. Confianza inicial frente a final, y calibración: la confianza 1–5 se traduce a una probabilidad esperada (1 = 50 %, 5 = 100 %) y se compara con los aciertos. Incluye el % de aciertos por nivel de confianza.
4. % de participantes que eligen al menos una estrategia no sensorial en cada caso del cierre.
5. Mapa de calor de los toques por imagen y histograma de los segundos marcados por audio, ambos junto a la zona o el fragmento clave.
6. Reproducciones promedio por audio, durante la decisión y del fragmento en la pista.

**⬇ Exportar todo en CSV:** UTF-8 con BOM, para que Excel lo abra bien.

### Columnas del CSV

```
id_registro, codigo, timestamp, tipo_registro, ronda, id_estimulo, medio, orden, tipo_correcto,
decision, acierto, confianza, coordenadas_x_y, coord_x_pct, coord_y_pct, segundo_marcado,
categoria_detalle, detalle_concreto, texto, reproducciones, reproducciones_pista,
tiempo_respuesta_s, confianza_imagen, confianza_audio, caso_cierre, estrategias,
estrategia_no_sensorial, version_estimulos
```

`tipo_registro` puede valer:

- `estimulo`: una fila por estímulo.
- `confianza_inicial` y `confianza_final`: usan `confianza_imagen` y `confianza_audio`. La final incluye además la reflexión en `texto`.
- `cierre`: una fila por caso, con `estrategias` separadas por `|`.
- `sesion`: duración total en `tiempo_respuesta_s`.

**Privacidad:** no se registra IP, nombre, correo, user-agent ni ningún dato del dispositivo, y **no se usa el micrófono**.

## Compatibilidad de audio (Safari iOS / Chrome Android)

- La reproducción usa un `<audio>` nativo con `playsinline` y siempre arranca con un toque del usuario, sin autoplay.
- No se espera a la precarga, porque iOS no precarga hasta el primer toque.
- La forma de onda se calcula con Web Audio, que en Safari antiguo usa la forma de callbacks. Si eso falla, se dibuja una onda neutra y el audio igual suena.
- En iPhone, **el interruptor de silencio apaga el audio web**. La pantalla de prueba de sonido lo advierte.

**Pendiente de verificar:** pruébenlo en al menos un iPhone y un Android reales antes de la sesión (ver la lista en `docs/guion_facilitador.md`).

---

## Plan de implementación

| | |
|---|---|
| **Participantes** | 8 estudiantes de la universidad, mayores de 18 años |
| **Lugar y fecha** | En el salón, en celulares con audífonos · Fecha: [por definir] |
| **Duración** | 12–15 min por persona, más 1 min de presentación y 2 de cierre |
| **Equipo** | Santiago Escobar: coordinación y bitácora; evidencia y evaluación. Martín Casabon: diseño de la experiencia. Juan Esteban Vélez: mediación con IA y ética |

**Antes de la sesión:**

1. Reemplazar los placeholders por los estímulos finales.
2. Revisar a mano cada pista en el panel.
3. Conectar Sheets.
4. Cambiar la clave.
5. Hacer una prueba completa en iPhone y Android.
6. Tener 2–3 pares de audífonos de repuesto.

**Durante:** leer el guion del facilitador y proyectar un código QR con la URL. Nadie debe compartir pantalla ni respuestas.

**Después:**

1. Exportar el CSV desde el panel.
2. Analizar los indicadores 1–6.
3. Registrar en `docs/bitacora_IA.md` el uso de IA para la declaración AIAS.
4. Borrar la hoja y despublicar el sitio al terminar el curso.
