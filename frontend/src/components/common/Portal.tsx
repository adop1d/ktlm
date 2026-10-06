import { FC, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * El cromo fijo —barra de estado, paleta, prompts, ayuda— se monta en `document.body` y no
 * dentro de la página.
 *
 * El motivo es concreto: `PageWrapper` anima con `transform`, y un ancestro con `transform`
 * se convierte en el bloque contenedor de sus descendientes `position: fixed`. Con todo el
 * cromo dentro, la barra no llegaba al borde inferior y los modales no se centraban en la
 * ventana, sino dentro de una caja más pequeña. Es un fallo difícil de ver si solo se
 * toca el CSS del overlay.
 */
export const Portal: FC<{ children: ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);