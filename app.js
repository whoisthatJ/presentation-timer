const phases = [
  { name: "Presentation", hint: "Your floor is yours.", nextHint: "Wrap up your final thought.", key: "presentation" },
  { name: "Questions", hint: "Curiosity welcome.", nextHint: "One last question, then we switch.", key: "questions" },
  { name: "Next speaker", hint: "A moment to find your place.", nextHint: "The next speaker is up.", key: "handoff" },
];

const DEFAULT_DURATIONS = [120, 60, 30];
const STORAGE_KEY = "roomtone-durations-v1";
const CIRCLE_LENGTH = 2 * Math.PI * 128;
const phaseList = document.querySelector("#phase-list");
const phaseTitle = document.querySelector("#phase-title");
const timeValue = document.querySelector("#time-value");
const timerHint = document.querySelector("#timer-hint");
const timerRing = document.querySelector("#timer-ring");
const ringProgress = document.querySelector(".ring-progress");
const startPauseButton = document.querySelector("#start-pause");
const startPauseLabel = document.querySelector("#start-pause-label");
const resetButton = document.querySelector("#reset");
const sessionStatus = document.querySelector("#session-status");
const announcements = document.querySelector("#announcements");

let durations = loadDurations();
let currentPhase = 0;
let remaining = durations[currentPhase];
let running = false;
let deadline = 0;
let intervalId = null;
let audioContext = null;

function loadDurations() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      Array.isArray(stored) &&
      stored.length === phases.length &&
      stored.every((value) => Number.isInteger(value) && value > 0 && value <= 5999)
    ) {
      return stored;
    }
  } catch (error) {
    console.warn("Could not load saved timer settings.", error);
  }
  return [...DEFAULT_DURATIONS];
}

