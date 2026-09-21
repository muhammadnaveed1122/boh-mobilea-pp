/**
 * WhatsApp chat surface palette.
 *
 * These are deliberately NOT theme tokens — the chat canvas is a WhatsApp-branded
 * surface (doodle backdrop + green/white bubbles), so its chrome has to sit in
 * WhatsApp's own palette rather than the app's navy `--background`/`--card`.
 *
 * Dark values are WhatsApp's shipped dark set: canvas #0B141A, bars #202C33,
 * input pill #2A3942, sheet #111B21. Light values follow the warm-beige doodle
 * backdrop baked into `whatsapp-bg-light.png` (measured base rgb(229, 221, 213)).
 */

/**
 * Backdrop painted *behind* the doodle backdrop image.
 *
 * Both backdrop images (`whatsapp-bg-dark.jpg`, `whatsapp-bg-light.png`) are
 * opaque, so this no longer shows through the canvas — it is kept because
 * `ConversationScreen` paints the whole root with it (the surround behind the
 * header/composer while the keyboard animates) and so the image decode doesn't
 * flash the app's navy `--background`.
 */
export const CANVAS_BG_LIGHT = 'rgb(229, 221, 213)';
export const CANVAS_BG_DARK = 'rgb(11, 20, 26)';

/** Composer-bar / conversation-header background. */
export const COMPOSER_BG_LIGHT = 'rgb(252, 251, 249)';
export const COMPOSER_BG_DARK = 'rgb(32, 44, 51)';

/** Composer input pill background. */
export const INPUT_BG_LIGHT = 'rgb(255, 255, 255)';
export const INPUT_BG_DARK = 'rgb(42, 57, 66)';

/** Attachment-panel background. */
export const PANEL_BG_LIGHT = 'rgb(247, 247, 247)';
export const PANEL_BG_DARK = 'rgb(17, 27, 33)';

/**
 * Divider under the header / above the composer. The app's `--border` token is
 * navy and reads as a blue seam against these surfaces, so the chat uses a
 * neutral hairline tinted off its own bars instead.
 */
export const HAIRLINE_LIGHT = 'rgba(0, 0, 0, 0.08)';
export const HAIRLINE_DARK = 'rgba(255, 255, 255, 0.08)';
