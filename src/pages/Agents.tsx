import { MainLayout } from "@/components/layout/MainLayout";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Search, UserPlus } from "lucide-react";
import { useState } from "react";

// Mock data
const mockAgents = [
  { id: "1", name: "Anders Jensen", email: "anders@company.dk", baseSalary: 25000, sales: 45, commission: 22500, isActive: true },
  { id: "2", name: "Maria Nielsen", email: "maria@company.dk", baseSalary: 25000, sales: 38, commission: 19000, isActive: true },
  { id: "3", name: "Peter Hansen", email: "peter@company.dk", baseSalary: 25000, sales: 32, commission: 16000, isActive: true },
  { id: "4", name: "Sofia Andersen", email: "sofia@company.dk", baseSalary: 25000, sales: 28, commission: 14000, isActive: true },
  { id: "5", name: "Lars Pedersen", email: "lars@company.dk", baseSalary: 25000, sales: 25, commission: 12500, isActive: false },
];

export default function Agents() {
  const [search, setSearch] = useState("");
  
  const filteredAgents = mockAgents.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenter</h1>
            <p className="mt-1 text-muted-foreground">
              Administrer medarbejdere og se deres performance
            </p>
          </div>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Tilføj agent
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søg efter navn eller email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Agent</TableHead>
                <TableHead className="text-muted-foreground">Grundløn</TableHead>
                <TableHead className="text-muted-foreground">Salg (måned)</TableHead>
                <TableHead className="text-muted-foreground">Provision</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow 
                  key={agent.id} 
                  className="border-border cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {agent.baseSalary.toLocaleString("da-DK")} kr
                  </TableCell>
                  <TableCell className="text-foreground">
                    {agent.sales}
                  </TableCell>
                  <TableCell className="font-semibold text-success">
                    {agent.commission.toLocaleString("da-DK")} kr
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={agent.isActive ? "active" : "cancelled"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
