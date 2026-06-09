# Power Supply Sync · Power-Up de Trello

Carga el export de piezas faltantes de **Power Supply** (Stellantis) desde dentro de
Trello, sincroniza las tarjetas y avisa de los cambios.

## Qué hace
- **Botón en el tablero** → modal para subir el CSV/XLSX del día.
- Compara con las tarjetas existentes usando la clave **Pedido SAP + Puesto**:
  - **Nuevos** → crea tarjeta en *Pendientes*.
  - **Desaparecidos** (estaban y hoy no → facturado/anulado) → mueve a *Desaparecidos* + comentario.
  - **Reaparecidos** → vuelven a *Pendientes*.
  - **Cambios** (Estado, ETA, Cantidad, Prioridad, Alternativa) → comentario + badge 🔔 + historial.
- **Badges** en cada tarjeta: estado (color), ETA, prioridad, 🔔 si cambió hoy, ↔ si hay alternativa.
- **Sección "historial"** en el reverso de la tarjeta.
- **Botón "Marcar revisado"** → quita el badge 🔔.
- **Alerta opcional a Discord** con el resumen del día.
- El badge del botón del tablero muestra "(N✎ M✗)" con los cambios/desapariciones de la última carga.

## Instalación (GitHub Pages)
1. Sube **toda esta carpeta** a un repo y activa **GitHub Pages** (Settings → Pages → rama `main`, carpeta raíz).
2. Consigue tu **API Key** en https://trello.com/power-ups/admin (crea/usa un Power-Up).
3. Edita `js/config.js` y pega tu API Key en `APP_KEY`.
4. En https://trello.com/power-ups/admin → tu Power-Up → **New Iframe Connector**:
   pon la URL `https://TU-USUARIO.github.io/TU-REPO/index.html`.
   Activa las capacidades: board-buttons, card-badges, card-detail-badges,
   card-back-section, card-buttons, show-settings, authorization.
5. En el mismo panel, en **API Key**, añade el **origin permitido**:
   `https://TU-USUARIO.github.io`.
6. Abre tu tablero → **Power-Ups** → añade el tuyo (pestaña "Custom").

## Primer uso
1. Engranaje del Power-Up → **Conectar con Trello** (autoriza una vez).
2. Engranaje → **Ajustes**: elige lista de Pendientes y de Desaparecidos
   (y, si quieres, el webhook de Discord).
3. Botón **Power Supply** del tablero → sube el export → revisa la vista previa → **Aplicar**.

## Notas
- El snapshot e historial viajan en la descripción de cada tarjeta, en un bloque
  `─── no editar ───`. Puedes editar el resto de la descripción sin romper nada.
- Si Discord bloquea el aviso por CORS, enruta el webhook por tu sistema Python ya existente.
