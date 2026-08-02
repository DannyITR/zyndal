import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getParentWallet,
  getStudentsForParent,
  getStudentProgress,
  getPayoutHistory,
  addFundsToWallet,
  updateCoinRate,
  updateMilestoneSettings,
  payoutStudentCoins,
  getPendingPerfectWeekAchievements,
  resolvePerfectWeekAchievement,
  updatePerfectWeekBonus,
  getPendingGradeBonuses,
  resolveGradeBonus,
  updateGradeRewardSettings,
} from '../../../lib/storage'
import { coinsToCents, centsToDisplay } from '../../../lib/money'
import { PERFECT_WEEK_TARGET } from '../../../lib/streak'
import TopBar from '../../shared/TopBar'
import AddFundsPaymentModal from './AddFundsPaymentModal'
import PayoutModal from './PayoutModal'
import PerfectWeekNotification from './PerfectWeekNotification'
import GradeRewardNotification from './GradeRewardNotification'

const MILESTONE_DAYS = [7, 14, 30]

function buildGradeRewardDrafts(student) {
  return {
    aPlus: String(centsToDisplay(student.gradeRewardAPlusCents)),
    a: String(centsToDisplay(student.gradeRewardACents)),
    b: String(centsToDisplay(student.gradeRewardBCents)),
    c: String(centsToDisplay(student.gradeRewardCCents)),
  }
}

function buildMilestoneDrafts(milestoneSettings) {
  const drafts = {}
  for (const day of MILESTONE_DAYS) {
    drafts[day] = milestoneSettings?.[day] ?? milestoneSettings?.[String(day)] ?? 0
  }
  return drafts
}

