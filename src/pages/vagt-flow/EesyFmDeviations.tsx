import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VagtFlowLayout } from "@/components/vagt-flow/VagtFlowLayout";

const TABS = [
  { value: "upload", label: "Upload" },
  { value: "overview", label: "Oversigt" },
  { value: "raw", label: "Rådata" },
] as const;

const XLSX_ACCEPT = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

function FileDropzone({
  label,
  dropText,
  file,
  onFile,
  onClear,
}: {
  label: string;
  dropText: string;
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    accept: XLSX_ACCEPT,
    maxFiles: 1,
  });

  if (file) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center border-success/40 bg-success/5">
        <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-success" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-medium truncate">{file.name}</p>
        <Button variant="ghost" size="sm" className="mt-2 h-7" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1" /> Skift fil
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      {isDragActive ? (
        <p className="text-base">Slip filen her...</p>
      ) : (
        <>
          <p className="text-base mb-1">{dropText}</p>
          <p className="text-xs text-muted-foreground">eller klik for at vælge</p>
        </>
      )}
    </div>
  );
}

export default function EesyFmDeviations() {
  const [gadenCoopFile, setGadenCoopFile] = useState<File | null>(null);
  const [markedFile, setMarkedFile] = useState<File | null>(null);

  return (
    <VagtFlowLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Afstem automatisk salg</h1>
          <p className="text-muted-foreground">
            Afvigelser på Eesy FM — upload, overblik og rådata
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="upload">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Upload className="h-5 w-5" />
                  Upload kurv-fil
                </CardTitle>
                <CardDescription>
                  Upload Excel-filer (.xlsx). Én fil for Gaden/Coop og én for Marked.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <FileDropzone
                    label="Gaden/Coop"
                    dropText="Træk og slip Gaden/Coop-fil"
                    file={gadenCoopFile}
                    onFile={setGadenCoopFile}
                    onClear={() => setGadenCoopFile(null)}
                  />
                  <FileDropzone
                    label="Marked"
                    dropText="Træk og slip Marked-fil"
                    file={markedFile}
                    onFile={setMarkedFile}
                    onClear={() => setMarkedFile(null)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="raw">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Indhold tilføjes her.
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </VagtFlowLayout>
  );
}
