// Single source of truth para la versión del cotizador.
// Cambiar AQUI cuando saques una nueva versión y se propaga automaticamente
// a TopBar, FeedbackModal, login page y cualquier otro lugar que lo lea.

// Versión que VE el usuario.
// v2.0: estrenó MULTI-EMPRESA (BioNovaPack USA + Extruidos México).
// v2.1: cotizar guiado PASO POR PASO + cierre de auditorías.
// v2.2: reglas de negocio validadas por Diego (10-jun-2026): aprobación a
//       reducción >5% (antes 35%), redondeo medio-para-abajo del PN, cargo
//       +2.5/kg a rollos PN<1.3, intenso 1.25/kg, tabla de márgenes PUE/PPD.
// Subir esta constante actualiza login, TopBar y reabre el modal de Novedades.
export const APP_VERSION = '2.2';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_FULL = `v${APP_VERSION} BETA`;
export const APP_NAME = 'SICE Cotizador';
export const APP_ORG = 'BioNovaPack LLC';
