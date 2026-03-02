import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/calculations";

const formatCurrency = formatNumber;

const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// ==================== TV KPI CARD ====================

interface TvKpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  tvMode: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  /** Extra content after the value (e.g. switch count) */
  suffix?: React.ReactNode;
  /** Card className override for non-TV mode */
  className?: string;
}

export function TvKpiCard({ label, value, sub, tvMode, icon: Icon, suffix, className }: TvKpiCardProps) {
  return (
    <Card className={tvMode 
      ? 'border border-border/[0.14] shadow-2xl bg-card' 
      : className || ''
    }>
      <CardHeader className={tvMode 
        ? 'flex flex-row items-center justify-between space-y-0 pb-0 pt-4 px-5' 
        : 'flex flex-row items-center justify-between space-y-0 pb-2'
      }>
        <CardTitle className={tvMode 
          ? 'text-[24px] font-semibold text-muted-foreground' 
          : 'text-sm font-medium'
        }>{label}</CardTitle>
        {!tvMode && Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className={tvMode ? 'px-5 pb-4' : ''}>
        <div className={tvMode 
          ? 'text-[90px] leading-none font-extrabold text-primary' 
          : 'text-3xl font-bold text-primary'
        } style={tvMode ? { fontVariantNumeric: 'tabular-nums' } : undefined}>
          {value}
          {!tvMode && suffix}
        </div>
        <p className={tvMode 
          ? 'text-[17px] text-muted-foreground mt-2' 
          : 'text-xs text-muted-foreground mt-1'
        }>{sub}</p>
      </CardContent>
    </Card>
  );
}

// ==================== TV LEADERBOARD TABLE ====================

export interface LeaderboardSeller {
  id: string;
  name: string;
  displayName: string;
  avatarUrl?: string | null;
  salesCount: number;
  commission: number;
  crossSales?: number;
}

interface TvLeaderboardTableProps {
  title: string;
  sellers: LeaderboardSeller[];
  isLoading: boolean;
  tvMode: boolean;
  showCrossSales?: boolean;
  crossSalesLabel?: string;
  maxRows?: number;
}

export function TvLeaderboardTable({ 
  title, 
  sellers, 
  isLoading, 
  tvMode,
  showCrossSales = false,
  crossSalesLabel = "Switch",
  maxRows,
}: TvLeaderboardTableProps) {
  const displaySellers = maxRows ? sellers.slice(0, maxRows) : sellers;

  return (
    <Card className={tvMode 
      ? 'flex flex-col overflow-hidden border border-border/[0.14] shadow-2xl bg-card' 
      : ''
    }>
      <CardHeader className={tvMode ? 'pb-2 pt-4 px-4' : 'pb-3'}>
        <CardTitle className={tvMode 
          ? 'text-[26px] font-bold tracking-wide text-center uppercase text-foreground' 
          : 'text-center text-lg font-bold uppercase tracking-wider'
        }>{title}</CardTitle>
      </CardHeader>
      <CardContent className={tvMode ? 'flex-1 overflow-hidden p-0' : 'p-0 max-h-[600px] overflow-y-auto'}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">Indlæser...</span>
          </div>
        ) : displaySellers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">Ingen salg endnu</span>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className={tvMode ? 'border-b-2 border-border/70' : 'border-b border-border/50'}>
                  <TableHead className={tvMode ? 'w-[40px] text-center text-[18px] font-bold py-3 text-foreground/80' : 'w-10'}></TableHead>
                  <TableHead className={tvMode ? 'text-[18px] font-bold py-3 text-foreground/80' : ''}>Navn</TableHead>
                  <TableHead className={tvMode ? 'text-right text-[18px] font-bold py-3 w-[90px] text-foreground/80' : 'text-right'}>Salg</TableHead>
                  {showCrossSales && (
                    <TableHead className={tvMode ? 'text-right text-[18px] font-bold py-3 w-[90px] text-foreground/80' : 'text-right'}>{crossSalesLabel}</TableHead>
                  )}
                  <TableHead className={tvMode ? 'text-right text-[18px] font-bold py-3 w-[140px] text-foreground/80' : 'text-right'}>Provision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displaySellers.map((seller, index) => (
                  <TableRow 
                    key={seller.id} 
                    className={tvMode 
                      ? `border-b border-border/25 ${index % 2 === 1 ? 'bg-muted/40' : ''}` 
                      : 'border-b border-border/30'
                    }
                  >
                    <TableCell className={tvMode 
                      ? 'text-center text-muted-foreground font-bold text-[20px] py-[12px] tabular-nums w-[40px]' 
                      : 'py-2 text-center text-muted-foreground font-medium'
                    }>{index + 1}</TableCell>
                    <TableCell className={tvMode ? 'py-[12px]' : 'py-2'}>
                      <div className="flex items-center gap-2">
                        <Avatar className={tvMode ? 'h-8 w-8 flex-shrink-0' : 'h-8 w-8'}>
                          <AvatarImage src={seller.avatarUrl || undefined} alt={seller.name} />
                          <AvatarFallback className={tvMode 
                            ? 'text-[12px] bg-primary/20 font-semibold' 
                            : 'text-xs bg-primary/20'
                          }>{getInitials(seller.name)}</AvatarFallback>
                        </Avatar>
                        <span className={tvMode 
                          ? 'font-semibold text-[20px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] block' 
                          : 'font-medium text-sm'
                        }>{seller.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className={tvMode 
                      ? 'text-right py-[12px] text-primary font-bold text-[22px] tabular-nums w-[90px]' 
                      : 'text-right py-2 text-primary font-semibold'
                    }>{seller.salesCount}</TableCell>
                    {showCrossSales && (
                      <TableCell className={tvMode 
                        ? 'text-right py-[12px] text-primary font-bold text-[22px] tabular-nums w-[90px]' 
                        : 'text-right py-2 text-primary font-semibold'
                      }>{seller.crossSales || 0}</TableCell>
                    )}
                    <TableCell className={tvMode 
                      ? 'text-right py-[12px] font-semibold text-[20px] text-foreground tabular-nums w-[140px]' 
                      : 'text-right py-2'
                    }>
                      {tvMode ? (
                        formatCurrency(seller.commission)
                      ) : (
                        <span className="inline-block px-2 py-1 rounded text-sm font-semibold bg-primary/10 text-primary">{formatCurrency(seller.commission)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tvMode && maxRows && displaySellers.length < maxRows && displaySellers.length > 0 && (
              <p className="text-center text-muted-foreground/60 text-[14px] py-2">
                Kun {displaySellers.length} registrering{displaySellers.length !== 1 ? 'er' : ''} i denne periode
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
