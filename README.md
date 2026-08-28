# MiCharla Tac

**En vivo: https://fredymontero.com/micharla-tac**

La ruta anterior `/pitchlab` redirige aqui de forma permanente, asi que
cualquier enlace de jugada que ya hayas compartido sigue abriendo.

Pizarra táctica de fútbol 11 v 11 que corre entera en el navegador. Dibuja el
esquema, anima la jugada cuadro a cuadro, exporta imagen, guion o video y
comparte por enlace. Sin cuenta, sin servidor, sin costo.

Interfaz en español por defecto, con inglés disponible en el selector de idioma.

## Cómo correrlo

```bash
cd ~/micharla-tac
python3 -m http.server 8787
# abrir http://localhost:8787
```

No hay build. Cualquier hosting estático sirve (Vercel, GitHub Pages, Netlify):

```bash
vercel deploy --prod
```

`fredymontero.com/micharla-tac` sirve una **copia** de estos archivos, no un rewrite.
Este repositorio es la fuente de la verdad. Para publicar un cambio:

```bash
cd ~/micharla-tac && git commit -am "..."          # 1. cambia aqui
cd ~/from-the-field-to-code
./scripts/sync-micharla-tac.sh                     # 2. copia al sitio
vercel deploy --prod                           # 3. publica (git push NO publica)
```

## Qué hace

**Campo** 11v11 completo, medio campo, vertical, medio vertical, último tercio,
9v9, 7v7, futsal, fútbol playa, rejilla de entrenamiento y pizarra en blanco.
Cinco superficies, franjas de corte, tercios y carriles, rejilla.
Medidas reglamentarias en metros (105 x 68 y las marcas oficiales del campo).

**Fichas** Dos equipos con nombre, color, número y nombre de jugador editables.
Formaciones por tamaño de equipo: 11 (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2 y más),
9, 7 y futsal. Material: balón, conos, platos, maniquíes, picas, escaleras,
vallas, árbitro y textos.

**Barrera** Los maniquíes de tiro libre en fila, como se plantan en el
entrenamiento. Es una sola ficha: se coloca, se gira hacia el balón y se mueve
entera. De 2 a 6 maniquíes con el control del panel. Al girarla se apunta la
fila, los maniquíes no se tumban de costado; el maniquí suelto sí gira, que
para eso está.

**Arcos** Dos, y los dos miden lo que miden en la cancha: el reglamentario de
7.32 m de boca (regla 1 de la IFAB) y el de entrenamiento de 3 m. Se ven desde
arriba con la boca abierta y los dos postes marcados, así que se lee de un
vistazo hacia dónde se remata, y giran a cualquier ángulo. El deslizador de
tamaño (50 - 200%) lleva el pequeño de 1.5 m a 6 m, que es todo el rango de
arcos portátiles que existen. No pasan por el tamaño global de fichas a
propósito: agrandar las fichas no puede agrandar una portería.

La paleta flotante coloca fichas en cadena: eliges una, tocas el campo las veces
que haga falta y sales con **doble toque en la misma ficha** o con `Esc`. Los
números se autoincrementan por equipo. El doble toque existe porque en una
tablet no hay tecla `Esc`: sin él la paleta se quedaba trabada en modo colocar.

**Dibujo** Pase, desmarque, conducción, remate, línea, dibujo libre, zona
rectangular, óvalo, zona libre punto a punto, bloqueo y foco de atención.
Las flechas nacen rectas y se curvan arrastrando el tirador central.
Color, grosor, opacidad, relleno y línea discontinua por dibujo.

**Animación** Cada cuadro es una foto. Mueve las fichas, agrega un cuadro y la
pizarra interpola el movimiento. Fase con nombre ("Salida", "Disparador",
"Definición"), duración y tipo de movimiento por cuadro, papel cebolla,
previsualización punteada de a dónde va cada ficha, velocidad 0.25x a 2x y
repetición. Las flechas de un cuadro se van trazando mientras ese paso corre.

**Presentación** Un botón (o la tecla `M`) deja la pizarra sola a pantalla
completa: se van la barra, el riel, el panel y la línea de tiempo, y quedan la
fase del cuadro en grande, la nota del entrenador debajo y cuatro botones del
tamaño de un dedo que se apartan solos a los pocos segundos y vuelven con
cualquier toque. Deslizar cambia de cuadro. Presentando **no se dibuja**: un
atrapador cubre el lienzo y las teclas de edición se ignoran, así que un roce en
la tablet parado en la cancha no borra una ficha delante de los jugadores.
Pide pantalla completa donde el navegador la da y mantiene la pantalla
encendida con Wake Lock donde existe; donde no, el modo funciona igual.

**Exportar**
- PNG del cuadro actual a 1x, 2x o 3x
- SVG vectorial del cuadro actual
- Guion imprimible con todos los cuadros, su fase y su nota
- Video de la animación en MP4 donde el navegador lo permite (Chrome, Edge,
  Safari recientes) y WebM en el resto
- Enlace: la jugada entera viaja comprimida en la URL, no se sube nada

La jugada **no sale como archivo**. Sale como imagen, guion, video o enlace, y
se guarda en el navegador. Es una decisión, no algo pendiente: la pizarra no
entrega el documento crudo.

**Guardado** Autoguardado local en cada cambio, biblioteca de pizarras en el
navegador con miniatura, búsqueda y duplicado. Todo vive en `localStorage`.

**Sin conexión** Service worker + PWA instalable. Verificado de verdad: se
carga una vez con señal, se corta la red y la pizarra sigue entera. Sirve para
la cancha sin cobertura.

