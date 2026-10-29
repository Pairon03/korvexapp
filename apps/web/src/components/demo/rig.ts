// Boneco articulado das demonstrações de exercício.
// Coordenadas do "mundo": chão em y = 0, y cresce para cima, x de 0 a 240. A figura olha para a direita na vista lateral.
// Ângulos em graus, absolutos: 0 = direita, 90 = cima, -90 = baixo, 180 = esquerda.

export type Pt = [number, number];

export const LEN = { torso: 46, upperArm: 26, forearm: 24, thigh: 32, shin: 30, foot: 11, neck: 15, head: 9 } as const;

/** Membro por ângulos (cinemática direta) ou por alvo da mão/tornozelo (cinemática inversa). */
export type Limb =
  | { a: number; b: number }
  | { to: Pt; bend: 1 | -1 }
  /** Alvo no referencial do tronco: x ao longo da "frente" do tronco em pé, y ao longo do tronco. */
  | { rel: Pt; bend: 1 | -1 };

export interface SidePose {
  hip: Pt;
  torso: number;
  arm: Limb;
  leg: Limb;
  farArm?: Limb;
  farLeg?: Limb;
  foot?: number;
  farFoot?: number;
}

export interface FrontPose {
  hip: Pt;
  /** Braço direito (lado +x); o esquerdo é espelhado. */
  arm: { a: number; b: number };
  leg: { a: number; b: number };
  /** Coxa vista de frente encurta quando a pessoa está sentada. */
  thigh?: number;
}

export interface SideJoints {
  hip: Pt; shoulder: Pt; head: Pt;
  elbow: Pt; hand: Pt; knee: Pt; ankle: Pt; toe: Pt;
  farElbow: Pt; farHand: Pt; farKnee: Pt; farAnkle: Pt; farToe: Pt;
  torso: number;
}

export interface FrontJoints {
  hip: Pt; neck: Pt; head: Pt;
  shoulders: [Pt, Pt]; elbows: [Pt, Pt]; hands: [Pt, Pt];
  hips: [Pt, Pt]; knees: [Pt, Pt]; ankles: [Pt, Pt];
}

const rad = (d: number) => (d * Math.PI) / 180;
export const dir = (deg: number, len: number, from: Pt = [0, 0]): Pt => [from[0] + Math.cos(rad(deg)) * len, from[1] + Math.sin(rad(deg)) * len];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function solve(root: Pt, limb: Limb, l1: number, l2: number, torso: number): [Pt, Pt] {
  if ('a' in limb) {
    const mid = dir(limb.a, l1, root);
    return [mid, dir(limb.b, l2, mid)];
  }
  let target: Pt;
  if ('rel' in limb) {
    // Gira o alvo junto com o tronco (definido para o tronco em pé, 90°).
    const r = rad(torso - 90);
    const [x, y] = limb.rel;
    target = [root[0] + x * Math.cos(r) - y * Math.sin(r), root[1] + x * Math.sin(r) + y * Math.cos(r)];
  } else target = limb.to;
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const theta = Math.atan2(dy, dx);
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const mid: Pt = [root[0] + Math.cos(theta + limb.bend * alpha) * l1, root[1] + Math.sin(theta + limb.bend * alpha) * l1];
  const end: Pt = [root[0] + Math.cos(theta) * d, root[1] + Math.sin(theta) * d];
  return [mid, end];
}

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  if ('a' in a && 'a' in b) return { a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t) };
  if ('to' in a && 'to' in b) return { to: lerpPt(a.to, b.to, t), bend: a.bend };
  if ('rel' in a && 'rel' in b) return { rel: lerpPt(a.rel, b.rel, t), bend: a.bend };
  return t < 0.5 ? a : b;
}

