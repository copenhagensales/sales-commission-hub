import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Check, Camera, User, MapPin, Briefcase, Wallet, Palmtree, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmployeeMasterDataRecord {
  id: string;
  first_name: string;
  last_name: string;
  cpr_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  private_phone: string | null;
  private_email: string | null;
  work_email: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  job_title: string | null;
  department: string | null;
  work_location: string | null;
  manager_id: string | null;
  team_id: string | null;
  contract_id: string | null;
  contract_version: string | null;
  salary_type: "provision" | "fixed" | "hourly" | null;
  salary_amount: number | null;
  bank_reg_number: string | null;
  bank_account_number: string | null;
  system_role_id: string | null;
  vacation_type: "vacation_pay" | "vacation_bonus" | null;
  vacation_bonus_percent: number | null;
  has_parking: boolean;
  parking_spot_id: string | null;
  parking_monthly_cost: number | null;
  working_hours_model: string | null;
  weekly_hours: number | null;
  standard_start_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  invitation_status: "none" | "pending" | "completed" | null;
  auth_user_id: string | null;
  avatar_url: string | null;
}

type NewEmployee = Omit<EmployeeMasterDataRecord, "id" | "created_at" | "updated_at">;

const defaultEmployee: NewEmployee = {
  first_name: "",
  last_name: "",
  cpr_number: null,
  address_street: null,
  address_postal_code: null,
  address_city: null,
  address_country: "Danmark",
  private_phone: null,
  private_email: null,
  work_email: null,
  employment_start_date: null,
  employment_end_date: null,
  job_title: null,
  department: null,
  work_location: "København V",
  manager_id: null,
  team_id: null,
  contract_id: null,
  contract_version: null,
  salary_type: "provision",
  salary_amount: null,
  bank_reg_number: null,
  bank_account_number: null,
  system_role_id: null,
  vacation_type: "vacation_pay",
  vacation_bonus_percent: 1,
  has_parking: false,
  parking_spot_id: null,
  parking_monthly_cost: null,
  working_hours_model: null,
  weekly_hours: null,
  standard_start_time: null,
  is_active: true,
  invitation_status: "none",
  auth_user_id: null,
  avatar_url: null,
};

