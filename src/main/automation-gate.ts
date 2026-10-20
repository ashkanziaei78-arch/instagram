import { logRepo, settingsRepo } from '../core/db/repos'
import { pollerScheduler } from '../core/pollers'
import { jobQueue } from '../core/queue/job-queue'

/**
 * صف کارها و نظرسنجی‌ها فقط وقتی اشتراک فعال است می‌چرخند. کلید توقف اضطراری
 * جداست: آن داخل صف چک می‌شود و این کل موتور را خاموش و روشن می‌کند.
 */
let allowed: boolean | null = null

export const automationAllowed = (): boolean => allowed === true

export function setAutomationAllowed(v: boolean): void {
  if (allowed === v) return
  allowed = v
  if (v) {
    jobQueue.start(5000)
    if (settingsRepo.get<boolean>('pollersEnabled', true)) pollerScheduler.start()
  } else {
    jobQueue.stop()
    pollerScheduler.stop()
    logRepo.add({ level: 'warn', category: 'license', message: 'اشتراک فعال نیست؛ اتوماسیون‌ها متوقف شدند' })
  }
}
