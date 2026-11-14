const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export const SunIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const MoonIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
export const CheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const InfoIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);
export const AlertIcon = (p) => (
  <svg {...base} {...p}>
    <path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21.6h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
  </svg>
);
export const XIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const TargetIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
export const ShieldCheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const GaugeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 14l4-4" />
    <path d="M3.3 17a10 10 0 1 1 17.4 0" />
  </svg>
);
export const ArrowRightIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Tally's face as a logo. */
export function LogoMark(props) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...props}>
      <path d="M26 14 L31 20 L42 7" fill="none" stroke="#1b1530" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 14 L31 20 L42 7" fill="none" stroke="#ff6fa8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M32 17 C16 17 8 32 8 42 C8 54 18 60 32 60 C46 60 56 54 56 42 C56 32 48 17 32 17 Z"
        fill="#4ee3a5"
        stroke="#1b1530"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <ellipse cx="23" cy="38" rx="6" ry="7" fill="#fff" stroke="#1b1530" strokeWidth="2.5" />
      <ellipse cx="41" cy="38" rx="6" ry="7" fill="#fff" stroke="#1b1530" strokeWidth="2.5" />
      <circle cx="24" cy="39" r="3" fill="#1b1530" />
      <circle cx="42" cy="39" r="3" fill="#1b1530" />
      <path d="M25 49 Q32 55 39 49" fill="none" stroke="#1b1530" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
