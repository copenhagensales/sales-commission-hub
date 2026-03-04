

## Fjern medarbejder fra team

### Mål
Tilføj en X-knap på hver medarbejder i "Medarbejdere"-fanen i Rediger team-dialogen. Knappen fjerner medarbejderen fra teamet (gør dem teamløse). Kun synlig for medarbejdere der kun er på ét team.

### Ændringer i `src/components/employees/TeamsTab.tsx`

**1. Ny mutation (efter `deleteMutation`, ~linje 323)**

Tilføj `removeFromTeamMutation` der sletter rækken i `team_members` og opdaterer lokal `formData.employee_ids`:

```typescript
const removeFromTeamMutation = useMutation({
  mutationFn: async ({ employeeId, teamId }: { employeeId: string; teamId: string }) => {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("employee_id", employeeId)
      .eq("team_id", teamId);
    if (error) throw error;
  },
  onSuccess: (_, { employeeId }) => {
    queryClient.invalidateQueries({ queryKey: ["team-members-mappings"] });
    setFormData(prev => ({
      ...prev,
      employee_ids: prev.employee_ids.filter(id => id !== employeeId),
    }));
    toast({ title: "Medarbejder fjernet fra team" });
  },
});
```

**2. Hjælpefunktion**

```typescript
const getEmployeeTeamCount = (employeeId: string) =>
  teamMembers.filter(tm => tm.employee_id === employeeId).length;
```

**3. X-knap på medarbejderkort (~linje 1343-1365)**

Tilføj en X-knap ved siden af hver medarbejder, kun hvis `getEmployeeTeamCount(emp.id) === 1`:

```tsx
{getEmployeeTeamCount(emp.id) === 1 && editingTeam && (
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive rounded-full shrink-0"
    onClick={() => removeFromTeamMutation.mutate({ 
      employeeId: emp.id, 
      teamId: editingTeam.id 
    })}
  >
    <X className="h-3.5 w-3.5" />
  </Button>
)}
```

Medarbejdere med flere teams (stab-ansatte) vises uden X-knap — de skal flyttes via "Flyt team".

