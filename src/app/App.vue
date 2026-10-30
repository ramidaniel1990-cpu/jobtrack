<script setup lang="ts">
import { useTrackerStore } from "../features/tracker/store";
import { onUnmounted } from "vue";
import { useSessionStore } from "../features/auth/store";
import SessionPanel from "../features/auth/components/SessionPanel.vue";
const store = useTrackerStore();
const session = useSessionStore();
void session.start();
onUnmounted(() => session.dispose());
</script>

<template>
  <a href="#main" class="skip-link">Skip to content</a>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink to="/" class="brand"
        ><span class="brand-icon">J<span>↗</span></span
        >JobTrack<span class="brand-dot">.</span></RouterLink
      >
      <p class="nav-label">YOUR WORKSPACE</p>
      <nav aria-label="Main navigation">
        <RouterLink to="/" class="nav-link"
          ><span aria-hidden="true">⌕</span>My searches
          <small>{{ store.searches.length }}</small></RouterLink
        >
        <RouterLink to="/offers" class="nav-link"
          ><span aria-hidden="true">▤</span>Offers</RouterLink
        >
        <RouterLink to="/saved" class="nav-link"
          ><span aria-hidden="true">◇</span>Saved
          <small>{{
            Object.values(store.decisions).filter((value) => value === "saved")
              .length
          }}</small></RouterLink
        >
      </nav>
      <div class="sidebar-note">
        <span class="demo-dot"></span> {{ session.storageLabel }}
        <p>Your next step starts with a good search.</p>
        <small>Demo offers · simulated assessments</small>
      </div>
      <div class="sidebar-footer">
        <span class="avatar">JT</span>
        <div>My personal workspace<small>Portfolio project</small></div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <span>Your career, with intention.</span
        ><span class="demo-badge"
          ><span class="demo-dot"></span> DEMO OFFERS</span
        >
      </header>
      <main id="main" tabindex="-1">
        <SessionPanel />
        <div v-if="store.migrationNotice" role="status" class="notice">
          {{ store.migrationNotice }}
        </div>
        <div v-if="store.error" role="alert" class="notice error">
          {{ store.error }}
          <button
            v-if="store.canRetry"
            class="button"
            :disabled="store.saving || store.initializing"
            @click="store.retry()"
          >
            Retry storage operation
          </button>
        </div>
        <div v-if="store.success" role="status" class="notice success">
          {{ store.success }}
        </div>
        <div
          v-if="session.phase === 'loading' || store.initializing"
          class="panel storage-state"
          role="status"
        >
          <h1>Loading your workspace…</h1>
          <p>Waiting for the session and storage before loading data.</p>
        </div>
        <div
          v-else-if="session.phase === 'error' || !store.ready"
          class="panel storage-state"
        >
          <h1>Workspace unavailable</h1>
          <p>
            Retry the failed operation. Demo storage is only used when you
            explicitly choose it.
          </p>
        </div>
        <template v-else>
          <p v-if="store.saving" class="notice storage-busy" role="status">
            Saving changes… Waiting for storage confirmation.
          </p>
          <div :inert="store.saving">
            <RouterView :key="store.sessionKey" />
          </div>
        </template>
      </main>
      <footer class="page-footer">
        Made for your next step. <span>JobTrack · Phase one</span>
      </footer>
    </div>
  </div>
</template>
