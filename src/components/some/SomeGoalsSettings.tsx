import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DefaultGoals } from "@/hooks/useSomeContent";

interface SomeGoalsSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: DefaultGoals | undefined;
  onSave: (goals: Partial<DefaultGoals>) => void;
}

export function SomeGoalsSettings({ open, onOpenChange, goals, onSave }: SomeGoalsSettingsProps) {
  const [tiktok, setTiktok] = useState(goals?.tiktok_videos_target ?? 7);
  const [stories, setStories] = useState(goals?.insta_stories_target ?? 3);
  const [posts, setPosts] = useState(goals?.insta_posts_target ?? 1);

  useEffect(() => {
    if (goals) {
      setTiktok(goals.tiktok_videos_target);
      setStories(goals.insta_stories_target);
      setPosts(goals.insta_posts_target);
    }
  }, [goals]);

  const handleSave = () => {
    onSave({
      tiktok_videos_target: tiktok,
      insta_stories_target: stories,
      insta_posts_target: posts,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ugentlige mål</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tiktok">TikTok videoer pr. uge</Label>
            <Input
              id="tiktok"
              type="number"
              min={0}
              value={tiktok}
              onChange={(e) => setTiktok(parseInt(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="stories">Instagram Stories pr. uge</Label>
            <Input
              id="stories"
              type="number"
              min={0}
              value={stories}
              onChange={(e) => setStories(parseInt(e.target.value) || 0)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="posts">Instagram posts pr. uge</Label>
            <Input
              id="posts"
              type="number"
              min={0}
              value={posts}
              onChange={(e) => setPosts(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave}>Gem mål</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
