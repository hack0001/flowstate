export interface WorkflowType {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
  stage_count?: number
  task_count?: number
}

export interface Stage {
  id: string
  workflow_type_id: string
  name: string
  description: string
  icon: string
  order_index: number
  tasks?: Task[]
}

export interface Task {
  id: string
  stage_id: string
  title: string
  description: string
  instructions: string
  order_index: number
  estimated_minutes: number
  has_prompt: boolean
  prompt_text?: string | null
  resource_url?: string | null
}

export interface WorkflowSession {
  id: string
  workflow_type_id: string
  title: string
  current_stage_id: string | null
  current_task_id: string | null
  is_active: boolean
  is_priority: boolean
  started_at: string
  completed_at: string | null
  workflow_type?: WorkflowType
}

export interface TaskCompletion {
  id: string
  session_id: string
  task_id: string
  completed_at: string
  pomodoros_used: number
}

export interface FocusSession {
  session: WorkflowSession
  currentTask: Task | null
  currentStage: Stage | null
  allStages: Stage[]
  allTasks: Task[]
  completedTaskIds: string[]
  totalTasks: number
  completedTasks: number
  progress: number
}

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak'
