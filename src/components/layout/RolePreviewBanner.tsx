import { useRolePreview } from "@/contexts/RolePreviewContext";
import { X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function RolePreviewBanner() {
  const { isPreviewMode, previewRole, exitPreviewMode } = useRolePreview();
  const navigate = useNavigate();

  if (!isPreviewMode) return null;

  const handleExit = () => {
    exitPreviewMode();
    navigate("/employees");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5" />
        <span className="font-medium">
          Preview-tilstand: Du ser appen som en <strong>{previewRole}</strong> ville se den
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="text-white hover:bg-orange-600 hover:text-white gap-2"
      >
        <X className="h-4 w-4" />
        Afslut preview
      </Button>
    </div>
  );
}
