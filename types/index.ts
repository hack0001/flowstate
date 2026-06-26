export interface WorkflowType {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
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
  estimated_minutes?: number
  has_prompt: boolean
  prompt_text?: string
  resource_url?: string
}

export interface WorkflowSession {
  id: string
  workflow_type_id: string
  title: string
  is_priority: boolean
  created_at: string
  updated_at: string
  workflow_type?: WorkflowType
}

export interface TaskCompletion {
  id: string
  session_id: string
  task_id: string
  completed_at: string
  pomodoros_used: number
}

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak'
