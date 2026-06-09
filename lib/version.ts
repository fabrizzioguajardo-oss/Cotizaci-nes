// Single source of truth para la versión del cotizador.
// Cambiar AQUI cuando saques una nueva versión y se propaga automaticamente
// a TopBar, FeedbackModal, login page y cualquier otro lugar que lo lea.

// Versión que VE el usuario.
// v2.0: estrenó MULTI-EMPRESA (BioNovaPack USA + Extruidos México).
// v2.1: cotizar guiado PASO POR PASO (revelado progresivo del formulario) +
//       cierre completo de las auditorías (robustez, seguridad, correctitud de
//       precios, autosave, PDFs). Ver CHANGELOG.md.
// Subir esta constante actualiza login, TopBar y reabre el modal de Novedades.
export const APP_VERSION = '2.1';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_FULL = `v${APP_VERSION} BETA`;
export const APP_NAME = 'SICE Cotizador';
export const APP_ORG = 'BioNovaPack LLC';
