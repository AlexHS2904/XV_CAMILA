# Mis XV Años — Camila

Sitio estático de invitación. Fecha: **20 de febrero de 2027**.

## Estructura

```text
index.html
assets/
  css/styles.css
  js/app.js
  js/gallery.js
  js/animations.js
  images/
    paper-*.webp
    camila-*.webp
    itinerario/*.webp
```

La página no necesita Node.js ni un proceso de compilación. Incluye todo el contenido de la versión HTML original. Para verla localmente, puedes abrir `index.html` o iniciar un servidor estático:

```bash
python3 -m http.server 8000
```

Visita `http://localhost:8000`. Los datos de los invitados y el panel de administración de esta versión funcionan en el navegador con `localStorage`; **no constituyen una base de datos compartida ni control de acceso seguro**. Si publicas la página en GitHub Pages, considera el repositorio y su JavaScript públicos.

## Actualizar tu repositorio de GitHub

1. Descomprime el ZIP y copia `index.html` y `assets/` a la raíz de tu repositorio clonado.
2. Verifica con `git status` qué cambiará.
3. Ejecuta `git add index.html assets .nojekyll README.md` y `git commit -m "Organize Camila invitation assets"`.
4. Ejecuta `git push origin main` (o el nombre real de tu rama).
5. Si usas GitHub Pages, confirma en Settings → Pages que apunta a `main` y `/ (root)`.

**Nota:** este proyecto se armó a partir del último HTML autónomo compartido por el usuario. Mantiene las imágenes, los estilos y los scripts sin reescribir las funcionalidades. Las fuentes permanecen embebidas en el CSS para conservar la apariencia y evitar archivos adicionales.