export default function FinanceScreen({ user, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const PAYOUT_TYPE_LABELS = {
    manual: t('finance.payoutTypeManual'),
    perfect_week_bonus: t('finance.payoutTypePerfectWeek'),
    grade_bonus: t('finance.payoutTypeGradeBonus'),
  }
  const [wallet, setWallet] = useState(null)
  const [students, setStudents] = useState(null)
  const [progressByStudent, setProgressByStudent] = useState({})
  const [payoutHistory, setPayoutHistory] = useState(null)
  const [pendingAchievements, setPendingAchievements] = useState(null)

  const [showAddFunds, setShowAddFunds] = useState(false)
  const [payoutTargetId, setPayoutTargetId] = useState(null)

  const [rateInput, setRateInput] = useState('')
  const [rateSaving, setRateSaving] = useState(false)
  const [rateMessage, setRateMessage] = useState('')
  const [rateMessageIsError, setRateMessageIsError] = useState(false)

  const [milestoneDrafts, setMilestoneDrafts] = useState(null)
  const [milestoneSaving, setMilestoneSaving] = useState(false)
  const [milestoneMessage, setMilestoneMessage] = useState('')
  const [milestoneMessageIsError, setMilestoneMessageIsError] = useState(false)

  const [bonusDrafts, setBonusDrafts] = useState({})
  const [bonusSavingId, setBonusSavingId] = useState(null)
  const [bonusMessageId, setBonusMessageId] = useState(null)

  const [pendingGradeBonuses, setPendingGradeBonuses] = useState(null)
  const [gradeRewardDrafts, setGradeRewardDrafts] = useState({})
  const [gradeRewardSavingId, setGradeRewardSavingId] = useState(null)
  const [gradeRewardMessageId, setGradeRewardMessageId] = useState(null)

  // Used by the save handlers below (not the initial-load effect, which
  // fetches the wallet inline to keep its dependency array accurate).
  async function refreshWallet() {
    const w = await getParentWallet(user.id)
    setWallet(w)
    setRateInput(String(w.coinToDollarRate))
    setMilestoneDrafts(buildMilestoneDrafts(w.milestoneSettings))
  }

  async function refreshPendingAchievements() {
    const list = await getPendingPerfectWeekAchievements(user.id)
    setPendingAchievements(list)
  }

  async function refreshPendingGradeBonuses() {
    const list = await getPendingGradeBonuses(user.id)
    setPendingGradeBonuses(list)
  }

  useEffect(() => {
    let cancelled = false
    getParentWallet(user.id).then((w) => {
      if (cancelled) return
      setWallet(w)
      setRateInput(String(w.coinToDollarRate))
      setMilestoneDrafts(buildMilestoneDrafts(w.milestoneSettings))
    })
    getStudentsForParent(user.id).then((list) => {
      if (cancelled) return
      setStudents(list)
      setBonusDrafts(Object.fromEntries(list.map((s) => [s.id, String(s.perfectWeekBonus)])))
      setGradeRewardDrafts(Object.fromEntries(list.map((s) => [s.id, buildGradeRewardDrafts(s)])))
    })
    getPayoutHistory(user.id).then((h) => {
      if (!cancelled) setPayoutHistory(h)
    })
    getPendingPerfectWeekAchievements(user.id).then((list) => {
      if (!cancelled) setPendingAchievements(list)
    })
    getPendingGradeBonuses(user.id).then((list) => {
      if (!cancelled) setPendingGradeBonuses(list)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    if (!students || students.length === 0) return
    let cancelled = false
    Promise.all(students.map((s) => getStudentProgress(user.id, s.id).then((p) => [s.id, p]))).then((pairs) => {
      if (!cancelled) setProgressByStudent(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [students, user.id])

  async function handleFunded(amountCents) {
    await addFundsToWallet(user.id, amountCents)
    await refreshWallet()
  }

  async function handleSaveRate(e) {
    e.preventDefault()
    const rate = Math.round(Number(rateInput))
    if (!Number.isFinite(rate) || rate <= 0) return
    setRateSaving(true)
    setRateMessage('')
    try {
      await updateCoinRate(user.id, rate)
      await refreshWallet()
      setRateMessage(t('finance.rateUpdated'))
      setRateMessageIsError(false)
    } catch {
      setRateMessage(t('finance.rateUpdateFailed'))
      setRateMessageIsError(true)
    } finally {
      setRateSaving(false)
    }
  }

  async function handleSaveMilestones(e) {
    e.preventDefault()
    setMilestoneSaving(true)
    setMilestoneMessage('')
    try {
      const normalized = {}
      for (const day of MILESTONE_DAYS) {
        normalized[day] = Math.max(0, Math.round(Number(milestoneDrafts[day])) || 0)
      }
      await updateMilestoneSettings(user.id, normalized)
      await refreshWallet()
      setMilestoneMessage(t('finance.milestonesUpdated'))
      setMilestoneMessageIsError(false)
    } catch {
      setMilestoneMessage(t('finance.milestonesUpdateFailed'))
      setMilestoneMessageIsError(true)
    } finally {
      setMilestoneSaving(false)
    }
  }

  async function handleSaveBonus(e, studentId) {
    e.preventDefault()
    const amount = Number(bonusDrafts[studentId])
    if (!Number.isFinite(amount) || amount < 0) return
    setBonusSavingId(studentId)
    setBonusMessageId(null)
    try {
      await updatePerfectWeekBonus(user.id, studentId, amount)
      const list = await getStudentsForParent(user.id)
      setStudents(list)
      setBonusMessageId(studentId)
    } catch {
      setBonusMessageId(`${studentId}-error`)
    } finally {
      setBonusSavingId(null)
    }
  }

  async function handleConfirmPayout(coins) {
    const targetId = payoutTargetId
    const amountCents = coinsToCents(coins, wallet.coinToDollarRate)
    await payoutStudentCoins(user.id, targetId, coins, amountCents)
    const [updatedProgress, updatedWallet, updatedHistory] = await Promise.all([
      getStudentProgress(user.id, targetId),
      getParentWallet(user.id),
      getPayoutHistory(user.id),
    ])
    setProgressByStudent((prev) => ({ ...prev, [targetId]: updatedProgress }))
    setWallet(updatedWallet)
    setPayoutHistory(updatedHistory)
    setPayoutTargetId(null)
  }

  async function handleResolveAchievement(achievement, amountCents) {
    await resolvePerfectWeekAchievement(achievement.id, user.id, achievement.studentId, amountCents)
    const [updatedProgress, updatedWallet, updatedHistory] = await Promise.all([
      getStudentProgress(user.id, achievement.studentId),
      getParentWallet(user.id),
      getPayoutHistory(user.id),
    ])
    setProgressByStudent((prev) => ({ ...prev, [achievement.studentId]: updatedProgress }))
    setWallet(updatedWallet)
    setPayoutHistory(updatedHistory)
    await refreshPendingAchievements()
  }

  async function handleResolveGradeBonus(bonus, amountCents) {
    await resolveGradeBonus(bonus.id, user.id, bonus.studentId, amountCents)
    const [updatedProgress, updatedWallet, updatedHistory] = await Promise.all([
      getStudentProgress(user.id, bonus.studentId),
      getParentWallet(user.id),
      getPayoutHistory(user.id),
    ])
    setProgressByStudent((prev) => ({ ...prev, [bonus.studentId]: updatedProgress }))
    setWallet(updatedWallet)
    setPayoutHistory(updatedHistory)
    await refreshPendingGradeBonuses()
  }

  async function handleSaveGradeReward(e, studentId) {
    e.preventDefault()
    const draft = gradeRewardDrafts[studentId]
    const toCents = (v) => Math.round(Number(v) * 100)
    const amounts = { aPlusCents: toCents(draft.aPlus), aCents: toCents(draft.a), bCents: toCents(draft.b), cCents: toCents(draft.c) }
    if (Object.values(amounts).some((v) => !Number.isFinite(v) || v < 0)) return
    setGradeRewardSavingId(studentId)
    setGradeRewardMessageId(null)
    try {
      await updateGradeRewardSettings(user.id, studentId, amounts)
      const list = await getStudentsForParent(user.id)
      setStudents(list)
      setGradeRewardMessageId(studentId)
    } catch {
      setGradeRewardMessageId(`${studentId}-error`)
    } finally {
      setGradeRewardSavingId(null)
    }
  }

  const payoutTarget = payoutTargetId ? students?.find((s) => s.id === payoutTargetId) : null

  if (!wallet || !milestoneDrafts) {
    return (
      <div className="screen">
        <TopBar
          title={t('finance.title')}
          subtitle={t('finance.subtitle')}
          username={user.username}
          onBack={onBack}
          onLogout={onLogout}
          onLogoClick={onLogoClick}
        />
        <p className="loading-text">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar
        title={t('finance.title')}
        subtitle={t('finance.subtitle')}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {pendingAchievements && pendingAchievements.length > 0 && (
        <div className="perfect-week-banner">
          {pendingAchievements.map((achievement) => (
            <PerfectWeekNotification
              key={achievement.id}
              achievement={achievement}
              onResolve={(amountCents) => handleResolveAchievement(achievement, amountCents)}
            />
          ))}
        </div>
      )}

      {pendingGradeBonuses && pendingGradeBonuses.length > 0 && (
        <div className="perfect-week-banner">
          {pendingGradeBonuses.map((bonus) => (
            <GradeRewardNotification
              key={bonus.id}
              bonus={bonus}
              onResolve={(amountCents) => handleResolveGradeBonus(bonus, amountCents)}
            />
          ))}
        </div>
      )}

      <div className="wallet-card">
        <p className="wallet-label">{t('finance.walletBalance')}</p>
        <p className="wallet-balance">${centsToDisplay(wallet.walletBalanceCents)}</p>
        <div className="wallet-meta-row">
          <div className="wallet-meta">
            <p className="wallet-meta-value">${centsToDisplay(wallet.totalAddedCents)}</p>
            <p className="wallet-meta-label">{t('finance.totalAdded')}</p>
          </div>
          <div className="wallet-meta">
            <p className="wallet-meta-value">${centsToDisplay(wallet.totalPaidOutCents)}</p>
            <p className="wallet-meta-label">{t('finance.totalPaidOut')}</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => setShowAddFunds(true)}>
          {t('finance.addFunds')}
        </button>
      </div>

      <div className="finance-info-card">
        <p>{t('finance.infoCard')}</p>
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('finance.coinRateHeading')}</h3>
        <form className="rate-form" onSubmit={handleSaveRate}>
          <div className="rate-form-row">
            <input
              type="number"
              min="1"
              className="rate-input"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
            <span className="rate-form-static">{t('finance.coinsEqualsOneDollar')}</span>
          </div>
          {rateMessage && (
            <p className={rateMessageIsError ? 'form-error' : 'form-success'}>{rateMessage}</p>
          )}
          <button type="submit" className="btn btn-secondary" disabled={rateSaving}>
            {rateSaving ? t('settings.saving') : t('finance.saveRate')}
          </button>
        </form>
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('parent.yourStudents')}</h3>
        <p className="field-hint">{t('finance.payAnytimeHint')}</p>
        {!students ? (
          <p className="loading-text">{t('common.loading')}</p>
        ) : students.length === 0 ? (
          <p className="field-hint">{t('parent.noStudentsLinked')}</p>
        ) : (
          <div className="finance-student-list">
            {students.map((student) => {
              const progress = progressByStudent[student.id]
              if (!progress) return null
              const dollarValue = centsToDisplay(coinsToCents(progress.coins, wallet.coinToDollarRate))
              return (
                <div key={student.id} className="finance-student-row">
                  <div>
                    <p className="finance-student-name">@{student.username}</p>
                    <p className="finance-student-detail">
                      {t('finance.studentCoinDetail', { coins: progress.coins, dollar: dollarValue, rate: wallet.coinToDollarRate })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setPayoutTargetId(student.id)}
                    disabled={progress.coins === 0}
                  >
                    {t('finance.payout')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('finance.perfectWeekBonusHeading')}</h3>
        <p className="field-hint">
          {t('finance.perfectWeekBonusHint', { target: PERFECT_WEEK_TARGET })}
        </p>
        {!students || students.length === 0 ? (
          <p className="field-hint">{t('parent.noStudentsLinked')}</p>
        ) : (
          <div className="perfect-week-bonus-list">
            {students.map((student) => (
              <form
                key={student.id}
                className="perfect-week-bonus-row"
                onSubmit={(e) => handleSaveBonus(e, student.id)}
              >
                <span className="perfect-week-bonus-name">@{student.username}</span>
                <span className="perfect-week-bonus-dollar">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="perfect-week-bonus-input"
                  value={bonusDrafts[student.id] ?? ''}
                  onChange={(e) => setBonusDrafts((prev) => ({ ...prev, [student.id]: e.target.value }))}
                />
                <button type="submit" className="btn btn-secondary btn-small" disabled={bonusSavingId === student.id}>
                  {bonusSavingId === student.id ? t('settings.saving') : t('finance.save')}
                </button>
                {bonusMessageId === student.id && <span className="perfect-week-bonus-saved">{t('finance.savedBang')}</span>}
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('finance.gradeRewardsHeading')}</h3>
        <p className="field-hint">{t('finance.gradeRewardsHint')}</p>
        {!students || students.length === 0 ? (
          <p className="field-hint">{t('parent.noStudentsLinked')}</p>
        ) : (
          <div className="grade-reward-list">
            {students.map((student) => (
              <form
                key={student.id}
                className="grade-reward-card"
                onSubmit={(e) => handleSaveGradeReward(e, student.id)}
              >
                <p className="grade-reward-name">@{student.username}</p>
                <div className="grade-reward-grid">
                  {[
                    ['A+ (90%+)', 'aPlus'],
                    ['A (80-89%)', 'a'],
                    ['B (70-79%)', 'b'],
                    ['C (60-69%)', 'c'],
                  ].map(([label, key]) => (
                    <label key={key} className="grade-reward-field">
                      <span>{label}</span>
                      <div className="grade-reward-input-row">
                        <span>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={gradeRewardDrafts[student.id]?.[key] ?? ''}
                          onChange={(e) =>
                            setGradeRewardDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], [key]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-small"
                  disabled={gradeRewardSavingId === student.id}
                >
                  {gradeRewardSavingId === student.id ? t('settings.saving') : t('finance.save')}
                </button>
                {gradeRewardMessageId === student.id && <span className="perfect-week-bonus-saved">{t('finance.savedBang')}</span>}
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('finance.rewardMilestonesHeading')}</h3>
        <p className="field-hint">{t('finance.rewardMilestonesHint')}</p>
        <form className="milestone-form" onSubmit={handleSaveMilestones}>
          <table className="milestone-table">
            <thead>
              <tr>
                <th>{t('finance.streakColumn')}</th>
                <th>{t('finance.bonusCoinsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {MILESTONE_DAYS.map((day) => (
                <tr key={day}>
                  <td>{t('finance.dayStreak', { count: day })}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="milestone-input"
                      value={milestoneDrafts[day]}
                      onChange={(e) =>
                        setMilestoneDrafts((prev) => ({ ...prev, [day]: e.target.value }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {milestoneMessage && (
            <p className={milestoneMessageIsError ? 'form-error' : 'form-success'}>
              {milestoneMessage}
            </p>
          )}
          <button type="submit" className="btn btn-secondary" disabled={milestoneSaving}>
            {milestoneSaving ? t('settings.saving') : t('finance.saveMilestones')}
          </button>
        </form>
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('finance.payoutHistoryHeading')}</h3>
        {!payoutHistory ? (
          <p className="loading-text">{t('common.loading')}</p>
        ) : payoutHistory.length === 0 ? (
          <p className="field-hint">{t('finance.noPayoutsYet')}</p>
        ) : (
          <ul className="payout-history-list">
            {payoutHistory.map((entry) => (
              <li key={entry.id} className="payout-history-row">
                <div>
                  <p className="payout-history-student">@{entry.studentUsername}</p>
                  <p className="payout-history-date">
                    {t('finance.payoutHistoryDetail', {
                      type: PAYOUT_TYPE_LABELS[entry.type] || t('finance.payoutTypeManual'),
                      date: entry.date,
                      coins: entry.coins,
                    })}
                  </p>
                </div>
                <p className="payout-history-amount">${centsToDisplay(entry.amountCents)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAddFunds && <AddFundsPaymentModal onClose={() => setShowAddFunds(false)} onFunded={handleFunded} />}

      {payoutTarget && progressByStudent[payoutTargetId] && (
        <PayoutModal
          student={payoutTarget}
          coins={progressByStudent[payoutTargetId].coins}
          rate={wallet.coinToDollarRate}
          walletBalanceCents={wallet.walletBalanceCents}
          onClose={() => setPayoutTargetId(null)}
          onConfirm={handleConfirmPayout}
        />
      )}
    </div>
  )
}