function saveDurations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(durations));
  } catch (error) {
    console.warn("Could not save timer settings.", error);
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderPhases() {
  phaseList.replaceChildren();

  phases.forEach((phase, index) => {
    const card = document.createElement("article");
    card.className = `phase-card${index === currentPhase ? " is-current" : ""}`;
    card.dataset.phase = String(index);

    const top = document.createElement("div");
    top.className = "phase-card-top";

    const number = document.createElement("span");
    number.className = "phase-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const name = document.createElement("span");
    name.className = "phase-name";
    name.textContent = phase.name;
    top.append(number, name);

    const time = document.createElement("div");
    time.className = "phase-time";
    const timeButton = document.createElement("button");
    timeButton.className = "phase-time-button";
    timeButton.type = "button";
    timeButton.textContent = formatTime(durations[index]);
    timeButton.setAttribute("aria-label", `Edit ${phase.name} duration, ${formatTime(durations[index])}`);
    timeButton.setAttribute("aria-expanded", "false");
    timeButton.addEventListener("click", () => openDurationEditor(index, card));
    const label = document.createElement("span");
    label.className = "phase-time-label";
    label.textContent = "min";
    time.append(timeButton, label);

    card.append(top, time);
    phaseList.append(card);
  });
}

function openDurationEditor(index, card) {
  if (card.querySelector(".duration-editor")) return;

  const timeButton = card.querySelector(".phase-time-button");
  timeButton.setAttribute("aria-expanded", "true");
  const minutes = Math.floor(durations[index] / 60);
  const seconds = durations[index] % 60;
  const editor = document.createElement("form");
  editor.className = "duration-editor";
  editor.setAttribute("aria-label", `Edit ${phases[index].name} duration`);

  const minutesInput = document.createElement("input");
  minutesInput.type = "number";
  minutesInput.min = "0";
  minutesInput.max = "99";
  minutesInput.value = String(minutes);
  minutesInput.inputMode = "numeric";
  minutesInput.setAttribute("aria-label", "Minutes");
  minutesInput.required = true;

  const minuteLabel = document.createElement("span");
  minuteLabel.textContent = "m";

  const secondsInput = document.createElement("input");
  secondsInput.className = "seconds-input";
  secondsInput.type = "number";
  secondsInput.min = "0";
  secondsInput.max = "59";
  secondsInput.value = String(seconds).padStart(2, "0");
  secondsInput.inputMode = "numeric";
  secondsInput.setAttribute("aria-label", "Seconds");
  secondsInput.required = true;

  const secondLabel = document.createElement("span");
  secondLabel.textContent = "s";

  const saveButton = document.createElement("button");
  saveButton.className = "duration-save";
  saveButton.type = "submit";
  saveButton.setAttribute("aria-label", "Save duration");
  saveButton.textContent = "✓";

  editor.append(minutesInput, minuteLabel, secondsInput, secondLabel, saveButton);
  card.append(editor);

  editor.addEventListener("submit", (event) => {
    event.preventDefault();
    const minuteValue = Number(minutesInput.value);
    const secondValue = Number(secondsInput.value);
    const total = minuteValue * 60 + secondValue;
    if (
      !Number.isInteger(minuteValue) ||
      !Number.isInteger(secondValue) ||
      minuteValue < 0 ||
      minuteValue > 99 ||
      secondValue < 0 ||
      secondValue > 59 ||
      total < 1
    ) {
      editor.reportValidity();
      announcements.textContent = "Enter a duration of at least one second.";
      return;
    }

    durations[index] = total;
    saveDurations();
    if (index === currentPhase && !running) remaining = total;
    render();
    announcements.textContent = `${phases[index].name} duration set to ${formatTime(total)}.`;
  });

  minutesInput.focus();
  minutesInput.select();
}

function render() {
  renderPhases();
  phaseTitle.textContent = phases[currentPhase].name;
  timeValue.textContent = formatTime(remaining);
  timerHint.textContent = running ? phases[currentPhase].nextHint : phases[currentPhase].hint;
  startPauseLabel.textContent = running ? "Pause session" : "Start session";
  sessionStatus.textContent = running ? "Session in progress" : "Ready when you are";
  document.body.classList.toggle("is-running", running);

  const progress = Math.max(0, Math.min(1, remaining / durations[currentPhase]));
  ringProgress.style.strokeDasharray = String(CIRCLE_LENGTH);
  ringProgress.style.strokeDashoffset = String(CIRCLE_LENGTH * (1 - progress));
  timerRing.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  timerRing.setAttribute(
    "aria-valuetext",
    `${formatTime(remaining)} remaining in ${phases[currentPhase].name}`,
  );
}

function start() {
  if (running) return;
  if (remaining <= 0) remaining = durations[currentPhase];
  running = true;
  deadline = Date.now() + remaining * 1000;
  intervalId = window.setInterval(tick, 100);
  render();
}

function pause() {
  if (!running) return;
  remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  running = false;
  window.clearInterval(intervalId);
  intervalId = null;
  render();
}

function reset() {
  running = false;
  window.clearInterval(intervalId);
  intervalId = null;
  currentPhase = 0;
  remaining = durations[currentPhase];
  timerHint.textContent = phases[currentPhase].hint;
  render();
  announcements.textContent = "Session reset to the presentation phase.";
}

function tick() {
  const nextRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  if (nextRemaining !== remaining) {
    remaining = nextRemaining;
    render();
  }
  if (nextRemaining === 0) advancePhase();
}

function advancePhase() {
  currentPhase = (currentPhase + 1) % phases.length;
  remaining = durations[currentPhase];
  deadline = Date.now() + remaining * 1000;
  playChime();
  render();
  announcements.textContent = `${phases[currentPhase].name} begins.`;
}

function playChime() {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;
    [659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = now + index * 0.13;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.35);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.36);
    });
  } catch (error) {
    console.warn("Could not play the phase-change chime.", error);
  }
}

startPauseButton.addEventListener("click", () => {
  if (running) pause();
  else start();
});
resetButton.addEventListener("click", reset);

render();
