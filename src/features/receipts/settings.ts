import type { Region } from '../../lib/tax'

export interface BusinessDetails {
  name: string
  taxId: string // ABN or NZ GST number
  contact: string
  region: Region
  markup: string // % added to rebilled expenses
}

export const BUSINESS_DEFAULTS: BusinessDetails = { name: '', taxId: '', contact: '', region: 'AU', markup: '0' }

export const CATEGORIES = [
  'Materials',
  'Equipment',
  'Fuel',
  'Travel',
  'Meals',
  'Software',
  'Subcontractor',
  'Office',
  'Other',
]
