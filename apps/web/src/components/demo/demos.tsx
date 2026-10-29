import type { ReactNode } from 'react';
import { dir, type FrontJoints, type FrontPose, type Pt, type SideJoints, type SidePose } from './rig';

// Uma demonstração por exercício da biblioteca: posição inicial (a), posição final (b) e os equipamentos.
// Os equipamentos recebem as articulações já calculadas, para acompanhar a mão, o pé ou o quadril.

export const C = {
  body: '#ECECF2',
  far: '#6E6E80',
  frame: '#2E2E3B',
  frameLine: '#4A4A5E',
  weight: '#FF2D4F',
  cable: '#E23CCB',
  band: '#9B4DFF',
} as const;

type SideDemo = { view: 'side'; a: SidePose; b: SidePose; back?: (j: SideJoints) => ReactNode; front?: (j: SideJoints) => ReactNode; farPhase?: number; hold?: boolean };
type FrontDemo = { view: 'front'; a: FrontPose; b: FrontPose; lying?: boolean; back?: (j: FrontJoints) => ReactNode; front?: (j: FrontJoints) => ReactNode };
export type Demo = (SideDemo | FrontDemo) & { note?: string };

// ---------- peças de equipamento ----------
const box = (x1: number, y1: number, x2: number, y2: number, k?: string) => (
  <rect key={k} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} rx={2} fill={C.frame} stroke={C.frameLine} strokeWidth={1.5} />
);
const bar = (a: Pt, b: Pt, w = 4, k?: string) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.frameLine} strokeWidth={w} strokeLinecap="round" />;
/** Bancos têm pés: tampo + duas pernas. */
const bench = (x1: number, x2: number, top: number, k = 'bench') => (
  <g key={k}>
    {bar([x1 + 6, 0], [x1 + 6, top], 4)}
    {bar([x2 - 6, 0], [x2 - 6, top], 4)}
    {box(x1, top - 5, x2, top)}
  </g>
);
const plate = (p: Pt, r = 13, k?: string) => (
  <g key={k}>
    <circle cx={p[0]} cy={p[1]} r={r} fill={C.weight} />
    <circle cx={p[0]} cy={p[1]} r={r * 0.28} fill="#07070A" />
  </g>
);
const dumbbell = (p: Pt, k?: string) => (
  <g key={k}>
    <circle cx={p[0]} cy={p[1]} r={6.5} fill={C.weight} />
    <circle cx={p[0]} cy={p[1]} r={2} fill="#07070A" />
  </g>
);
/** Halter visto de frente (barra horizontal com anilhas nas pontas). */
const dumbbellFront = (p: Pt, k?: string) => (
  <g key={k}>
    <line x1={p[0] - 8} y1={p[1]} x2={p[0] + 8} y2={p[1]} stroke={C.frameLine} strokeWidth={3} />
    <rect x={p[0] - 11} y={p[1] - 5} width={5} height={10} rx={1.5} fill={C.weight} />
    <rect x={p[0] + 6} y={p[1] - 5} width={5} height={10} rx={1.5} fill={C.weight} />
  </g>
);
const cable = (a: Pt, b: Pt, color: string = C.cable, k?: string) => (
  <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={1.8} strokeDasharray={color === C.band ? undefined : '0'} strokeLinecap="round" />
);
const pulley = (p: Pt, k?: string) => <circle key={k} cx={p[0]} cy={p[1]} r={5} fill={C.frame} stroke={C.frameLine} strokeWidth={2} />;
const grip = (p: Pt, k?: string) => <circle key={k} cx={p[0]} cy={p[1]} r={4} fill={C.frameLine} />;
const pad = (p: Pt, r = 5, k?: string) => <circle key={k} cx={p[0]} cy={p[1]} r={r} fill={C.frame} stroke={C.frameLine} strokeWidth={1.5} />;

// ---------- poses comuns ----------
const STAND: Pt = [120, 62];
const standLegs = { leg: { to: [122, 0] as Pt, bend: 1 as const } };
const armsDown = { arm: { a: -90, b: -90 } };
const seatedLegs = (hipX: number, footX: number) => ({ leg: { to: [footX, 0] as Pt, bend: 1 as const }, hip: [hipX, 34] as Pt });
/** Banco de encosto reto para exercícios sentados. */
const seat = (x: number, w = 34, back = true) => (
  <g key="seat">
    {bar([x + w / 2, 0], [x + w / 2, 28], 4)}
    {box(x, 24, x + w, 30)}
    {back && box(x - 2, 30, x + 4, 92)}
  </g>
);

