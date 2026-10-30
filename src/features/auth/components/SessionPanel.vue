<script setup lang="ts">
import { useSessionStore } from "../store";
const session = useSessionStore();
</script>
<template>
  <section class="session-panel" aria-label="Session and storage">
    <div class="session-heading">
      <strong>{{ session.storageLabel }}</strong
      ><span v-if="session.user">{{
        session.user.displayName || session.user.email || "Signed-in user"
      }}</span>
    </div>
    <p>
      Offers are demo data. Match assessments are simulated. Scheduled searches
      do not run yet.
    </p>
    <div class="session-actions">
      <button
        v-if="!session.user"
        class="button primary"
        :disabled="session.busy || session.phase === 'loading'"
        @click="session.signIn()"
      >
        {{ session.busy ? "Opening Google sign-in…" : "Sign in with Google" }}
      </button>
      <button
        v-else
        class="button"
        :disabled="session.busy"
        @click="session.signOut()"
      >
        Sign out
      </button>
      <button
        v-if="session.phase !== 'demo' && !session.user"
        class="button"
        :disabled="session.busy"
        @click="session.useDemo()"
      >
        Continue with demo storage
      </button>
      <button
        v-if="session.error"
        class="button"
        :disabled="session.busy"
        @click="session.retry()"
      >
        Retry Firebase session
      </button>
    </div>
    <p v-if="session.phase === 'demo'">
      Demo data stays in this browser and is never uploaded automatically.
    </p>
    <p v-if="session.error" class="notice error" role="alert">
      {{ session.error }}
    </p>
    <p v-if="session.notice" class="notice" role="status">
      {{ session.notice }}
    </p>
  </section>
</template>
