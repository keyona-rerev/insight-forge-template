import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface LessonRow { id: string; lesson: string; source_notes: string | null; created_at: string }

// "Learned from your edits": the general lessons the AI saved from Revise
// notes. Every new draft follows these. Removing one takes effect on the
// next draft.
export const LearnedLessons = () => {
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("writing_lessons" as any)
      .select("id, lesson, source_notes, created_at")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data || []) as unknown as LessonRow[]);
    setLoaded(true);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("writing_lessons" as any).delete().eq("id", id);
    if (error) { toast.error("Could not remove that lesson"); return; }
    setRows((p) => p.filter((r) => r.id !== id));
    toast.success("Removed. New drafts won't use it.");
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <Label className="text-base">Learned from your edits</Label>
        <p className="text-sm text-muted-foreground">
          When you revise a draft with notes, the AI saves any note that applies to posts in general. Every new draft follows these. Remove one if it's wrong.
        </p>
      </div>
      {!loaded ? null : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. Use Revise with notes on the Review page.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <div className="flex-1">
                <p>{r.lesson}</p>
                {r.source_notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">From your note: "{r.source_notes.slice(0, 160)}{r.source_notes.length > 160 ? "..." : ""}"</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Remove lesson">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
