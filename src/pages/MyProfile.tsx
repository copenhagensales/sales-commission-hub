import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { User, MapPin, Briefcase, Wallet, Palmtree, Car, Clock, FileText, CalendarX, Thermometer, AlertTriangle, AlarmClock, Pencil, Save, X, Check, Phone, Mail, Shield, History, ChevronDown, Star, TrendingUp, TrendingDown, Target } from "lucide-react";
import { GdprSettingsCard } from "@/components/gdpr/GdprSettingsCard";
import { GdprConsentDialog } from "@/components/gdpr/GdprConsentDialog";
import { useHasDataProcessingConsent } from "@/hooks/useGdpr";
import { EmployeeCalendar } from "@/components/employee/EmployeeCalendar";
import { Progress } from "@/components/ui/progress";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { SalesGoalTracker } from "@/components/my-profile/SalesGoalTracker";

// Read-only display field
function DisplayField({ value, displayValue }: { value: string | number | null | undefined; displayValue?: string | null }) {
  return (
    <div className="py-2 px-3 bg-muted/30 rounded-md min-h-[40px] flex items-center">
      <span className="font-medium">{displayValue ?? value ?? "-"}</span>
    </div>
  );
}

// Masked read-only field for sensitive data
function MaskedDisplayField({ value }: { value: string | null }) {
  return (
    <div className="py-2 px-3 bg-muted/30 rounded-md min-h-[40px] flex items-center">
      <span className="font-medium">{value ? "••••••••" : "-"}</span>
    </div>
  );
}

