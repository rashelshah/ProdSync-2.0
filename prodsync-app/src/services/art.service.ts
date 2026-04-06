import { apiFetch, readApiJson } from '@/lib/api'
import type {
  ArtAlert,
  ArtBudget,
  ArtExpense,
  ArtProp,
  ArtSet,
  CreateArtExpenseInput,
  CreateArtExpenseResult,
  CreateArtPropInput,
  CreateArtSetInput,
  UpdateArtPropInput,
  UpdateArtSetInput,
} from '@/modules/expenses/types'

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

export const artService = {
  async getExpenses(projectId: string): Promise<ArtExpense[]> {
    const response = await apiFetch(`/art/expenses?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ expenses: ArtExpense[] }>(response)
    return payload.expenses ?? []
  },

  async getExpense(projectId: string, id: string): Promise<ArtExpense> {
    const response = await apiFetch(`/art/expenses/${encodeURIComponent(id)}?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ expense: ArtExpense }>(response)
    return payload.expense
  },

  async createExpense(input: CreateArtExpenseInput): Promise<CreateArtExpenseResult> {
    const formData = new FormData()
    formData.append('projectId', input.projectId)
    formData.append('description', input.description)
    formData.append('category', input.category)
    formData.append('quantity', String(input.quantity))
    formData.append('manualAmount', String(input.manualAmount))
    if (input.receipt) {
      formData.append('receipt', input.receipt)
    }

    const response = await apiFetch('/art/expenses', {
      method: 'POST',
      body: formData,
    })
    return readApiJson<CreateArtExpenseResult>(response)
  },

  async deleteExpense(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/art/expenses/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getProps(projectId: string): Promise<ArtProp[]> {
    const response = await apiFetch(`/art/props?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ props: ArtProp[] }>(response)
    return payload.props ?? []
  },

  async createProp(input: CreateArtPropInput): Promise<ArtProp> {
    const response = await apiFetch('/art/props', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ prop: ArtProp }>(response)
    return payload.prop
  },

  async updateProp(id: string, input: UpdateArtPropInput): Promise<ArtProp> {
    const response = await apiFetch(`/art/props/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ prop: ArtProp }>(response)
    return payload.prop
  },

  async deleteProp(projectId: string, id: string): Promise<void> {
    const response = await apiFetch(`/art/props/${encodeURIComponent(id)}?${withProjectId(projectId)}`, {
      method: 'DELETE',
    })
    await readApiJson<{ ok: boolean }>(response)
  },

  async getSets(projectId: string): Promise<ArtSet[]> {
    const response = await apiFetch(`/art/set?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ sets: ArtSet[] }>(response)
    return payload.sets ?? []
  },

  async createSet(input: CreateArtSetInput): Promise<ArtSet> {
    const response = await apiFetch('/art/set', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ set: ArtSet }>(response)
    return payload.set
  },

  async updateSet(id: string, input: UpdateArtSetInput): Promise<ArtSet> {
    const response = await apiFetch(`/art/set/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ set: ArtSet }>(response)
    return payload.set
  },

  async getBudget(projectId: string): Promise<ArtBudget> {
    const response = await apiFetch(`/art/budget?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ budget: ArtBudget }>(response)
    return payload.budget
  },

  async getAlerts(projectId: string): Promise<ArtAlert[]> {
    const response = await apiFetch(`/art/alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ alerts: ArtAlert[] }>(response)
    return payload.alerts ?? []
  },
}
