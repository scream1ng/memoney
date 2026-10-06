export type TxType = 'expense' | 'income'

export interface CustomCategory {
  id: string
  type: TxType
  label: string
  icon: string
  color: string
  clues: string
}

/** Fields read from a voice clip or receipt photo. The user confirms every guess. */
export interface Guess {
  type?: TxType
  /** integer minor units (cents/satang) */
  amount?: number
  category?: string
  date?: string
  note?: string
  merchant?: string
  heard?: string
}

export interface Tx {
  id: string
  type: TxType
  /** integer minor units (cents/satang) */
  amount: number
  category: string
  /** local calendar date, YYYY-MM-DD */
  date: string
  note?: string
  merchant?: string
  createdAt: number
  /** set when a receipt photo is stored; also its version for the photo URL */
  photoAt?: number
}

export interface Note {
  id: string
  /** free text; the first line is the title */
  text: string
  createdAt: number
  updatedAt: number
}

export type Page = 'home' | 'stats' | 'notes' | 'settings'

/** A change the assistant suggests. Nothing is saved until the user confirms it in the app. */
export type Proposal =
  | { kind: 'add_tx'; tx: Guess & { type: TxType; amount: number; date: string } }
  | { kind: 'edit_tx'; before: Tx; after: Tx }
  | { kind: 'delete_tx'; tx: Tx }
  | { kind: 'add_note'; text: string }
  | { kind: 'edit_note'; before: Note; text: string }
  | { kind: 'delete_note'; note: Note }
  | { kind: 'navigate'; page: Page; date?: string; period?: 'day' | 'week' | 'month'; now: boolean }

export interface AssistantReply {
  heard?: string
  reply: string
  transactions: Tx[]
  notes: Note[]
  /** a total card: expenses over every match of the search, which may be more than the rows shown */
  summary?: { title: string; expense: number; byCategory: Record<string, number> }
  /** the actions are alternatives: the user picks one */
  choose: boolean
  actions: Proposal[]
}

export interface Turn {
  role: 'user' | 'assistant'
  text: string
}
