import { Badge } from "@/components/ui/badge";

interface BrandBadgeProps {
  brandName: string;
  brandColor: string;
  className?: string;
}

export function BrandBadge({ brandName, brandColor, className }: BrandBadgeProps) {
  const isEesy = brandName.toLowerCase() === "eesy";
  const isYouSee = brandName.toLowerCase() === "yousee";

  return (
    <Badge
      className={`${
        isEesy
          ? "bg-orange-500 text-white hover:bg-orange-600"
          : isYouSee
          ? "bg-blue-700 text-white hover:bg-blue-800"
          : ""
      } ${className}`}
      style={
        !isEesy && !isYouSee
          ? { backgroundColor: brandColor, color: "#fff" }
          : undefined
      }
    >
      {brandName}
    </Badge>
  );
}
