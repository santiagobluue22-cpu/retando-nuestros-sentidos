# Bitácora de uso de IA (para la declaración AIAS)

**Regla del proyecto:** la IA ayuda a preparar el material, pero **nunca decide por el participante**. Todo lo que produce la IA lo revisa el equipo a mano antes de usarlo.

## Plantilla

| Fecha | Integrante | Herramienta (y versión) | Propósito | Prompt usado (resumen o texto) | Qué aceptamos | Qué rechazamos o modificamos | Por qué |
|---|---|---|---|---|---|---|---|
| AAAA-MM-DD | | | | | | | |

**Propósitos típicos:**

- Generar una imagen sintética.
- Generar una voz TTS de catálogo (indicar el nombre de la voz y confirmar que **no** es clonada).
- Redactar un borrador de `explicacion_pista`.
- Revisar la ortografía.
- Construir el prototipo.

**Para cada estímulo generado,** anota también el `id` de `estimulos.json` y confirma que:

- [ ] No hay rostros de personas reales ni de figuras públicas.
- [ ] No es una voz clonada ni una imitación de una persona real.
- [ ] El guion es ficticio y no tiene datos personales.
- [ ] La pista fue revisada a mano y corregida si hacía falta.

---

## Registros

| Fecha | Integrante | Herramienta | Propósito | Prompt usado | Qué aceptamos | Qué rechazamos / modificamos | Por qué |
|---|---|---|---|---|---|---|---|
| 2026-11-11 | Equipo (encargo: Santiago Escobar) | Claude Code (Anthropic) | Construcción del prototipo web: flujo de la experiencia, reproductor de audio con forma de onda, registro en localStorage y Google Sheets, panel de indicadores, exportación CSV, `estimulos.json` con pistas de EJEMPLO, documentación y placeholders | Encargo detallado con contexto del curso, flujo en 6 pasos, reglas de contenido, campos de registro, indicadores del panel y entregables (ver el prompt completo en el historial de la sesión) | [Completar tras revisar: p. ej., estructura, flujo, panel] | [Completar: p. ej., textos de pista de ejemplo que reescribimos, opciones del cierre que ajustamos] | [Completar] |

**Notas sobre el uso de Claude Code:**

- Claude Code **no generó imágenes ni audios.** Solo creó placeholders: imágenes grises y tonos sintéticos hechos por código.
- Los textos de `explicacion_pista` son **ejemplos marcados con [EJEMPLO, reemplazar]**. El equipo debe escribir los definitivos para cada estímulo real y revisarlos a mano.
- Decisiones técnicas propuestas por la IA y aceptadas por el equipo [confirmar]:
  - Forma de onda propia en lugar de WaveSurfer.js, para no depender de un CDN.
  - Envío a Sheets solo al completar la sesión, para que «Salir» descarte los datos del todo.
  - Calibración calculada como confianza 1–5 traducida a 50–100 %.
- Verificación hecha: flujo completo en un navegador Chromium con viewport de 375 px, reproducción de audio y columnas del CSV. **Pendiente:** pruebas en Safari de iOS y Chrome de Android en dispositivos reales.

| Fecha | Integrante | Herramienta | Propósito | Prompt / parámetros | Qué aceptamos | Qué rechazamos / modificamos | Por qué |
|---|---|---|---|---|---|---|---|
| 2026-11-17 | Equipo (encargo a Claude Code) | Claude Code + EDSR ×4 (modelo neuronal de superresolución, OpenCV dnn_superres) | Mejorar la nitidez de `r1_i1` y `r1_i2` (originales de 512×286 px) | Reducción de ruido JPEG suave → EDSR ×4 → 1600 px → enfoque moderado | [Completar tras revisar] | Se descartó un mejorador generativo (tipo Real-ESRGAN/Topaz) porque inventa detalle | Las imágenes ya eran sintéticas; se comprobó que las letras deformadas del letrero (la pista) quedan iguales. No aplicar EDSR a fotos reales: añadiría rastros de procesamiento con IA |

| Fecha | Integrante | Herramienta | Propósito | Prompt / guion | Qué aceptamos | Qué rechazamos / modificamos | Por qué |
|---|---|---|---|---|---|---|---|
| 2026-11-17 | Equipo | ElevenLabs (voz de catálogo, no clonada) | Audio sintético R1-A1 | «Eran las 3 de la mañana cuando escuché mi nombre. Pensé que estaba solo, hasta que alguien respondió desde debajo de mi cama.» (guion ficticio) | [Completar] | Claude Code normalizó el volumen; la pista (silencio total en las pausas) se basó en una medición del archivo | [Completar] |
| 2026-11-18 | Equipo | ElevenLabs (voz de catálogo, no clonada) | Audios sintéticos R1-A3 y R2-A2 | [Completar: guiones] | [Completar] | Claude Code normalizó el volumen; las pistas se basaron en mediciones de los archivos (ruido en pausas, tramo sin respirar) | [Completar] |
| 2026-11-18 | Equipo + Claude Code | Claude Code (Anthropic) | Redacción de pistas y ubicación de zonas clave de R1-I3, R1-I4, R2-I1 a R2-I4, R1-A1 a R1-A3 y R2-A1 a R2-A3 | Indicaciones del equipo por estímulo (p. ej., «señala el gato», «señala los árboles») | [Completar] | [Completar] | Las pistas deben revisarse a mano antes de la sesión |

### Fuente de los audios «reales» R1-A2, R2-A1 y R2-A3 (2026-11-18)
Según el equipo, salen de estos videos públicos de YouTube:

| Audio | Archivo original | Video | Minuto |
|---|---|---|---|
| R2-A1 | Audio_Real_1 | https://www.youtube.com/watch?v=hM_fTrvJbvdg | 43:06 |
| R2-A3 | Audio_Real_2 | [Completar] | [Completar] |
| R1-A2 | Audio_Real_3 | [Completar] | [Completar] |

Enlaces entregados:
- https://www.youtube.com/watch?v=hM_fTrvJbvdg
- https://www.youtube.com/watch?v=e-Xg-OLBS0o&t=2102s
- https://www.youtube.com/watch?v=M_fTrvJbvdg

⚠️ Esto **no cumple** las reglas de contenido del proyecto: los audios reales deben ser sonidos grabados por el equipo o la voz de un integrante que dé su consentimiento. Son voces de terceros que no dieron su consentimiento, y el contenido puede tener derechos de autor. **Pendiente: reemplazarlos por grabaciones propias antes de la sesión.**
