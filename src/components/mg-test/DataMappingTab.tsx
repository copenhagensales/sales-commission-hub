import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldDefinitionsManager } from "./FieldDefinitionsManager";
import { IntegrationMappingEditor } from "./IntegrationMappingEditor";

export function DataMappingTab() {
  const [activeTab, setActiveTab] = useState("definitions");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="definitions">Standard Feltdefinitioner</TabsTrigger>
          <TabsTrigger value="mappings">API Feltmapping</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions">
          <FieldDefinitionsManager />
        </TabsContent>

        <TabsContent value="mappings">
          <IntegrationMappingEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
