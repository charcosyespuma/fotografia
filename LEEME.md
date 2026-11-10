# El Tiempo Esta Noche

App de previsión para fotografía nocturna de Charcos y Espuma.

- `index.html`: la app. Se publica con GitHub Pages.
- `sitios.json`: tus sitios y tu tema de ntfy. Cópialo desde la app (⚙️ → Avisos → Copiar configuración).
- `aviso.mjs`: el programa que calcula la previsión de tus sitios y te envía el aviso.
- `.github/workflows/aviso.yml`: hace que GitHub ejecute el aviso cada tarde a las 17:00 (UTC).

Para probar el aviso a mano: pestaña **Actions → Aviso de buena noche → Run workflow**.

Nota: GitHub pausa las tareas programadas si el repositorio pasa 60 días sin cambios.
Si dejan de llegar avisos, entra en Actions y vuelve a activarlo.
