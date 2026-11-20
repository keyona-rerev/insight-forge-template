-- Card titles scraped before create-manual-source decoded entities kept raw
-- text such as "Installable Triggers &nbsp;|&nbsp; Apps Script". This
-- decodes the common entities in existing titles once. Safe to run twice:
-- a decoded title has nothing left to replace.

update public.reference_cards
set title = trim(regexp_replace(
      replace(replace(replace(replace(replace(replace(replace(
        title,
        '&nbsp;', ' '), '&amp;', '&'), '&#39;', ''''), '&#039;', ''''), '&quot;', '"'), '&mdash;', '—'), '&ndash;', '–'),
      '\s+', ' ', 'g'))
where title ~ '&(nbsp|amp|#39|#039|quot|mdash|ndash);'
  -- A queued summary job was built from the old title; changing it now would
  -- void that job. Those cards are left for the next run of this script.
  and summary_state <> 'queued';
