import { expect,it } from 'vitest'
import { dailyResearchReward } from '../../../core/src/calc/sleepRewards'
import { createDrawStateKey,simulateEfficiencyState } from '../../../core/src/calc/babyEfficiencyDraw'
const reward={candy:9,shards:200,researchExp:100}
it('reduces the eleventh reward only; special encounter shifts to twelfth',()=>{expect(dailyResearchReward(reward,9)).toBe(reward);expect(dailyResearchReward(reward,10)).toEqual({candy:1,shards:100,researchExp:50});expect(dailyResearchReward(reward,10,11)).toBe(reward);expect(dailyResearchReward(reward,11,11)?.candy).toBe(1)})
it('baby draws preserve catches while reducing candy in order',()=>{const state={buckets:[{count:1,typed:true,special:false,dpr:1,catch:1,candy:9}],power:100,encounters:8,otherSlots:0,typedFallback:{catch:0,candy:0},openFallback:{catch:0,candy:0}};expect(simulateEfficiencyState({...state,researchedBefore:8},100)).toEqual({catch:800,candy:2400});const key=createDrawStateKey();expect(key(state)).toBe(key({...state,buckets:[...state.buckets]}));expect(key({...state,researchedBefore:8})).not.toBe(key(state));expect(key({...state,typedFallback:{catch:1,candy:4}})).not.toBe(key(state))})
