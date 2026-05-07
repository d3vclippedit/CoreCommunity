type Pt = [number, number];

// ── CORE letter node positions ────────────────────────────────────────────────

const C_NODES: Pt[] = [
  [241, 142],
  [215, 136],
  [183, 141],
  [164, 157],
  [159, 183],
  [163, 209],
  [179, 229],
  [210, 244],
  [239, 249],
];
const C_LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
];

const O_NODES: Pt[] = [
  [312, 137],
  [348, 151],
  [368, 185],
  [361, 224],
  [331, 249],
  [292, 249],
  [260, 224],
  [253, 185],
  [273, 151],
];
const O_LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 0],
];
const O_CORE: Pt = [312, 195];

const R_NODES: Pt[] = [
  [387, 140],
  [387, 170],
  [387, 200],
  [387, 230],
  [387, 255],
  [407, 140],
  [432, 148],
  [456, 168],
  [456, 192],
  [440, 213],
  [413, 219],
  [419, 231],
  [441, 248],
  [463, 255],
];
const R_LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 2],
  [10, 11],
  [11, 12],
  [12, 13],
];

const E_NODES: Pt[] = [
  [486, 140],
  [486, 175],
  [486, 210],
  [486, 255],
  [506, 140],
  [529, 140],
  [555, 140],
  [506, 200],
  [525, 200],
  [506, 255],
  [529, 255],
  [555, 255],
];
const E_LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 4],
  [4, 5],
  [5, 6],
  [2, 7],
  [7, 8],
  [3, 9],
  [9, 10],
  [10, 11],
];

// ── COMMUNITIES letter data ───────────────────────────────────────────────────

