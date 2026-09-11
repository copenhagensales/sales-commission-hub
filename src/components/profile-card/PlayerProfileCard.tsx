/**
 * Spillerprofil-kort.
 *
 * Genbrugelig komponent: viser identitet, karrieretal, personlige rekorder,
 * klubber og ligahistorik for én person. Alle tal kommer præberegnet fra
 * useEmployeeProfileStats — komponenten laver ingen forespørgsler.
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
  hint?: string;
}

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

  const records: RecordRow[] = [
    {
      label: "Bedste dag",
      value: kr(s?.best_day_amount ?? null),
      meta: formatDanishDate(s?.best_day_date) ?? "ikke sat endnu",
    },
    {
      label: "Bedste uge",
      value: kr(s?.best_week_amount ?? null),
      meta:
        formatIsoWeek(s?.best_week_iso, s?.best_week_year) ?? "ikke sat endnu",
    },
    {
      label: "Bedste lønperiode",
      value: kr(s?.best_period_amount ?? null),
      meta: formatPayPeriod(s?.best_period_start) ?? "ikke sat endnu",
    },
    {
      label: "Længste stribe uden nuldag",
      value:
        s && s.longest_streak_days > 0
          ? `${count(s.longest_streak_days)} dage`
          : "—",
      meta:
        (s && s.longest_streak_days > 0
          ? formatDateSpan(s.streak_start, s.streak_end)
          : null) ?? "ikke sat endnu",
      hint: "Sammenhængende dage med mindst ét salg. Godkendt fravær og dage uden planlagt vagt springes over og bryder ikke striben.",
    },
  ];

  const clubs = [
    { name: "Klub 50", threshold: 50, times: s?.club_50_count ?? 0 },
    { name: "Klub 100", threshold: 100, times: s?.club_100_count ?? 0 },
    { name: "Klub 200", threshold: 200, times: s?.club_200_count ?? 0 },
  ];
  const achieved = clubs.filter((c) => c.times > 0);
  const next = clubs.find((c) => c.times === 0);

  const hasLeague =
    !!s && (s.league_seasons > 0 || s.league_round_wins > 0 || !!s.league_best_division);

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
      <header style={{ padding: "22px 22px 20px" }}>
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

        {person.clients.length > 0 && (
          <ul
            aria-label="Kunder"
            style={{
              display: "flex",
              flexWrap: "wrap",
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
          </ul>
        )}
      </header>

      {/* 2) Tre karrieretal */}
      <div style={{ display: "flex", gap: 2, padding: "0 22px" }}>
        {[
          { label: "Salg i alt", value: count(s?.total_sales ?? 0) },
          { label: "Lønperioder", value: count(s?.pay_periods ?? 0) },
          {
            label: "Snit pr. lønperiode",
            value: s && s.pay_periods > 0 ? kr(s.avg_per_pay_period) : "—",
          },
        ].map((item, i, arr) => (
          <div
            key={item.label}
            style={{
              flex: "1 1 0",
              background: PANEL,
              padding: "14px 14px 12px",
              borderTopLeftRadius: i === 0 ? 14 : 0,
              borderBottomLeftRadius: i === 0 ? 14 : 0,
              borderTopRightRadius: i === arr.length - 1 ? 14 : 0,
              borderBottomRightRadius: i === arr.length - 1 ? 14 : 0,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: TEXT_PRIMARY,
              }}
            >
              {item.label}
            </p>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 27,
                fontWeight: 800,
                lineHeight: 1.05,
                color: TEXT_PRIMARY,
              }}
            >
              {item.value}
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

        <dl style={{ margin: 0 }}>
          {records.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: i === 0 ? "0 0 12px" : "12px 0",
                borderTop: i === 0 ? undefined : `1px solid ${DIVIDER}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <dt
                  style={{
                    fontSize: 15,
                    fontWeight: 400,
                    color: TEXT_PRIMARY,
                  }}
                >
                  {r.label}
                </dt>
                <p
                  style={{
                    margin: "4px 0 0",
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
              <dd
                style={{
                  margin: 0,
                  fontSize: 21,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  color: TEXT_PRIMARY,
                }}
              >
                {r.value}
              </dd>
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
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {achieved.map((c) => {
            const isTop = c.threshold === 200;
            return (
              <li
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  padding: isTop ? "8px 14px" : "6px 12px",
                  borderRadius: 14,
                  background: isTop
                    ? "hsl(var(--cph-emerald) / 0.20)"
                    : "hsl(var(--cph-emerald) / 0.12)",
                  border: `${isTop ? 2 : 1}px solid hsl(var(--cph-emerald) / 0.55)`,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 800, color: EMERALD }}>
                  ×{c.times}
                </span>
                <span
                  style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRIMARY }}
                >
                  {c.name}
                </span>
                {isTop && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    husets højeste klub ·{" "}
                    {club200Members === 1
                      ? "1 medlem i huset"
                      : `${count(club200Members)} medlemmer i huset`}
                  </span>
                )}
              </li>
            );
          })}

          {next && (
            <li
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 14,
                border: `1px dashed hsl(var(--cph-light-blue) / 0.45)`,
              }}
            >
              <span
                style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRIMARY }}
              >
                {next.name}
              </span>
              <span
                style={{ fontSize: 13, fontWeight: 400, color: TEXT_PRIMARY }}
              >
                · kan opnås
              </span>
            </li>
          )}
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
          },
          {
            label: "Rundesejre",
            value: hasLeague ? count(s?.league_round_wins ?? 0) : "—",
          },
          {
            label: "Sæsoner spillet",
            value: hasLeague ? count(s?.league_seasons ?? 0) : "—",
          },
        ].map((item) => (
          <div key={item.label} style={{ flex: "1 1 0" }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: TEXT_PRIMARY,
              }}
            >
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
