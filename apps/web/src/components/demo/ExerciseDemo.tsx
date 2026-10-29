import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { C, DEMOS, type Demo } from './demos';
import { frontJoints, lerpFront, lerpSide, repCurve, sideJoints, type Pt } from './rig';

const REP_MS = 3200;
const GROUND = 150;

const limb = (pts: Pt[], color: string, w: number, k: string) => (
  <polyline key={k} points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
);

function SideFigure({ demo, t }: { demo: Extract<Demo, { view: 'side' }>; t: number }) {
  const pose = lerpSide(demo.a, demo.b, repCurve(t));
  if (demo.farPhase) {
    const other = lerpSide(demo.a, demo.b, repCurve(t + demo.farPhase));
    pose.farArm = other.arm;
  }
  const j = sideJoints(pose);
  return (
    <>
      {demo.back?.(j)}
      {limb([j.hip, j.farKnee, j.farAnkle, j.farToe], C.far, 8, 'fl')}
      {limb([j.shoulder, j.farElbow, j.farHand], C.far, 7, 'fa')}
      {limb([j.hip, j.shoulder], C.body, 13, 'torso')}
      <circle cx={j.head[0]} cy={j.head[1]} r={9} fill={C.body} />
      {limb([j.hip, j.knee, j.ankle, j.toe], C.body, 8.5, 'nl')}
      {limb([j.shoulder, j.elbow, j.hand], C.body, 7.5, 'na')}
      {demo.front?.(j)}
    </>
  );
}

function FrontFigure({ demo, t }: { demo: Extract<Demo, { view: 'front' }>; t: number }) {
  const j = frontJoints(lerpFront(demo.a, demo.b, repCurve(t)));
  const arms = [0, 1].map((i) => limb([j.shoulders[i], j.elbows[i], j.hands[i]], C.body, 7.5, `a${i}`));
  if (demo.lying) {
    // Visto da cabeceira: banco em corte, tronco deitado (círculo) e a cabeça mais perto de quem olha.
    return (
      <>
        <rect x={104} y={0} width={32} height={6} rx={2} fill={C.frame} stroke={C.frameLine} strokeWidth={1.5} />
        <rect x={116} y={6} width={8} height={24} fill={C.frameLine} />
        <rect x={98} y={30} width={44} height={6} rx={2} fill={C.frame} stroke={C.frameLine} strokeWidth={1.5} />
        <ellipse cx={120} cy={47} rx={22} ry={11} fill={C.far} />
        {[0, 1].map((i) => limb([[120 + (i ? -15 : 15), 46], j.elbows[i], j.hands[i]], C.body, 7.5, `la${i}`))}
        <circle cx={120} cy={50} r={9} fill={C.body} />
        {demo.front?.(j)}
      </>
    );
  }
  return (
    <>
      {demo.back?.(j)}
      {[0, 1].map((i) => limb([j.hips[i], j.knees[i], j.ankles[i]], C.body, 8.5, `l${i}`))}
      <path d={`M${j.hips[0][0]},${j.hips[0][1]} L${j.shoulders[0][0]},${j.shoulders[0][1]} L${j.shoulders[1][0]},${j.shoulders[1][1]} L${j.hips[1][0]},${j.hips[1][1]} Z`} fill={C.body} stroke={C.body} strokeWidth={6} strokeLinejoin="round" />
      <circle cx={j.head[0]} cy={j.head[1]} r={9} fill={C.body} />
      {arms}
      {demo.front?.(j)}
    </>
  );
}

export function hasDemo(exerciseId: string) {
  return exerciseId in DEMOS;
}

/** Só aceita links https, para o campo de vídeo do personal. */
export function safeVideoUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Demonstração animada de um exercício da biblioteca (figura ilustrativa, sem mídia de terceiros).
 * `phase` fixa um quadro (0 = início, ~0.43 = fim do movimento), usado nos testes visuais e na impressão.
 */
export function ExerciseDemo({ exerciseId, name, phase, className }: { exerciseId: string; name: string; phase?: number; className?: string }) {
  const demo = DEMOS[exerciseId];
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(phase == null && !reduced);
  const [t, setT] = useState(phase ?? (reduced ? 0.43 : 0));
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !demo) return;
    let raf = 0;
    const offset = t * REP_MS * (demo.view === 'side' && demo.hold ? 2 : 1);
    start.current = null;
    const tick = (now: number) => {
      if (start.current == null) start.current = now - offset;
      const period = REP_MS * (demo.view === 'side' && demo.hold ? 2 : 1);
      setT(((now - start.current) % period) / period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // t entra só como ponto de partida ao retomar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, demo]);

  if (!demo) return null;
  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-xl border border-line bg-[#0B0B10]">
        <svg viewBox="0 0 240 160" role="img" aria-label={`Demonstração animada: ${name}`} className="block h-auto w-full">
          <defs>
            <radialGradient id="demo-glow" cx="50%" cy="100%" r="70%">
              <stop offset="0%" stopColor="#FF2D4F" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#FF2D4F" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="240" height="160" fill="url(#demo-glow)" />
          <line x1={8} y1={GROUND} x2={232} y2={GROUND} stroke="#26262F" strokeWidth={2} />
          <g transform={`translate(0 ${GROUND}) scale(1 -1)`}>
            {demo.view === 'side' ? <SideFigure demo={demo} t={t} /> : <FrontFigure demo={demo} t={t} />}
          </g>
        </svg>
        {phase == null && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pausar demonstração' : 'Reproduzir demonstração'}
            className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-fg hover:bg-black/80"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 text-[11px] text-muted">
        {demo.note ? `${demo.note}. ` : ''}Animação ilustrativa. Siga as orientações do seu personal.
      </figcaption>
    </figure>
  );
}
