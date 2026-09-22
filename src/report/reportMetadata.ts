import { getTemplateSchemaById, type ReportMetadataField } from '../config/templateSchema'

export interface ReportMetadata {
  preparedBy?: string
  role?: string
  company?: string
  portfolio?: string
  region?: string
  team?: string
  project?: string
  projectManager?: string
  organisation?: string
  reportingPeriod?: string
}

export function getReportMetadataFields(templateId?: string | null): readonly ReportMetadataField[] {
  return getTemplateSchemaById(templateId ?? undefined)?.report?.reportMetadata?.fields ?? []
}

export function getReportMetadataLines(metadata?: ReportMetadata, fields: readonly ReportMetadataField[] = []) {
  if (!metadata) return []

  const lines: string[] = []
  for (const field of fields) {
    const value = metadata[field.id]?.trim()
    if (value) lines.push(`${field.label}: ${value}`)
  }
  return lines
}

export function getReportIdentitySlug(metadata?: ReportMetadata) {
  const preparedBy = metadata?.preparedBy?.trim()
  if (!preparedBy) return 'WeekFlow'
  return preparedBy.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'WeekFlow'
}