// Editable field for contact info
function EditableContactField({ 
  value, 
  onSave, 
  type = "text",
  placeholder 
}: { 
  value: string | null; 
  onSave: (value: string | null) => void;
  type?: "text" | "tel" | "email";
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onSave(editValue || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9 flex-1"
          placeholder={placeholder}
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSave}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCancel}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  const Icon = type === "tel" ? Phone : type === "email" ? Mail : null;

  return (
    <div 
      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group min-h-[40px]"
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center gap-2">
        {Icon && value && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="font-medium">{value || "-"}</span>
      </div>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default function MyProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [absencePeriod, setAbsencePeriod] = useState<"2" | "6" | "12">("2");
  const { hasConsent, isLoading: consentLoading } = useHasDataProcessingConsent();
  const { isPreviewMode, previewEmployee } = useRolePreview();

  // Fetch current user's employee data (or preview employee if in preview mode)
  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-profile", isPreviewMode, previewEmployee?.id],
    queryFn: async () => {
      // If in preview mode, fetch the preview employee's data
      if (isPreviewMode && previewEmployee?.id) {
        const { data, error } = await supabase
          .from("employee_master_data")
          .select("*")
          .eq("id", previewEmployee.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        
        // Fetch team names for this employee
        const { data: teamMemberships } = await supabase
          .from("team_members")
          .select("team:teams(name)")
          .eq("employee_id", data.id);
        
        const teamNames = (teamMemberships || [])
          .map((tm: { team: { name: string } | null }) => tm.team?.name)
          .filter(Boolean)
          .join(", ");
        
        return {
          ...data,
          department: teamNames || data.department,
        };
      }

      // Normal flow: fetch current user's data
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const lowerEmail = userData.user.email?.toLowerCase() || '';
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      
      // Fetch team names for this employee
      const { data: teamMemberships } = await supabase
        .from("team_members")
        .select("team:teams(name)")
        .eq("employee_id", data.id);
      
      const teamNames = (teamMemberships || [])
        .map((tm: { team: { name: string } | null }) => tm.team?.name)
        .filter(Boolean)
        .join(", ");
      
      return {
        ...data,
        department: teamNames || data.department,
      };
    },
  });

  // Find corresponding vagt-flow employee by email
  const { data: vagtFlowEmployee } = useQuery({
    queryKey: ["my-vagt-flow-employee", employee?.private_email, employee?.work_email],
    queryFn: async () => {
      if (!employee?.private_email && !employee?.work_email) return null;
      const emails = [employee.private_email, employee.work_email].filter(Boolean);
      const { data, error } = await supabase
        .from("employee")
        .select("id")
        .in("email", emails)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!(employee?.private_email || employee?.work_email),
  });

  // Fetch absence history from absence_request_v2 (employee-initiated)
  const { data: absencesV2 = [] } = useQuery({
    queryKey: ["my-absences-v2", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("status", "approved")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch absence history from employee_absence (manager-initiated via vagt-flow)
  const { data: absencesVagtFlow = [] } = useQuery({
    queryKey: ["my-absences-vagtflow", vagtFlowEmployee?.id],
    queryFn: async () => {
      if (!vagtFlowEmployee?.id) return [];
      const { data, error } = await supabase
        .from("employee_absence")
        .select("*")
        .eq("employee_id", vagtFlowEmployee.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vagtFlowEmployee?.id,
  });

  // Combine absences from both sources and normalize format
  const absences = useMemo(() => {
    const normalized: Array<{
      id: string;
      type: "sick" | "vacation";
      start_date: string;
      end_date: string;
      source: "request" | "vagtflow";
    }> = [];

    // Add absences from absence_request_v2
    absencesV2.forEach(a => {
      normalized.push({
        id: a.id,
        type: a.type as "sick" | "vacation",
        start_date: a.start_date,
        end_date: a.end_date,
        source: "request",
      });
    });

    // Add absences from employee_absence (map reason to type)
    absencesVagtFlow.forEach(a => {
      const type = a.reason === "Ferie" ? "vacation" : "sick";
      normalized.push({
        id: a.id,
        type,
        start_date: a.start_date,
        end_date: a.end_date,
        source: "vagtflow",
      });
    });

    // Sort by start_date descending
    return normalized.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
  }, [absencesV2, absencesVagtFlow]);

  // Fetch lateness records
  const { data: latenessRecords = [] } = useQuery({
    queryKey: ["my-lateness", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("lateness_record")
        .select("*")
        .eq("employee_id", employee.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch my contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["my-contracts-profile", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*, contract_signatures(*)")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch shift history (time_stamps)
  const { data: timeStamps = [] } = useQuery({
    queryKey: ["my-time-stamps", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", employee.id)
        .order("clock_in", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch booking assignments (fieldmarketing shifts)
  const { data: bookingAssignments = [] } = useQuery({
    queryKey: ["my-booking-assignments", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("booking_assignment")
        .select(`
          *,
          booking:booking_id (
            location:location_id (name),
            brand:brand_id (name, color_hex)
          )
        `)
        .eq("employee_id", employee.id)
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });


  // Fetch Danish holidays for payroll calculations
  const { data: danishHolidays = [] } = useQuery({
    queryKey: ["danish-holidays"],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("danish_holiday")
        .select("date, name")
        .gte("year", currentYear - 1)
        .lte("year", currentYear + 1);
      if (error) throw error;
      return data;
    },
  });

  // Create a Set of holiday dates for quick lookup
  const holidayDates = useMemo(() => {
    return new Set(danishHolidays.map(h => h.date));
  }, [danishHolidays]);

  // Deduplicate time stamps - keep only the most recent entry per date (manager edits take priority)
  const deduplicatedTimeStamps = useMemo(() => {
    const byDate = new Map<string, typeof timeStamps[0]>();
    // Sort by updated_at desc so we pick the latest edit first
    const sorted = [...timeStamps].sort((a, b) => 
      new Date(b.updated_at || b.clock_in).getTime() - new Date(a.updated_at || a.clock_in).getTime()
    );
    sorted.forEach(stamp => {
      const dateKey = stamp.clock_in.split('T')[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, stamp);
      }
    });
    return Array.from(byDate.values()).sort((a, b) => 
      new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()
    );
  }, [timeStamps]);

  // Generate expected work schedule for current month - using actual time stamps when available
  const { expectedSchedule, weekendSchedule } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dailyHours = (employee?.weekly_hours || 37) / 5; // 5 working days
    const defaultStartTime = employee?.standard_start_time || "09:00";
    
    // Create a map of actual time stamps by date for quick lookup
    const timeStampsByDate = new Map<string, typeof deduplicatedTimeStamps[0]>();
    deduplicatedTimeStamps.forEach(stamp => {
      const dateKey = stamp.clock_in.split('T')[0];
      timeStampsByDate.set(dateKey, stamp);
    });
    
    // Create a map of holidays for quick lookup
    const holidaysByDate = new Map<string, string>();
    danishHolidays.forEach(h => {
      holidaysByDate.set(h.date, h.name);
    });
    
    type ScheduleEntry = {
      date: string;
      status: "work" | "vacation" | "sick" | "holiday";
      hours: number;
      startTime: string;
      endTime: string;
      hasActualStamp: boolean;
      isWeekend?: boolean;
      holidayName?: string;
    };
    
    const schedule: ScheduleEntry[] = [];
    const weekends: ScheduleEntry[] = [];
    
    // Generate all days in the month
    const current = new Date(monthStart);
    while (current <= monthEnd && current <= now) {
      const dayOfWeek = current.getDay();
      // Use local date format to avoid timezone issues
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const holidayName = holidaysByDate.get(dateStr);
      
      // Check for actual time stamp on this date
      const actualStamp = timeStampsByDate.get(dateStr);
      
      if (isWeekend) {
        // Only add weekend days if there's an actual stamp
        if (actualStamp) {
          const clockIn = new Date(actualStamp.clock_in);
          const clockOut = actualStamp.clock_out ? new Date(actualStamp.clock_out) : null;
          const actualStartTime = clockIn.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
          const actualEndTime = clockOut ? clockOut.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : null;
          
          let actualHours = 0;
          if (clockOut) {
            actualHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          }
          
          weekends.push({
            date: dateStr,
            status: "work",
            hours: actualHours,
            startTime: actualStartTime,
            endTime: actualEndTime || "",
            hasActualStamp: true,
            isWeekend: true,
          });
        }
      } else {
        // Weekday logic - check for holiday first
        if (holidayName) {
          // Holiday - count as paid day off (full hours credit for fixed salary)
          schedule.push({
            date: dateStr,
            status: "holiday",
            hours: dailyHours, // Holidays give full pay
            startTime: "",
            endTime: "",
            hasActualStamp: false,
            holidayName,
          });
        } else {
          // Check for absence
          const absence = absences.find(a => {
            const start = new Date(a.start_date);
            const end = new Date(a.end_date);
            return current >= start && current <= end;
          });
          
          if (absence) {
            schedule.push({
              date: dateStr,
              status: absence.type === "vacation" ? "vacation" : "sick",
              hours: 0,
              startTime: "",
              endTime: "",
              hasActualStamp: false,
            });
          } else if (actualStamp) {
            const clockIn = new Date(actualStamp.clock_in);
            const clockOut = actualStamp.clock_out ? new Date(actualStamp.clock_out) : null;
            const actualStartTime = clockIn.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
            const actualEndTime = clockOut ? clockOut.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : null;
            
            let actualHours = dailyHours;
            if (clockOut) {
              actualHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
            }
            
            schedule.push({
              date: dateStr,
              status: "work",
              hours: actualHours,
              startTime: actualStartTime,
              endTime: actualEndTime || "",
              hasActualStamp: true,
            });
          } else {
            schedule.push({
              date: dateStr,
              status: "work",
              hours: dailyHours,
              startTime: defaultStartTime,
              endTime: "",
              hasActualStamp: false,
            });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }
    
    return {
      expectedSchedule: schedule.reverse(),
      weekendSchedule: weekends.reverse(),
    };
  }, [employee?.weekly_hours, employee?.standard_start_time, absences, deduplicatedTimeStamps, danishHolidays]);
  
  const [showWeekends, setShowWeekends] = useState(false);

  // Calculate payroll period (15th to 14th)
  // Holidays count as paid days (not deducted from workdays)
  const payrollPeriod = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    let periodStart: Date;
    let periodEnd: Date;
    
    if (currentDay >= 15) {
      // We're in the period from 15th of current month to 14th of next month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 15);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 14);
    } else {
      // We're in the period from 15th of previous month to 14th of current month
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 14);
    }
    
    // Helper to format date as YYYY-MM-DD for holiday lookup
    const formatDateKey = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Calculate workdays in period (excluding weekends, but including holidays as paid days)
    const countWorkdays = (start: Date, end: Date) => {
      let count = 0;
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        // Count weekdays (mon-fri) - holidays on weekdays still count as paid days
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count;
    };
    
    // Calculate workdays passed so far in period (including holidays as paid)
    const countWorkdaysPassed = (start: Date, upTo: Date) => {
      let count = 0;
      const current = new Date(start);
      const endDate = upTo < periodEnd ? upTo : periodEnd;
      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        // Weekdays count as worked/paid (including holidays)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count;
    };
    
    const totalWorkdays = countWorkdays(periodStart, periodEnd);
    const workdaysPassed = countWorkdaysPassed(periodStart, now);
    
    return {
      start: periodStart,
      end: periodEnd,
      totalWorkdays,
      workdaysPassed,
    };
  }, []);

  // Fetch commission/provision stats for provision-based employees
  // Uses payroll period (15th-14th) instead of calendar month
  // Also fetches daily commission breakdown for the monthly overview
  const { data: commissionStats } = useQuery({
    queryKey: ["my-commission-stats", employee?.id, employee?.salary_type, payrollPeriod.start.toISOString()],
    queryFn: async () => {
      if (!employee?.id) return null;
      
      const now = new Date();
      // Use payroll period dates (15th-14th)
      const periodStart = payrollPeriod.start.toISOString();
      const periodEnd = payrollPeriod.end.toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      
      // For monthly overview: get current month range
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      
      let periodCommission = 0;
      let todayCommission = 0;
      let periodSalesCount = 0;
      let todaySalesCount = 0;
      
      // Map to store daily commission: date string -> commission amount
      const dailyCommissionMap = new Map<string, number>();

      // Check for agent mappings (for dialer-based sales)
      const { data: mappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id, agents(name)")
        .eq("employee_id", employee.id);
      
      if (mappings && mappings.length > 0) {
        const agentNames = mappings.map(m => (m.agents as { name: string } | null)?.name).filter(Boolean);
        
        if (agentNames.length > 0) {
          // Fetch period sales for this employee's agents
          const { data: periodSales } = await supabase
            .from("sales")
            .select(`
              id,
              sale_datetime,
              sale_items (
                id,
                mapped_commission
              )
            `)
            .in("agent_name", agentNames)
            .gte("sale_datetime", periodStart)
            .lte("sale_datetime", periodEnd);
          
          // Fetch this month's sales for daily breakdown
          const { data: monthSales } = await supabase
            .from("sales")
            .select(`
              id,
              sale_datetime,
              sale_items (
                id,
                mapped_commission
              )
            `)
            .in("agent_name", agentNames)
            .gte("sale_datetime", monthStart)
            .lte("sale_datetime", monthEnd);
          
          // Fetch today's sales
          const { data: todaySales } = await supabase
            .from("sales")
            .select(`
              id,
              sale_items (
                id,
                mapped_commission
              )
            `)
            .in("agent_name", agentNames)
            .gte("sale_datetime", todayStart)
            .lte("sale_datetime", todayEnd);
          
          // Calculate totals (mapped_commission is already pre-multiplied by quantity)
          periodCommission += periodSales?.reduce((total, sale) => {
            return total + (sale.sale_items?.reduce((sum, item) => {
              return sum + (item.mapped_commission || 0);
            }, 0) || 0);
          }, 0) || 0;
          
          todayCommission += todaySales?.reduce((total, sale) => {
            return total + (sale.sale_items?.reduce((sum, item) => {
              return sum + (item.mapped_commission || 0);
            }, 0) || 0);
          }, 0) || 0;
          
          periodSalesCount += periodSales?.length || 0;
          todaySalesCount += todaySales?.length || 0;
          
          // Build daily commission map for this month
          monthSales?.forEach(sale => {
            const dateKey = sale.sale_datetime.split('T')[0];
            const saleCommission = sale.sale_items?.reduce((sum, item) => sum + (item.mapped_commission || 0), 0) || 0;
            dailyCommissionMap.set(dateKey, (dailyCommissionMap.get(dateKey) || 0) + saleCommission);
          });
        }
      }

      // Also check fieldmarketing_sales (for fieldmarketing employees)
      const { data: fmPeriodSales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name, registered_at")
        .eq("seller_id", employee.id)
        .gte("registered_at", periodStart)
        .lte("registered_at", periodEnd);
      
      const { data: fmMonthSales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name, registered_at")
        .eq("seller_id", employee.id)
        .gte("registered_at", monthStart)
        .lte("registered_at", monthEnd);
      
      const { data: fmTodaySales } = await supabase
        .from("fieldmarketing_sales")
        .select("id, product_name")
        .eq("seller_id", employee.id)
        .gte("registered_at", todayStart)
        .lte("registered_at", todayEnd);
      
      // Fetch products to get commission values for fieldmarketing sales
      const allFmSales = [...(fmPeriodSales || []), ...(fmMonthSales || []), ...(fmTodaySales || [])];
      if (allFmSales.length > 0) {
        const allProductNames = allFmSales.map(s => s.product_name).filter(Boolean);
        const uniqueProductNames = [...new Set(allProductNames)];
        
        if (uniqueProductNames.length > 0) {
          const { data: products } = await supabase
            .from("products")
            .select("name, commission_dkk")
            .in("name", uniqueProductNames);
          
          const productCommissionMap = new Map(
            (products || []).map(p => [p.name, p.commission_dkk || 0])
          );
          
          // Add fieldmarketing commission for period
          periodCommission += fmPeriodSales?.reduce((total, sale) => {
            return total + (productCommissionMap.get(sale.product_name) || 0);
          }, 0) || 0;
          
          // Add fieldmarketing commission for today
          todayCommission += fmTodaySales?.reduce((total, sale) => {
            return total + (productCommissionMap.get(sale.product_name) || 0);
          }, 0) || 0;
          
          // Build daily commission map for fieldmarketing this month
          fmMonthSales?.forEach(sale => {
            const dateKey = sale.registered_at.split('T')[0];
            const saleCommission = productCommissionMap.get(sale.product_name) || 0;
            dailyCommissionMap.set(dateKey, (dailyCommissionMap.get(dateKey) || 0) + saleCommission);
          });
        }
      }
      
      periodSalesCount += fmPeriodSales?.length || 0;
      todaySalesCount += fmTodaySales?.length || 0;

      // Calculate vacation pay (12.5% of earned commission)
      const vacationPayRate = 0.125;
      const earnedVacationPay = periodCommission * vacationPayRate;

      return {
        periodCommission,
        todayCommission,
        periodSalesCount,
        todaySalesCount,
        earnedVacationPay,
        dailyCommission: Object.fromEntries(dailyCommissionMap),
        hasData: periodCommission > 0 || periodSalesCount > 0 || todaySalesCount > 0
      };
    },
    enabled: !!employee?.id && employee?.salary_type === 'provision',
  });

  // Calculate shift statistics using payroll period (15th-14th)
  const shiftStats = useMemo(() => {
    const salaryType = employee?.salary_type;
    const salaryAmount = employee?.salary_amount || 0;
    const isFixedSalary = salaryType === 'fixed';
    const weeklyHours = employee?.weekly_hours || 37;
    const dailyExpectedHours = weeklyHours / 5;
    
    const now = new Date();
    
    // Filter time stamps and booking assignments within payroll period
    const periodTimeStamps = deduplicatedTimeStamps.filter(stamp => {
      const stampDate = new Date(stamp.clock_in);
      return stampDate >= payrollPeriod.start && stampDate <= payrollPeriod.end;
    });
    
    const periodBookings = bookingAssignments.filter(b => {
      const bookingDate = new Date(b.date);
      return bookingDate >= payrollPeriod.start && bookingDate <= payrollPeriod.end;
    });
    
    // Calculate actual hours from time stamps
    const actualStampHours = periodTimeStamps.reduce((sum, stamp) => {
      if (stamp.clock_in && stamp.clock_out) {
        const clockIn = new Date(stamp.clock_in);
        const clockOut = new Date(stamp.clock_out);
        const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);
    
    // Calculate actual hours from bookings
    const actualBookingHours = periodBookings.reduce((sum, b) => {
      const start = new Date(`1970-01-01T${b.start_time}`);
      const end = new Date(`1970-01-01T${b.end_time}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    
    const totalActualHours = actualStampHours + actualBookingHours;
    const totalActualShifts = periodTimeStamps.length + periodBookings.length;
    
    // Calculate expected hours and shifts to date
    const expectedHoursToDate = payrollPeriod.workdaysPassed * dailyExpectedHours;
    const expectedShiftsToDate = payrollPeriod.workdaysPassed;
    
    // Calculate expected for full period
    const expectedHoursTotal = payrollPeriod.totalWorkdays * dailyExpectedHours;
    const expectedShiftsTotal = payrollPeriod.totalWorkdays;
    
    // Calculate percentage and difference
    const hoursPercentage = expectedHoursToDate > 0 ? (totalActualHours / expectedHoursToDate) * 100 : 100;
    const shiftsPercentage = expectedShiftsToDate > 0 ? (totalActualShifts / expectedShiftsToDate) * 100 : 100;
    const hoursDifference = totalActualHours - expectedHoursToDate;
    const shiftsDifference = totalActualShifts - expectedShiftsToDate;
    
    // For fixed salary: show monthly salary, not calculated from hours
    // For hourly: calculate based on hours worked
    const hourlyRate = isFixedSalary ? 0 : salaryAmount;
    
    // Calculate earned salary in current payroll period (for fixed salary)
    const earnedInPeriod = isFixedSalary && payrollPeriod.totalWorkdays > 0
      ? (payrollPeriod.workdaysPassed / payrollPeriod.totalWorkdays) * salaryAmount
      : 0;
    
    // Calculate vacation pay (12.5% of earned salary)
    const vacationPayRate = 0.125;
    const earnedVacationPay = earnedInPeriod * vacationPayRate;
    
    return {
      // Payroll period stats
      actualHours: totalActualHours,
      actualShifts: totalActualShifts,
      expectedHoursToDate,
      expectedShiftsToDate,
      expectedHoursTotal,
      expectedShiftsTotal,
      hoursPercentage,
      shiftsPercentage,
      hoursDifference,
      shiftsDifference,
      // Legacy (calendar month) - keep for compatibility
      stampCount: periodTimeStamps.length,
      stampHours: actualStampHours,
      bookingCount: periodBookings.length,
      bookingHours: actualBookingHours,
      // Financial
      hourlyRate,
      isFixedSalary,
      earnedInPeriod,
      earnedVacationPay,
    };
  }, [deduplicatedTimeStamps, bookingAssignments, employee?.salary_amount, employee?.salary_type, employee?.weekly_hours, payrollPeriod]);

  // Calculate absence statistics
  const absenceStats = useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(absencePeriod);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    
    const periodAbsences = absences.filter(a => {
      const date = new Date(a.start_date);
      return date >= periodStart && date <= now;
    });
    
    // Helper to format date as YYYY-MM-DD for holiday lookup
    const formatDateKey = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Count only weekdays (excluding weekends AND holidays)
    const countDays = (absenceList: typeof absences, type: string) => {
      return absenceList.filter(a => a.type === type).reduce((sum, a) => {
        const start = new Date(a.start_date);
        const end = new Date(a.end_date);
        let workdays = 0;
        const current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay();
          const dateKey = formatDateKey(current);
          // Only count if it's a weekday AND not a holiday
          if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateKey)) {
            workdays++;
          }
          current.setDate(current.getDate() + 1);
        }
        return sum + workdays;
      }, 0);
    };
    
    const countOccurrences = (absenceList: typeof absences, type: string) => {
      return absenceList.filter(a => a.type === type).length;
    };
    
    const workingDaysInPeriod = parseInt(absencePeriod) * 21.5;
    const sickDaysInPeriod = countDays(periodAbsences, "sick");
    const vacationDaysInPeriod = countDays(periodAbsences, "vacation");
    const sickOccurrencesInPeriod = countOccurrences(periodAbsences, "sick");
    const sickPercentInPeriod = (sickDaysInPeriod / workingDaysInPeriod) * 100;
    
    const sickAbsences = periodAbsences.filter(a => a.type === "sick").sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    
    return {
      sickDaysInPeriod,
      vacationDaysInPeriod,
      sickOccurrencesInPeriod,
      sickPercentInPeriod,
      sickAbsences,
    };
  }, [absences, absencePeriod, holidayDates]);

  // Calculate lateness statistics
  const latenessStats = useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(absencePeriod);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    
    const periodLateness = latenessRecords.filter(l => {
      const date = new Date(l.date);
      return date >= periodStart && date <= now;
    });
    
    const totalMinutesInPeriod = periodLateness.reduce((sum, l) => sum + l.minutes, 0);
    
    return {
      countInPeriod: periodLateness.length,
      totalMinutesInPeriod,
      records: periodLateness.slice(0, 15),
    };
  }, [latenessRecords, absencePeriod]);

  const handleSaveContact = async (field: string, value: string | null) => {
    if (!employee?.id) return;
    try {
      const { error } = await supabase
        .from("employee_master_data")
        .update({ [field]: value })
        .eq("id", employee.id);
      
      if (error) throw error;
      
      toast.success("Oplysninger opdateret");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Kunne ikke gemme ændringer");
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "d. MMMM yyyy", { locale: da });
  };

  const getSalaryTypeLabel = (type: string | null) => {
    switch (type) {
      case "provision": return "Provision";
      case "fixed": return "Fast løn";
      case "hourly": return "Timeløn";
      default: return null;
    }
  };

  const getVacationTypeLabel = (type: string | null) => {
    switch (type) {
      case "vacation_pay": return "Ferieløn";
      case "vacation_bonus": return "Feriebonus";
      default: return null;
    }
  };

  const getContractStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Kladde", variant: "secondary" },
      pending_employee: { label: "Afventer underskrift", variant: "destructive" },
      pending_manager: { label: "Afventer godkendelse", variant: "secondary" },
      signed: { label: "Underskrevet", variant: "default" },
      rejected: { label: "Afvist", variant: "destructive" },
      expired: { label: "Udløbet", variant: "secondary" },
    };
    const { label, variant } = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Wait for BOTH employee AND consent status to be fully loaded before rendering anything
  if (isLoading || consentLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </MainLayout>
    );
  }

  // Calculate if consent is needed - only after all data is loaded
  const needsConsent = !!employee && !hasConsent;

  if (!employee) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Din bruger er ikke tilknyttet en medarbejderprofil.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* GDPR Consent Dialog */}
      <GdprConsentDialog 
        open={needsConsent} 
        onConsent={() => queryClient.invalidateQueries({ queryKey: ["gdpr-consents"] })} 
      />

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Min profil</h1>
          <p className="text-muted-foreground">
            {employee.first_name} {employee.last_name} {employee.job_title && `· ${employee.job_title}`}
          </p>
        </div>

        <Tabs defaultValue="stamdata" className="w-full">
          <TabsList>
            <TabsTrigger value="stamdata">Stamdata</TabsTrigger>
            <TabsTrigger value="kontrakter">
              <FileText className="h-4 w-4 mr-2" />
              Kontrakter
            </TabsTrigger>
            <TabsTrigger value="vagthistorik">
              <History className="h-4 w-4 mr-2" />
              Vagthistorik
            </TabsTrigger>
            <TabsTrigger value="fravaer">
              <CalendarX className="h-4 w-4 mr-2" />
              Fravær
            </TabsTrigger>
            <TabsTrigger value="gdpr">
              <Shield className="h-4 w-4 mr-2" />
              GDPR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stamdata" className="mt-6">
            <div className="space-y-6">
              {/* Personal Information - Combined Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personlige oplysninger</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Left Column - Identity & Contact */}
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Identitet</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Fornavn(e)</label>
                            <DisplayField value={employee.first_name} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Efternavn</label>
                            <DisplayField value={employee.last_name} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">CPR-nr.</label>
                          <MaskedDisplayField value={employee.cpr_number} />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Kontakt</h4>
                        <div>
                          <label className="text-xs text-muted-foreground">Telefon (kan redigeres)</label>
                          <EditableContactField 
                            value={employee.private_phone} 
                            type="tel"
                            placeholder="Telefonnummer"
                            onSave={(v) => handleSaveContact("private_phone", v)} 
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Privat email</label>
                          <DisplayField value={employee.private_email} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Arbejdsemail</label>
                          <DisplayField value={employee.work_email} />
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Address (Editable) */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Adresse (kan redigeres)</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Vejnavn og nr.</label>
                        <EditableContactField 
                          value={employee.address_street} 
                          placeholder="Vejnavn og husnummer"
                          onSave={(v) => handleSaveContact("address_street", v)} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Postnummer</label>
                          <EditableContactField 
                            value={employee.address_postal_code} 
                            placeholder="Postnummer"
                            onSave={(v) => handleSaveContact("address_postal_code", v)} 
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">By</label>
                          <EditableContactField 
                            value={employee.address_city} 
                            placeholder="By"
                            onSave={(v) => handleSaveContact("address_city", v)} 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Land</label>
                        <EditableContactField 
                          value={employee.address_country || "Danmark"} 
                          placeholder="Land"
                          onSave={(v) => handleSaveContact("address_country", v)} 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Employment Information - Combined Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ansættelsesforhold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Employment Details */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Stilling</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Jobtitel</label>
                        <DisplayField value={employee.job_title} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Afdeling / Team</label>
                        <DisplayField value={employee.department} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Arbejdssted</label>
                        <DisplayField value={employee.work_location} />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Datoer</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Ansættelsesdato</label>
                        <DisplayField value={employee.employment_start_date} displayValue={formatDate(employee.employment_start_date)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Slutdato</label>
                        <DisplayField value={employee.employment_end_date} displayValue={formatDate(employee.employment_end_date)} />
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Arbejdstid</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Timer pr. uge</label>
                        <DisplayField value={employee.weekly_hours || 37} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Mødetid</label>
                        <DisplayField value={employee.standard_start_time} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Salary & Benefits - Combined Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Løn & Goder</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Salary */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Løn</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Løntype</label>
                        <DisplayField value={employee.salary_type} displayValue={getSalaryTypeLabel(employee.salary_type)} />
                      </div>
                      {employee.salary_amount && (
                        <div>
                          <label className="text-xs text-muted-foreground">
                            {employee.salary_type === 'fixed' ? 'Månedsløn' : 'Timesats'}
                          </label>
                          <DisplayField 
                            value={employee.salary_amount} 
                            displayValue={`${employee.salary_amount.toLocaleString('da-DK')} kr${employee.salary_type === 'fixed' ? '/måned' : '/time'}`} 
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-muted-foreground">Reg.nr.</label>
                        <MaskedDisplayField value={employee.bank_reg_number} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Kontonummer</label>
                        <MaskedDisplayField value={employee.bank_account_number} />
                      </div>
                    </div>

                    {/* Vacation */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Ferie</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Ferietype</label>
                        <DisplayField value={employee.vacation_type} displayValue={getVacationTypeLabel(employee.vacation_type)} />
                      </div>
                    </div>

                    {/* Parking */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Parkering</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Parkeringsplads</label>
                        <DisplayField value={employee.has_parking ? "Ja" : "Nej"} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="kontrakter" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Mine kontrakter</CardTitle>
              </CardHeader>
              <CardContent>
                {contracts.length > 0 ? (
                  <div className="space-y-3">
                    {contracts.map((contract) => (
                      <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium">{contract.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(contract.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {getContractStatusBadge(contract.status || "draft")}
                          {contract.status === "pending_employee" && (
                            <Button size="sm" onClick={() => navigate(`/contract/${contract.id}`)}>
                              Underskriv
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Ingen kontrakter</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fravaer" className="mt-6 space-y-6">
            {/* Period selector */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Vis periode:</span>
              <Select value={absencePeriod} onValueChange={(v) => setAbsencePeriod(v as "2" | "6" | "12")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 måneder</SelectItem>
                  <SelectItem value="6">6 måneder</SelectItem>
                  <SelectItem value="12">12 måneder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Sygefravær</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dit fravær</span>
                      <span className="font-medium">{absenceStats.sickPercentInPeriod.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(absenceStats.sickPercentInPeriod, 10) * 10} 
                      className={absenceStats.sickPercentInPeriod > 3.5 ? "h-3 [&>div]:bg-red-500" : "h-2"} 
                    />
                    <p className="text-xs text-muted-foreground">
                      {absenceStats.sickDaysInPeriod} sygedage ({absenceStats.sickOccurrencesInPeriod} perioder)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Palmtree className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Ferie</span>
                  </div>
                  <p className="text-2xl font-bold">{absenceStats.vacationDaysInPeriod}</p>
                  <p className="text-xs text-muted-foreground">feriedage brugt i perioden</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlarmClock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Forsinkelser</span>
                  </div>
                  <p className="text-2xl font-bold">{latenessStats.countInPeriod}</p>
                  <p className="text-xs text-muted-foreground">
                    {latenessStats.totalMinutesInPeriod} minutter total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* High sick absence warning */}
            {absenceStats.sickPercentInPeriod > 3.5 && (
              <Card className="border-2 border-red-500 bg-red-500/10 shadow-lg">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-red-500/20 p-3">
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-600">Højt sygefravær</h3>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-red-600">{absenceStats.sickPercentInPeriod.toFixed(1)}%</span>
                          <span className="text-sm text-muted-foreground">dit fravær</span>
                          <span className="text-muted-foreground">vs.</span>
                          <span className="text-lg font-semibold">3,5%</span>
                          <span className="text-sm text-muted-foreground">landsgennemsnit</span>
                        </div>
                        <Progress 
                          value={Math.min((absenceStats.sickPercentInPeriod / 10) * 100, 100)} 
                          className="h-3 bg-red-200 [&>div]:bg-red-500" 
                        />
                        <p className="text-sm text-muted-foreground mt-3">
                          Dit sygefravær ligger over det danske gennemsnit. Højt fravær kan påvirke både dit team og din egen udvikling i virksomheden.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History section */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Sick history */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    Sygehistorik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {absenceStats.sickAbsences.length > 0 ? (
                    <div className="space-y-2">
                      {absenceStats.sickAbsences.slice(0, 10).map((absence) => (
                        <div key={absence.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                          <span className="text-sm">
                            {formatDate(absence.start_date)}
                            {absence.start_date !== absence.end_date && ` - ${formatDate(absence.end_date)}`}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {Math.ceil((new Date(absence.end_date).getTime() - new Date(absence.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} dag(e)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen sygeperioder i valgt periode</p>
                  )}
                </CardContent>
              </Card>

              {/* Lateness history */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlarmClock className="h-4 w-4 text-orange-500" />
                    Forsinkelseshistorik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {latenessStats.records.length > 0 ? (
                    <div className="space-y-2">
                      {latenessStats.records.map((record) => (
                        <div key={record.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                          <span className="text-sm">{formatDate(record.date)}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium">{record.minutes} min</span>
                            {record.note && (
                              <p className="text-xs text-muted-foreground">{record.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen forsinkelser i valgt periode</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Calendar */}
            <EmployeeCalendar 
              standardStartTime={employee.standard_start_time}
              absences={absences.map(a => ({ id: a.id, type: a.type, start_date: a.start_date, end_date: a.end_date }))}
              latenessRecords={latenessRecords.map(l => ({ id: l.id, date: l.date, minutes: l.minutes }))}
            />
          </TabsContent>

          <TabsContent value="vagthistorik" className="mt-6">
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Timer i lønperiode */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Timer i lønperiode</p>
                            <p className="text-2xl font-bold">{shiftStats.actualHours.toFixed(1)}</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${
                          shiftStats.hoursPercentage >= 100 ? 'text-green-600' : 
                          shiftStats.hoursPercentage >= 80 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {shiftStats.hoursPercentage >= 100 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span>{Math.round(shiftStats.hoursPercentage)}%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Progress 
                          value={Math.min(shiftStats.hoursPercentage, 100)} 
                          className={`h-2 ${
                            shiftStats.hoursPercentage >= 100 ? '[&>div]:bg-green-500' : 
                            shiftStats.hoursPercentage >= 80 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                          }`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>af {shiftStats.expectedHoursToDate.toFixed(1)} forventet</span>
                          <span className={shiftStats.hoursDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {shiftStats.hoursDifference >= 0 ? '+' : ''}{shiftStats.hoursDifference.toFixed(1)}t
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Vagter i lønperiode */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-500/10">
                            <Briefcase className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Vagter i lønperiode</p>
                            <p className="text-2xl font-bold">{shiftStats.actualShifts}</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${
                          shiftStats.shiftsPercentage >= 100 ? 'text-green-600' : 
                          shiftStats.shiftsPercentage >= 80 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {shiftStats.shiftsPercentage >= 100 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span>{Math.round(shiftStats.shiftsPercentage)}%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Progress 
                          value={Math.min(shiftStats.shiftsPercentage, 100)} 
                          className={`h-2 ${
                            shiftStats.shiftsPercentage >= 100 ? '[&>div]:bg-green-500' : 
                            shiftStats.shiftsPercentage >= 80 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                          }`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>af {shiftStats.expectedShiftsToDate} forventet</span>
                          <span className={shiftStats.shiftsDifference >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {shiftStats.shiftsDifference >= 0 ? '+' : ''}{shiftStats.shiftsDifference}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/10">
                        <Palmtree className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Feriedage brugt</p>
                        <p className="text-2xl font-bold">{absenceStats.vacationDaysInPeriod}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-500/10">
                        <Thermometer className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sygedage</p>
                        <p className="text-2xl font-bold">{absenceStats.sickDaysInPeriod}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {employee?.salary_type === 'provision' ? (
                  // Commission-based salary display (using payroll period 15th-14th)
                  <>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-emerald-500/10">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Provision i lønperiode
                            </p>
                            <p className="text-2xl font-bold">
                              {(commissionStats?.periodCommission || 0).toLocaleString('da-DK')} kr
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(payrollPeriod.start, "d. MMM", { locale: da })} - {format(payrollPeriod.end, "d. MMM", { locale: da })} · {commissionStats?.periodSalesCount || 0} salg
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-500/10">
                            <Palmtree className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Optjente feriepenge
                            </p>
                            <p className="text-2xl font-bold">
                              {Math.round(commissionStats?.earnedVacationPay || 0).toLocaleString('da-DK')} kr
                            </p>
                            <p className="text-xs text-muted-foreground">
                              12,5% af optjent provision
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : shiftStats.isFixedSalary ? (
                  <>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-emerald-500/10">
                            <Wallet className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Optjent løn i periode
                            </p>
                            <p className="text-2xl font-bold">{Math.round(shiftStats.earnedInPeriod).toLocaleString('da-DK')} kr</p>
                            <p className="text-xs text-muted-foreground">
                              {format(payrollPeriod.start, "d. MMM", { locale: da })} - {format(payrollPeriod.end, "d. MMM", { locale: da })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-500/10">
                            <Palmtree className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Optjente feriepenge
                            </p>
                            <p className="text-2xl font-bold">{Math.round(shiftStats.earnedVacationPay).toLocaleString('da-DK')} kr</p>
                            <p className="text-xs text-muted-foreground">
                              12,5% af optjent løn
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-emerald-500/10">
                          <Wallet className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Løn i lønperiode
                          </p>
                          <p className="text-2xl font-bold">
                            {Math.round(shiftStats.actualHours * shiftStats.hourlyRate).toLocaleString('da-DK')} kr
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(payrollPeriod.start, "d. MMM", { locale: da })} - {format(payrollPeriod.end, "d. MMM", { locale: da })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sales Goal Tracker - only for provision employees */}
              {employee?.salary_type === 'provision' && employee?.id && (
                <SalesGoalTracker
                  employeeId={employee.id}
                  payrollPeriod={payrollPeriod}
                  commissionStats={{
                    periodTotal: commissionStats?.periodCommission || 0,
                    periodSales: commissionStats?.periodSalesCount || 0,
                    monthTotal: commissionStats?.periodCommission || 0,
                    monthSales: commissionStats?.periodSalesCount || 0,
                    todayTotal: commissionStats?.todayCommission || 0,
                    todaySales: commissionStats?.todaySalesCount || 0,
                  }}
                  absences={absences}
                  danishHolidays={danishHolidays || []}
                />
              )}

              {/* Payroll Period Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Lønperiodeoversigt
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({format(payrollPeriod.start, "d. MMM", { locale: da })} - {format(payrollPeriod.end, "d. MMM", { locale: da })} · {employee?.weekly_hours || 37} timer/uge)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expectedSchedule.slice(0, 25).map((day) => {
                      const date = new Date(day.date);
                      const dailySalary = day.hours * shiftStats.hourlyRate;
                      // Get daily commission for provision employees
                      const dailyCommission = employee?.salary_type === 'provision' 
                        ? (commissionStats?.dailyCommission?.[day.date] || 0)
                        : 0;
                      
                      return (
                        <div key={day.date} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            {day.status === "work" ? (
                              <div className="w-3 h-3 rounded-full bg-green-500" />
                            ) : day.status === "vacation" ? (
                              <Palmtree className="h-4 w-4 text-amber-500" />
                            ) : day.status === "holiday" ? (
                              <Star className="h-4 w-4 text-purple-500" />
                            ) : (
                              <Thermometer className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium">
                              {format(date, "EEEE d. MMM", { locale: da })}
                            </span>
                            {day.status === "holiday" && day.holidayName && (
                              <span className="text-xs text-purple-600 dark:text-purple-400">
                                {day.holidayName}
                              </span>
                            )}
                            {day.status === "work" && day.startTime && (
                              <span className="text-xs text-muted-foreground">
                                {day.hasActualStamp 
                                  ? `${day.startTime}${day.endTime ? ` - ${day.endTime}` : ' (ikke udstemplet)'}`
                                  : `fra ${day.startTime}`
                                }
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {day.status === "work" ? (
                              <>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                  {day.hours.toFixed(1)} timer
                                </Badge>
                                {/* Show salary for hourly employees */}
                                {!shiftStats.isFixedSalary && shiftStats.hourlyRate > 0 && (
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {dailySalary.toLocaleString('da-DK')} kr
                                  </Badge>
                                )}
                                {/* Show commission for provision employees */}
                                {employee?.salary_type === 'provision' && dailyCommission > 0 && (
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {dailyCommission.toLocaleString('da-DK')} kr
                                  </Badge>
                                )}
                              </>
                            ) : day.status === "holiday" ? (
                              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200">
                                Helligdag
                              </Badge>
                            ) : (
                              <Badge 
                                variant={day.status === "vacation" ? "secondary" : "destructive"}
                                className={day.status === "vacation" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : ""}
                              >
                                {day.status === "vacation" ? "Ferie" : "Syg"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {expectedSchedule.length === 0 && weekendSchedule.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Ingen arbejdsdage endnu denne måned
                      </p>
                    )}
                    
                    {/* Weekend section - collapsible */}
                    {weekendSchedule.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <button
                          onClick={() => setShowWeekends(!showWeekends)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${showWeekends ? 'rotate-180' : ''}`} />
                          <span>Weekend-vagter ({weekendSchedule.length})</span>
                        </button>
                        
                        {showWeekends && (
                          <div className="mt-3 space-y-2 pl-2 border-l-2 border-orange-300 dark:border-orange-700">
                            {weekendSchedule.map((day) => {
                              const date = new Date(day.date);
                              const dailySalary = day.hours * shiftStats.hourlyRate;
                              
                              return (
                                <div key={day.date} className="flex items-center justify-between py-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                                    <span className="text-sm font-medium">
                                      {format(date, "EEEE d. MMM", { locale: da })}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {day.startTime}{day.endTime ? ` - ${day.endTime}` : ' (ikke udstemplet)'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                                      {day.hours.toFixed(1)} timer
                                    </Badge>
                                    {shiftStats.hourlyRate > 0 && (
                                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                        {dailySalary.toLocaleString('da-DK')} kr
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Booking Assignments History */}
              {bookingAssignments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Fieldmarketing vagter
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {bookingAssignments.slice(0, 20).map((assignment) => {
                        const date = new Date(assignment.date);
                        const location = assignment.booking?.location?.name || "Ukendt";
                        const brand = assignment.booking?.brand;
                        const start = new Date(`1970-01-01T${assignment.start_time}`);
                        const end = new Date(`1970-01-01T${assignment.end_time}`);
                        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                        return (
                          <div key={assignment.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              {brand && (
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: brand.color_hex }}
                                  title={brand.name}
                                />
                              )}
                              <div>
                                <span className="text-sm font-medium">
                                  {format(date, "EEEE d. MMM", { locale: da })}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {location}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {assignment.start_time.slice(0, 5)} - {assignment.end_time.slice(0, 5)}
                              </span>
                              <Badge variant="outline">
                                {hours.toFixed(1)} timer
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Absence History */}
              {absences.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-amber-500" />
                      Fraværshistorik
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {absences.slice(0, 20).map((absence) => {
                        const startDate = new Date(absence.start_date);
                        const endDate = new Date(absence.end_date);
                        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const isVacation = absence.type === "vacation";
                        return (
                          <div key={absence.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              {isVacation ? (
                                <Palmtree className="h-4 w-4 text-amber-500" />
                              ) : (
                                <Thermometer className="h-4 w-4 text-red-500" />
                              )}
                              <div>
                                <span className="text-sm font-medium">
                                  {format(startDate, "d. MMM", { locale: da })}
                                  {absence.start_date !== absence.end_date && ` - ${format(endDate, "d. MMM", { locale: da })}`}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {isVacation ? "Ferie" : "Sygdom"}
                                </span>
                              </div>
                            </div>
                            <Badge variant={isVacation ? "secondary" : "destructive"} className={isVacation ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : ""}>
                              {days} dag{days > 1 ? "e" : ""}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {deduplicatedTimeStamps.length === 0 && bookingAssignments.length === 0 && absences.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">Ingen vagthistorik at vise</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="gdpr" className="mt-6">
            <GdprSettingsCard />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
