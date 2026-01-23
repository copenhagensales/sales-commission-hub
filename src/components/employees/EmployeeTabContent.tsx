import React from "react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Search, Plus, FileText, Check, Clock, X, Pencil, Mail, UserCheck, Send, 
  Phone, MessageSquare, ArrowRightLeft, Trash2, MoreHorizontal, ArrowUpDown, 
  ArrowUp, ArrowDown, Loader2, Eye, EyeOff 
} from "lucide-react";
import { EmployeeExcelImport } from "@/components/employees/EmployeeExcelImport";

interface EmployeeMasterDataRecord {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  is_active: boolean;
  private_email: string | null;
  private_phone: string | null;
  invitation_status: "none" | "pending" | "completed" | null;
}

interface JobPosition {
  id: string;
  name: string;
  is_active: boolean;
}

interface EmployeeTabContentProps {
  employees: EmployeeMasterDataRecord[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: "active" | "inactive" | "all";
  setStatusFilter: (filter: "active" | "inactive" | "all") => void;
  teamFilter: string;
  setTeamFilter: (filter: string) => void;
  uniqueTeams: string[];
  sortColumn: "name" | "position" | "team";
  sortDirection: "asc" | "desc";
  handleSort: (column: "name" | "position" | "team") => void;
  getEmployeeTeams: (employeeId: string) => string;
  getContractStatus: (employeeId: string) => "signed" | "pending" | "rejected" | "none";
  canEditEmployees: boolean;
  onEdit: (employee: EmployeeMasterDataRecord) => void;
  onNavigate: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean, employee: EmployeeMasterDataRecord) => void;
  toggleActivePending: boolean;
  onDeactivate: (employee: EmployeeMasterDataRecord) => void;
  onSendInvitation: (employee: EmployeeMasterDataRecord) => void;
  sendingResetTo: string | null;
  onMoveToStaff: (id: string) => void;
  onDelete: (id: string) => void;
  onSendSms: (employee: EmployeeMasterDataRecord) => void;
  canSendEmployeeSms: boolean;
  hasOutboundSoftphone: boolean;
  isDeviceReady: boolean;
  makeCall: (phone: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  // Create dialog props
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  createData: { first_name: string; last_name: string; email: string; password: string; job_title: string };
  setCreateData: (data: { first_name: string; last_name: string; email: string; password: string; job_title: string }) => void;
  creatingEmployee: boolean;
  handleCreateEmployee: () => void;
  jobPositions: JobPosition[];
  currentUserPosition: string | undefined;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
}

export function EmployeeTabContent({
  employees,
  isLoading,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  teamFilter,
  setTeamFilter,
  uniqueTeams,
  sortColumn,
  sortDirection,
  handleSort,
  getEmployeeTeams,
  getContractStatus,
  canEditEmployees,
  onEdit,
  onNavigate,
  onToggleActive,
  toggleActivePending,
  onDeactivate,
  onSendInvitation,
  sendingResetTo,
  onMoveToStaff,
  onDelete,
  onSendSms,
  canSendEmployeeSms,
  hasOutboundSoftphone,
  isDeviceReady,
  makeCall,
  searchInputRef,
  createDialogOpen,
  setCreateDialogOpen,
  createData,
  setCreateData,
  creatingEmployee,
  handleCreateEmployee,
  jobPositions,
  currentUserPosition,
  showPassword,
  setShowPassword,
}: EmployeeTabContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Filter header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            ref={searchInputRef}
            placeholder={t("employees.filters.searchPlaceholder")} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-9 h-9" 
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "active" | "inactive" | "all")}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("employees.filters.active")}</SelectItem>
            <SelectItem value="inactive">{t("employees.filters.inactive")}</SelectItem>
            <SelectItem value="all">{t("employees.filters.all")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Alle teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle teams</SelectItem>
            {uniqueTeams.map((team) => (
              <SelectItem key={team} value={team}>{team}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEditEmployees && (
          <div className="flex items-center gap-2 ml-auto">
            <EmployeeExcelImport />
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
            }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> {t("employees.create.button")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("employees.create.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fornavn *</Label>
                      <Input value={createData.first_name} onChange={(e) => setCreateData({ ...createData, first_name: e.target.value })} placeholder="Fornavn" />
                    </div>
                    <div className="space-y-2">
                      <Label>Efternavn</Label>
                      <Input value={createData.last_name} onChange={(e) => setCreateData({ ...createData, last_name: e.target.value })} placeholder="Efternavn" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={createData.email} onChange={(e) => setCreateData({ ...createData, email: e.target.value })} placeholder="medarbejder@email.dk" />
                  </div>
                  <div className="space-y-2">
                    <Label>Kodeord *</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={createData.password} onChange={(e) => setCreateData({ ...createData, password: e.target.value })} placeholder="Mindst 6 tegn" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Stilling *</Label>
                    <Select value={createData.job_title} onValueChange={(value) => setCreateData({ ...createData, job_title: value })}>
                      <SelectTrigger><SelectValue placeholder="Vælg stilling" /></SelectTrigger>
                      <SelectContent>
                        {jobPositions.filter((p) => p.name !== "Ejer" || currentUserPosition === "Ejer").map((position) => (
                          <SelectItem key={position.id} value={position.name}>{position.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleCreateEmployee} disabled={creatingEmployee}>
                    {creatingEmployee ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opretter...</> : <><Plus className="mr-2 h-4 w-4" /> Opret medarbejder</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Employee table */}
      <div className="rounded-xl border bg-card/50 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">{t("employees.table.name")} {sortColumn === "name" ? (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</div>
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => handleSort("position")}>
                  <div className="flex items-center gap-1">{t("employees.table.position")} {sortColumn === "position" ? (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</div>
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => handleSort("team")}>
                  <div className="flex items-center gap-1">Team {sortColumn === "team" ? (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</div>
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.status")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} className="cursor-pointer hover:bg-muted/30 border-b border-border/30" onClick={() => onNavigate(employee.id)}>
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative">
                            {getContractStatus(employee.id) === 'signed' ? <div className="flex items-center"><FileText className="h-3.5 w-3.5 text-emerald-500" /><Check className="h-2.5 w-2.5 text-emerald-500 absolute -right-1 -bottom-0.5" /></div>
                            : getContractStatus(employee.id) === 'pending' ? <div className="flex items-center"><FileText className="h-3.5 w-3.5 text-amber-500" /><Clock className="h-2.5 w-2.5 text-amber-500 absolute -right-1 -bottom-0.5" /></div>
                            : getContractStatus(employee.id) === 'rejected' ? <div className="flex items-center"><FileText className="h-3.5 w-3.5 text-destructive" /><X className="h-2.5 w-2.5 text-destructive absolute -right-1 -bottom-0.5" /></div>
                            : <FileText className="h-3.5 w-3.5 text-muted-foreground/30" />}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{getContractStatus(employee.id) === 'signed' ? t("employees.table.contractSigned") : getContractStatus(employee.id) === 'pending' ? "Afventer underskrift" : getContractStatus(employee.id) === 'rejected' ? "Kontrakt afvist" : t("employees.table.noContractSigned")}</TooltipContent>
                      </Tooltip>
                      <span>{employee.first_name} {employee.last_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm">{employee.job_title || <span className="text-muted-foreground/50">-</span>}</TableCell>
                  <TableCell className="py-3">{getEmployeeTeams(employee.id) ? <Badge variant="secondary" className="text-xs font-normal">{getEmployeeTeams(employee.id)}</Badge> : <span className="text-muted-foreground/50">-</span>}</TableCell>
                  <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                    <Switch checked={employee.is_active} disabled={toggleActivePending} onCheckedChange={(checked) => { if (!checked) { onDeactivate(employee); } else { onToggleActive(employee.id, true, employee); }}} />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-0.5">
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onSendInvitation(employee); }} disabled={!employee.private_email || sendingResetTo === employee.id || employee.invitation_status === "completed"}>
                          {sendingResetTo === employee.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : employee.invitation_status === "completed" ? <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> : employee.invitation_status === "pending" ? <Send className="h-3.5 w-3.5 text-amber-500" /> : <Mail className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger><TooltipContent>{employee.invitation_status === "completed" ? t("employees.actions.registered") : employee.invitation_status === "pending" ? t("employees.actions.resendInvitation") : t("employees.actions.sendInvitation")}</TooltipContent></Tooltip>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(employee); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover w-48">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); if (employee.private_phone) { if (hasOutboundSoftphone && isDeviceReady) { makeCall(employee.private_phone); } else { window.location.href = `tel:${employee.private_phone}`; }}}} disabled={!employee.private_phone}><Phone className="h-4 w-4 mr-2" />Ring op</DropdownMenuItem>
                          {canSendEmployeeSms && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendSms(employee); }} disabled={!employee.private_phone}><MessageSquare className="h-4 w-4 mr-2" />Send SMS</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToStaff(employee.id); }}><ArrowRightLeft className="h-4 w-4 mr-2" />Flyt til stab</DropdownMenuItem>
                          {canEditEmployees && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(employee.id); }} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Slet medarbejder</DropdownMenuItem></>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("employees.table.noEmployeesFound")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
