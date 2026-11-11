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
