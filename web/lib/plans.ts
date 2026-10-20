export interface Plan {
  id: 'm1' | 'm3' | 'm6'
  title: string
  days: number
  /** تومان */
  price: number | null
  enabled: boolean
  note?: string
}

export const PLANS: Plan[] = [
  { id: 'm1', title: 'یک‌ماهه', days: 30, price: 400_000, enabled: true },
  { id: 'm3', title: 'سه‌ماهه', days: 90, price: 1_000_000, enabled: true, note: 'ماهی حدود ۳۳۳ هزار تومان' },
  { id: 'm6', title: 'شش‌ماهه', days: 180, price: null, enabled: false, note: 'به‌زودی' }
]

export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id)

export const toman = (n: number): string => n.toLocaleString('fa-IR') + ' تومان'
export const faNum = (n: number): string => n.toLocaleString('fa-IR')
