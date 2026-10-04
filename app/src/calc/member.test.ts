import { describe, expect, it } from 'vitest'
import { stepGoldSeed, stepSkillLevel } from './member'

describe('gold seeds and skill level', () => {
  it('raises the skill level with each gold seed', () => {
    expect(stepGoldSeed({ skillLevel: 2, goldSeeds: 0 }, 1, 7)).toEqual({ skillLevel: 3, goldSeeds: 1 })
    expect(stepGoldSeed({ skillLevel: 3, goldSeeds: 1 }, -1, 7)).toEqual({ skillLevel: 2, goldSeeds: 0 })
  })

  it('stops at the skill max and at zero seeds', () => {
    expect(stepGoldSeed({ skillLevel: 7, goldSeeds: 2 }, 1, 7)).toBeNull()
    expect(stepGoldSeed({ skillLevel: 3, goldSeeds: 0 }, -1, 7)).toBeNull()
  })

  it('drops seeds that no longer fit when the skill level goes down', () => {
    expect(stepSkillLevel({ skillLevel: 4, goldSeeds: 3 }, 3, 7)).toEqual({ skillLevel: 3, goldSeeds: 2 })
    expect(stepSkillLevel({ skillLevel: 4, goldSeeds: 1 }, 3, 7)).toEqual({ skillLevel: 3, goldSeeds: 1 })
    expect(stepSkillLevel({ skillLevel: 4, goldSeeds: 1 }, 99, 7)).toEqual({ skillLevel: 7, goldSeeds: 1 })
    expect(stepSkillLevel({ skillLevel: 2, goldSeeds: 1 }, 0, 7)).toEqual({ skillLevel: 1, goldSeeds: 0 })
  })
})
