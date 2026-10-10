/** 概率分支保留未暴击时的技能加成；仅暴击清零。 */
export class CookingSkillState {
  private crit = new Map<number, number>([[0, 1]])
  extraPot = 0

  addPot(amount: number) { this.extraPot = Math.min(200, Math.max(0, this.extraPot + amount)) }

  addCrit(choices: { amount: number, probability: number }[]) {
    const total = choices.reduce((sum, choice) => sum + choice.probability, 0)
    if (total > 1 + 1e-8) throw new Error('技能暴击概率分支总和不能超过 1')
    const next = new Map<number, number>()
    const add = (key: number, probability: number) => next.set(key, (next.get(key) ?? 0) + probability)
    for (const [bonus, probability] of this.crit) {
      add(bonus, probability * Math.max(0, 1 - total))
      for (const choice of choices) add(Math.min(70, bonus + Math.round(choice.amount * 100)), probability * choice.probability)
    }
    this.crit = next
  }

  potSize(base: number, sunday: boolean, camp: boolean) {
    return Math.ceil((base * (sunday ? 2 : 1) + this.extraPot) * (camp ? 1.5 : 1))
  }

  cook(sunday: boolean) {
    const base = sunday ? 0.3 : 0.1
    let chance = 0
    const next = new Map<number, number>()
    for (const [bonus, probability] of this.crit) {
      const hit = Math.min(1, base + bonus / 100)
      chance += probability * hit
      next.set(0, (next.get(0) ?? 0) + probability * hit)
      next.set(bonus, (next.get(bonus) ?? 0) + probability * (1 - hit))
    }
    this.crit = next
    this.extraPot = 0
    return { chance, multiplier: 1 + chance * (sunday ? 2 : 1) }
  }
}
