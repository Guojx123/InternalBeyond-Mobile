interface AvatarProps {
  /** 图片地址（本地 object URL / dataURL / 远端均可） */
  src?: string | null;
  /** 兜底字符：模块 glyph 或姓名首字 */
  glyph?: string;
  /** 兜底姓名，用于取首字 */
  name?: string;
  /** 边长（px） */
  size?: number;
  /** 额外类名 */
  className?: string;
  title?: string;
}

/**
 * 圆形头像：有图用图，无图降级为 glyph / 姓名首字。
 * 背景用 --soft（此前该变量缺失导致头像透明）。
 */
export function Avatar({ src, glyph, name, size = 38, className = '', title }: AvatarProps) {
  const fallback = glyph || (name || '?').trim().slice(0, 1) || '?';
  return (
    <span
      className={`ava ${className}`.trim()}
      title={title}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.42)),
      }}
    >
      {src ? <img src={src} alt={name || ''} /> : fallback}
    </span>
  );
}
