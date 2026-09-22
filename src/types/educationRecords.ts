export const EDUCATION_TASK_TYPES = ['Assignment', 'Exercise', 'Quiz', 'Practical Task', 'Reflection', 'Project', 'Other'] as const
export type EducationTaskType = typeof EDUCATION_TASK_TYPES[number]

export const EDUCATION_TASK_STATUSES = ['Planned', 'In Progress', 'Completed', 'Overdue'] as const
export type EducationTaskStatus = typeof EDUCATION_TASK_STATUSES[number]

export const EDUCATION_ASSESSMENT_TYPES = ['Formative', 'Summative', 'Diagnostic', 'Practical', 'Quiz', 'Test', 'Other'] as const
export type EducationAssessmentType = typeof EDUCATION_ASSESSMENT_TYPES[number]

export const EDUCATION_ASSESSMENT_STATUSES = ['Planned', 'In Progress', 'Completed'] as const
export type EducationAssessmentStatus = typeof EDUCATION_ASSESSMENT_STATUSES[number]

export interface EducationAttendance {
  id: string
  kind: 'attendance'
  date: string
  classGroup: string
  courseProgramme: string
  registeredLearners: number
  present: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface EducationAcademicTask {
  id: string
  kind: 'academic-task'
  task: string
  type: EducationTaskType
  classGroup: string
  courseProgramme: string
  assignedDate: string
  dueDate: string
  expectedSubmissions: number
  submissions: number
  status: EducationTaskStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface EducationAssessment {
  id: string
  kind: 'assessment'
  assessment: string
  type: EducationAssessmentType
  classGroup: string
  courseProgramme: string
  date: string
  learners: number
  averageScore: number
  status: EducationAssessmentStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export type EducationRecord = EducationAttendance | EducationAcademicTask | EducationAssessment

export function calculateAttendancePercentage(record: Pick<EducationAttendance, 'registeredLearners' | 'present'>) {
  return record.registeredLearners > 0 ? (record.present / record.registeredLearners) * 100 : null
}

export function calculateSubmissionRate(record: Pick<EducationAcademicTask, 'expectedSubmissions' | 'submissions'>) {
  return record.expectedSubmissions > 0 ? (record.submissions / record.expectedSubmissions) * 100 : null
}
