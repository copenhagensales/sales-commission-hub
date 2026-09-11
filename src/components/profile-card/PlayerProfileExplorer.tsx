/**
 * Liste + spillerprofil-kort side om side.
 *
 * Genbrugelig: giv den et sæt medarbejder-id'er. Alle stats hentes i ÉT kald,
 * så hover kun skifter hvilken række der vises — ingen forespørgsler pr. hover.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ProfilePerson,
  useEmployeeProfileStats,
} from "@/hooks/useEmployeeProfileStats";
import { PlayerProfileCard } from "./PlayerProfileCard";
import { getInitials, kr } from "./profileCardFormat";

const ONYX = "hsl(var(--cph-onyx))";
const EMERALD = "hsl(var(--cph-emerald))";
const LIGHT_BLUE = "hsl(var(--cph-light-blue))";
const ON_LIGHT_PRIMARY = "hsl(var(--cph-onyx))";
const ON_LIGHT_SECONDARY = "hsl(var(--cph-onyx) / 0.88)";

interface PlayerProfileExplorerProps {
  employeeIds: string[];
  /** Kolonneoverskrift for nøgletallet. */
  metricLabel?: string;
  className?: string;
}

export function PlayerProfileExplorer({
  employeeIds,
  metricLabel = "Provision",
  className,
}: PlayerProfileExplorerProps) {
  const { data, isLoading } = useEmployeeProfileStats();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const people = useMemo<ProfilePerson[]>(() => {
    if (!data) return [];
    return employeeIds
      .map((id) => data.byId.get(id))
      .filter((p): p is ProfilePerson => !!p)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "da-DK"));
  }, [data, employeeIds]);

  useEffect(() => {
    if (people.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !people.some((p) => p.id === selectedId)) {
      setSelectedId(people[0].id);
    }
  }, [people, selectedId]);

  const selected = people.find((p) => p.id === selectedId) ?? null;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nextIndex =
      e.key === "ArrowDown"
        ? Math.min(index + 1, people.length - 1)
        : Math.max(index - 1, 0);
    const next = people[nextIndex];
    if (!next) return;
    setSelectedId(next.id);
    rowRefs.current[next.id]?.focus();
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Indlæser profiler...</p>;
  }

  if (people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen medarbejdere at vise.
      </p>
    );
  }

  return (
    <div
      className={className}
      style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}
    >
      {/* Listen */}
      <div
        style={{
          flex: "1 1 370px",
          minWidth: 300,
          background: "hsl(var(--cph-white))",
          borderRadius: 24,
          padding: "18px 20px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "48px 1fr 64px",
            gap: 12,
            alignItems: "center",
            padding: "0 0 8px",
            borderBottom: "1px solid hsl(var(--cph-onyx) / 0.14)",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: ON_LIGHT_SECONDARY,
          }}
        >
          <span aria-hidden="true" />
          <span>Medarbejder</span>
          <span style={{ textAlign: "right" }}>{metricLabel}</span>
        </div>

        <ul
          role="listbox"
          aria-label="Medarbejdere"
          style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}
        >
          {people.map((person, index) => {
            const isSelected = person.id === selectedId;
            const meta = [person.jobTitle || "Medarbejder", person.teamName]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={person.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  ref={(el) => {
                    rowRefs.current[person.id] = el;
                  }}
                  onMouseEnter={() => setSelectedId(person.id)}
                  onFocus={() => setSelectedId(person.id)}
                  onClick={() => setSelectedId(person.id)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr 64px",
                    gap: 12,
                    alignItems: "center",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 10px",
                    borderRadius: 14,
                    background: isSelected ? LIGHT_BLUE : "transparent",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 800,
                      background: isSelected
                        ? ONYX
                        : "hsl(var(--cph-onyx) / 0.08)",
                      color: isSelected ? EMERALD : ON_LIGHT_PRIMARY,
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
                  </span>
                  <span style={{ minWidth: 0, display: "block" }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 17,
                        fontWeight: 800,
                        color: ON_LIGHT_PRIMARY,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {person.fullName}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 400,
                        color: ON_LIGHT_SECONDARY,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {meta}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      textAlign: "right",
                      color: ON_LIGHT_PRIMARY,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {person.stats ? kr(person.stats.total_commission) : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Kortet i sin egen kolonne */}
      <div style={{ flex: "1 1 400px", minWidth: 320 }}>
        <div style={{ position: "sticky", top: 16 }}>
          <div aria-live="polite" className="sr-only">
            {selected ? `Viser profil for ${selected.fullName}` : ""}
          </div>
          {selected && (
            <PlayerProfileCard
              person={selected}
              club200Members={data?.club200Members ?? 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
