/**
 * Spillerprofil-kort.
 *
 * Genbrugelig komponent: viser identitet, rekorder, klubber og ligahistorik
 * for én person. Alle tal kommer præberegnet fra useEmployeeProfileStats —
 * komponenten laver ingen forespørgsler.
 */
import { ProfilePerson } from "@/hooks/useEmployeeProfileStats";
import {
  count,
  formatDanishDate,
  formatDateSpan,
  formatDivision,
  formatIsoWeek,
  formatPayPeriod,
  formatTenure,
  getInitials,
  kr,
} from "./profileCardFormat";

const ONYX = "hsl(var(--cph-onyx))";
const EMERALD = "hsl(var(--cph-emerald))";
const TEXT_PRIMARY = "hsl(var(--cph-light-blue) / 0.95)";
const TEXT_SECONDARY = "hsl(var(--cph-light-blue) / 0.90)";
const PANEL = "hsl(var(--cph-light-blue) / 0.07)";
const PANEL_STRONG = "hsl(var(--cph-light-blue) / 0.10)";
const DIVIDER = "hsl(var(--cph-light-blue) / 0.12)";
const GRID_LINE = "hsl(var(--cph-light-blue) / 0.035)";

interface PlayerProfileCardProps {
  person: ProfilePerson;
  /** Antal personer i huset med Klub 200 — bruges til tekstforklaringen. */
  club200Members?: number;
  className?: string;
}

interface RecordRow {
  label: string;
  value: string;
  meta: string;
  icon: JSX.Element;
  bars?: number;
  /** Antal af de sidste felter der markeres som igangværende stribe. */
  activeBars?: number;
  activeLabel?: string;
}

/** Små inline-ikoner så kortet kan bruges uafhængigt af ikonbiblioteket. */
function Icon({ path, size = 14, color = EMERALD }: { path: string; size?: number; color?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: `0 0 ${size}px` }}
    >
      <path d={path} />
    </svg>
  );
}

const ICON_SUN =
  "M12 4v2M12 18v2M4 12H6M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z";
const ICON_CALENDAR =
  "M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z";
const ICON_BARS = "M6 19V11M12 19V5M18 19v-6";
const ICON_FLAME =
  "M12 3c3 3.5 5 6 5 9a5 5 0 01-10 0c0-1.6.7-3 2-4.5.6 1 1.2 1.6 2 2 .6-2.2.6-4.2 1-6.5z";
const ICON_SHIELD = "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z";
const ICON_STAR =
  "M12 4l2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.6-4.6 2.6.9-5.3L4.5 9.6l5.2-.7L12 4z";
const ICON_CLOCK = "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z";
const ICON_TROPHY =
  "M8 4h8v4a4 4 0 01-8 0V4zM8 5H5v2a3 3 0 003 3M16 5h3v2a3 3 0 01-3 3M10 15h4M12 12v3M9 19h6";
const ICON_LOCK = "M8 11V8a4 4 0 018 0v3M6 11h12v9H6v-9z";

