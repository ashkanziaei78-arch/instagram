/**
 * فهرست درس‌های بخش آموزش. ویدیوها از روی خود اپ ضبط شده‌اند و در
 * public/learn هستند: {id}-{lang}.mp4 و پوستر {id}-{lang}.webp.
 * متن‌ها در dict-app (learn.lessons) است.
 */
export interface Lesson {
  id: string
  kind: 'video' | 'images'
  /** طول ویدیو به ثانیه */
  secs?: number
  /** بخشی از پنل که این درس درباره‌اش است */
  goto: string
}

export const LESSONS: Lesson[] = [
  { id: 'start', kind: 'video', secs: 24, goto: '/dashboard' },
  { id: 'connect', kind: 'images', goto: '/dashboard' },
  { id: 'first-reply', kind: 'video', secs: 22, goto: '/dashboard/automations' },
  { id: 'form', kind: 'video', secs: 19, goto: '/dashboard/automations' },
  { id: 'showcase', kind: 'video', secs: 33, goto: '/dashboard/catalog' },
  { id: 'contacts', kind: 'video', secs: 20, goto: '/dashboard/contacts' },
  { id: 'giveaway', kind: 'video', secs: 16, goto: '/dashboard/tools' },
  { id: 'install', kind: 'images', goto: '/dashboard/settings' }
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