**Pantallas** La interfaz se dimensiona sola. En monitores grandes (desde
1600px y otra vez desde 2100px) crecen la barra superior, el riel, el panel,
las miniaturas y la tipografía, no solo la cancha. En pantallas táctiles cada
control se agranda para el dedo, y en tablet horizontal el riel pasa a dos
columnas para que las catorce herramientas quepan sin hacer scroll. Los
teléfonos quedan fuera de ese ensanchamiento por debajo de 700px.

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
| `M` | Modo presentación (`Esc` para salir) |
| Dos dedos | Pellizcar para acercar, arrastrar para mover |

## Cómo está hecho

Módulos ES puros, sin framework y sin dependencias. Canvas 2D para todo el
dibujo, DOM para los paneles.

| Archivo | Responsabilidad |
| --- | --- |
| `js/pitch.js` | Medidas del campo y de los arcos en metros, proyección y marcas |
| `js/view.js` | Zoom, paneo e imán a los puntos del campo |
| `js/state.js` | Documento, cuadros, selección, historial y guardado |
| `js/render.js` | Pintado: fichas, dibujos, interpolación, ayudas visuales |
| `js/interact.js` | Puntero y gestos táctiles, hit testing, herramientas |
| `js/animate.js` | Reloj de reproducción |
| `js/export.js` | PNG, SVG, guion, video, archivos y enlaces |
| `js/svg.js` | Grabador con la misma API que Canvas 2D que emite SVG |
| `js/present.js` | Modo presentación: pantalla completa, gestos, Wake Lock |
| `js/i18n.js` | Diccionarios es / en |
| `js/main.js` | Cableado de la interfaz |

Tres decisiones que vale la pena conocer:

1. **Las posiciones se guardan como fracción del campo visible** y se convierten
   a fracción del campo real cuando cambias de vista. Por eso pasar de horizontal
   a vertical, a medio campo o a futsal deja a cada ficha en el mismo punto del
   campo de verdad. Ver `toPitchFrac` y `fromPitchFrac` en `js/pitch.js`.
2. **`js/svg.js` implementa la misma API que el contexto 2D del canvas**, así que
   el mismo código de dibujo produce el PNG y el SVG. No hay dos renderizadores
   que mantener.
3. **El campo se mide contra los elementos, no contra números fijos.** En modo
   presentación `computeRects` le pregunta a `present.insets()` cuánto ocupan el
   cartel de fase y la barra de controles y centra la cancha en lo que sobra. El
   cartel tiene alto fijo a propósito: si creciera con el texto, el campo saltaría
   de tamaño al pasar de un cuadro con nota a uno sin ella. Y las medidas salen de
   `offsetTop` / `offsetHeight`, no de `getBoundingClientRect`, porque la barra se
   aparta con un `transform` y el campo saltaría cada vez que lo hace.

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
- Ya no se abren archivos de jugada. Las pizarras guardadas en el navegador y
  los enlaces compartidos siguen funcionando igual, y los `minigoal` guardados
  antes ahora se dibujan con sus 3 m reales en vez del tamaño arbitrario que
  tenían.
- Las pizarras guardadas antes de los dos cambios de nombre se migran solas la
  primera vez que abres esta versión: `tacticalboard.*` y `pitchlab.*` pasan a
  `micharlatac.*`. Ver `js/legacy.js`, que no importa nada a propósito y es
  importado por `i18n.js` y `state.js` para que corra antes que cualquier
  lectura de `localStorage`.
- El balón es el emoji ⚽ dibujado como texto en el lienzo, no una figura hecha
  a mano: cualquier cosa que dibujáramos sería una imitación peor de algo que el
  sistema ya trae bien hecho. Sale de la fuente de emoji del dispositivo, así que
  no se pide nada a la red, y se ve un poco distinto en Mac, Android y Windows.
  Ver `ballGlyph` en `js/render.js`.
- Por eso el balón se dibuja más grande de lo que es en la cancha (`KINDS.ball`
  en `js/state.js`): una pizarra sirve para ver la jugada, no para respetar los
  22 cm del balón.
- El PNG y el video llevan el balón siempre, porque rasterizan. En el **SVG** va
  como texto y depende de que quien lo abra tenga fuente de emoji; si no la
  tiene, cae a un glifo blanco. Es el precio de usar el emoji de verdad.
- `css/present.css` va después de `css/styles.css` a propósito: gana por orden,
  sin necesitar `!important`.
- `sw.js` cachea la lista `ASSETS`. Si agregas un archivo al proyecto, agrégalo
  ahí y sube `CACHE` a la versión siguiente, o la app se rompe sin conexión.

## Licencia y créditos

El código es MIT. Ver [LICENSE](LICENSE).

La tipografía **Inter** (© 2016 The Inter Project Authors) va incluida en
`fonts/` bajo la SIL Open Font License 1.1. Ver [fonts/OFL.txt](fonts/OFL.txt).
Se sirve desde este mismo dominio a propósito: ninguna petición sale del
navegador del usuario para cargar una fuente.

Todo lo demás (código, iconos, textos) es original.

MiCharla Tac es un producto independiente. No está afiliado, patrocinado ni
avalado por ninguna federación, club, marca deportiva ni por ningún otro sitio
de pizarras tácticas. Las medidas del campo son datos reglamentarios de dominio
público. Los nombres de formaciones (4-4-2, 4-3-3) son terminología común del
fútbol.
