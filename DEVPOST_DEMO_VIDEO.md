# Cado AI — 3-Minute Devpost Demo

## Recording setup

- Resolution: 1920×1080, browser zoom 100%, notifications disabled.
- Demo login: `demo@cado.study` / `CadoDemo2026!`
- Source PDF: `frontend/public/cado-demo-notes.pdf`
- Reset the demo at any time:
  `cd backend && DEMO_FILE_URL=http://localhost:3000/cado-demo-notes.pdf .venv/bin/python scripts/seed_devpost_demo.py`
- Use the seeded study set for Learn, Tutor, Quiz results, Dashboard, Plans, and History.
- For the upload shot, select `cado-demo-notes.pdf`, but record generation separately and cut waiting down to three seconds.

## Timestamped production script

| Time | On-screen action | Exact voiceover |
|---|---|---|
| **0:00–0:12** | Landing hero. Slow cursor move over the four-step Upload → Learn → Quiz → Plan strip. | Students already have the material they need, but turning scattered notes into a useful study routine takes time. Cado AI turns those notes into one connected learning session: a guided loop from understanding, to practice, to an achievable plan. |
| **0:12–0:22** | Click **Start learning**. Two-second registration shot, then hard cut to the populated dashboard. | Create a personal workspace, and Cado keeps your learning, progress, and next steps together instead of sending you across five different tools. |
| **0:22–0:52** | Open Upload. Drop `cado-demo-notes.pdf`. Hover formats, counts, language, focus, and answer options. Click Generate. Show three pipeline states using jump cuts. Overlay: **Local BGE-M3 · Notes stay grounded**. | I can drop in a PDF, PowerPoint, text file, or even a photo of notes. Then I choose exactly what I want: explanations, flashcards, quiz questions, language, topic focus, and four or five answer choices. Behind the scenes, Cado extracts the text with PyMuPDF or Tesseract, breaks it into searchable chunks, and creates local BGE-M3 embeddings in pgvector. Relevant passages are sent to the study model, so the output stays grounded in my material. |
| **0:52–1:20** | Learn tab: scroll one explanation, click **Full explain**, click **Vocabulary**, then switch to Flashcards. Flip one card and select **Got it**. | The Learn view starts with concise explanations, but I can expand any concept when I need the full picture. Vocabulary mode defines difficult terms in context. Flashcards flip naturally, work from the keyboard, and let me rate confidence, so review becomes active instead of passive rereading. |
| **1:20–1:43** | Open **Ask Cado**. Send: “Why do plants need both photosynthesis and cellular respiration?” Click citation `[1]` to open the PDF page. Overlay: **Answers cited to your notes**. | When I am stuck, Ask Cado becomes a tutor for this exact set. It answers from my notes first and attaches page-level citations I can open immediately. If the material does not cover my question, it can fall back to trusted teaching sources and clearly labels the difference. |
| **1:43–2:13** | Take Quiz. Answer one correct, one wrong, flag one, then jump cut to seeded completed result. Show score chart, missed topics, **Full explain**, and **Share**. | Quizzes give instant feedback without revealing answers before I commit. I can flag questions, skip, navigate freely, and request a full explanation of every option. The result screen shows what I missed, turns those gaps into a focused retry, and creates a shareable quiz link for signed-in friends. |
| **2:13–2:45** | Dashboard: hover streak, accuracy, weak topics, countdown, month, wins. Scroll to Plans. Drag one task, start/pause timer, check a task. Overlay: **Personalized plan · Built-in focus timer**. | Back on Today, Cado turns activity into direction: my streak, accuracy, weak topics, exam countdown, monthly progress, and wins are visible at a glance. The personalized plan breaks a goal into realistic daily tasks. I can edit or reorder them, run a focused timer, and mark each step complete. Weak topics link straight back to practice. |
| **2:45–2:54** | Open History. Hover Learn and Quiz on the set. Toggle dark mode. | History keeps every generated set ready to learn or quiz again, while light and dark themes make the workspace feel personal. Everything remains connected to the original notes instead of becoming another folder of disconnected AI output. |
| **2:54–3:00** | Return to dashboard with Cado mascot visible. Fade in product name and tagline. | Cado AI turns the notes students already have into the explanation, practice, tutoring, and plan they need next. |

## Edit map

Seven silent 1920×1080 reference clips are generated in the ignored
`demo-video-clips/` directory:

- `01-opening-login.webm` — 5.80s
- `02-upload-options.webm` — 6.68s
- `03-learn-flashcards.webm` — 8.72s
- `04-tutor-citations.webm` — 7.20s
- `05-quiz.webm` — 5.00s
- `06-dashboard-plan.webm` — 10.36s
- `07-history-theme.webm` — 4.96s
- `cado-devpost-rough-cut.mp4` — exactly 3:00 at 1920×1080/24fps,
  with all three overlays and the end card applied (silent, 12.6 MB)

Regenerate them with `cd frontend && node scripts/record-devpost-demo.mjs`.
These are reference takes: hold or repeat the cleanest frames beneath the
voiceover, and manually capture the exact clicks called for below when making
the final submission.

1. Record each row as a separate clip; do not attempt one continuous take.
2. Keep cursor movement deliberate. Pause over the target for half a second before each click.
3. Speed up only the upload pipeline, using three one-second clips: **Upload notes**, **Read & embed**, **Write the set**.
4. Use hard cuts between routes. Use a short dissolve only for the final logo/tagline.
5. Add three overlays, each for 2.5–3 seconds:
   - `Local BGE-M3 · Notes stay grounded` at 0:39.
   - `Answers cited to your notes` at 1:29.
   - `Personalized plan · Built-in focus timer` at 2:29.
6. Keep music at least 18 dB below narration. Let interface audio play only for the plan timer.
7. End card, 2.5 seconds:
   - **Cado AI**
   - **Notes in. A study session out.**
   - `Next.js · FastAPI · Neon/pgvector · PyMuPDF/Tesseract · BGE-M3`

The narration is 388 words. At 130 words per minute it runs approximately
2:59, leaving about one second of tolerance inside the 3:00 timeline.

## Capture checklist

- [ ] Landing hero and four-step strip
- [ ] Register form and populated dashboard reveal
- [ ] Upload configuration and all three progress stages
- [ ] Short explanation, Full explain, Vocabulary, flashcard flip, confidence
- [ ] Tutor response and PDF citation viewer
- [ ] Correct, wrong, flagged, and skipped quiz states
- [ ] Completed score, weak-topic review, Full explain, and Share
- [ ] Dashboard analytics, countdown, month progress, and wins
- [ ] Plan drag reorder, timer, and task completion
- [ ] History and theme toggle
- [ ] Closing dashboard and end card

## Technical claims shown or spoken

- Inputs: PDF, PPTX, TXT, PNG, JPEG, and WebP.
- Extraction: PyMuPDF for PDFs and Tesseract OCR for images/scanned documents.
- Retrieval: normalized 1024-dimensional local BGE-M3 embeddings stored in Neon PostgreSQL with pgvector.
- Outputs: configurable explanations, flashcards, and 4–5 option MCQs.
- Tutor: notes-first retrieval, page citations, trusted-web fallback, and optional diagrams.
- Product loop: Learn → Quiz → weak-topic review → personalized plan.

## Safety take

If a live external call fails, keep recording and switch to the seeded set in History. Do not show deployment logs, `.env` files, API keys, database URLs, or the diagnostics screen in the final video. Delete or rotate the public demo account after submission.
