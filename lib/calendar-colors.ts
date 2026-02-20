// Google Calendar event color palette (from Calendar API v3)
// These are fixed and never change.
export const GOOGLE_EVENT_COLORS: Record<string, { background: string; foreground: string }> = {
  '1':  { background: '#7986cb', foreground: '#1d1d1d' }, // Lavanda
  '2':  { background: '#33b679', foreground: '#ffffff' }, // Sage
  '3':  { background: '#8e24aa', foreground: '#ffffff' }, // Uva
  '4':  { background: '#e67c73', foreground: '#ffffff' }, // Flamingo
  '5':  { background: '#f6bf26', foreground: '#1d1d1d' }, // Banana
  '6':  { background: '#f4511e', foreground: '#ffffff' }, // Tangerina
  '7':  { background: '#039be5', foreground: '#ffffff' }, // Mirtilo (default)
  '8':  { background: '#616161', foreground: '#ffffff' }, // Grafite
  '9':  { background: '#3f51b5', foreground: '#ffffff' }, // Arandano
  '10': { background: '#0b8043', foreground: '#ffffff' }, // Basil
  '11': { background: '#d50000', foreground: '#ffffff' }, // Tomate
}

export const DEFAULT_EVENT_COLOR = '#039be5'

export function getEventColor(colorId?: string): string {
  if (colorId && GOOGLE_EVENT_COLORS[colorId]) {
    return GOOGLE_EVENT_COLORS[colorId].background
  }
  return DEFAULT_EVENT_COLOR
}
