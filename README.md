# PitchLab

**En vivo: https://fredymontero.com/pitchlab**

(el mismo despliegue tambien responde en https://pitchlab-lemon.vercel.app)

Pizarra táctica de fútbol 11 v 11 que corre entera en el navegador. Dibuja el
esquema, anima la jugada cuadro a cuadro, exporta imagen, guion o video y
comparte por enlace. Sin cuenta, sin servidor, sin costo.

Interfaz en español por defecto, con inglés disponible en el selector de idioma.

## Cómo correrlo

```bash
cd ~/tactical-board
python3 -m http.server 8787
# abrir http://localhost:8787
```

No hay build. Cualquier hosting estático sirve (Vercel, GitHub Pages, Netlify):

```bash
vercel deploy --prod
```

`fredymontero.com/pitchlab` no tiene una copia de estos archivos: el sitio hace
un rewrite hacia este despliegue, asi que cada `vercel deploy --prod` de aqui
actualiza tambien esa ruta.

## Qué hace

**Campo** 11v11 completo, medio campo, vertical, medio vertical, último tercio,
9v9, 7v7, futsal, fútbol playa, rejilla de entrenamiento y pizarra en blanco.
Cinco superficies, franjas de corte, tercios y carriles, rejilla.
Medidas reales en metros (105 x 68 y las marcas FIFA).

**Fichas** Dos equipos con nombre, color, número y nombre de jugador editables.
Formaciones por tamaño de equipo: 11 (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2 y más),
9, 7 y futsal. Material: balón, conos, platos, maniquíes, mini arcos, picas,
escaleras, vallas, árbitro y textos.

La paleta flotante coloca fichas en cadena: eliges una, tocas el campo las veces
que haga falta y sales con `Esc`. Los números se autoincrementan por equipo.

**Dibujo** Pase, desmarque, conducción, remate, línea, dibujo libre, zona
rectangular, óvalo, zona libre punto a punto, bloqueo y foco de atención.
Las flechas nacen rectas y se curvan arrastrando el tirador central.
Color, grosor, opacidad, relleno y línea discontinua por dibujo.

**Animación** Cada cuadro es una foto. Mueve las fichas, agrega un cuadro y la
pizarra interpola el movimiento. Fase con nombre ("Salida", "Disparador",
"Definición"), duración y tipo de movimiento por cuadro, papel cebolla,
previsualización punteada de a dónde va cada ficha, velocidad 0.25x a 2x y
repetición. Las flechas de un cuadro se van trazando mientras ese paso corre.

**Exportar**
- PNG del cuadro actual a 1x, 2x o 3x
- SVG vectorial del cuadro actual
- Guion imprimible con todos los cuadros, su fase y su nota
- Video de la animación en MP4 donde el navegador lo permite (Chrome, Edge,
  Safari recientes) y WebM en el resto
- Archivo `.pitchlab.json` para guardar y reabrir
- Enlace: la jugada entera viaja comprimida en la URL, no se sube nada

**Guardado** Autoguardado local en cada cambio, biblioteca de pizarras en el
navegador con miniatura, búsqueda y duplicado. Todo vive en `localStorage`.

**Sin conexión** Service worker + PWA instalable.

## Atajos

| Tecla | Acción |
| --- | --- |
| `V` | Seleccionar y mover |
| `P` `R` `D` `S` | Pase, desmarque, conducción, remate |
| `L` `F` | Línea, dibujo libre |
| `Z` `C` `G` | Zona, óvalo, zona libre |
| `B` `H` | Bloqueo, foco |
| `T` `E` | Texto, borrador |
| `Espacio` | Reproducir o pausar |
| `N` | Nuevo cuadro |
| `,` `.` | Cuadro anterior / siguiente |
| Flechas | Mover la selección (Shift para pasos grandes) |
| `Supr` | Eliminar la selección |
| `Shift` + arrastrar | Mover la ficha en todos los cuadros |
| `Alt` + arrastrar | Desactivar el imán |
| `Cmd/Ctrl` + `D` | Duplicar |
| `Cmd/Ctrl` + `S` | Guardar |
| `Cmd/Ctrl` + `Z` | Deshacer (con Shift, rehacer) |
| Rueda | Acercar y alejar hacia el cursor |
| `Espacio` + arrastrar | Mover la vista |
| Dos dedos | Pellizcar para acercar, arrastrar para mover |

## Cómo está hecho

Módulos ES puros, sin framework y sin dependencias. Canvas 2D para todo el
dibujo, DOM para los paneles.

| Archivo | Responsabilidad |
| --- | --- |
| `js/pitch.js` | Medidas del campo en metros, proyección y todas las marcas |
| `js/view.js` | Zoom, paneo e imán a los puntos del campo |
| `js/state.js` | Documento, cuadros, selección, historial y guardado |
| `js/render.js` | Pintado: fichas, dibujos, interpolación, ayudas visuales |
| `js/interact.js` | Puntero y gestos táctiles, hit testing, herramientas |
| `js/animate.js` | Reloj de reproducción |
| `js/export.js` | PNG, SVG, guion, video, archivos y enlaces |
| `js/svg.js` | Grabador con la misma API que Canvas 2D que emite SVG |
| `js/i18n.js` | Diccionarios es / en |
| `js/main.js` | Cableado de la interfaz |

Dos decisiones que vale la pena conocer:

1. **Las posiciones se guardan como fracción del campo visible** y se convierten
   a fracción del campo real cuando cambias de vista. Por eso pasar de horizontal
   a vertical, a medio campo o a futsal deja a cada ficha en el mismo punto del
   campo de verdad. Ver `toPitchFrac` y `fromPitchFrac` en `js/pitch.js`.
2. **`js/svg.js` implementa la misma API que el contexto 2D del canvas**, así que
   el mismo código de dibujo produce el PNG y el SVG. No hay dos renderizadores
   que mantener.

## Rutas

Todo es una sola página estática. Se usan rutas con hash para no depender de
reglas del servidor:

- `#/` editor
- `#/b/<jugada comprimida>` pizarra compartida
- `#/library` biblioteca

Cuando exista backend, esas rutas pasan a `/b/:id` y `/library` sin tocar el
resto de la aplicación.

## Lo que no incluye (y por qué)

- **Cuenta y guardado en la nube.** Decisión explícita: esta versión funciona
  como invitado, guarda local y comparte por enlace. Los ganchos están puestos
  (`saveToLibrary`, `shareLink`, el modelo `Board`), falta solo el backend.
- **Colaboración en vivo.** El modelo de datos ya lo permite, la capa de red no.
- **GIF.** El video sale en MP4 o WebM, que es lo que el navegador graba gratis.

## Notas

- Safari graba MP4 pero versiones viejas no graban nada; ahí quedan la imagen y
  el guion imprimible.
- Los archivos `.tboard.json` de la versión anterior se abren sin problema.

## Licencia

MIT. Ver [LICENSE](LICENSE).

PitchLab es un producto independiente. No usa marcas, logos ni archivos de
ningun otro sitio de pizarras tacticas.
