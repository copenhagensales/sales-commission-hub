import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, ChevronDown, ChevronRight, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useSidebarMenuConfig,
  useSaveMenuConfig,
  type MenuConfigItem,
} from "@/hooks/useSidebarMenuConfig";

// Default labels for items (fallback when no label_override)
const DEFAULT_LABELS: Record<string, string> = {
  section_mit_hjem: "Mit Hjem",
  section_spil: "Spil",
  // section_some removed
  section_personale: "Personale",
  section_ledelse: "Ledelse",
  section_vagtplan: "Vagtplan",
  section_fieldmarketing: "Fieldmarketing",
  section_mg: "MG",
  section_rekruttering: "Rekruttering",
  section_onboarding: "Onboarding",
  section_rapporter: "Rapporter",
  section_lon: "Løn",
  section_economic: "Økonomi",
  section_admin: "Admin",
  section_amo: "Arbejdsmiljø",
  item_home: "Hjem",
  item_messages: "Beskeder",
  item_my_profile: "Min Profil",
  item_my_feedback: "Min Feedback",
  item_pulse_survey: "Pulsmåling",
  item_my_goals: "Løn & Mål",
  item_team_goals: "Teammål",
  item_refer_a_friend: "Anbefal en ven",
  item_immediate_payment: "Straksbetaling (ASE)",
  item_tdc_opsummering: "TDC Opsummering",
  item_h2h: "Head to Head",
  item_commission_league: "Superligaen",
  item_some: "SOME",
  item_extra_work: "Ekstra arbejde",
  item_employees: "Medarbejdere",
  item_login_log: "Login log",
  item_upcoming_starts: "Kommende Opstarter",
  item_contracts: "Kontrakter",
  item_permissions: "Rettigheder",
  item_career_wishes: "Karriereønsker",
  item_company_overview: "Virksomhedsoverblik",
  item_onboarding_analyse: "Onboarding Analyse",
  item_email_templates_ledelse: "Email skabeloner",
  item_security_dashboard: "Sikkerhed",
  item_system_stability: "Systemstabilitet",
  item_car_quiz_admin: "Firmabil Admin",
  item_coc_admin: "Code of Conduct Admin",
  item_pulse_survey_results: "Pulsmåling resultater",
  item_customer_inquiries: "Kundehenvendelser",
  item_client_forecast: "Kundeforecast",
  item_car_quiz: "Firmabil",
  item_system_feedback: "Fejlrapportering",
  item_code_of_conduct: "Code of Conduct",
  item_shift_overview: "Vagtplan (Leder)",
  item_absence: "Fravær",
  item_time_tracking: "Tidsregistrering",
  item_time_stamp: "Stempelur",
  item_closing_shifts: "Lukkevagter",
  item_fm_my_schedule: "Min vagtplan",
  item_fm_overview: "Overblik",
  item_fm_booking: "Booking",
  item_fm_vehicles: "Køretøjer",
  item_fm_sales_registration: "Salgsregistrering",
  item_fm_billing: "Fakturering",
  item_fm_travel_expenses: "Rejseudgifter",
  item_fm_edit_sales: "Ret salgsregistrering",
  item_mg_test: "MG Test",
  item_recruitment_dashboard: "Dashboard",
  item_candidates: "Kandidater",
  item_messages_recruitment: "Beskeder",
  item_sms_templates: "SMS skabeloner",
  item_email_templates_recruitment: "Email skabeloner",
  item_referrals: "Henvisninger",
  item_winback: "Winback",
  item_upcoming_interviews: "Kommende samtaler",
  item_upcoming_hires: "Kommende ansættelser",
  item_booking_flow: "Booking Flow",
  item_onboarding_program: "Onboarding Program",
  item_coaching_templates: "Coaching skabeloner",
  item_sales: "Salg",
  item_reports_admin: "Rapporter Admin",
  item_reports_daily: "Dagsrapporter",
  item_reports_management: "Ledelsesrapporter",
  item_reports_employee: "Medarbejderrapporter",
  item_cancellations: "Annulleringer",
  item_salary_types: "Lønarter",
  item_economic_dashboard: "Overblik",
  item_economic_posteringer: "Posteringer",
  item_economic_expenses: "Udgifter",
  item_economic_budget: "Budget 2026",
  item_economic_mapping: "Mapping",
  item_economic_revenue_match: "Omsætning",
  item_economic_sales_validation: "Salgsvalidering",
  item_economic_upload: "Import",
  item_logikker: "Logikker",
  item_live_stats: "Live Stats",
  item_kpi_definitions: "KPI Definitioner",
  item_amo_dashboard: "Dashboard",
  item_amo_organisation: "Organisation",
  item_amo_annual_discussion: "Årlig drøftelse",
  item_amo_meetings: "Møder",
  item_amo_apv: "APV",
  item_amo_kemi_apv: "Kemi-APV",
  item_amo_training: "Uddannelse",
  item_amo_documents: "Dokumenter",
  item_amo_tasks: "Opgaver",
  item_amo_settings: "Indstillinger",
  item_amo_audit_log: "Audit log",
  item_settings: "Indstillinger",
};

