/* ============================================================
   config.js  ·  Ajustes globales del Power-Up
   ⚠️  RELLENA APP_KEY con tu API Key de Trello
       (https://trello.com/power-ups/admin  →  tu Power-Up  →  "API Key")
   ============================================================ */
window.PS_CONFIG = {
  APP_KEY: 'a6f085800e9583625cbe3df070b26123',      // ← imprescindible
  APP_NAME: 'Power Supply Sync',
  // Días que una tarjeta sigue marcada como "cambió" tras un cambio (badge 🔔)
  ALERT_DAYS: 1,
  // Mapa Cuenta cliente → marca (autodetección fiable en todas las líneas)
  ACCOUNTS: {
    '16225':  'Opel',
    '113822': 'Citroën',
    '113823': 'Peugeot'
    // añade aquí Fiat u otras cuentas cuando las tengas, p. ej. '99999':'Fiat'
  }
};
