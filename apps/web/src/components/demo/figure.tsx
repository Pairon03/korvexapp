import type { FrontJoints, Pt, SideJoints } from './rig';

// Desenho da pessoa nas demonstrações: corpo com volume, roupa de treino, cabelo e tênis.
// Tudo no referencial do mundo (y para cima). As articulações vêm do rig.

export const SKIN = { near: '#D8A07A', far: '#9A6E52', shade: '#B9805D' };
export const OUTFIT = {
  shirt: '#FF2D4F', shirtFar: '#A81E37', shirtShade: '#D92443',
  shorts: '#3A3A4E', shortsFar: '#26263A',
  shoe: '#F1F1F5', shoeFar: '#8C8C99', sole: '#9B4DFF',
  hair: '#2B1D16',
};

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const norm = (a: Pt): Pt => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const f = (n: number) => n.toFixed(2);

/** Caminho fechado e suave (Catmull-Rom) passando pelos pontos. */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Segmento afunilado (cápsula de raios diferentes nas pontas). */
function capsule(a: Pt, b: Pt, ra: number, rb: number, fill: string, key?: string) {
  const dirv = norm(sub(b, a));
  const nrm: Pt = [-dirv[1], dirv[0]];
  const pts = [add(a, mul(nrm, ra)), add(b, mul(nrm, rb)), sub(b, mul(nrm, rb)), sub(a, mul(nrm, ra))];
  return (
    <g key={key} fill={fill}>
      <path d={`M${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' L')}Z`} />
      <circle cx={a[0]} cy={a[1]} r={ra} />
      <circle cx={b[0]} cy={b[1]} r={rb} />
    </g>
  );
}

/** Coxa ou braço com uma "manga" (bermuda ou camiseta) cobrindo o começo. */
function segment(a: Pt, b: Pt, ra: number, rb: number, skin: string, cloth: string, cover: number, key: string) {
  const mid = lerp(a, b, cover);
  const rmid = ra + (rb - ra) * cover;
  return (
    <g key={key}>
      {capsule(a, b, ra, rb, skin)}
      {cover > 0 && capsule(a, mid, ra + 1.2, rmid + 1.2, cloth)}
    </g>
  );
}

