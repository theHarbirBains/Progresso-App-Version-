# Guide cards

How to Do It's two card pages for a built-in exercise: page 1, the demonstration and instructions;
page 2, Technique & Setup. Harbir generates them; each card is one picture with its words in it.
Where an exercise has its cards, How to Do It shows just those two pages; the others keep the drawn
page.

## Adding cards

1. Put the images in a folder outside the repo (they're the sources; only the published WebPs are
   committed). A **sheet** is a grid of exercises side by side (three or five so far), page 1 along
   the top and page 2 under it, its cards parted by a thin line drawn across the sheet or by a dark
   gap. A card made **on its own** is named for the exercise's slug and page:
   `bb-back-squat_1.png`, `bb-back-squat_2.png` (or `.jpg`, `.webp`), and takes that page's place.
2. List each sheet in `cards.json`: its file name and a slug for each column, in order (`null` for a
   column to skip). A slug is the catalogue's (`supabase/catalog/*.mjs`). A new sheet for exercises
   already listed replaces their entries in the old one (`null` there, or left out).
3. `python tools/guide-cards/publish.py "<folder>"` cuts the sheets, checks every slug is an active
   built-in listed once, writes `apps/mobile/assets/guide-cards/<slug>_<page>.webp` (never larger
   than drawn, at most 1170 px wide) and `apps/mobile/src/exercises/illustrations/guideCards.generated.ts`,
   and removes the files of exercises no longer listed.

Look at every new card beside its slug before committing: the script can only check the slugs, not
that a column shows the exercise it's listed as.

A card should be drawn at least 1080 px wide to stay sharp on an iPhone; one cut from a sheet is
only as large as its column (about 350 px on a five-across sheet, 510 on a three-across one).
