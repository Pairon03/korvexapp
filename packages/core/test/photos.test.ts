import { describe, expect, it } from 'vitest';
import { addAssessmentPhoto, createSeedState, photoTargetAssessment, removeAssessmentPhoto, setPhotoConsent } from '../src';

function setup() {
  const s = createSeedState();
  const student = s.students.find((x) => photoTargetAssessment(s, x.id))!;
  const target = photoTargetAssessment(s, student.id)!;
  return { s, student, target };
}

describe('fotos de acompanhamento', () => {
  it('só aceita foto com consentimento do aluno', () => {
    const { s, student, target } = setup();
    setPhotoConsent(s, student.id, false);
    expect(() => addAssessmentPhoto(s, target.id, 'frente', 'k1', student.name)).toThrow(/não autorizou/);
  });

  it('substitui a foto da mesma categoria e devolve a chave antiga', () => {
    const { s, student, target } = setup();
    setPhotoConsent(s, student.id, true);
    expect(addAssessmentPhoto(s, target.id, 'frente', 'k1', student.name)).toBeNull();
    expect(addAssessmentPhoto(s, target.id, 'frente', 'k2', student.name)).toBe('k1');
    addAssessmentPhoto(s, target.id, 'costas', 'k3', student.name);
    expect(target.photos.map((p) => p.storageKey).sort()).toEqual(['k2', 'k3']);
    expect(removeAssessmentPhoto(s, target.id, 'costas', student.name)).toBe('k3');
  });

  it('revogar o consentimento remove todas as fotos e devolve as chaves para apagar', () => {
    const { s, student, target } = setup();
    setPhotoConsent(s, student.id, true);
    addAssessmentPhoto(s, target.id, 'frente', 'k1', student.name);
    addAssessmentPhoto(s, target.id, 'perfil', 'k2', student.name);
    expect(setPhotoConsent(s, student.id, false).sort()).toEqual(['k1', 'k2']);
    expect(target.photos).toEqual([]);
  });
});
