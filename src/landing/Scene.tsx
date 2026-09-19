import React from 'react';
import useAppColors from '../hooks/useAppColors';
import { toHex } from '../utils/color';
import { createShapeField, type ShapeField } from './shapeField';

export interface SceneProps {
  /** False draws one still frame (prefers-reduced-motion). */
  animate?: boolean;
  /** Called if the WebGL context can't be created, so the page can settle on its gradient. */
  onUnavailable?: () => void;
}

/** Thin React shell over the imperative scene in shapeField.ts: mounts it, and pushes theme/motion changes in. */
const Scene: React.FC<SceneProps> = ({ animate = true, onUnavailable }) => {
  const [colors] = useAppColors();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fieldRef = React.useRef<ShapeField | null>(null);

  const palette = React.useMemo(
    () => [colors.info, colors.infoLight, colors.success, colors.warning, colors.warningLight, colors.fail].map(toHex),
    [colors],
  );
  const outline = toHex(colors.bgDark);

  // latest values for the mount effect without making it re-run (it must mount once)
  const latest = React.useRef({ palette, outline, animate });
  latest.current = { palette, outline, animate };

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    try {
      fieldRef.current = createShapeField(el, latest.current);
    } catch (err) {
      console.warn('Landing scene unavailable, using the gradient:', err);
      onUnavailable?.();
    }
    return () => {
      fieldRef.current?.dispose();
      fieldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    fieldRef.current?.update({ palette, outline, animate });
  }, [palette, outline, animate]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default Scene;
