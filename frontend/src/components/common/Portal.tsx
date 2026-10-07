import { FC, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The fixed chrome —status bar, palette, prompts, help— is mounted in `document.body`, not
 * inside the page.
 *
 * The reason is concrete: `PageWrapper` animates with `transform`, and an ancestor with
 * `transform` becomes the containing block for its `position: fixed` descendants. With all
 * the chrome inside, the bar never reached the bottom edge and the modals did not center in
 * the window but inside a smaller box. It is a bug that is hard to spot if you only touch the
 * overlay CSS.
 */
export const Portal: FC<{ children: ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);