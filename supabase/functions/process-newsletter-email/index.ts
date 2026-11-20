// REMOVED: the Mailgun newsletter webhook was retired. Newsletters now arrive
// through Gmail. This stub answers 410 Gone so nothing is processed here.
// Safe to delete this whole folder from the repo.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "This endpoint was retired." }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
