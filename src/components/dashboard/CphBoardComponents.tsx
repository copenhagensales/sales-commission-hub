import React from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import cphLogo from "@/assets/cph-sales-logo.png";
import { formatNumber } from "@/lib/calculations";
import type { LeaderboardSeller } from "@/components/dashboard/TvDashboardComponents";

/**
 * Copenhagen Sales visuel stil til klient-boards.
 * Rent præsentationslag - ingen datalogik, ingen beregninger.
 */

const ONYX = "hsl(var(--cph-onyx))";
const LIGHT = "hsl(var(--cph-light-blue))";
const EMERALD = "hsl(var(--cph-emerald))";
const LIGHT_DIM = "hsl(var(--cph-light-blue) / 0.72)";
const SURFACE = "hsl(var(--cph-light-blue) / 0.07)";
const ONYX_DIM = "hsl(var(--cph-onyx) / 0.76)";

export interface CphKpi {
  label: string;
  value: string | number;
  sub: string;
  suffix?: React.ReactNode;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

function CphKpiCard({ kpi, emphasis, tvMode }: { kpi: CphKpi; emphasis?: boolean; tvMode: boolean }) {
  const bigSize = tvMode ? (emphasis ? 84 : 56) : emphasis ? 64 : 44;
  return (
    <div
      className="flex flex-col justify-between rounded-[20px]"
      style={{
        background: emphasis ? LIGHT : SURFACE,
        color: emphasis ? ONYX : LIGHT,
        padding: tvMode ? "18px 26px" : "18px 20px",
      }}
    >
      <div
        className="font-extrabold uppercase"
        style={{
          fontSize: tvMode ? 18 : 13,
          letterSpacing: "0.1em",
          color: emphasis ? ONYX : LIGHT_DIM,
        }}
      >
        {kpi.label}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div
          className="font-extrabold"
          style={{ fontSize: bigSize, lineHeight: 0.95, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}
        >
          {kpi.value}
        </div>
        {kpi.suffix && (
          <div style={{ fontSize: tvMode ? 18 : 13, color: emphasis ? ONYX_DIM : LIGHT_DIM }}>{kpi.suffix}</div>
        )}
      </div>
      <div style={{ fontSize: tvMode ? 17 : 12, marginTop: 6, color: emphasis ? ONYX_DIM : LIGHT_DIM }}>{kpi.sub}</div>
    </div>
  );
}

function CphSecondaryKpi({ kpi, tvMode }: { kpi: CphKpi; tvMode: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[20px]"
      style={{ background: SURFACE, color: LIGHT, padding: tvMode ? "14px 24px" : "14px 18px" }}
    >
      <div
        className="font-extrabold uppercase"
        style={{ fontSize: tvMode ? 18 : 12, letterSpacing: "0.1em", color: LIGHT_DIM }}
      >
        {kpi.label}
      </div>
      <div className="flex items-baseline gap-3">
        <div
          className="font-extrabold"
          style={{ fontSize: tvMode ? 38 : 28, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
        >
          {kpi.value}
        </div>
        <div style={{ fontSize: tvMode ? 17 : 12, color: LIGHT_DIM }}>{kpi.sub}</div>
      </div>
    </div>
  );
}

interface CphLeaderboardProps {
  title: string;
  sellers: LeaderboardSeller[];
  isLoading: boolean;
  tvMode: boolean;
  light?: boolean;
  showCrossSales?: boolean;
  crossSalesLabel?: string;
  showFiber?: boolean;
  maxRows?: number;
}

export function CphLeaderboard({
  title,
  sellers,
  isLoading,
  tvMode,
  light = false,
  showCrossSales = false,
  crossSalesLabel = "Switch",
  showFiber = false,
  maxRows,
}: CphLeaderboardProps) {
  const rows = maxRows ? sellers.slice(0, maxRows) : sellers;
  const fg = light ? ONYX : LIGHT;
  const fgDim = light ? ONYX_DIM : LIGHT_DIM;
  const cols = `${tvMode ? "38px 46px" : "22px 30px"} minmax(0,1fr) ${tvMode ? "66px" : "36px"}${
    showCrossSales ? (tvMode ? " 62px" : " 34px") : ""
  }${showFiber ? (tvMode ? " 70px" : " 38px") : ""} auto`;


  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-[20px]"
      style={{
        background: light ? LIGHT : SURFACE,
        color: fg,
        padding: tvMode ? "18px 26px" : "18px 20px",
      }}
    >
      <div
        className="flex items-center justify-between gap-3"
        style={{ paddingBottom: 14, borderBottom: `2px solid ${light ? ONYX : "hsl(var(--cph-light-blue) / 0.18)"}` }}
      >
        <div className="flex items-center gap-3">
          <span
            style={{ width: 5, height: tvMode ? 22 : 18, borderRadius: 3, background: light ? ONYX : EMERALD }}
          />
          <span className="font-extrabold" style={{ fontSize: tvMode ? 26 : 18, letterSpacing: "-0.01em" }}>
            {title}
          </span>
        </div>
        <span style={{ fontSize: tvMode ? 17 : 12, color: fgDim }}>Provision, kr</span>
      </div>

      <div
        className="grid items-center font-extrabold uppercase"
        style={{
          gridTemplateColumns: cols,
          columnGap: 14,
          padding: tvMode ? "12px 0 8px" : "12px 0 8px",
          fontSize: tvMode ? 15 : 10,
          letterSpacing: tvMode ? "0.08em" : "0.02em",
          color: fgDim,
        }}
      >
        <span>#</span>
        <span />
        <span>Navn</span>
        <span style={{ textAlign: "right" }}>Salg</span>
        {showCrossSales && <span style={{ textAlign: "right" }}>{crossSalesLabel}</span>}
        {showFiber && <span style={{ textAlign: "right" }}>Fiber</span>}
        <span style={{ textAlign: "right", minWidth: tvMode ? 118 : 66 }}>Provision</span>
      </div>

      {isLoading ? (
        <div className="py-8 text-center" style={{ color: fgDim }}>
          Indlæser...
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center" style={{ color: fgDim }}>
          Ingen salg endnu
        </div>
      ) : (
        <div
          className={
            tvMode
              ? "flex min-h-0 flex-1 flex-col justify-around"
              : "flex flex-col overflow-y-auto max-h-[560px]"
          }
        >
          {rows.map((seller, index) => {
            const isTop = index === 0;
            return (
              <div
                key={seller.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: cols,
                  columnGap: 14,
                  padding: tvMode ? (isTop ? "10px 14px 10px 10px" : "12px 0") : isTop ? "10px 10px 10px 8px" : "10px 0",
                  margin: isTop ? (tvMode ? "0 -14px 0 -10px" : "0 -10px 0 -8px") : undefined,
                  background: isTop ? (light ? ONYX : "hsl(var(--cph-light-blue) / 0.12)") : undefined,
                  color: isTop && light ? LIGHT : undefined,
                  borderRadius: isTop ? 16 : undefined,
                }}
              >
                <span
                  className={index < 3 ? "font-extrabold" : ""}
                  style={{
                    fontSize: tvMode ? (isTop ? 24 : 22) : 15,
                    textAlign: "center",
                    color: isTop ? EMERALD : index < 3 ? undefined : fgDim,
                  }}
                >
                  {index + 1}
                </span>
                <span
                  className="flex items-center justify-center font-extrabold"
                  style={{
                    width: tvMode ? 46 : 30,
                    height: tvMode ? 46 : 30,
                    borderRadius: "50%",
                    fontSize: tvMode ? 17 : 12,
                    background: isTop
                      ? EMERALD
                      : index < 3
                      ? light
                        ? ONYX
                        : "hsl(var(--cph-light-blue) / 0.18)"
                      : light
                      ? "hsl(var(--cph-onyx) / 0.10)"
                      : "hsl(var(--cph-light-blue) / 0.10)",
                    color: isTop ? ONYX : index < 3 && light ? LIGHT : undefined,
                  }}
                >
                  {getInitials(seller.displayName || seller.name)}
                </span>
                <span
                  className={index < 3 ? "truncate font-extrabold" : "truncate"}
                  style={{ fontSize: tvMode ? (isTop ? 23 : 22) : 15 }}
                >
                  {seller.displayName || seller.name}
                </span>
                <span
                  className="font-extrabold"
                  style={{ fontSize: tvMode ? 22 : 15, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                >
                  {seller.salesCount}
                </span>
                {showCrossSales && (
                  <span
                    style={{
                      fontSize: tvMode ? 20 : 14,
                      textAlign: "right",
                      color: isTop ? LIGHT_DIM : fgDim,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {seller.crossSales ?? 0}
                  </span>
                )}
                {showFiber && (
                  <span
                    style={{
                      fontSize: tvMode ? 20 : 14,
                      textAlign: "right",
                      color: isTop ? LIGHT_DIM : fgDim,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {seller.fiberPoints ?? 0}
                  </span>
                )}
                <span
                  className="font-extrabold"
                  style={{
                    fontSize: tvMode ? (isTop ? 26 : 24) : 16,
                    textAlign: "right",
                    letterSpacing: "-0.02em",
                    minWidth: tvMode ? 118 : 66,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatNumber(Math.round(seller.commission))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CphBoardFrameProps {
  title: string;
  subtitle: string;
  tvMode: boolean;
  rightContent?: React.ReactNode;
  primaryKpis: CphKpi[];
  secondaryKpis?: CphKpi[];
  extraContent?: React.ReactNode;
  children: React.ReactNode;
}

export function CphBoardFrame({
  title,
  subtitle,
  tvMode,
  rightContent,
  primaryKpis,
  secondaryKpis,
  extraContent,
  children,
}: CphBoardFrameProps) {

  const now = new Date();
  const kpiCols = tvMode
    ? `1.35fr ${primaryKpis.slice(1).map(() => "1fr").join(" ")}`
    : undefined;

  return (
    <div
      className={
        tvMode
          ? "relative flex h-[1080px] w-[1920px] flex-col overflow-hidden"
          : "relative flex min-h-screen flex-col"
      }
      style={{
        background: ONYX,
        color: LIGHT,
        fontVariantNumeric: "tabular-nums",
        padding: tvMode ? "24px 40px 24px" : "20px 20px 28px",
        gap: tvMode ? 18 : 16,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--cph-light-blue) / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--cph-light-blue) / 0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <header
        className="relative flex flex-wrap items-center justify-between gap-6"
        style={{ paddingBottom: tvMode ? 12 : 12 }}
      >
        <div className="flex items-center gap-6">
          <img src={cphLogo} alt="Copenhagen Sales" style={{ width: tvMode ? 132 : 92, height: "auto" }} />
          <div>
            <div
              className="font-extrabold"
              style={{ fontSize: tvMode ? 44 : 26, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {title}
            </div>
            <div style={{ fontSize: tvMode ? 20 : 13, color: LIGHT_DIM, marginTop: 8 }}>{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {tvMode ? (
            <>
              <div
                className="flex items-center gap-3"
                style={{
                  background: "hsl(var(--cph-emerald) / 0.12)",
                  border: `1.5px solid ${EMERALD}`,
                  borderRadius: 14,
                  padding: "14px 22px",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: EMERALD,
                    boxShadow: "0 0 0 5px hsl(var(--cph-emerald) / 0.2)",
                    display: "block",
                  }}
                />
                <span
                  className="font-extrabold uppercase"
                  style={{ fontSize: 20, letterSpacing: "0.1em", color: EMERALD }}
                >
                  Live
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="font-extrabold" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {format(now, "HH.mm")}
                </div>
                <div style={{ fontSize: 18, color: LIGHT_DIM, marginTop: 6 }}>
                  {format(now, "d. MMMM", { locale: da })}
                </div>
              </div>
            </>
          ) : (
            rightContent
          )}
        </div>
      </header>

      <section
        className={tvMode ? "relative grid gap-4" : "relative grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"}
        style={tvMode ? { gridTemplateColumns: kpiCols } : undefined}
      >
        {primaryKpis.map((kpi, i) => (
          <CphKpiCard key={kpi.label} kpi={kpi} emphasis={i === 0} tvMode={tvMode} />
        ))}
      </section>

      {secondaryKpis && secondaryKpis.length > 0 && (
        <section
          className={tvMode ? "relative grid grid-cols-3 gap-4" : "relative grid grid-cols-1 gap-3 md:grid-cols-3"}
        >
          {secondaryKpis.map((kpi) => (
            <CphSecondaryKpi key={kpi.label} kpi={kpi} tvMode={tvMode} />
          ))}
        </section>
      )}

      <section
        className={
          tvMode
            ? "relative grid min-h-0 flex-1 grid-cols-3 gap-4"
            : "relative grid grid-cols-1 gap-4 lg:grid-cols-3"
        }
      >
        {children}
      </section>
    </div>
  );
}