export function lerpSide(a: SidePose, b: SidePose, t: number): SidePose {
  return {
    hip: lerpPt(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    arm: lerpLimb(a.arm, b.arm, t),
    leg: lerpLimb(a.leg, b.leg, t),
    farArm: lerpLimb(a.farArm ?? a.arm, b.farArm ?? a.farArm ?? b.arm, t),
    farLeg: lerpLimb(a.farLeg ?? a.leg, b.farLeg ?? a.farLeg ?? b.leg, t),
    foot: lerp(a.foot ?? 0, b.foot ?? a.foot ?? 0, t),
    farFoot: lerp(a.farFoot ?? a.foot ?? 0, b.farFoot ?? a.farFoot ?? b.foot ?? a.foot ?? 0, t),
  };
}

export function lerpFront(a: FrontPose, b: FrontPose, t: number): FrontPose {
  return {
    hip: lerpPt(a.hip, b.hip, t),
    arm: { a: lerp(a.arm.a, b.arm.a, t), b: lerp(a.arm.b, b.arm.b, t) },
    leg: { a: lerp(a.leg.a, b.leg.a, t), b: lerp(a.leg.b, b.leg.b, t) },
    thigh: lerp(a.thigh ?? LEN.thigh, b.thigh ?? a.thigh ?? LEN.thigh, t),
  };
}

export function sideJoints(p: SidePose): SideJoints {
  const shoulder = dir(p.torso, LEN.torso, p.hip);
  const head = dir(p.torso, LEN.neck, shoulder);
  const [elbow, hand] = solve(shoulder, p.arm, LEN.upperArm, LEN.forearm, p.torso);
  const [farElbow, farHand] = solve(shoulder, p.farArm ?? p.arm, LEN.upperArm, LEN.forearm, p.torso);
  const [knee, ankle] = solve(p.hip, p.leg, LEN.thigh, LEN.shin, p.torso);
  const [farKnee, farAnkle] = solve(p.hip, p.farLeg ?? p.leg, LEN.thigh, LEN.shin, p.torso);
  return {
    hip: p.hip, shoulder, head, elbow, hand, knee, ankle,
    toe: dir(p.foot ?? 0, LEN.foot, ankle),
    farElbow, farHand, farKnee, farAnkle,
    farToe: dir(p.farFoot ?? p.foot ?? 0, LEN.foot, farAnkle),
    torso: p.torso,
  };
}

const mirror = (deg: number) => 180 - deg;

export function frontJoints(p: FrontPose): FrontJoints {
  const [hx, hy] = p.hip;
  const neck: Pt = [hx, hy + LEN.torso];
  const shoulders: [Pt, Pt] = [[hx + 15, hy + LEN.torso - 4], [hx - 15, hy + LEN.torso - 4]];
  const hips: [Pt, Pt] = [[hx + 8, hy], [hx - 8, hy]];
  const elbows: [Pt, Pt] = [dir(p.arm.a, LEN.upperArm, shoulders[0]), dir(mirror(p.arm.a), LEN.upperArm, shoulders[1])];
  const hands: [Pt, Pt] = [dir(p.arm.b, LEN.forearm, elbows[0]), dir(mirror(p.arm.b), LEN.forearm, elbows[1])];
  const thigh = p.thigh ?? LEN.thigh;
  const knees: [Pt, Pt] = [dir(p.leg.a, thigh, hips[0]), dir(mirror(p.leg.a), thigh, hips[1])];
  const ankles: [Pt, Pt] = [dir(p.leg.b, LEN.shin, knees[0]), dir(mirror(p.leg.b), LEN.shin, knees[1])];
  return { hip: p.hip, neck, head: [hx, hy + LEN.torso + 13], shoulders, elbows, hands, hips, knees, ankles };
}

/** Curva de uma repetição: sobe, segura no topo, desce mais devagar, pausa curta embaixo. Devolve 0..1. */
export function repCurve(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  if (p < 0.38) return ease(p / 0.38);
  if (p < 0.48) return 1;
  if (p < 0.92) return 1 - ease((p - 0.48) / 0.44);
  return 0;
}