export const DEMOS: Record<string, Demo> = {
  // ---------------- peito ----------------
  ex_supino_reto: {
    view: 'side',
    a: { hip: [150, 40], torso: 180, arm: { to: [112, 52], bend: -1 }, leg: { to: [182, 0], bend: 1 } },
    b: { hip: [150, 40], torso: 180, arm: { to: [106, 89], bend: -1 }, leg: { to: [182, 0], bend: 1 } },
    back: () => [bench(78, 162, 35), bar([100, 0], [100, 100], 4, 'r1'), bar([96, 100], [104, 100], 4, 'r2')],
    front: (j) => plate(j.hand, 15),
  },
  ex_supino_halteres: {
    view: 'side',
    a: { hip: [150, 40], torso: 180, arm: { to: [108, 48], bend: -1 }, leg: { to: [182, 0], bend: 1 } },
    b: { hip: [150, 40], torso: 180, arm: { to: [106, 89], bend: -1 }, leg: { to: [182, 0], bend: 1 } },
    back: () => bench(78, 162, 35),
    front: (j) => dumbbell(j.hand),
  },
  ex_supino_maquina: {
    view: 'side',
    a: { ...seatedLegs(100, 142), torso: 96, arm: { to: [104, 78], bend: -1 } },
    b: { ...seatedLegs(100, 142), torso: 96, arm: { to: [146, 80], bend: -1 } },
    back: (j) => [seat(84), bar([176, 0], [176, 132], 5, 'post'), bar([176, 124], j.hand, 4, 'lever'), pulley([176, 124], 'pv')],
    front: (j) => grip(j.hand),
  },
  ex_flexao: {
    view: 'side',
    a: { hip: [106, 28], torso: 26.6, arm: { to: [150, 2], bend: 1 }, leg: { to: [50, 2], bend: 1 }, foot: -70 },
    b: { hip: [111, 10], torso: 8, arm: { to: [150, 2], bend: 1 }, leg: { to: [50, 2], bend: 1 }, foot: -80 },
  },
  ex_crucifixo_polia: {
    view: 'front',
    a: { hip: STAND, arm: { a: 15, b: 5 }, leg: { a: -86, b: -88 } },
    b: { hip: STAND, arm: { a: -70, b: -150 }, leg: { a: -86, b: -88 } },
    back: (j) => [pulley([28, 128], 'p1'), pulley([212, 128], 'p2'), bar([28, 0], [28, 140], 4, 'l'), bar([212, 0], [212, 140], 4, 'r'),
      cable([212, 128], j.hands[0], C.cable, 'c1'), cable([28, 128], j.hands[1], C.cable, 'c2')],
    front: (j) => [grip(j.hands[0], 'g1'), grip(j.hands[1], 'g2')],
  },
  ex_crucifixo_halteres: {
    view: 'front',
    lying: true,
    note: 'Visto da cabeceira do banco',
    a: { hip: [120, 40], arm: { a: 0, b: 25 }, leg: { a: -90, b: -90 } },
    b: { hip: [120, 40], arm: { a: 62, b: 112 }, leg: { a: -90, b: -90 } },
    front: (j) => [dumbbell(j.hands[0], 'd1'), dumbbell(j.hands[1], 'd2')],
  },

  // ---------------- costas ----------------
  ex_puxada_frente: {
    view: 'side',
    a: { ...seatedLegs(104, 140), torso: 100, arm: { to: [112, 128], bend: 1 } },
    b: { ...seatedLegs(104, 140), torso: 100, arm: { to: [110, 92], bend: 1 } },
    back: (j) => [seat(90, 30, false), pad([130, 50], 6, 'kp'), bar([130, 44], [130, 0], 4, 'kb'), pulley([112, 150], 'pl'), cable([112, 150], j.hand, C.cable, 'c')],
    front: (j) => bar([j.hand[0] - 9, j.hand[1] + 2], [j.hand[0] + 9, j.hand[1] - 2], 5, 'bar'),
  },
  ex_barra_fixa_assistida: {
    view: 'side',
    a: { hip: [128, 44], torso: 93, arm: { to: [132, 140], bend: 1 }, leg: { to: [100, 22], bend: -1 }, foot: 190 },
    b: { hip: [128, 78], torso: 96, arm: { to: [132, 140], bend: 1 }, leg: { to: [100, 56], bend: -1 }, foot: 190 },
    back: (j) => [bar([80, 140], [180, 140], 5, 'b'), bar([170, 140], [170, 0], 5, 'post'), box(j.knee[0] - 10, j.knee[1] - 8, j.knee[0] + 14, j.knee[1] - 2, 'assist'), bar([j.knee[0] + 2, j.knee[1] - 8], [170, j.knee[1] - 8], 3, 'arm')],
  },
  ex_puxada_elastico: {
    view: 'side',
    a: { hip: STAND, torso: 92, ...standLegs, arm: { to: [140, 150], bend: 1 } },
    b: { hip: STAND, torso: 92, ...standLegs, arm: { to: [130, 104], bend: 1 } },
    back: (j) => [bar([150, 0], [150, 158], 4, 'post'), cable([150, 156], j.hand, C.band, 'band')],
    front: (j) => grip(j.hand),
  },
  ex_remada_curvada: {
    view: 'side',
    a: { hip: [108, 58], torso: 32, leg: { to: [122, 0], bend: 1 }, arm: { to: [146, 34], bend: -1 } },
    b: { hip: [108, 58], torso: 32, leg: { to: [122, 0], bend: 1 }, arm: { to: [134, 64], bend: -1 } },
    front: (j) => plate(j.hand, 15),
  },
  ex_remada_baixa: {
    view: 'side',
    a: { hip: [78, 32], torso: 94, leg: { to: [140, 18], bend: 1 }, arm: { to: [126, 70], bend: -1 }, foot: 80 },
    b: { hip: [78, 32], torso: 92, leg: { to: [140, 18], bend: 1 }, arm: { to: [100, 62], bend: -1 }, foot: 80 },
    back: (j) => [box(58, 24, 100, 30, 's'), bar([79, 0], [79, 24], 4, 'sl'), box(146, 6, 152, 36, 'fp'), bar([150, 62], [200, 62], 3, 'rail'), pulley([200, 62], 'p'), bar([200, 0], [200, 62], 5, 'post'), cable(j.hand, [200, 62], C.cable, 'c')],
    front: (j) => grip(j.hand),
  },
  ex_remada_unilateral: {
    view: 'side',
    a: { hip: [92, 64], torso: 8, arm: { to: [140, 24], bend: -1 }, farArm: { to: [154, 38], bend: -1 }, leg: { to: [84, 0], bend: 1 }, farLeg: { to: [76, 40], bend: -1 }, farFoot: 180 },
    b: { hip: [92, 64], torso: 10, arm: { to: [116, 60], bend: -1 }, farArm: { to: [154, 38], bend: -1 }, leg: { to: [84, 0], bend: 1 }, farLeg: { to: [76, 40], bend: -1 }, farFoot: 180 },
    back: () => bench(70, 166, 38),
    front: (j) => dumbbell(j.hand),
  },
  ex_remada_elastico: {
    view: 'side',
    a: { hip: STAND, torso: 90, ...standLegs, arm: { to: [166, 98], bend: -1 } },
    b: { hip: STAND, torso: 90, ...standLegs, arm: { to: [128, 82], bend: -1 } },
    back: (j) => [bar([206, 0], [206, 110], 4, 'post'), cable([206, 96], j.hand, C.band, 'band')],
    front: (j) => grip(j.hand),
  },

  // ---------------- ombros ----------------
  ex_desenvolvimento_halteres: {
    view: 'side',
    a: { ...seatedLegs(104, 140), torso: 92, arm: { to: [112, 98], bend: -1 } },
    b: { ...seatedLegs(104, 140), torso: 92, arm: { to: [108, 128], bend: -1 } },
    back: () => seat(88),
    front: (j) => dumbbell(j.hand),
  },
  ex_desenvolvimento_maquina: {
    view: 'side',
    a: { ...seatedLegs(104, 140), torso: 92, arm: { to: [112, 98], bend: -1 } },
    b: { ...seatedLegs(104, 140), torso: 92, arm: { to: [108, 128], bend: -1 } },
    back: (j) => [seat(88), pulley([70, 118], 'pv'), bar([70, 118], j.hand, 4, 'lever'), bar([70, 118], [70, 0], 5, 'post')],
    front: (j) => grip(j.hand),
  },
  ex_elevacao_lateral: {
    view: 'front',
    a: { hip: STAND, arm: { a: -84, b: -84 }, leg: { a: -86, b: -88 } },
    b: { hip: STAND, arm: { a: -2, b: -6 }, leg: { a: -86, b: -88 } },
    front: (j) => [dumbbellFront(j.hands[0], 'd1'), dumbbellFront(j.hands[1], 'd2')],
  },
  ex_face_pull: {
    view: 'side',
    a: { hip: STAND, torso: 92, ...standLegs, arm: { to: [166, 116], bend: 1 } },
    b: { hip: STAND, torso: 94, ...standLegs, arm: { to: [134, 124], bend: 1 } },
    back: (j) => [bar([214, 0], [214, 132], 5, 'post'), pulley([214, 122], 'p'), cable([214, 122], j.hand, C.cable, 'c')],
    front: (j) => grip(j.hand),
  },

  // ---------------- braços ----------------
  ex_rosca_direta: {
    view: 'side',
    a: { hip: STAND, torso: 90, ...standLegs, arm: { a: -90, b: -80 } },
    b: { hip: STAND, torso: 90, ...standLegs, arm: { a: -86, b: 78 } },
    front: (j) => plate(j.hand, 12),
  },
  ex_rosca_martelo: {
    view: 'side',
    farPhase: 0.5,
    a: { hip: STAND, torso: 90, ...standLegs, arm: { a: -90, b: -82 } },
    b: { hip: STAND, torso: 90, ...standLegs, arm: { a: -86, b: 80 } },
    front: (j) => [dumbbell(j.farHand, 'df'), dumbbell(j.hand, 'dn')],
  },
  ex_rosca_polia: {
    view: 'side',
    a: { hip: STAND, torso: 90, ...standLegs, arm: { a: -90, b: -80 } },
    b: { hip: STAND, torso: 90, ...standLegs, arm: { a: -86, b: 78 } },
    back: (j) => [bar([168, 0], [168, 20], 6, 'post'), pulley([168, 8], 'p'), cable([168, 8], j.hand, C.cable, 'c')],
    front: (j) => grip(j.hand),
  },
  ex_triceps_polia: {
    view: 'side',
    a: { hip: STAND, torso: 94, ...standLegs, arm: { a: -84, b: 40 } },
    b: { hip: STAND, torso: 94, ...standLegs, arm: { a: -86, b: -86 } },
    back: (j) => [bar([156, 0], [156, 158], 5, 'post'), pulley([156, 150], 'p'), cable([156, 150], j.hand, C.cable, 'c')],
    front: (j) => grip(j.hand),
  },
  ex_triceps_frances: {
    view: 'side',
    a: { ...seatedLegs(104, 140), torso: 92, arm: { a: 96, b: -110 } },
    b: { ...seatedLegs(104, 140), torso: 92, arm: { a: 96, b: 92 } },
    back: () => seat(88),
    front: (j) => dumbbell(j.hand),
  },
  ex_mergulho_banco: {
    view: 'side',
    a: { hip: [92, 42], torso: 90, arm: { to: [80, 36], bend: 1 }, leg: { to: [170, 2], bend: 1 }, foot: 80 },
    b: { hip: [94, 14], torso: 86, arm: { to: [80, 36], bend: 1 }, leg: { to: [170, 2], bend: 1 }, foot: 80 },
    back: () => bench(36, 86, 38),
  },

  // ---------------- pernas ----------------
  ex_agachamento_livre: {
    view: 'side',
    a: { hip: [118, 62], torso: 88, leg: { to: [124, 0], bend: 1 }, arm: { rel: [-4, 4], bend: 1 } },
    b: { hip: [94, 32], torso: 52, leg: { to: [124, 0], bend: 1 }, arm: { rel: [-4, 4], bend: 1 } },
    front: (j) => plate(dir(j.torso + 180, 3, j.shoulder), 16),
  },
  ex_agachamento_goblet: {
    view: 'side',
    a: { hip: [118, 62], torso: 90, leg: { to: [124, 0], bend: 1 }, arm: { rel: [14, -10], bend: -1 } },
    b: { hip: [96, 30], torso: 66, leg: { to: [124, 0], bend: 1 }, arm: { rel: [14, -10], bend: -1 } },
    front: (j) => dumbbell(j.hand),
  },
  ex_leg_press: {
    view: 'side',
    a: { hip: [76, 30], torso: 140, leg: { to: [124, 74], bend: 1 }, arm: { to: [86, 26], bend: -1 }, foot: 135 },
    b: { hip: [76, 30], torso: 140, leg: { to: [100, 50], bend: 1 }, arm: { to: [86, 26], bend: -1 }, foot: 135 },
    back: (j) => {
      const sled = dir(-45, 1, j.ankle);
      return [bar([92, 30], [196, 134], 5, 'rail'), box(50, 20, 96, 26, 'seat'), bar([72, 0], [72, 20], 4, 'sl'),
        <line key="back" x1={52} y1={26} x2={30} y2={62} stroke={C.frameLine} strokeWidth={6} strokeLinecap="round" />,
        <line key="sled" x1={sled[0] - 14} y1={sled[1] + 14} x2={sled[0] + 14} y2={sled[1] - 14} stroke={C.weight} strokeWidth={6} strokeLinecap="round" />];
    },
  },
  ex_cadeira_extensora: {
    view: 'side',
    a: { hip: [100, 40], torso: 96, leg: { a: 0, b: -84 }, arm: { to: [110, 38], bend: -1 } },
    b: { hip: [100, 40], torso: 96, leg: { a: 2, b: -6 }, arm: { to: [110, 38], bend: -1 } },
    back: (j) => [box(88, 30, 134, 36, 's'), box(86, 36, 92, 96, 'bk'), bar([110, 0], [110, 30], 5, 'sl'), bar([132, 34], dir(-90, 4, j.ankle), 3, 'arm')],
    front: (j) => pad(dir(-90, 4, j.ankle), 5),
  },
  ex_afundo: {
    view: 'side',
    a: { hip: [116, 58], torso: 90, leg: { to: [146, 0], bend: 1 }, farLeg: { to: [82, 2], bend: 1 }, farFoot: -40, ...armsDown },
    b: { hip: [114, 32], torso: 88, leg: { to: [146, 0], bend: 1 }, farLeg: { to: [82, 2], bend: 1 }, farFoot: -40, ...armsDown },
    front: (j) => [dumbbell(j.farHand, 'df'), dumbbell(j.hand, 'dn')],
  },
  ex_terra_romeno: {
    view: 'side',
    a: { hip: [120, 61], torso: 88, leg: { to: [124, 0], bend: 1 }, ...armsDown },
    b: { hip: [104, 58], torso: 18, leg: { to: [124, 0], bend: 1 }, ...armsDown },
    front: (j) => plate(j.hand, 15),
  },
  ex_mesa_flexora: {
    view: 'side',
    a: { hip: [92, 42], torso: -2, leg: { a: 180, b: 180 }, arm: { to: [152, 32], bend: 1 }, foot: -90 },
    b: { hip: [92, 42], torso: -2, leg: { a: 178, b: 92 }, arm: { to: [152, 32], bend: 1 }, foot: 0 },
    back: (j) => [box(40, 32, 168, 37, 't'), bar([60, 0], [60, 32], 4, 'l1'), bar([150, 0], [150, 32], 4, 'l2'), bar([60, 36], dir(0, 5, j.ankle), 3, 'arm')],
    front: (j) => pad(dir(0, 5, j.ankle), 5),
  },
  ex_flexora_elastico: {
    view: 'side',
    a: { hip: STAND, torso: 92, leg: { a: -90, b: -90 }, farLeg: { to: [122, 0], bend: 1 }, arm: { to: [158, 92], bend: -1 } },
    b: { hip: STAND, torso: 94, leg: { a: -96, b: -176 }, farLeg: { to: [122, 0], bend: 1 }, arm: { to: [158, 92], bend: -1 } },
    back: (j) => [bar([166, 0], [166, 96], 5, 'post'), cable([166, 6], j.ankle, C.band, 'band')],
  },
  ex_ponte_gluteo: {
    view: 'side',
    a: { hip: [106, 12], torso: 148, leg: { to: [150, 0], bend: 1 }, arm: { to: [116, 20], bend: -1 } },
    b: { hip: [110, 40], torso: 188, leg: { to: [150, 0], bend: 1 }, arm: { to: [114, 46], bend: -1 } },
    back: () => bench(26, 74, 34),
    front: (j) => plate(j.hip, 13),
  },
  ex_abducao: {
    view: 'front',
    a: { hip: [120, 46], thigh: 18, arm: { a: -100, b: -80 }, leg: { a: -92, b: -90 } },
    b: { hip: [120, 46], thigh: 18, arm: { a: -100, b: -80 }, leg: { a: -12, b: -90 } },
    back: () => [box(90, 30, 150, 38, 's'), box(88, 38, 152, 100, 'bk'), bar([120, 0], [120, 30], 5, 'sl')],
    front: (j) => [pad([j.knees[0][0] + 6, j.knees[0][1]], 5, 'p1'), pad([j.knees[1][0] - 6, j.knees[1][1]], 5, 'p2')],
  },
  ex_panturrilha_pe: {
    view: 'side',
    a: { hip: [116, 66], torso: 90, leg: { to: [118, 5], bend: 1 }, foot: 12, arm: { to: [150, 92], bend: -1 } },
    b: { hip: [116, 77], torso: 90, leg: { to: [118, 16], bend: 1 }, foot: -38, arm: { to: [150, 100], bend: -1 } },
    back: () => [box(124, 0, 168, 8, 'step'), bar([160, 0], [160, 104], 4, 'rail'), bar([146, 100], [164, 100], 4, 'h')],
  },
  ex_panturrilha_sentado: {
    view: 'side',
    a: { hip: [90, 42], torso: 94, leg: { to: [124, 5], bend: 1 }, foot: 12, arm: { to: [118, 52], bend: -1 } },
    b: { hip: [90, 42], torso: 94, leg: { to: [124, 15], bend: 1 }, foot: -36, arm: { to: [118, 58], bend: -1 } },
    back: () => [box(70, 32, 106, 38, 's'), bar([88, 0], [88, 32], 4, 'sl'), box(128, 0, 160, 8, 'step')],
    front: (j) => box(j.knee[0] - 12, j.knee[1] + 3, j.knee[0] + 10, j.knee[1] + 9, 'pad'),
  },

  // ---------------- abdômen ----------------
  ex_prancha: {
    view: 'side',
    hold: true,
    note: 'Isometria: segure a posição',
    a: { hip: [96, 19], torso: 15, arm: { a: -90, b: 0 }, leg: { to: [36, 3], bend: 1 }, foot: -70 },
    b: { hip: [96, 20.5], torso: 14.5, arm: { a: -90, b: 0 }, leg: { to: [36, 3], bend: 1 }, foot: -70 },
  },
  ex_dead_bug: {
    view: 'side',
    a: { hip: [134, 12], torso: 180, arm: { a: 90, b: 90 }, farArm: { a: 90, b: 90 }, leg: { a: 90, b: 0 }, farLeg: { a: 90, b: 0 }, foot: 90, farFoot: 90 },
    b: { hip: [134, 12], torso: 180, arm: { a: 168, b: 172 }, farArm: { a: 90, b: 90 }, leg: { a: 90, b: 0 }, farLeg: { a: 8, b: 4 }, foot: 90, farFoot: 70 },
  },
  ex_abdominal_polia: {
    view: 'side',
    a: { hip: [112, 36], torso: 86, leg: { a: -90, b: 180 }, arm: { rel: [8, 14], bend: -1 }, foot: 180 },
    b: { hip: [108, 35], torso: 38, leg: { a: -84, b: 180 }, arm: { rel: [8, 14], bend: -1 }, foot: 180 },
    back: (j) => [bar([150, 0], [150, 158], 5, 'post'), pulley([150, 150], 'p'), cable([150, 150], j.hand, C.cable, 'c')],
    front: (j) => grip(j.hand),
  },
};
