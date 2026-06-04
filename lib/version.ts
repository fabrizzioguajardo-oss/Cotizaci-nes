// Single source of truth para la versión del cotizador.
// Cambiar AQUI cuando saques una nueva versión y se propaga automaticamente
// a TopBar, FeedbackModal, login page y cualquier otro lugar que lo lea.

// Versión que VE el usuario. v2.0 es la actualización mayor que estrena
// MULTI-EMPRESA: cotizar para BioNovaPack (USA, USD) y Extruidos (México, MXN),
// cada una con su moneda, formato de PDF e identidad de marca. Consolida además
// todo el arco interno previo (builds 1.09–1.22 + la red de seguridad, ver
// CHANGELOG.md). El salto 1.10 → 2.0 es a propósito: cotizar para una segunda
// empresa/país es el cambio más grande del proyecto.
export const APP_VERSION = '2.0';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_FULL = `v${APP_VERSION} BETA`;
export const APP_NAME = 'SICE Cotizador';
export const APP_ORG = 'BioNovaPack LLC';
