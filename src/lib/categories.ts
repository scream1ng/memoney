import {
  BookOpen, Briefcase, Car, Clapperboard, Coffee, Ellipsis, Gift, HeartPulse, House, Laptop, Plane, Receipt,
  ShoppingBag, TrendingUp, Utensils, Zap,
  type LucideIcon,
} from 'lucide-react'
import { useSyncExternalStore } from 'react'
import type { CustomCategory, TxType } from './types.ts'

export interface Category {
  id: string
  label: string
  icon: LucideIcon
  color: string
}

export const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase, coffee: Coffee, laptop: Laptop, house: House, plane: Plane,
  receipt: Receipt, gift: Gift, trend: TrendingUp, car: Car, bag: ShoppingBag,
  food: Utensils, zap: Zap, health: HeartPulse, fun: Clapperboard, book: BookOpen,
}
export const COLORS = ['#248a3d', '#b07000', '#5856d6', '#007aff', '#c93400', '#ff2d55', '#af52de']

export const CATEGORIES: Record<TxType, Category[]> = {
  expense: [
    { id: 'food', label: 'Food', icon: Utensils, color: '#c93400' },
    { id: 'transport', label: 'Transport', icon: Car, color: '#007aff' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#ff2d55' },
    { id: 'bills', label: 'Bills', icon: Zap, color: '#af52de' },
    { id: 'home', label: 'Home', icon: House, color: '#0071a4' },
    { id: 'work-travel', label: 'Work travel', icon: Plane, color: '#248a3d' },
    { id: 'equipment', label: 'Equipment', icon: Laptop, color: '#5856d6' },
    { id: 'software', label: 'Software & subscriptions', icon: Receipt, color: '#007aff' },
    { id: 'home-office', label: 'Home office', icon: House, color: '#b07000' },
    { id: 'health', label: 'Health', icon: HeartPulse, color: '#ff3b30' },
    { id: 'fun', label: 'Fun', icon: Clapperboard, color: '#5856d6' },
    { id: 'other', label: 'Other', icon: Ellipsis, color: '#8e8e93' },
  ],
  income: [
    { id: 'salary', label: 'Salary', icon: Briefcase, color: '#248a3d' },
    { id: 'gift', label: 'Gift', icon: Gift, color: '#ff2d55' },
    { id: 'invest', label: 'Invest', icon: TrendingUp, color: '#007aff' },
    { id: 'other-in', label: 'Other', icon: Ellipsis, color: '#8e8e93' },
  ],
}

// Keep legacy IDs in CATEGORIES so saved entries still render and validate.
export const ACTIVE_CATEGORIES: Record<TxType, Category[]> = {
  expense: ['food', 'shopping', 'bills', 'transport', 'other'].map((id) => CATEGORIES.expense.find((c) => c.id === id)!),
  income: ['salary', 'gift', 'invest'].map((id) => CATEGORIES.income.find((c) => c.id === id)!),
}

const ALL = [...CATEGORIES.expense, ...CATEGORIES.income]

let custom: CustomCategory[] = []
let grouped: Record<TxType, Category[]> = { expense: CATEGORIES.expense, income: CATEGORIES.income }
let loaded = false
let loading: Promise<void> | undefined
let owner: string | undefined
let generation = 0
const listeners = new Set<() => void>()

function setCustom(next: CustomCategory[]) {
  custom = next
  grouped = {
    expense: [...next.filter((c) => c.type === 'expense').map(toCategory), ...CATEGORIES.expense],
    income: [...next.filter((c) => c.type === 'income').map(toCategory), ...CATEGORIES.income],
  }
  listeners.forEach((l) => l())
}

function toCategory(c: CustomCategory): Category {
  return { id: c.id, label: c.label, icon: ICONS[c.icon] ?? Briefcase, color: c.color }
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function useCategories(type: TxType): Category[] {
  return useSyncExternalStore(subscribe, () => grouped[type])
}
export function useCustomCategories(): CustomCategory[] {
  return useSyncExternalStore(subscribe, () => custom)
}
export function categories(type: TxType): Category[] { return grouped[type] }

export const categoryRepo = {
  async load(userId?: string) {
    if (userId && userId !== owner) {
      owner = userId
      generation++
      loaded = false
      loading = undefined
      setCustom([])
    }
    if (loaded) return
    loading ??= (async () => {
      const current = generation
      const r = await fetch('/api/categories', { credentials: 'include' })
      if (!r.ok) throw new Error('Could not load categories')
      const next = await r.json() as CustomCategory[]
      if (current === generation) { setCustom(next); loaded = true }
    })()
    const request = loading
    try { await request }
    finally { if (loading === request) loading = undefined }
  },
  async save(input: Omit<CustomCategory, 'id'>, id?: string) {
    const current = generation
    if (loading) await loading
    if (current !== generation) throw new Error('Session changed. Try again.')
    const r = await fetch(id ? `/api/categories/${id}` : '/api/categories', {
      method: id ? 'PUT' : 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    if (!r.ok) throw new Error((await r.json().catch(() => ({})) as { error?: string }).error ?? 'Could not save category')
    const saved = await r.json() as CustomCategory
    if (current === generation) setCustom(custom.some((c) => c.id === saved.id)
      ? custom.map((c) => c.id === saved.id ? saved : c)
      : [...custom, saved])
    return saved
  },
  async remove(id: string) {
    const current = generation
    if (loading) await loading
    if (current !== generation) throw new Error('Session changed. Try again.')
    const r = await fetch(`/api/categories/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok) throw new Error((await r.json().catch(() => ({})) as { error?: string }).error ?? 'Could not delete category')
    if (current === generation) setCustom(custom.filter((c) => c.id !== id))
  },
}

export function category(id: string): Category {
  const found = custom.find((c) => c.id === id)
  return found ? toCategory(found) : ALL.find((c) => c.id === id) ?? CATEGORIES.expense[CATEGORIES.expense.length - 1]
}
