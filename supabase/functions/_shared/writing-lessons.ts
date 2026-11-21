// Lessons learned from the owner's Revise notes.
//
// When the owner revises a draft with notes, the editor also writes one
// general rule for future posts (or none, when the notes were only about
// that post). Those rules are stored in writing_lessons and given to every
// later draft, so the owner doesn't have to repeat the same note. The
// owner can see and remove them on the Strategy page.

// deno-lint-ignore no-explicit-any
type Db = any;

export const MAX_LESSONS = 20;

// The JSON field the revise prompt asks for, and how to ask for it.
export const LESSON_INSTRUCTION =
  `Also write "lesson": one short instruction, under 200 characters, that every future post should follow, based on these notes. ` +
  `Only include what applies to posts in general (tone, openings, structure, length, words or phrases to avoid). ` +
  `If the notes are only about this post's specific content, set "lesson" to "".`;

// A usable lesson, or null for empty / placeholder / oversized answers.
export function cleanLesson(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim().replace(/^["'\-\s]+|["'\s]+$/g, "");
  if (t.length < 8 || t.length > 300) return null;
  if (/^(none|n\/a|no lesson|null)\.?$/i.test(t)) return null;
  return t;
}

// Newest active lessons first, capped. Never throws: an install that has not
// run the migration yet simply gets no lessons.
export async function loadLessons(supabase: Db, userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("writing_lessons")
      .select("lesson")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(MAX_LESSONS);
    if (error || !data) return [];
    return data.map((r: { lesson: string }) => String(r.lesson ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// System-prompt lines for the lessons, or [] when there are none.
export function lessonsLines(lessons: string[]): string[] {
  if (!lessons.length) return [];
  return [
    "LEARNED FROM THE OWNER'S PAST EDITS (follow these in every draft; a hard rule wins if they conflict):",
    ...lessons.map((l) => `- ${l}`),
    "",
  ];
}

// Save one lesson. Duplicates (same text, any case) are ignored by a unique
// index. Returns the saved text, or null if nothing was saved.
export async function saveLesson(
  supabase: Db, userId: string, raw: unknown, draftId: string | null, notes: string,
): Promise<string | null> {
  const lesson = cleanLesson(raw);
  if (!lesson) return null;
  try {
    const { error } = await supabase.from("writing_lessons").insert({
      user_id: userId, lesson, source_draft_id: draftId, source_notes: notes.slice(0, 2000),
    });
    if (error) return null;
    return lesson;
  } catch {
    return null;
  }
}
