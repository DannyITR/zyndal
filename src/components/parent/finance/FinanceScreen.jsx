import { useEffect, useState } from 'react'
import {
  getParentWallet,
  getStudentsForParent,
  getProgress,
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
const PAYOUT_TYPE_LABELS = {
  manual: 'Manual Payout',
  perfect_week_bonus: 'Perfect Week Bonus',
  grade_bonus: 'Grade Bonus',
}

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

  const [milestoneDrafts, setMilestoneDrafts] = useState(null)
  const [milestoneSaving, setMilestoneSaving] = useState(false)
  const [milestoneMessage, setMilestoneMessage] = useState('')

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
    Promise.all(students.map((s) => getProgress(s.id).then((p) => [s.id, p]))).then((pairs) => {
      if (!cancelled) setProgressByStudent(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [students])

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
      setRateMessage('Rate updated!')
    } catch {
      setRateMessage("Couldn't save the rate. Please try again.")
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
      setMilestoneMessage('Milestones updated!')
    } catch {
      setMilestoneMessage("Couldn't save milestones. Please try again.")
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
      getProgress(targetId),
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
      getProgress(achievement.studentId),
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
      getProgress(bonus.studentId),
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
          title="💳 Finances"
          subtitle="Manage payments"
          username={user.username}
          onBack={onBack}
          onLogout={onLogout}
          onLogoClick={onLogoClick}
        />
        <p className="loading-text">Loading…</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar
        title="💳 Finances"
        subtitle="Manage payments"
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
        <p className="wallet-label">Wallet Balance</p>
        <p className="wallet-balance">${centsToDisplay(wallet.walletBalanceCents)}</p>
        <div className="wallet-meta-row">
          <div className="wallet-meta">
            <p className="wallet-meta-value">${centsToDisplay(wallet.totalAddedCents)}</p>
            <p className="wallet-meta-label">Total added</p>
          </div>
          <div className="wallet-meta">
            <p className="wallet-meta-value">${centsToDisplay(wallet.totalPaidOutCents)}</p>
            <p className="wallet-meta-label">Total paid out</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => setShowAddFunds(true)}>
          + Add Funds
        </button>
      </div>

      <div className="finance-info-card">
        <p>
          Your child earns <strong>1 coin</strong> per correct answer plus streak bonuses. You set how much each coin
          is worth. The default is <strong>10 coins = $1</strong>.
        </p>
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Coin-to-Dollar Rate</h3>
        <form className="rate-form" onSubmit={handleSaveRate}>
          <div className="rate-form-row">
            <input
              type="number"
              min="1"
              className="rate-input"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
            <span className="rate-form-static">coins = $1</span>
          </div>
          {rateMessage && (
            <p className={rateMessage.startsWith("Couldn't") ? 'form-error' : 'form-success'}>{rateMessage}</p>
          )}
          <button type="submit" className="btn btn-secondary" disabled={rateSaving}>
            {rateSaving ? 'Saving…' : 'Save Rate'}
          </button>
        </form>
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Your Students</h3>
        <p className="field-hint">You can always pay your child any amount at any time.</p>
        {!students ? (
          <p className="loading-text">Loading…</p>
        ) : students.length === 0 ? (
          <p className="field-hint">No students linked yet.</p>
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
                      {progress.coins} coins = ${dollarValue} at your current rate of {wallet.coinToDollarRate} coins
                      = $1
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setPayoutTargetId(student.id)}
                    disabled={progress.coins === 0}
                  >
                    💸 Payout
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Perfect Week Bonus</h3>
        <p className="field-hint">
          Suggested bonus when a student answers all 6 subjects correctly, first attempt, for 7 days in a row
          ({PERFECT_WEEK_TARGET}/{PERFECT_WEEK_TARGET}). You always confirm the payment yourself — this never pays
          automatically.
        </p>
        {!students || students.length === 0 ? (
          <p className="field-hint">No students linked yet.</p>
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
                  {bonusSavingId === student.id ? 'Saving…' : 'Save'}
                </button>
                {bonusMessageId === student.id && <span className="perfect-week-bonus-saved">Saved!</span>}
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Grade Rewards</h3>
        <p className="field-hint">
          Suggested bonus when your student uploads a graded test. Below 60% suggests no bonus. You always confirm
          the payment yourself — this never pays automatically.
        </p>
        {!students || students.length === 0 ? (
          <p className="field-hint">No students linked yet.</p>
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
                  {gradeRewardSavingId === student.id ? 'Saving…' : 'Save'}
                </button>
                {gradeRewardMessageId === student.id && <span className="perfect-week-bonus-saved">Saved!</span>}
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Reward Milestones</h3>
        <p className="field-hint">Bonus coins awarded automatically when a student hits a streak milestone.</p>
        <form className="milestone-form" onSubmit={handleSaveMilestones}>
          <table className="milestone-table">
            <thead>
              <tr>
                <th>Streak</th>
                <th>Bonus coins</th>
              </tr>
            </thead>
            <tbody>
              {MILESTONE_DAYS.map((day) => (
                <tr key={day}>
                  <td>{day}-day streak</td>
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
            <p className={milestoneMessage.startsWith("Couldn't") ? 'form-error' : 'form-success'}>
              {milestoneMessage}
            </p>
          )}
          <button type="submit" className="btn btn-secondary" disabled={milestoneSaving}>
            {milestoneSaving ? 'Saving…' : 'Save Milestones'}
          </button>
        </form>
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Payout History</h3>
        {!payoutHistory ? (
          <p className="loading-text">Loading…</p>
        ) : payoutHistory.length === 0 ? (
          <p className="field-hint">No payouts yet.</p>
        ) : (
          <ul className="payout-history-list">
            {payoutHistory.map((entry) => (
              <li key={entry.id} className="payout-history-row">
                <div>
                  <p className="payout-history-student">@{entry.studentUsername}</p>
                  <p className="payout-history-date">
                    {PAYOUT_TYPE_LABELS[entry.type] || 'Manual Payout'} · {entry.date} · {entry.coins} coins
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
