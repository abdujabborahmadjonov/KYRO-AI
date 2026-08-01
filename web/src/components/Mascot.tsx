/** Kyro the blob — a friendly mascot in the spirit of kids-health apps. */
export function Mascot({ size = 92 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Kyro the mascot" className="mascot">
      {/* little legs */}
      <ellipse cx="46" cy="112" rx="7" ry="5" fill="#fff" />
      <ellipse cx="74" cy="112" rx="7" ry="5" fill="#fff" />
      {/* body */}
      <path
        d="M60 8 C88 8 104 32 104 62 C104 92 86 110 60 110 C34 110 16 92 16 62 C16 32 32 8 60 8 Z"
        fill="#ffffff"
        stroke="#FFE1D6"
        strokeWidth="3"
      />
      {/* crown */}
      <path d="M46 10 L52 2 L60 9 L68 2 L74 10 Z" fill="#FFD54F" stroke="#F9A825" strokeWidth="1.5" strokeLinejoin="round" />
      {/* eyes */}
      <circle cx="46" cy="56" r="5" fill="#4A3B52" />
      <circle cx="74" cy="56" r="5" fill="#4A3B52" />
      <circle cx="47.8" cy="54.2" r="1.6" fill="#fff" />
      <circle cx="75.8" cy="54.2" r="1.6" fill="#fff" />
      {/* cheeks */}
      <circle cx="36" cy="68" r="6" fill="#FFC4B2" opacity="0.8" />
      <circle cx="84" cy="68" r="6" fill="#FFC4B2" opacity="0.8" />
      {/* smile */}
      <path d="M50 72 Q60 82 70 72" stroke="#FF5E7E" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
