import {
  Briefcase, Car, Clapperboard, Ellipsis, Gift, HeartPulse, House, ShoppingBag, TrendingUp, Utensils, Zap,
  type LucideIcon,
} from 'lucide-react'
import type { TxType } from './types'

export interface Category {
  id: string
  label: string
  icon: LucideIcon
  color: string
}

export const CATEGORIES: Record<TxType, Category[]> = {
  expense: [
    { id: 'food', label: 'Food', icon: Utensils, color: '#c93400' },
    { id: 'transport', label: 'Transport', icon: Car, color: '#007aff' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#ff2d55' },
    { id: 'bills', label: 'Bills', icon: Zap, color: '#af52de' },
    { id: 'home', label: 'Home', icon: House, color: '#0071a4' },
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

const ALL = [...CATEGORIES.expense, ...CATEGORIES.income]

export function category(id: string): Category {
  return ALL.find((c) => c.id === id) ?? CATEGORIES.expense[CATEGORIES.expense.length - 1]
}
