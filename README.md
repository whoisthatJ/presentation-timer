# Roomtone

A gentle, looping timer for student presentation sessions:

1. Presentation — 2 minutes
2. Questions — 1 minute
3. Next speaker — 30 seconds

The phase durations are editable by clicking a time. Changing the active phase
updates its countdown immediately. Start the session to begin the loop; the
timer advances automatically, or use **Skip to…** to finish a phase early and
move to the next. Each transition has a quiet phase-specific signal: two beeps
for presentations, three for questions, and four for the speaker handoff.
Pause and reset controls are available at any time. Duration settings are saved
in the browser on the current device.

## Run locally

Open `index.html` in a modern browser. No build step or dependencies are
required. A local static server also works:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.
