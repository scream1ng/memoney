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
