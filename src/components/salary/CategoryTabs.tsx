import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Calculator, 
  BarChart3,
  FileText,
  Users,
  Receipt,
  UserPlus,
  DollarSign,
  PieChart,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import existing tab components
import { SalaryTypesTab } from "./SalaryTypesTab";
import { PersonnelOverviewCards } from "./PersonnelOverviewCards";
import { TeamExpensesTab } from "./TeamExpensesTab";
import { NewEmployeesTab } from "./NewEmployeesTab";
import { SellerSalariesTab } from "./SellerSalariesTab";
import { CombinedSalaryTab } from "./CombinedSalaryTab";
import { DBOverviewTab } from "./DBOverviewTab";
import { ClientDBTab } from "./ClientDBTab";

interface SubTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  colorClass: string;
  subTabs: SubTab[];
}

const categories: Category[] = [
  {
    id: "setup",
    label: "Opsætning",
    icon: <Settings className="h-4 w-4" />,
    description: "Administration af lønarter og personale",
    colorClass: "data-[state=active]:bg-muted",
    subTabs: [
      {
        id: "salary-types",
        label: "Lønarter",
        icon: <FileText className="h-4 w-4" />,
        component: <SalaryTypesTab />,
      },
      {
        id: "personnel",
        label: "Personale løn",
        icon: <Users className="h-4 w-4" />,
        component: <PersonnelOverviewCards />,
      },
      {
        id: "team-expenses",
        label: "Teamomkostninger",
        icon: <Receipt className="h-4 w-4" />,
        component: <TeamExpensesTab />,
      },
      {
        id: "new-employees",
        label: "Nye medarbejdere",
        icon: <UserPlus className="h-4 w-4" />,
        component: <NewEmployeesTab />,
      },
    ],
  },
  {
    id: "calculation",
    label: "Lønberegning",
    icon: <Calculator className="h-4 w-4" />,
    description: "Beregning af provisioner og lønninger",
    colorClass: "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    subTabs: [
      {
        id: "seller-salaries",
        label: "Sælgerlønninger",
        icon: <DollarSign className="h-4 w-4" />,
        component: <SellerSalariesTab />,
      },
      {
        id: "combined",
        label: "Samlet oversigt",
        icon: <PieChart className="h-4 w-4" />,
        component: <CombinedSalaryTab />,
      },
    ],
  },
  {
    id: "reports",
    label: "Rapporter",
    icon: <BarChart3 className="h-4 w-4" />,
    description: "DB-oversigt og analyse",
    colorClass: "data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-900/30 dark:data-[state=active]:text-orange-400",
    subTabs: [
      {
        id: "db-overview",
        label: "DB Oversigt",
        icon: <TrendingUp className="h-4 w-4" />,
        component: <DBOverviewTab />,
      },
      {
        id: "client-db",
        label: "DB per klient",
        icon: <BarChart3 className="h-4 w-4" />,
        component: <ClientDBTab />,
      },
    ],
  },
];

export function CategoryTabs() {
  const [activeCategory, setActiveCategory] = useState(categories[0].id);
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    categories.forEach((cat) => {
      initial[cat.id] = cat.subTabs[0].id;
    });
    return initial;
  });
  const isMobile = useIsMobile();

  const currentCategory = categories.find((c) => c.id === activeCategory) || categories[0];
  const activeSubTab = activeSubTabs[activeCategory];

  const handleSubTabChange = (subTabId: string) => {
    setActiveSubTabs((prev) => ({
      ...prev,
      [activeCategory]: subTabId,
    }));
  };

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile: Category selector */}
        <Select value={activeCategory} onValueChange={setActiveCategory}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  {cat.icon}
                  <span>{cat.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Mobile: Sub-tab selector */}
        <Select value={activeSubTab} onValueChange={handleSubTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentCategory.subTabs.map((sub) => (
              <SelectItem key={sub.id} value={sub.id}>
                <div className="flex items-center gap-2">
                  {sub.icon}
                  <span>{sub.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Mobile: Content */}
        <div className="mt-4">
          {currentCategory.subTabs.find((s) => s.id === activeSubTab)?.component}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Desktop: Main category tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className={cn(
                "flex items-center gap-2 py-3 px-4 transition-all",
                cat.colorClass
              )}
            >
              {cat.icon}
              <div className="text-left hidden sm:block">
                <div className="font-medium">{cat.label}</div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  {cat.description}
                </div>
              </div>
              <span className="sm:hidden">{cat.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-6">
            {/* Sub-tabs for each category */}
            <Tabs value={activeSubTabs[cat.id]} onValueChange={handleSubTabChange}>
              <TabsList className="mb-4">
                {cat.subTabs.map((sub) => (
                  <TabsTrigger
                    key={sub.id}
                    value={sub.id}
                    className="flex items-center gap-2"
                  >
                    {sub.icon}
                    <span>{sub.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {cat.subTabs.map((sub) => (
                <TabsContent key={sub.id} value={sub.id}>
                  {sub.component}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
