import { formatINR } from "@/lib/utils/finance";

export function SIPCalendar({ sip7, sip28 }: { sip7: number; sip28: number }) {
  const today     = new Date();
  const day       = today.getDate();
  const next7     = day < 7  ? 7  - day : 7  + (30 - day);
  const next28    = day < 28 ? 28 - day : 28 + (30 - day);
  const total     = sip7 + sip28;

  return (
    <div className="card animate-slide-up stagger-4" style={{ padding: "20px 24px" }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="stat-label mb-0.5">SIP Calendar</div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Monthly mandate
          </div>
        </div>
        <div className="text-right">
          <div className="stat-label mb-1">Total/month</div>
          <div className="font-mono text-lg font-medium" style={{ color: "var(--gold-l)" }}>
            {formatINR(total, true)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { date: 7,  amount: sip7,  daysLeft: next7  },
          { date: 28, amount: sip28, daysLeft: next28 },
        ].map(({ date, amount, daysLeft }) => (
          <div
            key={date}
            className="flex items-center gap-4 rounded-xl p-4"
            style={{
              background: day === date ? "rgba(201,168,76,0.08)" : "var(--bg-2)",
              border:     `1px solid ${day === date ? "rgba(201,168,76,0.25)" : "var(--border)"}`,
            }}
          >
            <div
              className="font-display text-3xl flex-shrink-0 w-12 text-center"
              style={{ color: "var(--gold)", fontWeight: 600, lineHeight: 1 }}
            >
              {date}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-medium" style={{ color: "var(--teal)" }}>
                {formatINR(amount)}
              </div>
              <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                {daysLeft === 0 ? "TODAY" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} away`}
              </div>
            </div>
            {daysLeft === 0 && (
              <div className="badge badge-gold">DUE TODAY</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
