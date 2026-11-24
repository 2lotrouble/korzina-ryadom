/** Картинка первого экрана: корзина с продуктами долгого хранения и метка магазина. Чистый SVG, без внешних файлов. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 440 400" role="img" aria-label="Корзина с крупой, макаронами и консервами">
      <defs>
        <filter id="art-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1f2a24" floodOpacity="0.14" />
        </filter>
      </defs>

      {/* фон */}
      <circle cx="226" cy="214" r="172" fill="#e6f4ea" />
      <circle cx="372" cy="78" r="30" fill="#f6c453" />
      <circle cx="58" cy="286" r="9" fill="#f6c453" />
      <circle cx="398" cy="262" r="6" fill="#1f8a4c" opacity="0.5" />
      <ellipse cx="222" cy="368" rx="128" ry="12" fill="#1f2a24" opacity="0.1" />

      {/* ручка корзины — позади продуктов */}
      <path d="M130 240C130 96 314 96 314 240" fill="none" stroke="#b97a36" strokeWidth="13" strokeLinecap="round" />

      {/* бутылка масла */}
      <g transform="rotate(-10 120 200)">
        <rect x="111" y="112" width="22" height="16" rx="4" fill="#1f8a4c" />
        <rect x="113" y="124" width="18" height="30" rx="4" fill="#f4d46a" />
        <rect x="98" y="148" width="48" height="116" rx="14" fill="#f4d46a" />
        <rect x="98" y="186" width="48" height="38" fill="#fffdf6" />
        <circle cx="122" cy="205" r="9" fill="#f6c453" />
      </g>

      {/* пачка гречки */}
      <g transform="rotate(-4 178 190)">
        <rect x="140" y="112" width="80" height="150" rx="9" fill="#8b5a2b" />
        <rect x="140" y="112" width="80" height="16" rx="8" fill="#734921" />
        <rect x="150" y="146" width="60" height="50" rx="7" fill="#fff6dc" />
        <text x="180" y="168" textAnchor="middle" fontSize="12" fontWeight="700" fill="#5b3a17" letterSpacing="0.5">
          ГРЕЧКА
        </text>
        <text x="180" y="184" textAnchor="middle" fontSize="10" fontWeight="500" fill="#8b5a2b">
          800 г
        </text>
        <g fill="#c99355">
          <circle cx="160" cy="214" r="3" />
          <circle cx="172" cy="220" r="3" />
          <circle cx="186" cy="213" r="3" />
          <circle cx="199" cy="221" r="3" />
        </g>
      </g>

      {/* макароны */}
      <g transform="rotate(5 254 180)">
        <rect x="220" y="92" width="72" height="170" rx="10" fill="#f6c453" />
        <rect x="220" y="92" width="72" height="16" rx="8" fill="#e3ae3a" />
        <rect x="231" y="128" width="50" height="68" rx="9" fill="#fff6dc" />
        <g fill="none" stroke="#e3a52c" strokeWidth="4" strokeLinecap="round">
          <path d="M240 142q8 -8 16 0t16 0" />
          <path d="M240 158q8 -8 16 0t16 0" />
          <path d="M240 174q8 -8 16 0t16 0" />
        </g>
        <rect x="231" y="208" width="50" height="8" rx="4" fill="#e3ae3a" />
      </g>

      {/* консервы */}
      <g transform="rotate(9 320 210)">
        <rect x="290" y="160" width="62" height="104" rx="8" fill="#cdd5d0" />
        <rect x="290" y="182" width="62" height="54" fill="#e4572e" />
        <ellipse cx="321" cy="162" rx="31" ry="7" fill="#e7ecE9" />
        <ellipse cx="321" cy="162" rx="20" ry="4" fill="none" stroke="#b6c0ba" strokeWidth="2" />
        <path d="M304 209c8 -9 20 -9 28 0c-8 9 -20 9 -28 0Zm28 0l9 -7v14Z" fill="#fff" />
      </g>

      {/* корзина */}
      <g filter="url(#art-shadow)">
        <path d="M108 244H336L312 350Q309 364 295 364H149Q135 364 132 350Z" fill="#dba25c" />
        <g fill="none" stroke="#c0843f" strokeWidth="3" strokeLinecap="round">
          <path d="M116 276H328M122 306H322M128 336H316" />
          <path d="M160 250l10 108M222 250v110M284 250l-10 108" opacity="0.7" />
        </g>
        <rect x="98" y="230" width="248" height="24" rx="12" fill="#c98b43" />
      </g>
      <path d="M222 326c-22 -15 -30 -26 -30 -37a16 16 0 0 1 30 -8a16 16 0 0 1 30 8c0 11 -8 22 -30 37Z" fill="#fff" stroke="#c0843f" strokeWidth="2" />
      <path d="M222 318c-17 -12 -23 -20 -23 -28a11 11 0 0 1 23 -4a11 11 0 0 1 23 4c0 8 -6 16 -23 28Z" fill="#e4572e" />

      {/* метка магазина и статус */}
      <g filter="url(#art-shadow)">
        <path d="M66 62a26 26 0 0 1 26 26c0 19 -26 44 -26 44s-26 -25 -26 -44a26 26 0 0 1 26 -26Z" fill="#e4572e" />
        <circle cx="66" cy="88" r="10" fill="#fff" />
      </g>
      <g filter="url(#art-shadow)">
        <rect x="236" y="30" width="194" height="38" rx="19" fill="#fff" />
        <circle cx="257" cy="49" r="6" fill="#1f8a4c" />
        <circle cx="257" cy="49" r="10" fill="#1f8a4c" opacity="0.2" />
        <text x="273" y="54" fontSize="13.5" fontWeight="600" fill="#1f2a24">
          Волонтёры до 20:00
        </text>
      </g>
    </svg>
  )
}
