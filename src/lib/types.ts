export type TxType = 'expense' | 'income'

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
}
