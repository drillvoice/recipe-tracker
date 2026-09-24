// Fired on window whenever local meal data changes outside the UI's own
// mutations (e.g. cloud sync applying remote edits), so UI caches can refresh.
export const MEALS_CHANGED_EVENT = 'dish-diary:meals-changed';

export function notifyMealsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MEALS_CHANGED_EVENT));
  }
}
