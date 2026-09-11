import type { WeekFlowTemplate, PlanningCategoryConfiguration } from '../config/templates'
import { FIELD_SALES_TEMPLATE } from '../config/templates'
import { getTemplateSchemaById } from '../config/templateSchema'
import type { DayPlan, PlanCategory, PlanItem } from '../types/weeklyPlan'

export type PlanningCategoryDescriptor = PlanningCategoryConfiguration & { order?: number }

export function getPlanningCategoryDescriptors(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): PlanningCategoryDescriptor[] {
  const categories = getTemplateSchemaById(template.id)?.planning.categories ?? []

  return categories
    .filter((category) => category.enabled)
    .map((category) => ({
      ...category,
      key: category.key as PlanCategory,
      order: 'order' in category ? category.order : undefined,
    }))
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
}

export function getPlanningCategoryItems(day: DayPlan, category: PlanCategory): PlanItem[] {
  return day.categories?.[category] ?? []
}