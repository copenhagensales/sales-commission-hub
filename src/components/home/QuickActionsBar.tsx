import { Link } from "react-router-dom";
import { Target, TrendingUp, Trophy, Share2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsBarProps {
  hasGoal: boolean;
  progressPercent: number;
  isEnrolledInLeague: boolean;
}

type ActionType = "set_goal" | "catch_up" | "milestones" | "share_success" | "join_league";

interface QuickAction {
  type: ActionType;
  label: string;
  icon: React.ElementType;
  href: string;
  variant?: "default" | "outline" | "secondary";
}

export function QuickActionsBar({
  hasGoal,
  progressPercent,
  isEnrolledInLeague,
}: QuickActionsBarProps) {
  // Determine which actions to show based on user status
  const getContextualActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];

    // Primary action based on goal status
    if (!hasGoal) {
      actions.push({
        type: "set_goal",
        label: "Sæt dit mål for perioden",
        icon: Target,
        href: "/my-goals",
        variant: "default",
      });
    } else if (progressPercent < 80) {
      actions.push({
        type: "catch_up",
        label: "Se hvordan du indhenter",
        icon: TrendingUp,
        href: "/my-goals",
        variant: "default",
      });
    } else if (progressPercent < 100) {
      actions.push({
        type: "milestones",
        label: "Se dine næste milestones",
        icon: TrendingUp,
        href: "/my-goals",
        variant: "default",
      });
    } else {
      actions.push({
        type: "share_success",
        label: "Se din fremgang",
        icon: Trophy,
        href: "/my-goals",
        variant: "default",
      });
    }

    // Secondary action: League enrollment
    if (!isEnrolledInLeague) {
      actions.push({
        type: "join_league",
        label: "Tilmeld salgsligaen",
        icon: Trophy,
        href: "/commission-league",
        variant: "outline",
      });
    }

    return actions;
  };

  const actions = getContextualActions();

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link key={action.type} to={action.href}>
          <Button 
            variant={action.variant || "default"} 
            size="sm" 
            className="gap-2"
          >
            <action.icon className="w-4 h-4" />
            {action.label}
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      ))}
    </div>
  );
}
