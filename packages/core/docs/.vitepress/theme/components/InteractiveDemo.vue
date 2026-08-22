<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { deepMerge } from '@/merge/deep-merge';
import { diffKeys, type KeyChange } from '@/merge/diff-keys';
import type { ConfigRecord } from '@/store/types';

interface DisplayEvent {
  id: number;
  key: string;
  prev: string;
  next: string;
  category: 'added' | 'modified' | 'removed';
}

const initialGlobal = JSON.stringify(
  {
    promptVersion: 'v2.4',
    model: {
      maxTokens: 4096,
      temperature: 0.7,
    },
    stream: true,
  },
  null,
  2,
);

const initialProject = JSON.stringify(
  {
    model: {
      maxTokens: 8192,
      temperature: 0.2,
    },
    debug: true,
  },
  null,
  2,
);

const globalText = ref(initialGlobal);
const projectText = ref(initialProject);
const globalError = ref(false);
const projectError = ref(false);

const mergedConfig = ref<ConfigRecord>({});
const mergedFormatted = ref('');
const events = ref<DisplayEvent[]>([]);
const isUpdated = ref(false);

let eventCounter = 0;
let lastMerged: ConfigRecord = {};
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let updateFlashTimer: ReturnType<typeof setTimeout> | undefined;

function triggerFlash() {
  isUpdated.value = true;
  if (updateFlashTimer) clearTimeout(updateFlashTimer);
  updateFlashTimer = setTimeout(() => {
    isUpdated.value = false;
  }, 400);
}

function formatVal(val: unknown): string {
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  return String(val);
}

function computeOrdering(changes: Map<string, KeyChange>): string[] {
  const deletions: string[] = [];
  const additions: string[] = [];

  for (const [key, change] of changes) {
    if (change.category === 'removed') {
      deletions.push(key);
    } else {
      additions.push(key);
    }
  }

  // Phase 1 : suppressions bottom-up (profondeur desc, puis alpha desc)
  deletions.sort((a, b) => {
    const depthA = a.split('.').length;
    const depthB = b.split('.').length;
    if (depthA !== depthB) return depthB - depthA;
    return b.localeCompare(a);
  });

  // Phase 2 : ajouts/modifications top-down (profondeur asc, puis alpha asc)
  additions.sort((a, b) => {
    const depthA = a.split('.').length;
    const depthB = b.split('.').length;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });

  return [...deletions, ...additions];
}

function runMerge(emitEvents = true) {
  let parsedGlobal: ConfigRecord = {};
  let parsedProject: ConfigRecord = {};

  try {
    parsedGlobal = JSON.parse(globalText.value || '{}');
    globalError.value = false;
  } catch {
    globalError.value = true;
    return;
  }

  try {
    parsedProject = JSON.parse(projectText.value || '{}');
    projectError.value = false;
  } catch {
    projectError.value = true;
    return;
  }

  const merged = deepMerge(parsedGlobal, parsedProject, 'replace');

  if (emitEvents) {
    const changes = diffKeys(lastMerged, merged);
    const orderedKeys = computeOrdering(changes);
    const newEvents: DisplayEvent[] = [];

    for (const key of orderedKeys) {
      const change = changes.get(key)!;
      newEvents.push({
        id: ++eventCounter,
        key,
        prev: formatVal(change.prev),
        next: formatVal(change.next),
        category: change.category,
      });
    }

    if (newEvents.length > 0) {
      events.value = [...newEvents, ...events.value].slice(0, 30);
      triggerFlash();
    }
  }

  lastMerged = JSON.parse(JSON.stringify(merged));
  mergedConfig.value = merged;
  mergedFormatted.value = JSON.stringify(merged, null, 2);
}

function handleInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runMerge(true);
  }, 200);
}

watch([globalText, projectText], () => {
  handleInput();
});

onMounted(() => {
  runMerge(false);
});
</script>

<template>
  <div class="demo-wrapper">
    <div class="demo-intro">
      <h2 class="demo-intro-title">Interactive Playground</h2>
      <p class="demo-intro-desc">
        Edit the base or local configuration files to see hierarchical merging
        and live events in real-time.
      </p>
    </div>

    <div class="demo-card">
      <div class="demo-header">
        <div class="demo-header-brand">
          <span class="demo-title">morsel</span>
        </div>
        <span class="demo-live">
          <span class="demo-live-dot"></span>
          Live
        </span>
      </div>

      <div class="demo-grid">
        <!-- Top Left: Global Config -->
        <div class="demo-panel">
          <div
            class="demo-panel-header demo-panel-header-editable"
            :class="{ 'demo-panel-header-error': globalError }"
          >
            <span class="demo-panel-title"
              >~/config/your-app/your-app.json</span
            >
            <span class="demo-panel-subtitle">Base Config</span>
          </div>
          <div class="demo-editor-wrap">
            <textarea
              v-model="globalText"
              class="demo-textarea"
              spellcheck="false"
              placeholder="Global JSON..."
            ></textarea>
          </div>
        </div>

        <!-- Top Right: Project Config -->
        <div class="demo-panel">
          <div
            class="demo-panel-header demo-panel-header-editable"
            :class="{ 'demo-panel-header-error': projectError }"
          >
            <span class="demo-panel-title">./your-app.json</span>
            <span class="demo-panel-subtitle">Local Config</span>
          </div>
          <div class="demo-editor-wrap">
            <textarea
              v-model="projectText"
              class="demo-textarea"
              spellcheck="false"
              placeholder="Project JSON..."
            ></textarea>
          </div>
        </div>

        <!-- Bottom Left: Events Log -->
        <div class="demo-panel demo-panel-events">
          <div class="demo-panel-header demo-panel-header-accent">
            <span class="demo-panel-title">Events</span>
            <span class="demo-events-count">{{ events.length }} events</span>
          </div>
          <div class="demo-events-list">
            <div
              v-for="ev in events"
              :key="ev.id"
              class="demo-event-row"
              :class="`demo-event-${ev.category}`"
            >
              <span class="demo-event-key">{{ ev.key }}</span>
              <span class="demo-event-arrow">→</span>
              <span class="demo-event-prev">{{ ev.prev }}</span>
              <span class="demo-event-next">{{ ev.next }}</span>
            </div>
          </div>
        </div>

        <!-- Bottom Right: Merged Output -->
        <div
          class="demo-panel demo-panel-output"
          :class="{ 'demo-panel-flash': isUpdated }"
        >
          <div class="demo-panel-header demo-panel-header-accent">
            <span class="demo-panel-title">Your Merged Config</span>
          </div>
          <pre class="demo-output-code"><code>{{ mergedFormatted }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  margin: 1.5rem auto 5rem;
  max-width: 960px;
  padding: 0 1rem;
}