function shoe(ankle: Pt, toe: Pt, color: string, key: string) {
  const d = norm(sub(toe, ankle));
  const up: Pt = [-d[1], d[0]];
  // A sola fica do lado oposto à canela; escolhemos a normal que aponta "para baixo" do pé.
  const down: Pt = up[1] > 0 ? mul(up, -1) : up;
  const heel = sub(ankle, mul(d, 3));
  const tip = add(toe, mul(d, 2));
  const pts: Pt[] = [add(heel, mul(down, 3)), add(tip, mul(down, 2.5)), add(tip, mul(down, -1.5)), add(lerp(ankle, toe, 0.4), mul(down, -4.5)), add(heel, mul(down, -3.5))];
  return (
    <g key={key}>
      <path d={smooth(pts)} fill={color} />
      <path d={`M${f(add(heel, mul(down, 3))[0])},${f(add(heel, mul(down, 3))[1])} L${f(add(tip, mul(down, 2.5))[0])},${f(add(tip, mul(down, 2.5))[1])}`} stroke={OUTFIT.sole} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

function leg(hip: Pt, knee: Pt, ankle: Pt, toe: Pt, far: boolean, key: string) {
  const skin = far ? SKIN.far : SKIN.near;
  return (
    <g key={key}>
      {capsule(knee, ankle, 5.2, 3.6, skin)}
      {segment(hip, knee, 7.6, 5.4, skin, far ? OUTFIT.shortsFar : OUTFIT.shorts, 0.62, 'th')}
      {shoe(ankle, toe, far ? OUTFIT.shoeFar : OUTFIT.shoe, 'sh')}
    </g>
  );
}

function arm(shoulder: Pt, elbow: Pt, hand: Pt, far: boolean, key: string) {
  const skin = far ? SKIN.far : SKIN.near;
  return (
    <g key={key}>
      {capsule(elbow, hand, 3.9, 2.9, skin)}
      {segment(shoulder, elbow, 5.4, 4.0, skin, far ? OUTFIT.shirtFar : OUTFIT.shirt, 0.42, 'ua')}
      <circle cx={hand[0]} cy={hand[1]} r={3.6} fill={skin} />
    </g>
  );
}

/** Tronco de perfil: costas, glúteos, abdômen e peito, com camiseta e bermuda. */
function torso(j: SideJoints) {
  const u = norm(sub(j.shoulder, j.hip));
  const v: Pt = [u[1], -u[0]]; // frente do corpo
  const at = (along: number, front: number): Pt => add(add(j.hip, mul(u, along)), mul(v, front));
  // Perfil (posição ao longo do tronco, frente, costas).
  const profile: [number, number, number][] = [
    [-3, 6, -8.5], [6, 6.8, -9.6], [14, 6.6, -7], [24, 6.9, -6.4], [33, 8.6, -7.6], [41, 7.6, -8], [47, 4.5, -5.5],
  ];
  const outline = (from: number, to: number) => {
    const rows = profile.filter(([s]) => s >= from && s <= to);
    return smooth([...rows.map(([s, fr]) => at(s, fr)), ...rows.reverse().map(([s, , bk]) => at(s, bk))]);
  };
  const neckA = at(44, 0.5), neckB = at(LEN_NECK, 1);
  return (
    <g>
      {capsule(neckA, neckB, 3.6, 3.4, SKIN.near)}
      <path d={outline(-3, 47)} fill={OUTFIT.shirt} />
      {/* sombra lateral da camiseta, dá volume */}
      <path d={smooth([at(10, -1), at(24, -2.5), at(40, -3), at(40, -7), at(24, -6), at(10, -8)])} fill={OUTFIT.shirtShade} opacity={0.7} />
      <path d={outline(-3, 14)} fill={OUTFIT.shorts} />
    </g>
  );
}
const LEN_NECK = 52;

function head(j: SideJoints) {
  const u = norm(sub(j.shoulder, j.hip));
  const v: Pt = [u[1], -u[0]];
  const c = add(j.head, mul(u, 2));
  const at = (along: number, front: number): Pt => add(add(c, mul(u, along)), mul(v, front));
  const angle = (Math.atan2(u[1], u[0]) * 180) / Math.PI - 90;
  const hair = smooth([at(9.5, 1), at(8, 6), at(3.5, 7.6), at(4, 3), at(2, -2), at(-4, -7.5), at(3, -8.6), at(8.5, -5)]);
  return (
    <g>
      <ellipse cx={c[0]} cy={c[1]} rx={7.6} ry={9} transform={`rotate(${f(angle)} ${f(c[0])} ${f(c[1])})`} fill={SKIN.near} />
      {/* nariz e queixo */}
      <path d={smooth([at(1.5, 7), at(-0.5, 9.2), at(-2, 7.2)])} fill={SKIN.near} />
      <path d={hair} fill={OUTFIT.hair} />
      <circle cx={at(2.2, 4.6)[0]} cy={at(2.2, 4.6)[1]} r={1} fill="#2B1D16" />
      <circle cx={at(0.5, -1.5)[0]} cy={at(0.5, -1.5)[1]} r={1.8} fill={SKIN.shade} />
    </g>
  );
}

export function SidePerson({ j }: { j: SideJoints }) {
  return (
    <>
      {arm(j.shoulder, j.farElbow, j.farHand, true, 'fa')}
      {leg(j.hip, j.farKnee, j.farAnkle, j.farToe, true, 'fl')}
      {torso(j)}
      {head(j)}
      {leg(j.hip, j.knee, j.ankle, j.toe, false, 'nl')}
      {arm(j.shoulder, j.elbow, j.hand, false, 'na')}
    </>
  );
}

// ---------------- vista de frente ----------------

export function FrontPerson({ j }: { j: FrontJoints }) {
  const [hx, hy] = j.hip;
  const top = j.neck[1];
  const torsoPath = smooth([
    [hx + 11, hy - 1], [hx + 10, hy + 14], [hx + 12.5, top - 14], [hx + 17, top - 3], [hx + 6, top + 1],
    [hx - 6, top + 1], [hx - 17, top - 3], [hx - 12.5, top - 14], [hx - 10, hy + 14], [hx - 11, hy - 1],
  ]);
  const shorts = smooth([[hx + 11.5, hy - 4], [hx + 10.5, hy + 9], [hx - 10.5, hy + 9], [hx - 11.5, hy - 4]]);
  const hc: Pt = [hx, top + 13];
  return (
    <>
      {[0, 1].map((i) => {
        const toe: Pt = [j.ankles[i][0] + (i ? -3 : 3), j.ankles[i][1] - 3];
        return (
          <g key={`l${i}`}>
            {capsule(j.knees[i], j.ankles[i], 5, 3.6, SKIN.near)}
            {segment(j.hips[i], j.knees[i], 7.4, 5.4, SKIN.near, OUTFIT.shorts, 0.6, 'th')}
            <ellipse cx={toe[0]} cy={toe[1] + 1} rx={5.5} ry={3.6} fill={OUTFIT.shoe} />
          </g>
        );
      })}
      <path d={shorts} fill={OUTFIT.shorts} />
      {capsule([hx, top - 2], [hx, top + 5], 4, 3.8, SKIN.near)}
      <path d={torsoPath} fill={OUTFIT.shirt} />
      <path d={smooth([[hx + 1, top - 4], [hx + 9, top - 12], [hx + 8, hy + 12], [hx + 2, hy + 10]])} fill={OUTFIT.shirtShade} opacity={0.55} />
      <ellipse cx={hc[0]} cy={hc[1]} rx={7.6} ry={9} fill={SKIN.near} />
      <path d={smooth([[hx - 8.2, hc[1] + 1], [hx - 7, hc[1] + 7.5], [hx, hc[1] + 10], [hx + 7, hc[1] + 7.5], [hx + 8.2, hc[1] + 1], [hx + 5, hc[1] + 4.5], [hx - 5, hc[1] + 4.5]])} fill={OUTFIT.hair} />
      <circle cx={hx - 2.8} cy={hc[1] - 0.5} r={0.95} fill="#2B1D16" />
      <circle cx={hx + 2.8} cy={hc[1] - 0.5} r={0.95} fill="#2B1D16" />
      {[0, 1].map((i) => arm(j.shoulders[i], j.elbows[i], j.hands[i], false, `a${i}`))}
    </>
  );
}

/** Pessoa deitada no banco vista da cabeceira (crucifixo com halteres). */
export function LyingHeadEnd({ j }: { j: FrontJoints }) {
  return (
    <>
      <ellipse cx={120} cy={44} rx={21} ry={10} fill={OUTFIT.shirt} />
      <ellipse cx={120} cy={47} rx={14} ry={5} fill={OUTFIT.shirtShade} opacity={0.6} />
      {[0, 1].map((i) => arm([120 + (i ? -14 : 14), 46], j.elbows[i], j.hands[i], false, `la${i}`))}
      <ellipse cx={120} cy={49} rx={8.5} ry={8} fill={OUTFIT.hair} />
      <ellipse cx={120} cy={53} rx={6} ry={4} fill={SKIN.near} />
    </>
  );
}