const COM: { nodes: Pt[]; links: [number, number][] }[] = [
  // c
  {
    nodes: [
      [184, 302],
      [172, 320],
      [184, 337],
    ],
    links: [
      [0, 1],
      [1, 2],
    ],
  },
  // o
  {
    nodes: [
      [207, 300],
      [223, 319],
      [207, 338],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
  },
  // m
  {
    nodes: [
      [248, 302],
      [260, 311],
      [273, 302],
      [273, 338],
      [248, 338],
    ],
    links: [
      [0, 1],
      [1, 2],
      [0, 4],
      [2, 3],
      [3, 4],
    ],
  },
  // m
  {
    nodes: [
      [294, 302],
      [306, 311],
      [319, 302],
      [319, 338],
      [294, 338],
    ],
    links: [
      [0, 1],
      [1, 2],
      [0, 4],
      [2, 3],
      [3, 4],
    ],
  },
  // u
  {
    nodes: [
      [341, 300],
      [341, 332],
      [357, 341],
      [374, 332],
      [374, 300],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  // n
  {
    nodes: [
      [381, 300],
      [381, 338],
      [414, 300],
      [414, 338],
    ],
    links: [
      [0, 1],
      [0, 2],
      [2, 3],
    ],
  },
  // i (stem only — dot rendered separately)
  {
    nodes: [
      [424, 310],
      [424, 338],
    ],
    links: [[0, 1]],
  },
  // t
  {
    nodes: [
      [445, 295],
      [445, 341],
      [437, 319],
      [464, 319],
    ],
    links: [
      [0, 1],
      [2, 3],
    ],
  },
  // i
  {
    nodes: [
      [478, 310],
      [478, 338],
    ],
    links: [[0, 1]],
  },
  // e
  {
    nodes: [
      [490, 300],
      [507, 319],
      [490, 338],
    ],
    links: [
      [0, 1],
      [1, 2],
    ],
  },
  // s
  {
    nodes: [
      [534, 300],
      [520, 316],
      [535, 326],
      [522, 342],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  },
];

// ── Tether builder ────────────────────────────────────────────────────────────

interface Tether {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
  dur: number;
}

function makeTethers(
  nodes: Pt[],
  links: [number, number][],
  pfx: string,
  baseDelay: number,
): Tether[] {
  return links.map(([a, b], i) => ({
    id: `${pfx}${i}`,
    x1: nodes[a][0],
    y1: nodes[a][1],
    x2: nodes[b][0],
    y2: nodes[b][1],
    delay: (baseDelay + i * 0.21) % 3.2,
    dur: 1.7 + (i % 5) * 0.28,
  }));
}

const CORE_TETHERS: Tether[] = [
  ...makeTethers(C_NODES, C_LINKS, "c", 0),
  ...makeTethers(O_NODES, O_LINKS, "o", 1.1),
  ...makeTethers(R_NODES, R_LINKS, "r", 0.65),
  ...makeTethers(E_NODES, E_LINKS, "e", 2.0),
];

const COM_TETHERS: Tether[] = COM.flatMap((l, li) =>
  makeTethers(l.nodes, l.links, `cm${li}`, li * 0.33),
);

const ALL_TETHERS = [...CORE_TETHERS, ...COM_TETHERS];

// ── Component ─────────────────────────────────────────────────────────────────

export function CoreLogo({
  className,
  style,
}: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 721 659"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Core Communities"
    >
      <defs>
        {/* Glow for tethers and nodes */}
        <filter id="cl-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Deep pulsing glow for O core */}
        <filter id="cl-core" x="-250%" y="-250%" width="600%" height="600%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b3" />
          <feMerge>
            <feMergeNode in="b1" />
            <feMergeNode in="b2" />
            <feMergeNode in="b3" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Person silhouette symbol */}
        <symbol id="cl-p" viewBox="0 0 10 15">
          <circle cx="5" cy="2.8" r="2.6" fill="white" />
          <path
            d="M1.5 6.8 C2 5.9 3.5 5.3 5 5.3 C6.5 5.3 8 5.9 8.5 6.8 L9.2 13.5 L7 13.5 L6.4 9.2 L3.6 9.2 L3 13.5 L0.8 13.5 Z"
            fill="white"
          />
        </symbol>

        <style>{`
          @keyframes cl-flicker {
            0%,100%{opacity:.38} 8%{opacity:.88} 22%{opacity:.28} 40%{opacity:.95} 58%{opacity:.32} 78%{opacity:.72}
          }
          @keyframes cl-breathe {
            0%,100%{opacity:.75} 50%{opacity:1}
          }
          @keyframes cl-core-pulse {
            0%,100%{opacity:.38} 50%{opacity:.82}
          }
          @keyframes cl-bright-pulse {
            0%,100%{opacity:.82;r:8} 50%{opacity:1;r:11}
          }
          .cl-t { animation: cl-flicker linear infinite; }
          .cl-n { animation: cl-breathe ease-in-out infinite; }
          .cl-core-ring { animation: cl-core-pulse ease-in-out 2.9s infinite; }
          .cl-core-dot  { animation: cl-bright-pulse ease-in-out 2.9s infinite; }
        `}</style>
      </defs>

      {/* ── Ghost letter backdrop ── */}
      <g opacity="0.06">
        <text
          x="360"
          y="255"
          textAnchor="middle"
          fontFamily="Inter,'system-ui',sans-serif"
          fontWeight="800"
          fontSize="165"
          fill="white"
        >
          CORE
        </text>
        <text
          x="360"
          y="342"
          textAnchor="middle"
          fontFamily="Inter,'system-ui',sans-serif"
          fontWeight="800"
          fontSize="60"
          fill="white"
        >
          COMMUNITIES
        </text>
      </g>

      {/* ── Tether lines ── */}
      <g filter="url(#cl-glow)">
        {ALL_TETHERS.map((t) => (
          <line
            key={t.id}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="white"
            strokeWidth="0.85"
            className="cl-t"
            style={{ animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s` }}
          />
        ))}
      </g>

      {/* ── Pulse dots traveling along tethers ── */}
      {ALL_TETHERS.map((t, i) => {
        const isCORE = i < CORE_TETHERS.length;
        const r = isCORE ? "2" : "1.4";
        const dur = `${t.dur * 1.25}s`;
        const begin = `${t.delay * 0.8}s`;
        return (
          <circle key={`p-${t.id}`} r={r} fill="white" filter="url(#cl-glow)">
            <animate
              attributeName="opacity"
              values="0;0;1;1;0"
              keyTimes="0;0.05;0.25;0.75;1"
              dur={dur}
              begin={begin}
              repeatCount="indefinite"
            />
            <animateMotion
              path={`M${t.x1},${t.y1} L${t.x2},${t.y2}`}
              dur={dur}
              begin={begin}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}

      {/* ── CORE person nodes ── */}
      {[
        ...C_NODES.map((p, i) => ({ p, s: 12, d: i * 0.22 })),
        ...O_NODES.map((p, i) => ({ p, s: 12, d: 0.6 + i * 0.17 })),
        ...R_NODES.map((p, i) => ({ p, s: 12, d: 1.1 + i * 0.13 })),
        ...E_NODES.map((p, i) => ({ p, s: 12, d: 1.9 + i * 0.19 })),
      ].map(({ p, s, d }) => (
        <use
          key={`cn-${p[0]}-${p[1]}`}
          href="#cl-p"
          x={p[0] - s / 2}
          y={p[1] - s}
          width={s}
          height={s * 1.5}
          filter="url(#cl-glow)"
          className="cl-n"
          style={{ animationDelay: `${d}s`, animationDuration: `${3.2 + (p[0] % 6) * 0.35}s` }}
        />
      ))}

      {/* ── COMMUNITIES person nodes ── */}
      {COM.flatMap((l, li) =>
        l.nodes.map((p, ni) => {
          const s = 8;
          const d = li * 0.29 + ni * 0.16;
          return (
            <use
              key={`comn-${p[0]}-${p[1]}`}
              href="#cl-p"
              x={p[0] - s / 2}
              y={p[1] - s}
              width={s}
              height={s * 1.5}
              filter="url(#cl-glow)"
              className="cl-n"
              style={{ animationDelay: `${d}s`, animationDuration: `${2.8 + (ni % 4) * 0.4}s` }}
            />
          );
        }),
      )}

      {/* ── i-dots (glowing circle instead of person) ── */}
      {([424, 478] as number[]).map((x) => (
        <circle
          key={`idot-${x}`}
          cx={x}
          cy={294}
          r="3.2"
          fill="white"
          filter="url(#cl-glow)"
          className="cl-n"
          style={{ animationDelay: x === 424 ? "0s" : "0.6s", animationDuration: "3s" }}
        />
      ))}

      {/* ── O core — layered pulsing glow ── */}
      <circle
        cx={O_CORE[0]}
        cy={O_CORE[1]}
        r="28"
        fill="white"
        filter="url(#cl-core)"
        className="cl-core-ring"
      />
      <circle
        cx={O_CORE[0]}
        cy={O_CORE[1]}
        r="8"
        fill="white"
        filter="url(#cl-glow)"
        className="cl-core-dot"
      />
    </svg>
  );
}