interface JobPosition {
  id: string;
  name: string;
  is_active: boolean;
}

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEmployee: EmployeeMasterDataRecord | null;
  jobPositions: JobPosition[];
  onSuccess: () => void;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  editingEmployee,
  jobPositions,
  onSuccess,
}: EmployeeFormDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<NewEmployee>(defaultEmployee);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["identity"]);

  // Initialize form data when editing employee changes
  useEffect(() => {
    if (editingEmployee) {
      setFormData({
        first_name: editingEmployee.first_name,
        last_name: editingEmployee.last_name,
        cpr_number: editingEmployee.cpr_number,
        address_street: editingEmployee.address_street,
        address_postal_code: editingEmployee.address_postal_code,
        address_city: editingEmployee.address_city,
        address_country: editingEmployee.address_country,
        private_phone: editingEmployee.private_phone,
        private_email: editingEmployee.private_email,
        work_email: editingEmployee.work_email,
        employment_start_date: editingEmployee.employment_start_date,
        employment_end_date: editingEmployee.employment_end_date,
        job_title: editingEmployee.job_title,
        department: editingEmployee.department,
        work_location: editingEmployee.work_location,
        manager_id: editingEmployee.manager_id,
        team_id: editingEmployee.team_id,
        contract_id: editingEmployee.contract_id,
        contract_version: editingEmployee.contract_version,
        salary_type: editingEmployee.salary_type,
        salary_amount: editingEmployee.salary_amount,
        bank_reg_number: editingEmployee.bank_reg_number,
        bank_account_number: editingEmployee.bank_account_number,
        system_role_id: editingEmployee.system_role_id,
        vacation_type: editingEmployee.vacation_type,
        vacation_bonus_percent: editingEmployee.vacation_bonus_percent,
        has_parking: editingEmployee.has_parking,
        parking_spot_id: editingEmployee.parking_spot_id,
        parking_monthly_cost: editingEmployee.parking_monthly_cost,
        working_hours_model: editingEmployee.working_hours_model,
        weekly_hours: editingEmployee.weekly_hours,
        standard_start_time: editingEmployee.standard_start_time,
        is_active: editingEmployee.is_active,
        invitation_status: editingEmployee.invitation_status,
        auth_user_id: editingEmployee.auth_user_id,
        avatar_url: editingEmployee.avatar_url,
      });
      setOpenSections(["identity"]);
    } else {
      setFormData(defaultEmployee);
      setOpenSections(["identity"]);
    }
    setLastSaved(null);
  }, [editingEmployee, open]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingEmployee) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingEmployee.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, avatar_url: publicUrl });
      
      await supabase
        .from("employee_master_data")
        .update({ avatar_url: publicUrl })
        .eq("id", editingEmployee.id);
      
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: "Profilbillede uploadet" });
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({ title: "Fejl ved upload", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Auto-save function for editing existing employee
  const autoSaveEmployee = useCallback(async () => {
    if (!editingEmployee) return;
    
    setAutoSaving(true);
    try {
      const { error } = await supabase
        .from("employee_master_data")
        .update(formData)
        .eq("id", editingEmployee.id);
      
      if (!error) {
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  }, [editingEmployee, formData, queryClient]);

  // Debounced auto-save when form changes
  useEffect(() => {
    if (!editingEmployee || !open) return;
    
    const timeoutId = setTimeout(() => {
      autoSaveEmployee();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [formData, editingEmployee, open, autoSaveEmployee]);

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      toast({ title: t("employees.toast.fillNames"), variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      if (editingEmployee) {
        const { error } = await supabase
          .from("employee_master_data")
          .update(formData)
          .eq("id", editingEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_master_data").insert(formData);
        if (error) throw error;
      }
      
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: editingEmployee ? t("employees.toast.updated") : t("employees.toast.created") });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: t("employees.toast.error"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData(defaultEmployee);
    setLastSaved(null);
    setOpenSections(["identity"]);
    onOpenChange(false);
  };

  const sections = [
    { id: "identity", icon: User, title: t("employees.steps.identity"), required: true },
    { id: "contact", icon: MapPin, title: t("employees.steps.contact") },
    { id: "employment", icon: Briefcase, title: t("employees.steps.employment") },
    { id: "salary", icon: Wallet, title: t("employees.steps.salary") },
    { id: "vacation", icon: Palmtree, title: t("employees.steps.vacation") },
    { id: "other", icon: Settings, title: t("employees.steps.other") },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingEmployee ? t("employees.dialog.editEmployee") : t("employees.dialog.newEmployee")}</DialogTitle>
        </DialogHeader>
        
        {/* Auto-save indicator */}
        <div className="text-center h-5">
          {autoSaving ? (
            <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("employees.dialog.saving")}
            </span>
          ) : lastSaved ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <Check className="h-3 w-3" /> {t("employees.dialog.savedAutomatically")}
            </span>
          ) : null}
        </div>

        <Accordion 
          type="multiple" 
          value={openSections} 
          onValueChange={setOpenSections}
          className="space-y-2"
        >
          {/* Identity Section */}
          <AccordionItem value="identity" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t("employees.steps.identity")}</span>
                <span className="text-xs text-destructive">*</span>
                {formData.first_name && formData.last_name && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formData.first_name} {formData.last_name}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                {editingEmployee && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                      <Avatar className="h-20 w-20 border-2 border-border">
                        <AvatarImage src={formData.avatar_url || undefined} alt="Profilbillede" />
                        <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                          {formData.first_name?.[0]?.toUpperCase() || ""}
                          {formData.last_name?.[0]?.toUpperCase() || ""}
                        </AvatarFallback>
                      </Avatar>
                      <label 
                        htmlFor="avatar-upload" 
                        className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        )}
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                      />
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("employees.fields.firstName")} *</Label>
                    <Input 
                      value={formData.first_name} 
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("employees.fields.lastName")} *</Label>
                    <Input 
                      value={formData.last_name} 
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{t("employees.fields.cprNumber")}</Label>
                    <Input 
                      type="password" 
                      value={formData.cpr_number || ""} 
                      onChange={(e) => setFormData({ ...formData, cpr_number: e.target.value || null })} 
                      placeholder={t("employees.fields.cprPlaceholder")} 
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Contact Section */}
          <AccordionItem value="contact" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t("employees.steps.contact")}</span>
                {(formData.private_phone || formData.private_email) && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formData.private_phone || formData.private_email}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>{t("employees.fields.address")}</Label>
                  <Input 
                    value={formData.address_street || ""} 
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value || null })} 
                    placeholder={t("employees.fields.addressPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.postalCode")}</Label>
                  <Input 
                    value={formData.address_postal_code || ""} 
                    onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.city")}</Label>
                  <Input 
                    value={formData.address_city || ""} 
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.country")}</Label>
                  <Input 
                    value={formData.address_country || ""} 
                    onChange={(e) => setFormData({ ...formData, address_country: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.phone")}</Label>
                  <Input 
                    value={formData.private_phone || ""} 
                    onChange={(e) => setFormData({ ...formData, private_phone: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>{t("employees.fields.email")}</Label>
                  <Input 
                    type="email" 
                    value={formData.private_email || ""} 
                    onChange={(e) => setFormData({ ...formData, private_email: e.target.value || null })} 
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Employment Section */}
          <AccordionItem value="employment" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t("employees.steps.employment")}</span>
                {formData.job_title && (
                  <span className="text-xs text-muted-foreground ml-2">{formData.job_title}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("employees.fields.employmentDate")}</Label>
                  <Input 
                    type="date" 
                    value={formData.employment_start_date || ""} 
                    onChange={(e) => setFormData({ ...formData, employment_start_date: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.endDate")}</Label>
                  <Input 
                    type="date" 
                    value={formData.employment_end_date || ""} 
                    onChange={(e) => setFormData({ ...formData, employment_end_date: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.jobTitle")}</Label>
                  <Select 
                    value={formData.job_title || ""} 
                    onValueChange={(v) => setFormData({ ...formData, job_title: v || null })}
                  >
                    <SelectTrigger><SelectValue placeholder={t("employees.fields.selectPosition")} /></SelectTrigger>
                    <SelectContent>
                      {jobPositions.map((position) => (
                        <SelectItem key={position.id} value={position.name}>
                          {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.department")}</Label>
                  <Input 
                    value={formData.department || ""} 
                    onChange={(e) => setFormData({ ...formData, department: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.workLocation")}</Label>
                  <Select 
                    value={formData.work_location || "København V"} 
                    onValueChange={(v) => setFormData({ ...formData, work_location: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="København V">København V</SelectItem>
                      <SelectItem value="Århus">Århus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.contractId")}</Label>
                  <Input 
                    value={formData.contract_id || ""} 
                    onChange={(e) => setFormData({ ...formData, contract_id: e.target.value || null })} 
                  />
                </div>
                <div className="flex items-center space-x-2 col-span-2">
                  <Switch 
                    checked={formData.is_active} 
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} 
                  />
                  <Label>{t("employees.fields.activeEmployee")}</Label>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Salary Section */}
          <AccordionItem value="salary" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t("employees.steps.salary")}</span>
                {formData.salary_type && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formData.salary_type === "provision" ? "Provision" : 
                     formData.salary_type === "fixed" ? "Fast løn" : "Timeløn"}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("employees.fields.salaryType")}</Label>
                  <Select 
                    value={formData.salary_type || "provision"} 
                    onValueChange={(v) => setFormData({ ...formData, salary_type: v as "provision" | "fixed" | "hourly" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="provision">{t("employees.salaryTypes.provision")}</SelectItem>
                      <SelectItem value="fixed">{t("employees.salaryTypes.fixed")}</SelectItem>
                      <SelectItem value="hourly">{t("employees.salaryTypes.hourly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.salary_type === "fixed" || formData.salary_type === "hourly") && (
                  <div className="space-y-2">
                    <Label>{t("employees.fields.salaryAmount")}</Label>
                    <Input 
                      type="number" 
                      value={formData.salary_amount || ""} 
                      onChange={(e) => setFormData({ ...formData, salary_amount: e.target.value ? parseFloat(e.target.value) : null })} 
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("employees.fields.regNumber")}</Label>
                  <Input 
                    type="password" 
                    value={formData.bank_reg_number || ""} 
                    onChange={(e) => setFormData({ ...formData, bank_reg_number: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.accountNumber")}</Label>
                  <Input 
                    type="password" 
                    value={formData.bank_account_number || ""} 
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value || null })} 
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Vacation Section */}
          <AccordionItem value="vacation" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <Palmtree className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t("employees.steps.vacation")}</span>
                {formData.vacation_type && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formData.vacation_type === "vacation_pay" ? "Feriegodtgørelse" : "Ferietillæg"}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("employees.fields.vacationType")}</Label>
                  <Select 
                    value={formData.vacation_type || "vacation_pay"} 
                    onValueChange={(v) => setFormData({ ...formData, vacation_type: v as "vacation_pay" | "vacation_bonus" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation_pay">{t("employees.fields.vacationPay")}</SelectItem>
                      <SelectItem value="vacation_bonus">{t("employees.fields.vacationBonus")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.vacation_type === "vacation_bonus" && (
                  <div className="space-y-2">
                    <Label>{t("employees.fields.vacationBonusPercent")}</Label>
                    <Input 
                      type="number" 
                      value={formData.vacation_bonus_percent || 1} 
                      onChange={(e) => setFormData({ ...formData, vacation_bonus_percent: parseFloat(e.target.value) })} 
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Other Section */}
          <AccordionItem value="other" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t("employees.steps.other")}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 col-span-2">
                  <Switch 
                    checked={formData.has_parking} 
                    onCheckedChange={(checked) => setFormData({ ...formData, has_parking: checked })} 
                  />
                  <Label>{t("employees.fields.parkingSpot")}</Label>
                </div>
                {formData.has_parking && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.spotId")}</Label>
                      <Input 
                        value={formData.parking_spot_id || ""} 
                        onChange={(e) => setFormData({ ...formData, parking_spot_id: e.target.value || null })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.monthlyPrice")}</Label>
                      <Input 
                        type="number" 
                        value={formData.parking_monthly_cost || ""} 
                        onChange={(e) => setFormData({ ...formData, parking_monthly_cost: e.target.value ? parseFloat(e.target.value) : null })} 
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2 col-span-2">
                  <Label>{t("employees.fields.workingHoursModel")}</Label>
                  <Input 
                    value={formData.working_hours_model || ""} 
                    onChange={(e) => setFormData({ ...formData, working_hours_model: e.target.value || null })} 
                    placeholder={t("employees.fields.workingHoursPlaceholder")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.hoursPerWeek")}</Label>
                  <Input 
                    type="number" 
                    value={formData.weekly_hours || ""} 
                    onChange={(e) => setFormData({ ...formData, weekly_hours: e.target.value ? parseFloat(e.target.value) : null })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("employees.fields.standardStartTime")}</Label>
                  <Input 
                    type="time" 
                    value={formData.standard_start_time || ""} 
                    onChange={(e) => setFormData({ ...formData, standard_start_time: e.target.value || null })} 
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Save button */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {t("employees.dialog.cancel") || "Annuller"}
          </Button>
          <Button onClick={handleSave} disabled={saving || autoSaving}>
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("employees.dialog.saving")}</>
            ) : (
              <>{t("employees.dialog.save") || "Gem"}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
