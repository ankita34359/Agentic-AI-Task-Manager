/**
 * Sticker-style card: thick outline, hard offset shadow (its own layer so hover can move it
 * with transform only), optional tilt and tape.
 * color: paper | yellow | pink | cyan | mint | orange | purple
 */
export default function StickerCard({
  as: Tag = 'div',
  color = 'paper',
  tilt = 0,
  hover = true,
  tape = false,
  halftone = false,
  className = '',
  faceClassName = '',
  style,
  children,
  ...rest
}) {
  return (
    <Tag className={`sticker sticker--${color}${hover ? ' sticker--hover' : ''} ${className}`} style={{ '--tilt': `${tilt}deg`, ...style }} {...rest}>
      <span className="sticker__shadow" aria-hidden="true" />
      <div className={`sticker__face${halftone ? ' sticker__face--halftone' : ''} ${faceClassName}`}>
        {tape && <span className="sticker__tape" aria-hidden="true" />}
        {children}
      </div>
    </Tag>
  );
}