export function PlayerProfileCard({
  person,
  club200Members = 0,
  className,
}: PlayerProfileCardProps) {
  const s = person.stats;

  const metaParts = [
    person.jobTitle || "Medarbejder",
    person.teamName || "Intet team",
    formatTenure(person.employmentStartDate),
  ].filter(Boolean) as string[];

  const streakDays = s?.longest_streak_days ?? 0;
  const currentStreak = Math.min(s?.current_streak_days ?? 0, streakDays);

  const records: RecordRow[] = [
    {
      label: "Bedste uge",
      value: kr(s?.best_week_amount ?? null),
      meta:
        formatIsoWeek(s?.best_week_iso, s?.best_week_year) ?? "ikke sat endnu",
      icon: <Icon path={ICON_BARS} />,
    },
    {
      label: "Længste stribe uden nuldag",
      value: streakDays > 0 ? `${count(streakDays)} dage` : "—",
      meta:
        (streakDays > 0 ? formatDateSpan(s?.streak_start, s?.streak_end) : null) ??
        "ikke sat endnu",
      hint: "Sammenhængende dage med mindst ét salg. Godkendt fravær og dage uden planlagt vagt springes over og bryder ikke striben.",
      icon: <Icon path={ICON_FLAME} />,
      bars: streakDays,
    },
  ];

  const clubs = [
    { name: "Klub 50", threshold: 50, times: s?.club_50_count ?? 0 },
    { name: "Klub 100", threshold: 100, times: s?.club_100_count ?? 0 },
    { name: "Klub 200", threshold: 200, times: s?.club_200_count ?? 0 },
  ];

  const hasLeague =
    !!s && (s.league_seasons > 0 || s.league_round_wins > 0 || !!s.league_best_division);
  const leagueChip = hasLeague ? formatDivision(s?.league_best_division) : null;

  const ringColor = (threshold: number) =>
    threshold === 200 ? "hsl(45 80% 62%)" : threshold === 100 ? "hsl(210 16% 78%)" : "hsl(28 55% 58%)";

  return (
    <article
      className={className}
      aria-label={`Spillerprofil for ${person.fullName}`}
      style={{
        borderRadius: 24,
        overflow: "hidden",
        background: ONYX,
        backgroundImage: `repeating-linear-gradient(to right, ${GRID_LINE} 0 1px, transparent 1px 48px), repeating-linear-gradient(to bottom, ${GRID_LINE} 0 1px, transparent 1px 48px)`,
        color: TEXT_PRIMARY,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* 1) Identitet */}
      <header
        style={{
          padding: "22px 22px 20px",
          background: `radial-gradient(120% 120% at 0% 0%, hsl(var(--cph-emerald) / 0.16), transparent 60%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              flex: "0 0 72px",
              borderRadius: "50%",
              background: EMERALD,
              color: ONYX,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 23,
              fontWeight: 800,
              boxShadow: `0 0 0 3px hsl(var(--cph-emerald) / 0.35)`,
              backgroundImage: person.avatarUrl
                ? `url(${person.avatarUrl})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {person.avatarUrl
              ? ""
              : getInitials(person.firstName, person.lastName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontSize: 24,
                fontWeight: 800,
                lineHeight: 1.15,
                margin: 0,
                color: TEXT_PRIMARY,
              }}
            >
              {person.fullName || "Ukendt"}
            </h3>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                fontWeight: 400,
                color: TEXT_SECONDARY,
              }}
            >
              {metaParts.join(" · ")}
            </p>
          </div>
        </div>

        {(person.clients.length > 0 || leagueChip) && (
          <ul
            aria-label="Kunder og liga"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              listStyle: "none",
              margin: "14px 0 0",
              padding: 0,
            }}
          >
            {person.clients.map((client) => (
              <li
                key={client}
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  padding: "4px 10px",
                  borderRadius: 14,
                  background: PANEL_STRONG,
                  color: TEXT_PRIMARY,
                }}
              >
                {client}
              </li>
            ))}
            {leagueChip && (
              <li
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "4px 12px",
                  borderRadius: 14,
                  background: "hsl(var(--cph-emerald) / 0.14)",
                  border: `1px solid hsl(var(--cph-emerald) / 0.5)`,
                  color: EMERALD,
                }}
              >
                <Icon path={ICON_TROPHY} size={13} />
                {leagueChip}
              </li>
            )}
          </ul>
        )}
      </header>

      {/* 2) Topgrafik: de to vigtigste rekorder */}
      <div style={{ display: "flex", gap: 8, padding: "0 22px" }}>
        {[
          {
            label: "Bedste dag",
            value: kr(s?.best_day_amount ?? null),
            meta: formatDanishDate(s?.best_day_date) ?? "ikke sat endnu",
            icon: <Icon path={ICON_SUN} />,
          },
          {
            label: "Bedste lønperiode",
            value: kr(s?.best_period_amount ?? null),
            meta: formatPayPeriod(s?.best_period_start) ?? "ikke sat endnu",
            icon: <Icon path={ICON_CALENDAR} />,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              flex: "1 1 0",
              background: PANEL,
              padding: "14px 16px 13px",
              borderRadius: 18,
              border: `1px solid ${DIVIDER}`,
              backgroundImage: `radial-gradient(100% 120% at 100% 0%, hsl(var(--cph-emerald) / 0.10), transparent 65%)`,
            }}
          >
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: TEXT_SECONDARY,
              }}
            >
              {item.icon}
              {item.label}
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 27,
                fontWeight: 800,
                lineHeight: 1.05,
                color: TEXT_PRIMARY,
              }}
            >
              {item.value}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                fontWeight: 400,
                color: TEXT_SECONDARY,
              }}
            >
              {item.meta}
            </p>
          </div>
        ))}
      </div>

      {/* 3) Personlige rekorder */}
      <section style={{ padding: "22px 22px 20px" }}>
        <h4
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "0 0 12px",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: EMERALD,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 3,
              height: 12,
              background: EMERALD,
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Personlige rekorder
        </h4>

        <dl style={{ display: "grid", gap: 10, margin: 0 }}>
          {records.map((r) => (
            <div
              key={r.label}
              style={{
                background: PANEL,
                border: `1px solid ${DIVIDER}`,
                borderRadius: 18,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 34,
                      height: 34,
                      flex: "0 0 34px",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "hsl(var(--cph-emerald) / 0.14)",
                      border: `1px solid hsl(var(--cph-emerald) / 0.4)`,
                    }}
                  >
                    {r.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <dt
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {r.label}
                    </dt>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 13,
                        fontWeight: 400,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      {r.meta}
                    </p>
                    {r.hint && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 13,
                          fontWeight: 400,
                          color: TEXT_SECONDARY,
                          maxWidth: 300,
                        }}
                      >
                        {r.hint}
                      </p>
                    )}
                  </div>
                </div>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 21,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    color: r.bars ? EMERALD : TEXT_PRIMARY,
                  }}
                >
                  {r.value}
                </dd>
              </div>

              {!!r.bars && r.bars > 0 && (
                <div
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 4,
                    marginTop: 14,
                    height: 18,
                  }}
                >
                  {Array.from({ length: Math.min(r.bars, 30) }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        flex: "1 1 0",
                        height: 12,
                        borderRadius: 4,
                        background: "hsl(var(--cph-emerald) / 0.55)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </dl>
      </section>

      {/* 4) Klubberne */}
      <section style={{ padding: "0 22px 22px" }}>
        <h4
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "0 0 12px",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: EMERALD,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 3,
              height: 12,
              background: EMERALD,
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Klubber
        </h4>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 400,
            color: TEXT_SECONDARY,
          }}
        >
          Antal gange med mindst 50.000 / 100.000 / 200.000 kr i provision i én
          lønperiode (15. til 14.).
        </p>

        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {clubs.map((c) => {
            const earned = c.times > 0;
            const color = ringColor(c.threshold);
            return (
              <li
                key={c.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 8px 12px",
                  borderRadius: 18,
                  background: earned ? PANEL_STRONG : "transparent",
                  border: earned
                    ? `1px solid ${DIVIDER}`
                    : `1px dashed hsl(var(--cph-light-blue) / 0.28)`,
                  opacity: earned ? 1 : 0.55,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    fontWeight: 800,
                    color: earned ? color : TEXT_SECONDARY,
                    border: earned
                      ? `3px solid ${color}`
                      : `2px dashed hsl(var(--cph-light-blue) / 0.35)`,
                    background: earned ? `hsl(var(--cph-onyx))` : "transparent",
                  }}
                >
                  {earned ? c.threshold : <Icon path={ICON_LOCK} size={18} color={TEXT_SECONDARY} />}
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}
                >
                  {c.name}
                </span>
                {earned && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: "hsl(var(--cph-emerald) / 0.2)",
                      color: EMERALD,
                    }}
                  >
                    ×{c.times}
                  </span>
                )}
                {earned && c.threshold === 200 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      textAlign: "center",
                      color: TEXT_SECONDARY,
                    }}
                  >
                    {club200Members === 1
                      ? "1 medlem i huset"
                      : `${count(club200Members)} medlemmer i huset`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 5) Ligahistorik */}
      <footer
        style={{
          display: "flex",
          gap: 2,
          padding: "16px 22px 18px",
          background: "hsl(var(--cph-light-blue) / 0.06)",
          borderTop: `1px solid ${DIVIDER}`,
        }}
      >
        {[
          {
            label: "Bedste division",
            value: hasLeague ? formatDivision(s?.league_best_division) : "—",
            icon: <Icon path={ICON_SHIELD} />,
          },
          {
            label: "Rundesejre",
            value: hasLeague ? count(s?.league_round_wins ?? 0) : "—",
            icon: <Icon path={ICON_STAR} />,
          },
          {
            label: "Sæsoner spillet",
            value: hasLeague ? count(s?.league_seasons ?? 0) : "—",
            icon: <Icon path={ICON_CLOCK} />,
          },
        ].map((item) => (
          <div key={item.label} style={{ flex: "1 1 0" }}>
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: TEXT_SECONDARY,
              }}
            >
              {item.icon}
              {item.label}
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 17,
                fontWeight: 800,
                color: TEXT_PRIMARY,
              }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </footer>
    </article>
  );
}