function getLabel(item: MenuConfigItem): string {
  return item.label_override || DEFAULT_LABELS[item.item_key] || item.item_key;
}

// Droppable zone for a section's children area
function DroppableSectionZone({
  sectionKey,
  isOver,
  children,
}: {
  sectionKey: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `droppable_${sectionKey}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "ml-8 mt-1 mb-2 space-y-1 min-h-[36px] rounded-md border-2 border-dashed p-1 transition-colors",
        isOver
          ? "border-primary bg-primary/10"
          : "border-transparent"
      )}
    >
      {children}
    </div>
  );
}

// Sortable menu item row
function SortableMenuItem({
  item,
  onToggleVisible,
  onLabelChange,
  isSection,
  isExpanded,
  onToggleExpand,
  childCount,
}: {
  item: MenuConfigItem;
  onToggleVisible: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  isSection?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  childCount?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(getLabel(item));

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSaveLabel = () => {
    setEditing(false);
    const defaultLabel = DEFAULT_LABELS[item.item_key] || item.item_key;
    onLabelChange(item.id, editValue === defaultLabel ? "" : editValue);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-2.5 transition-colors",
        isSection ? "border-primary/20 bg-primary/5" : "border-border",
        isDragging && "ring-2 ring-primary/50",
        !item.visible && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {isSection && onToggleExpand && (
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveLabel}
            onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setEditValue(getLabel(item));
              setEditing(true);
            }}
            className="text-sm font-medium text-left truncate block w-full hover:text-primary"
          >
            {getLabel(item)}
          </button>
        )}
      </div>

      {isSection && childCount !== undefined && (
        <Badge variant="secondary" className="text-xs">
          {childCount}
        </Badge>
      )}

      {item.href && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden md:block">
          {item.href}
        </span>
      )}

      <Badge variant={item.visible ? "default" : "outline"} className="text-xs shrink-0">
        {item.visible ? "Synlig" : "Skjult"}
      </Badge>

      <Switch
        checked={item.visible}
        onCheckedChange={() => onToggleVisible(item.id)}
        className="shrink-0"
      />
    </div>
  );
}

export default function MenuEditor() {
  const { data: rawItems, isLoading } = useSidebarMenuConfig();
  const saveConfig = useSaveMenuConfig();
  const { toast } = useToast();

  const [items, setItems] = useState<MenuConfigItem[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSectionKey, setOverSectionKey] = useState<string | null>(null);

  useEffect(() => {
    if (rawItems) {
      setItems(rawItems);
      setHasChanges(false);
    }
  }, [rawItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sections = useMemo(
    () =>
      items
        .filter((i) => i.parent_key === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const getChildren = useCallback(
    (sectionKey: string) =>
      items
        .filter((i) => i.parent_key === sectionKey)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const toggleVisible = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i))
    );
    setHasChanges(true);
  };

  const updateLabel = (id: string, label: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, label_override: label || null } : i
      )
    );
    setHasChanges(true);
  };

  const toggleExpand = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  // Find which section a droppable/sortable id belongs to
  const findSectionKeyForId = useCallback(
    (id: string): string | null => {
      // Check if it's a droppable zone id
      if (typeof id === "string" && id.startsWith("droppable_")) {
        return id.replace("droppable_", "");
      }
      const item = items.find((i) => i.id === id);
      if (!item) return null;
      // If it's a top-level section, return its item_key
      if (item.parent_key === null) return item.item_key;
      // Otherwise return its parent
      return item.parent_key;
    },
    [items]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverSectionKey(null);
      return;
    }

    const activeItem = items.find((i) => i.id === active.id);
    if (!activeItem || activeItem.parent_key === null) {
      // Don't allow sections to move into other sections
      setOverSectionKey(null);
      return;
    }

    const targetSectionKey = findSectionKeyForId(over.id as string);
    setOverSectionKey(targetSectionKey);

    // If hovering over a different section's child or droppable zone, move the item there
    if (targetSectionKey && targetSectionKey !== activeItem.parent_key) {
      // Auto-expand the target section
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(targetSectionKey);
        return next;
      });

      // Move item to new parent
      setItems((prev) => {
        const targetChildren = prev
          .filter((i) => i.parent_key === targetSectionKey && i.id !== active.id)
          .sort((a, b) => a.sort_order - b.sort_order);

        const newSortOrder =
          targetChildren.length > 0
            ? targetChildren[targetChildren.length - 1].sort_order + 10
            : 10;

        return prev.map((i) =>
          i.id === active.id
            ? { ...i, parent_key: targetSectionKey, sort_order: newSortOrder }
            : i
        );
      });
      setHasChanges(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverSectionKey(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem) return;

    // If dropping on a droppable zone (empty section), item was already moved in onDragOver
    if ((over.id as string).startsWith("droppable_")) return;

    if (!overItem) return;

    // Reorder within same parent
    if (activeItem.parent_key === overItem.parent_key) {
      const parentKey = activeItem.parent_key;
      const siblings = items
        .filter((i) => i.parent_key === parentKey)
        .sort((a, b) => a.sort_order - b.sort_order);

      const oldIndex = siblings.findIndex((i) => i.id === active.id);
      const newIndex = siblings.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(siblings, oldIndex, newIndex);

      setItems((prev) => {
        const updated = [...prev];
        reordered.forEach((item, idx) => {
          const i = updated.findIndex((u) => u.id === item.id);
          if (i !== -1) updated[i] = { ...updated[i], sort_order: (idx + 1) * 10 };
        });
        return updated;
      });
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    try {
      await saveConfig.mutateAsync(items);
      toast({ title: "Menu gemt", description: "Menurækkefølgen er opdateret." });
      setHasChanges(false);
    } catch {
      toast({ title: "Fejl", description: "Kunne ikke gemme menuændringer.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    if (rawItems) {
      setItems(rawItems);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Indlæser menu...</div>
      </div>
    );
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu Editor</h1>
          <p className="text-muted-foreground text-sm">
            Træk og slip for at ændre rækkefølge eller flytte punkter mellem sektioner. Klik på navn for at omdøbe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Nulstil
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveConfig.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {saveConfig.isPending ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-accent border border-border rounded-lg p-3 text-sm text-accent-foreground">
          Du har ugemte ændringer. Klik "Gem ændringer" for at anvende dem.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Top-level sections */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sektioner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section) => {
                const isSection = section.item_key.startsWith("section_");
                const children = isSection ? getChildren(section.item_key) : [];
                const expanded = expandedSections.has(section.item_key);
                const isSectionDropTarget = overSectionKey === section.item_key;

                return (
                  <div key={section.id}>
                    <SortableMenuItem
                      item={section}
                      onToggleVisible={toggleVisible}
                      onLabelChange={updateLabel}
                      isSection={isSection}
                      isExpanded={expanded}
                      onToggleExpand={isSection ? () => toggleExpand(section.item_key) : undefined}
                      childCount={isSection ? children.length : undefined}
                    />

                    {/* Children — always show droppable zone when expanded or when it's a drop target */}
                    {isSection && (expanded || isSectionDropTarget) && (
                      <DroppableSectionZone
                        sectionKey={section.item_key}
                        isOver={isSectionDropTarget}
                      >
                        <SortableContext
                          items={children.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {children.map((child) => (
                            <SortableMenuItem
                              key={child.id}
                              item={child}
                              onToggleVisible={toggleVisible}
                              onLabelChange={updateLabel}
                            />
                          ))}
                          {children.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              Træk et menupunkt herind
                            </div>
                          )}
                        </SortableContext>
                      </DroppableSectionZone>
                    )}
                  </div>
                );
              })}
            </SortableContext>
          </CardContent>
        </Card>

        <DragOverlay>
          {activeItem && (
            <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 shadow-lg ring-2 ring-primary">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{getLabel(activeItem)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Preview — menurækkefølge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 text-sm">
            {sections
              .filter((s) => s.visible)
              .map((s, i, arr) => (
                <span key={s.id} className="text-muted-foreground">
                  {getLabel(s)}
                  {i < arr.length - 1 && <span className="mx-1">→</span>}
                </span>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