.demo-intro {
  text-align: center;
  margin-bottom: 1.5rem;
}

.demo-intro-title {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
  margin-bottom: 0.6rem;
  border-top: none;
  padding-top: 0;
}

.demo-intro-desc {
  font-size: 1rem;
  color: var(--vp-c-text-2);
  max-width: 580px;
  margin: 0 auto;
  line-height: 1.5;
}

.demo-card {
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 6px;
  overflow: hidden;
}

.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: var(--vp-c-bg, #ffffff);
  border-bottom: 1px solid var(--vp-c-divider, #e2e2e3);
}

.demo-header-brand {
  display: flex;
  align-items: center;
  gap: 0;
}

.demo-logo {
  width: 24px;
  height: 24px;
  display: block;
}

.demo-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--vp-c-text-1, #213547);
}

.demo-tagline-header {
  font-style: italic;
  font-size: 1rem;
  font-weight: 400;
  color: var(--vp-c-text-2);
  margin-left: 1rem;
}

.demo-live {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.demo-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
  }
  50% {
    opacity: 0.3;
    box-shadow: 0 0 0 5px rgba(239, 68, 68, 0);
  }
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding: 1rem;
}

@media (min-width: 768px) {
  .demo-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.demo-panel {
  background: var(--vp-c-bg, #ffffff);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 275px;
}

.demo-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.8rem;
  font-weight: 600;
}

.demo-panel-header-editable {
  background: #3e5aa2;
}

:global(.dark) .demo-panel-header-editable {
  background: #2d4a8e;
}

.demo-panel-header-editable .demo-panel-title {
  color: #ffffff;
}

.demo-panel-subtitle {
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.8;
}

.demo-panel-header-editable .demo-panel-subtitle {
  color: #ffffff;
}

.demo-panel-header-error {
  background: #c0392b !important;
}

:global(.dark) .demo-panel-header-error {
  background: #922b21 !important;
}

.demo-panel-title {
  font-family: var(--vp-font-family-mono, monospace);
  color: var(--vp-c-text-1, #213547);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.demo-tag-override {
  background: var(--vp-c-warning-soft, rgba(234, 179, 8, 0.15));
  color: var(--vp-c-warning-1, #eab308);
}

.demo-tag-frozen {
  background: var(--vp-c-brand-soft, rgba(62, 90, 162, 0.15));
  color: var(--vp-c-brand-1, #3e5aa2);
}

.demo-tag {
  font-size: 0.7rem;
  padding: 0.15rem 0.6rem;
  border-radius: 4px;
  background: var(--vp-c-default-soft, rgba(125, 125, 125, 0.15));
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.demo-editor-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.demo-textarea {
  width: 100%;
  height: 100%;
  padding: 0.75rem;
  border: none;
  resize: none;
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 0.85rem;
  line-height: 1.4;
  background: transparent;
  color: var(--vp-c-text-1);
  box-sizing: border-box;
  outline: none;
}

.demo-textarea:focus {
  background: var(--vp-c-bg-soft);
}

.demo-events-list {
  padding: 0.5rem;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.demo-empty {
  color: var(--vp-c-text-3);
  font-style: italic;
  padding: 1rem 0.5rem;
  text-align: center;
}

.demo-event-row {
  display: grid;
  grid-template-columns: 135px 20px 1fr 1fr;
  align-items: center;
  gap: 0.6rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: var(--vp-c-bg-mute);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.demo-event-key {
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.demo-event-arrow {
  color: var(--vp-c-text-3);
  text-align: center;
  margin-right: 0.25rem;
}

.demo-event-prev {
  color: #ea580c;
  opacity: 0.85;
  padding-left: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.demo-event-next {
  color: #10b981;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.demo-events-count {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}

.demo-output-code {
  margin: 0;
  padding: 0.75rem;
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 0.85rem;
  line-height: 1.4;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  background: transparent;
  color: var(--vp-c-text-1);
  transition: background-color 0.4s ease;
}

.demo-panel-output {
  transition: border-color 0.35s ease;
}

.demo-panel-output.demo-panel-flash {
  border-color: var(--vp-c-brand-1, #3e5aa2);
}

.demo-panel-output.demo-panel-flash .demo-output-code {
  background: rgba(62, 90, 162, 0.08);
}

:global(.dark .demo-panel-output.demo-panel-flash) {
  border-color: #5b7fc7;
}

:global(.dark .demo-panel-output.demo-panel-flash .demo-output-code) {
  background: rgba(91, 127, 199, 0.12);
}

.demo-footer {
  text-align: center;
  padding: 0.75rem;
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
}

.demo-tagline {
  font-family: var(--vp-font-family-base, sans-serif);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--vp-c-brand-1);
  letter-spacing: 0.02em;
}
</style>
