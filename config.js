/* Configuración editable de "Retando nuestros sentidos".
   Este archivo es público una vez publicado en GitHub Pages: no pongas aquí nada secreto. */
window.CONFIG = {
  // URL del Web App de Google Apps Script (termina en /exec). Vacío = solo localStorage.
  ENDPOINT_SHEETS: "",

  // Clave simple para abrir panel.html. Es una barrera mínima, NO seguridad real
  // (cualquiera puede leer este archivo). Cámbiala antes de publicar.
  CLAVE_PANEL: "sentidos2026",

  // Reproducciones máximas por audio durante la decisión.
  MAX_REPRODUCCIONES: 3,

  // Segundos entre reintentos de envío pendiente.
  REINTENTO_SEGUNDOS: 20,

  // Versión del set de estímulos (se registra en cada fila).
  VERSION_ESTIMULOS: "v1-placeholders"
};
