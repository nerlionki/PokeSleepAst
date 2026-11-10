type CatalogIngredient = { id: number; name: string }
type RecipeReference = { id?: number; name: string; ingredients: { id?: number; name: string; count: number }[] }

export function resolveRecipeReferences<T extends RecipeReference>(recipes: T[], ingredients: CatalogIngredient[], legacyIds: Readonly<Record<string, number>>) {
  const ingredientIds = new Map(ingredients.map(row => [row.id, row]))
  const ingredientNames = new Map(ingredients.map(row => [row.name, row.id]))
  if (ingredientIds.size !== ingredients.length) throw new Error('食材目录 ID 重复')
  const recipeIds = new Set<number>()
  return recipes.map(recipe => {
    const id = recipe.id ?? legacyIds[recipe.name]
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || recipeIds.has(id)) throw new Error(`食谱 ID 无效或重复：${recipe.name}`)
    recipeIds.add(id)
    return {
      ...recipe,
      id,
      ingredients: recipe.ingredients.map(ingredient => {
        const ingredientId = ingredient.id ?? ingredientNames.get(ingredient.name)
        if (ingredientId === undefined || !ingredientIds.has(ingredientId)) throw new Error(`食谱食材引用无效：${recipe.name} / ${ingredient.name}`)
        const canonical = ingredientIds.get(ingredientId)!
        return { ...ingredient, id: ingredientId, name: canonical.name }
      }),
    }
  })
}

export function validateCatalogReferences(data: Record<string, unknown>) {
  const ingredients = data['ingredients.json'] as CatalogIngredient[]
  const recipes = data['recipes.json'] as RecipeReference[]
  const compatibility = data['compatibility-maps.json'] as { modules?: { raeImage?: { MEAL_ID?: Record<string, number> } } }
  resolveRecipeReferences(recipes, ingredients, compatibility?.modules?.raeImage?.MEAL_ID ?? {})
}
