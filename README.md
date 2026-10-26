# Sibuyan Coconut Identification System

Next.js application for coconut variety records and experimental image screening focused on Sibuyan Island, Romblon.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- MongoDB with Prisma ORM
- NextAuth credentials authentication with bcrypt password hashing
- shadcn/ui-style components, lucide-react icons
- Recharts dashboard analytics
- Zustand state store
- Local image preview and Cloudinary-ready environment variables

## Image screening and identification

Identification lazily loads quantized `Xenova/clip-vit-base-patch32` using
Transformers.js 3.8.1 (WASM). The model runs in the browser; no paid inference API
is used. Initial model files are downloaded from Hugging Face and cached by the
browser. Images are uploaded to the configured Cloudinary account for admin
review, including rejected and uncertain scans.
The browser runtime uses one WASM thread with worker proxying disabled, including
on Chrome mobile and local network previews without cross-origin isolation.
Identification resizes photos before inference and uses the same optimized pixels
for upload. Initial model loading allows up to ten minutes; errors distinguish
download/startup, timeout, memory exhaustion, and inference failures without exposing
raw internal errors. A smaller photo does not reduce the model's own memory needs;
Cache/serialized-model failures get one retry with browser model caching disabled,
without deleting site data. Network failures use the safe `MODEL_NETWORK` code;
failed cache recovery uses `MODEL_CACHE`. Other failures retain the engine/memory
messages. These codes describe failure classes, not a verified Chrome root cause.
Nested runtime errors are classified without displaying raw details. Startup
diagnostics also distinguish `MODEL_ENGINE`, `MODEL_MEMORY`, `MODEL_APP_FILES`,
and `MODEL_START_UNKNOWN`; unknown inference failures use `MODEL_RUN_UNKNOWN`.
some low-memory devices may still be unable to run CLIP. Actual phone validation is
required before claiming device compatibility.

The six fixed screening categories compare coconut fruit with palm trees/leaves,
other fruit/vegetables, people/animals, manufactured objects, and scenery/documents.
A category must score at least 0.80 and lead the runner-up by at least 0.20;
otherwise the result is uncertain. These are provisional, uncalibrated thresholds.
Model failure offers retry rather than a fallback classification.

New scans compare normalized 512-dimensional CLIP image
embeddings against all prepared variety photos and positive reviewed examples.
Each variety averages the cosine similarities of up to three closest references,
after comparing all prepared photos; the five highest
comparisons are displayed, including weak alternatives. Scores are independent,
do not sum to 100%, and are not calibrated identification confidence. Unprepared
varieties have no invented percentage. Generic keywords and descriptive record
text do not contribute. Negative reviewed example
overlap routes a scan to review instead of asserting that visual similarity proves
the image is not coconut. Corrections do not retrain CLIP.
For embedding-based scans, uncertain or negative model screening still shows the
comparison list with an **Unable to determine** warning. Scores do not override
that warning. A close explicit admin-reviewed negative can still return **Not coconut**;
conflicting known references require review. Screening thresholds remain provisional;
they are not lowered to manufacture positive identifications.

Admin corrections now retain a server-derived pixel fingerprint. Before applying
the CLIP screening gate, the server checks for the same or a nearly identical
reviewed image (strict thumbnail-color and edge comparisons, excluding blank
images). A close approved reference can suggest its corrected variety even when
CLIP is uncertain or wrong. An exact negative reference rejects the image;
conflicting references stay uncertain. Shared color/shape/texture words alone
cannot bypass screening. This recognizes repeated photos, not new poses or crops.
Color analysis also recognizes orange fruit.

Existing corrections automatically acquire fingerprints from their saved source
images, at most four uncached references per request, then cache them on the
learning example. No variety re-upload is required when that source image is
still available. Storage reads are restricted to the configured Cloudinary
account. New corrections copy the fingerprint saved with the scan, so it survives
scan/image deletion. A correction made before this update whose source image was
already deleted cannot recover its pixels; a fresh scan and review are needed.
The original CLIP screening outcome remains in history for traceability; an admin
correction does not alter the model or its global threshold.

The API returns `status` (`possible_matches`, `not_coconut`, `uncertain`),
`message`, and `matches`, with a labeled visual-similarity percentage for prepared
comparisons. Browser-supplied analysis
is validated but remains advisory, not server-verified inference. Legacy confidence
values remain stored unchanged and are no longer displayed as accuracy. New numeric
values are normalized similarity only. JPEG, PNG and WebP are accepted up
to 10 MB; uploads are optimized before submission. Vercel's request-body limits
still apply to the final optimized request.

