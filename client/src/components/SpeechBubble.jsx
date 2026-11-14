/** Comic speech bubble with an outlined tail. tail: bottom-left | bottom-right | left | right */
export default function SpeechBubble({ children, tail = 'bottom-left', tilt = 0, className = '', ...rest }) {
  return (
    <div className={`bubble bubble--${tail} ${className}`} style={{ '--tilt': `${tilt}deg` }} {...rest}>
      {children}
    </div>
  );
}
