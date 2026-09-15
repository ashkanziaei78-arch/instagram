import type { Rule, RuleAction } from '../../shared/types'
import { jobsRepo, logRepo, rulesRepo } from '../db/repos'
import { buildMessage, humanDelayMs, type TemplateVars } from '../text'

export interface TriggerContext {
  accountId: number
  /** شناسه‌ی کاربری که تریگر را زده */
  userIgId: string
  username?: string
  fullName?: string
  /** اگر تریگر از کامنت آمده */
  commentId?: string
  mediaId?: string
  postCaption?: string
  postLink?: string
  /** متن خام تریگر (کامنت یا دایرکت) */
  rawText?: string
}

export function templateVarsFrom(ctx: TriggerContext): TemplateVars {
  return {
    username: ctx.username ?? '',
    name: ctx.fullName ?? ctx.username ?? '',
    full_name: ctx.fullName ?? '',
    post_caption: (ctx.postCaption ?? '').slice(0, 200),
    post_link: ctx.postLink ?? '',
    text: ctx.rawText ?? ''
  }
}

/**
 * اکشن‌های یک قانون را به صف می‌فرستد.
 *
 * دو نکته‌ی طراحی:
 *
 * ۱. تأخیر *انباشته* است. اگر قانون سه اکشن داشته باشد، اکشن دوم بعد از اکشن
 *    اول اجرا می‌شود، نه هم‌زمان با آن. اکشن `wait` هم به همین انباشت اضافه
 *    می‌کند. این باعث می‌شود گفت‌وگو طبیعی به نظر برسد.
 *
 * ۲. dedupe_key از (قانون + کاربر + شماره‌ی اکشن) ساخته می‌شود. اگر وبهوک
 *    دوباره همان کامنت را بفرستد — که متا واقعا این کار را می‌کند — دیتابیس
 *    خودش جلوی ارسال دوباره را می‌گیرد، حتی اگر منطق بالادست اشتباه کند.
 */
export function enqueueRuleActions(rule: Rule, ctx: TriggerContext): number {
  const vars = templateVarsFrom(ctx)
  let cumulativeDelay = humanDelayMs(rule.delay_min, rule.delay_max)
  let queued = 0

  for (const action of rule.actions) {
    switch (action.type) {
      case 'wait':
        cumulativeDelay += (action.seconds ?? 5) * 1000
        continue

      case 'send_dm': {
        if (!action.text) continue
        const id = jobsRepo.enqueue({
          account_id: ctx.accountId,
          kind: 'dm.send',
          run_at: Date.now() + cumulativeDelay,
          dedupe_key: dedupeKey(rule, ctx, action),
          payload: {
            recipientIgId: ctx.userIgId,
            username: ctx.username,
            text: buildMessage(action.text, vars),
            buttons: action.buttons,
            ruleId: rule.id,
            // حضور commentId باعث می‌شود از مسیر private reply برود که
            // نیازی به پنجره‌ی ۲۴ ساعته ندارد
            commentId: ctx.commentId
          }
        })
        if (id !== null) queued++
        // فاصله‌ی انسانی تا اکشن بعدی
        cumulativeDelay += humanDelayMs(4, 12)
        break
      }

      case 'reply_comment': {
        if (!action.text || !ctx.commentId) continue
        const id = jobsRepo.enqueue({
          account_id: ctx.accountId,
          kind: 'comment.reply',
          run_at: Date.now() + cumulativeDelay,
          dedupe_key: dedupeKey(rule, ctx, action),
          payload: {
            // شناسه‌ی پست را هم می‌فرستیم: موتور وب برای پاسخ به کامنت هر دو را
            // لازم دارد، موتور رسمی فقط شناسه‌ی کامنت را. فرمت «mediaId:commentId»
            // هر دو را راضی می‌کند و هر موتور خودش آنچه نیاز دارد را برمی‌دارد.
            commentId: ctx.mediaId ? ctx.mediaId + ':' + ctx.commentId : ctx.commentId,
            text: buildMessage(action.text, vars),
            ruleId: rule.id
          }
        })
        if (id !== null) queued++
        cumulativeDelay += humanDelayMs(3, 9)
        break
      }

      case 'follow_user': {
        const id = jobsRepo.enqueue({
          account_id: ctx.accountId,
          kind: 'user.follow',
          run_at: Date.now() + cumulativeDelay,
          dedupe_key: dedupeKey(rule, ctx, action),
          payload: { userIgId: ctx.userIgId, ruleId: rule.id }
        })
        if (id !== null) queued++
        cumulativeDelay += humanDelayMs(10, 30)
        break
      }

      case 'add_tag': {
        const id = jobsRepo.enqueue({
          account_id: ctx.accountId,
          kind: 'contact.tag',
          run_at: Date.now() + 1000,
          dedupe_key: dedupeKey(rule, ctx, action),
          payload: { userIgId: ctx.userIgId, tag: action.text ?? '', ruleId: rule.id }
        })
        if (id !== null) queued++
        break
      }

      case 'like_comment': {
        if (!ctx.commentId) continue
        const id = jobsRepo.enqueue({
          account_id: ctx.accountId,
          kind: 'comment.like',
          run_at: Date.now() + cumulativeDelay,
          dedupe_key: dedupeKey(rule, ctx, action),
          payload: { commentId: ctx.commentId, ruleId: rule.id }
        })
        if (id !== null) queued++
        cumulativeDelay += humanDelayMs(2, 6)
        break
      }
    }
  }

  if (queued > 0) {
    rulesRepo.incHit(rule.id)
    logRepo.add({
      account_id: ctx.accountId,
      level: 'info',
      category: 'rule',
      message:
        'قانون «' + rule.name + '» برای @' + (ctx.username ?? ctx.userIgId) + ' فعال شد — ' +
        queued + ' اکشن در صف',
      meta: { ruleId: rule.id, commentId: ctx.commentId }
    })
  }

  return queued
}

/**
 * کلید یکتاسازی. اگر قانون once_per_user باشد، کلید شامل زمان نیست، پس هر
 * تلاش دوباره برای همان کاربر رد می‌شود. اگر نباشد، شناسه‌ی کامنت را اضافه
 * می‌کنیم تا هر کامنت جداگانه پاسخ بگیرد ولی همان کامنت دوبار پاسخ نگیرد.
 */
function dedupeKey(rule: Rule, ctx: TriggerContext, action: RuleAction): string {
  const base = 'r' + rule.id + ':a' + action.order + ':u' + ctx.userIgId
  return rule.once_per_user ? base : base + ':c' + (ctx.commentId ?? Date.now())
}
