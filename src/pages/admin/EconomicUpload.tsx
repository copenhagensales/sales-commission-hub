import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileArchive, CheckCircle2, XCircle, Loader2, Clock, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface EconomicImport {
  id: string;
  created_at: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: string;
  error_message: string | null;
  detected_start_date: string | null;
  detected_end_date: string | null;
  rows_postering: number;
  rows_konto: number;
  processing_time_ms: number | null;
  files_found: string[] | null;
}

export default function EconomicUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch import history
  const { data: imports, isLoading } = useQuery({
    queryKey: ["economic-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as EconomicImport[];
    },
  });

  // Process import mutation
  const processImport = useMutation({
    mutationFn: async ({ storagePath, importId }: { storagePath: string; importId: string }) => {
      const { data, error } = await supabase.functions.invoke("import-economic-zip", {
        body: { storagePath, importId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-imports"] });
      toast({
        title: "Import gennemført",
        description: "Data er nu importeret til databasen.",
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["economic-imports"] });
      toast({
        title: "Import fejlede",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const lowerName = file.name.toLowerCase();
      const isValidFile = lowerName.endsWith(".zip") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
      
      if (!isValidFile) {
        toast({
          title: "Forkert filtype",
          description: "Upload venligst en ZIP- eller Excel-fil fra e-conomic.",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);

      try {
        const timestamp = Date.now();
        const storagePath = `${timestamp}/${file.name}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("economic-imports")
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        // Create import record
        const { data: importRecord, error: insertError } = await supabase
          .from("economic_imports")
          .insert({
            storage_path: storagePath,
            file_name: file.name,
            file_size_bytes: file.size,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) throw insertError;

        toast({
          title: "Fil uploadet",
          description: "Starter import...",
        });

        // Trigger processing
        await processImport.mutateAsync({
          storagePath,
          importId: importRecord.id,
        });
      } catch (error: any) {
        console.error("Upload error:", error);
        toast({
          title: "Upload fejlede",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [toast, processImport]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="outline" className="border-primary/30 text-primary">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Gennemført
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Fejl
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Behandler
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Afventer
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">E-conomic Import</h1>
            <p className="text-muted-foreground mt-1">
              Upload ZIP-eksport fra e-conomic for at importere posteringer og kontoplan
            </p>
          </div>

          {/* Upload area */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload ZIP-fil
              </CardTitle>
            <CardDescription>
              Træk og slip en ZIP- eller Excel-fil fra e-conomic, eller klik for at vælge
            </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                  ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                  ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-lg font-medium">Uploader og behandler...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileArchive className="h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-medium">
                      {isDragActive ? "Slip filen her" : "Træk ZIP- eller Excel-fil hertil"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Understøtter .zip, .xlsx og .xls filer
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Import history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Import historik
              </CardTitle>
              <CardDescription>
                Tidligere imports og deres status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : imports && imports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidspunkt</TableHead>
                      <TableHead>Fil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead className="text-right">Rækker</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(imp.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{imp.file_name || "Ukendt"}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(imp.file_size_bytes)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(imp.status)}
                            {imp.error_message && (
                              <span className="text-xs text-destructive">{imp.error_message}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {imp.detected_start_date && imp.detected_end_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(imp.detected_start_date), "d. MMM", { locale: da })} - 
                              {format(new Date(imp.detected_end_date), "d. MMM yyyy", { locale: da })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col text-sm">
                            <span>{imp.rows_postering.toLocaleString("da-DK")} posteringer</span>
                            <span className="text-muted-foreground">{imp.rows_konto.toLocaleString("da-DK")} konti</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Ingen imports endnu. Upload din første ZIP-fil ovenfor.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </MainLayout>
  );
}
