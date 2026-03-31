export interface PlanfixTask {
  id: number;
  name: string;
  description?: string;
  status?: { id: number; name: string };
  priority?: { id: number; name: string };
  assignees?: Array<{ id: number; name: string }>;
  project?: { id: number; name: string };
  startDate?: string;
  endDate?: string;
}

export interface PlanfixContact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}
