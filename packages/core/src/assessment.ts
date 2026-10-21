import { circumferenceLabel, skinfoldLabel } from './labels';
import type { Assessment, BodyFatCalculation, CircumferenceKey, Sex, SkinfoldProtocol, SkinfoldSite } from './types';

export const PROTOCOL_SITES: Record<SkinfoldProtocol, SkinfoldSite[]> = {
  jp3_masculino: ['peitoral', 'abdominal', 'coxa'],
  jp3_feminino: ['tricipital', 'suprailiaca', 'coxa'],
};

export const PROTOCOL_LABEL: Record<SkinfoldProtocol, string> = {
  jp3_masculino: 'Jackson & Pollock 3 dobras (masculino)',
  jp3_feminino: 'Jackson & Pollock 3 dobras (feminino)',
};

/**
 * Jackson & Pollock (1978/1980) 3 dobras + equação de Siri (1961).
 * Retorna null se faltar qualquer ponto do protocolo ou se o protocolo não corresponder ao sexo.
 */
export function calculateBodyFat(
  protocol: SkinfoldProtocol,
  sitesMm: Partial<Record<SkinfoldSite, number>>,
  sex: Sex,
  age: number,
  nowIso: string,
): BodyFatCalculation | null {
  if ((protocol === 'jp3_masculino') !== (sex === 'masculino')) return null;
  const sites = PROTOCOL_SITES[protocol];
  const values = sites.map((s) => sitesMm[s]);
  if (values.some((v) => v == null || Number.isNaN(v))) return null;
  const sum = (values as number[]).reduce((a, b) => a + b, 0);
  const density =
    protocol === 'jp3_masculino'
      ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age
      : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
  const pct = 495 / density - 450;
  const inputs: Record<string, number> = { idade: age, somaDobrasMm: sum };
  sites.forEach((s, i) => (inputs[s] = values[i] as number));
  return {
    formula: `${PROTOCOL_LABEL[protocol]} + Siri`,
    formulaVersion: 'jp3-siri@1',
    inputs,
    resultPct: Math.round(pct * 10) / 10,
    limitations:
      'Estimativa populacional com erro típico de ±3 a 5 pontos percentuais. Depende do avaliador, do adipômetro e da padronização dos pontos. Não é diagnóstico.',
    calculatedAt: nowIso,
  };
}

export interface ComparisonRow {
  key: string;
  label: string;
  unit: string;
  previous: number | null;
  current: number | null;
  diff: number | null;
  diffPct: number | null;
}

function row(key: string, label: string, unit: string, prev: number | null | undefined, cur: number | null | undefined): ComparisonRow {
  const previous = prev ?? null;
  const current = cur ?? null;
  // Valores ausentes nunca viram zero: sem os dois valores, não há diferença.
  const diff = previous != null && current != null ? Math.round((current - previous) * 10) / 10 : null;
  const diffPct = diff != null && previous ? Math.round((diff / previous) * 1000) / 10 : null;
  return { key, label, unit, previous, current, diff, diffPct };
}

export interface AssessmentComparison {
  rows: ComparisonRow[];
  alerts: string[];
  daysApart: number;
}

export function compareAssessments(prev: Assessment, cur: Assessment): AssessmentComparison {
  const rows: ComparisonRow[] = [
    row('weightKg', 'Peso', 'kg', prev.weightKg, cur.weightKg),
    row('heightCm', 'Altura', 'cm', prev.heightCm, cur.heightCm),
  ];
  const keys = new Set([...Object.keys(prev.circumferences), ...Object.keys(cur.circumferences)]) as Set<CircumferenceKey>;
  for (const k of keys) rows.push(row(k, circumferenceLabel[k], 'cm', prev.circumferences[k], cur.circumferences[k]));

  const alerts: string[] = [];
  if (prev.skinfolds && cur.skinfolds) {
    if (prev.skinfolds.protocol !== cur.skinfolds.protocol) {
      alerts.push('Protocolos de dobras diferentes entre as avaliações. As dobras não foram comparadas.');
    } else {
      for (const s of PROTOCOL_SITES[cur.skinfolds.protocol]) {
        rows.push(row(`dobra_${s}`, `Dobra ${skinfoldLabel[s].toLowerCase()}`, 'mm', prev.skinfolds.sitesMm[s], cur.skinfolds.sitesMm[s]));
      }
      if (prev.bodyFat && cur.bodyFat && prev.bodyFat.formulaVersion === cur.bodyFat.formulaVersion) {
        rows.push(row('bodyFat', 'Gordura estimada', '%', prev.bodyFat.resultPct, cur.bodyFat.resultPct));
      }
    }
  }

  const height = rows.find((r) => r.key === 'heightCm');
  if (height?.diff != null && Math.abs(height.diff) > 2) {
    alerts.push('Altura variou mais de 2 cm. Confira se houve erro de digitação.');
  }
  const daysApart = Math.round(
    (new Date(`${cur.date}T12:00:00Z`).getTime() - new Date(`${prev.date}T12:00:00Z`).getTime()) / 86_400_000,
  );
  const weight = rows.find((r) => r.key === 'weightKg');
  if (weight?.diffPct != null && Math.abs(weight.diffPct) > 8 && daysApart <= 60) {
    alerts.push(`Peso variou ${Math.abs(weight.diffPct)}% em ${daysApart} dias. Confirme a medida antes de usá-la.`);
  }
  return { rows, alerts, daysApart };
}

export function latestAssessments(all: Assessment[], studentId: string): Assessment[] {
  return all.filter((a) => a.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date));
}
