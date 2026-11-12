import { useEffect, useState } from 'react'
import { getAdminAiUsage } from '../../lib/adminApi'

// Read-only Claude token usage and estimated cost, by feature and by day
// (see api/admin/get-ai-usage.js). Costs are list-price estimates.

const numberFormat = new Intl.NumberFormat()
const costFormat = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })

function UsageTable({ label, rows }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Calls</th>
            <th>Input tokens</th>
            <th>Output tokens</th>
            <th>Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-table-empty">
                No AI calls logged in this period.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>{numberFormat.format(row.calls)}</td>
                <td>{numberFormat.format(row.inputTokens)}</td>
                <td>{numberFormat.format(row.outputTokens)}</td>
                <td>{costFormat.format(row.cost)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminAiUsagePanel() {
  const [days, setDays] = useState(30)
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    getAdminAiUsage(days)
      .then((data) => !cancelled && setUsage(data))
      .catch((err) => !cancelled && setError(err.message || 'Failed to load AI usage.'))
    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2>AI usage</h2>
        <div className="admin-filters">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {!usage && !error && <p>Loading…</p>}
      {usage && (
        <>
          <p>
            {numberFormat.format(usage.totals.calls)} calls · {numberFormat.format(usage.totals.inputTokens)} input /{' '}
            {numberFormat.format(usage.totals.outputTokens)} output tokens · est. {costFormat.format(usage.totals.cost)}
          </p>
          {usage.unpricedModels.length > 0 && (
            <p className="admin-error">No price on file for {usage.unpricedModels.join(', ')}; those calls are counted at $0.</p>
          )}
          <h3>By feature</h3>
          <UsageTable label="Feature" rows={usage.byFeature} />
          <h3>By day (UTC)</h3>
          <UsageTable label="Day" rows={usage.byDay} />
        </>
      )}
    </section>
  )
}
