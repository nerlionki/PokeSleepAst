import { useActivities } from './useActivities';
import { storeToRefs } from 'pinia';
import { POT_TIERS } from '../calc/data';
import { useSettingsStore } from '../stores/settings';

export function useSettingsPanel() {
  const store = useSettingsStore();
  const { settings, summary } = storeToRefs(store);
  const activity = useActivities(settings, () => settings.value.island);
  const eventMult = activity.field(
    'drowsyPowerMultiplier',
    () => settings.value.eventMult
  );
  const shinyUp = activity.field('shinyUp', () => settings.value.shinyUp);
  const mixMode = activity.field(
    'eventMix',
    () => settings.value.sleepEventMix
  );
  const maxPotSize = Math.max(...POT_TIERS.map(tier => tier.pot));
  const minPotSize = Math.min(...POT_TIERS.map(tier => tier.pot));

  return {
    summary,
    store,
    settings,
    shinyUp,
    minPotSize,
    maxPotSize,
    eventMult,
    mixMode,
  }
}