## Five-photo variety references

Creating a variety or changing its photo set requires exactly five different
JPEG, PNG, or WebP images, each at most 10 MB before optimization. Add/Edit supports
multiple selection, removal, and choosing the cover. Use varied angles and lighting;
five photos improve comparison coverage but do not guarantee accuracy or retrain CLIP.
Existing one-photo records may still save metadata without changing their photo set.
The first gallery photo mirrors the legacy cover field for existing views/exports.

After deployment, open Admin > Varieties > **Prepare / retry existing references**.
This explicitly processes saved variety photos and reviewed scan sources in the
browser; re-upload is unnecessary when the source remains available. Preparation
can be stopped after the current image and failed items retried. Unavailable sources
need replacement images. New scans and new gallery uploads already include embeddings.
Preparation and browser-submitted vectors are advisory, not server-verified inference.
Preparation submits the already-downloaded, optimized photo to the application's
server for file/signature/size and usable-pixel validation, after checking ownership
and the current saved source. It does not require a second server storage download.
The server does not verify that the submitted pixels equal the remote photo.
External legacy sources never receive a destroy ID for the configured storage account.

Gallery uploads are staged with unique storage IDs and attached transactionally
after ownership, count, duplicate-fingerprint, and embedding validation.
Variety saves use a bounded 15-second interactive transaction budget, including
the audit write, to avoid Prisma's default 5-second expiry during five-photo updates.
Save failures expose safe diagnostic codes without database messages or credentials.
Replaced unshared images are cleaned after saving; shared assets are preserved. If cleanup
fails, the record remains saved and the UI reports pending cleanup. The admin
**Clean unused uploads** action retries detached uploads older than 24 hours and
pending removals. It never removes attached gallery images.

## Admin scan deletion

Admins can permanently delete a scan after confirmation. The endpoint authenticates
admins, validates IDs, preserves reviewed learning examples with a detached source,
and writes an audit log. Shared Cloudinary assets are preserved. Unshared assets
are destroyed with cache invalidation; already-missing assets are accepted.
If storage cleanup fails, the scan is retained. If a later database transaction
fails, retrying is safe even when the image has already been removed.
Legacy images whose storage identity cannot be safely determined are retained with
a review message. All new uploads use unique IDs and disable overwriting.

## Validation and deployment

Run `npx tsx scripts/test-gallery-ranking.ts`,
`npx tsx scripts/test-reference-pixels.ts`,
`npx tsx scripts/test-identification.ts`, `npx tsx scripts/test-suspension.ts`,
`npm run lint`, and `npm run build`. Regression tests use synthetic inputs and
mocked database/storage services, without loading `.env` or modifying live data.
If Turbopack cannot start its CSS worker on Windows, use the supported
`npm run build -- --webpack` alternative. This is a local build-tool limitation;
verify the normal Vercel production build independently before releasing.

The additive schema adds the `VarietyImage` collection with ownership, optional
variety relation, ordering, embedding/fingerprint JSON, and deletion state, plus
indexes on variety/uploader IDs. It also adds optional `IdentificationHistory.analysis`,
`TrainingExample.imageFingerprint`, and `TrainingExample.imageEmbedding` JSON fields.
Generate the Prisma client during installation/build. MongoDB has no SQL migration
for these fields; existing documents remain readable without automatic backfill. If
your release workflow uses `prisma db push`, review the target database and proposed
changes first and run it separately from local verification; never use reset/seed
as part of this release. Deploy schema-compatible server and client together so
new requests include both screening evidence and image embeddings. Review and apply
the additive schema/index update as a separate production release step, then prepare
existing references with the admin button. No historical confidence recalculation
or automatic production deployment is included.

Before claiming accuracy, build a verified, held-out image set with coconut fruit,
each supported variety, other fruits, trees, unrelated objects, blank/blurry images,
and varied lighting/backgrounds. Evaluate coconut screening separately from variety
identification. There is currently no validated accuracy estimate.

## Temporary suspension

`SITE_SUSPENDED=true` blocks all pages and APIs, including admins. To restore access,
set it to `false` or remove it. Change the Production variable in Vercel and redeploy;
restart the server for local changes. This server-only setting must never use a
`NEXT_PUBLIC_` prefix. Keep `.env` and all credentials out of Git and logs.


