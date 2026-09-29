import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('offers a small default set while keeping legacy categories readable', async () => {
  const { ACTIVE_CATEGORIES, category } = await import('./categories.ts')
  expect(ACTIVE_CATEGORIES.expense.map((c) => c.id)).toEqual(['food', 'shopping', 'bills', 'transport', 'other'])
  expect(ACTIVE_CATEGORIES.income.map((c) => c.id)).toEqual(['salary', 'gift', 'invest'])
  expect(category('work-travel').label).toBe('Work travel')
  expect(category('other-in').label).toBe('Other')
})

it('keeps category order after editing an earlier category', async () => {
  const a = { id: 'a', type: 'income' as const, label: 'Salary · A', icon: 'briefcase', color: '#248a3d', clues: 'Acme' }
  const b = { ...a, id: 'b', label: 'Salary · B', clues: 'Beta' }
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([a, b]))
    .mockResolvedValueOnce(Response.json({ ...a, clues: 'Acme payroll' }))
  vi.stubGlobal('fetch', fetchMock)
  const { categoryRepo, categories } = await import('./categories.ts')
  await categoryRepo.load('user')
  await categoryRepo.save({ ...a, clues: 'Acme payroll' }, a.id)
  expect(categories('income').slice(0, 2).map((c) => c.id)).toEqual(['a', 'b'])
})

it('waits for the initial category list before saving', async () => {
  const a = { id: 'a', type: 'income' as const, label: 'Salary · A', icon: 'briefcase', color: '#248a3d', clues: 'Acme' }
  const b = { ...a, id: 'b', label: 'Salary · B', clues: 'Beta' }
  let finishLoad!: (response: Response) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finishLoad = resolve }))
    .mockResolvedValueOnce(Response.json(b))
  vi.stubGlobal('fetch', fetchMock)
  const { categoryRepo, categories } = await import('./categories.ts')
  const loading = categoryRepo.load('user')
  const saving = categoryRepo.save({ type: b.type, label: b.label, icon: b.icon, color: b.color, clues: b.clues })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  finishLoad(Response.json([a]))
  await Promise.all([loading, saving])
  expect(categories('income').slice(0, 2).map((c) => c.id)).toEqual(['a', 'b'])
})

it('does not show a previous user’s save after account change', async () => {
  const a = { id: 'a', type: 'income' as const, label: 'Salary · A', icon: 'briefcase', color: '#248a3d', clues: 'Acme' }
  let finishSave!: (response: Response) => void
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([]))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishSave = resolve }))
    .mockResolvedValueOnce(Response.json([]))
  vi.stubGlobal('fetch', fetchMock)
  const { categoryRepo, categories } = await import('./categories.ts')
  await categoryRepo.load('first-user')
  const saving = categoryRepo.save({ type: a.type, label: a.label, icon: a.icon, color: a.color, clues: a.clues })
  await categoryRepo.load('second-user')
  finishSave(Response.json(a))
  await saving
  expect(categories('income').some((c) => c.id === a.id)).toBe(false)
})
