/**
 * WhatsApp-style attachment glyphs, hand-built as react-native-svg so they
 * match the multi-color look of WhatsApp's attach sheet (a colored glyph on a
 * neutral dark circle) rather than the single-color lucide icons.
 *
 * Each glyph draws inside a 24×24 viewBox. `bg` is the circle's background
 * color — passed in so glyphs that need a "hole" (the camera lens) can cut it
 * cleanly against whatever the themed circle color is.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@theme';

interface GlyphProps {
  size?: number;
}

const LENS = '#aab4c4';
const LENS_WELL = '#e6ebf2';

const BLUE = '#4a9eff';
const BLUE_PALE = '#bfdcff';
const GREEN = '#22c55e';

/** Blue stacked-photos glyph (WhatsApp "Photos"). */
export function PhotosGlyph({ size = 28 }: Readonly<GlyphProps>) {
  const front = '#2f80ed';
  const back = '#8fb9ff';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Back photo (peek, top-right) */}
      <Rect x={8} y={2.5} width={13.5} height={13.5} rx={3} fill={back} />
      {/* Front photo */}
      <Rect x={2.5} y={7} width={15.5} height={14.5} rx={3.2} fill={front} />
      {/* Sun */}
      <Circle cx={7} cy={11.5} r={1.9} fill="#ffffff" />
      {/* Mountains */}
      <Path d="M2.8 21 L8.6 13.4 L11.8 17.4 L14.4 14.2 L17.7 21 Z" fill="#ffffff" />
    </Svg>
  );
}

/** Camera glyph (WhatsApp "Camera"): dark charcoal on the light circle, white on dark. */
export function CameraGlyph({ size = 28 }: Readonly<GlyphProps>) {
  const { colorScheme } = useTheme();
  const body = colorScheme === 'dark' ? '#ffffff' : '#3a4a54';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Viewfinder bump */}
      <Path d="M8.4 6.2 L9.7 4 H14.3 L15.6 6.2 Z" fill={body} />
      {/* Body */}
      <Rect x={3} y={6} width={18} height={13} rx={3.2} fill={body} />
      {/* Lens: gray well + lens on the white body */}
      <Circle cx={12} cy={12.6} r={3.6} fill={LENS_WELL} />
      <Circle cx={12} cy={12.6} r={2.4} fill={LENS} />
      <Circle cx={12} cy={12.6} r={1} fill="#ffffff" />
      {/* Flash dot */}
      <Circle cx={17.4} cy={9.6} r={0.85} fill={LENS} />
    </Svg>
  );
}

/** Green map-pin glyph (WhatsApp "Location"). */
export function LocationGlyph({ size = 28 }: Readonly<GlyphProps>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2 C7.6 2 4 5.5 4 9.8 C4 15.2 12 22 12 22 C12 22 20 15.2 20 9.8 C20 5.5 16.4 2 12 2 Z"
        fill={GREEN}
      />
      <Circle cx={12} cy={9.8} r={2.9} fill="#ffffff" />
    </Svg>
  );
}

/** Blue document glyph with a folded corner (WhatsApp "Document"). */
export function DocumentGlyph({ size = 28 }: Readonly<GlyphProps>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Page */}
      <Path
        d="M6 3 H14 L19 8 V19.8 A1.2 1.2 0 0 1 17.8 21 H6 A1.2 1.2 0 0 1 4.8 19.8 V4.2 A1.2 1.2 0 0 1 6 3 Z"
        fill={BLUE}
      />
      {/* Folded corner */}
      <Path d="M14 3 V7 A1 1 0 0 0 15 8 H19 Z" fill={BLUE_PALE} />
    </Svg>
  );
}
