import type { Notification, PlatformState, TrainingCycle } from './types';
import { nextId } from './util';

export function audit(state: PlatformState, actor: string, action: string, entity: string, detail: string): void {
  state.audit.unshift({ id: nextId(state, 'aud'), at: state.now, actor, action, entity, detail });
}

/** Notificações nunca carregam medidas, fotos ou dados de saúde no texto. */
export function notify(
  state: PlatformState,
  n: Pick<Notification, 'audience' | 'studentId' | 'kind' | 'title' | 'body'>,
): void {
  state.notifications.unshift({ ...n, id: nextId(state, 'ntf'), createdAt: state.now, read: false });
}

export function cycleEvent(state: PlatformState, cycle: TrainingCycle, type: string, message: string): void {
  cycle.events.push({ at: state.now, type, message });
}
