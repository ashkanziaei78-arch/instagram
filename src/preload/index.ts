import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, PUSH_EVENTS, type IpcApi } from '../shared/ipc'

/**
 * پل امن بین renderer و main.
 *
 * چرا contextBridge و نه nodeIntegration؟ اگر به صفحه‌ی renderer دسترسی مستقیم
 * Node بدهیم، هر اسکریپتی که آنجا اجرا شود (مثلا از یک آدرس تصویر آلوده) به
 * فایل‌سیستم و توکن‌های شما دسترسی دارد. با contextBridge فقط همین لیست
 * مشخص از توابع در دسترس است و نه چیز دیگری.
 */

const api = {} as IpcApi

for (const channel of IPC_CHANNELS) {
  // هر کانال به یک invoke ساده تبدیل می‌شود؛ امضاها از IpcApi می‌آیند
  ;(api as unknown as Record<string, (arg?: unknown) => Promise<unknown>>)[channel] = (arg?: unknown) =>
    ipcRenderer.invoke(channel, arg)
}

const events = {
  /** برگشتی برای لغو اشتراک صدا زده می‌شود */
  onActivity(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on(PUSH_EVENTS.activity, listener)
    return () => ipcRenderer.removeListener(PUSH_EVENTS.activity, listener)
  },
  onAccountsChanged(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on(PUSH_EVENTS.accountsChanged, listener)
    return () => ipcRenderer.removeListener(PUSH_EVENTS.accountsChanged, listener)
  }
}

contextBridge.exposeInMainWorld('ig', api)
contextBridge.exposeInMainWorld('igEvents', events)

export type IgBridge = IpcApi
export type IgEvents = typeof events
