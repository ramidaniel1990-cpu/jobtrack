<script setup lang="ts">
import { computed, ref } from "vue";
import type { JobSearch } from "../../../shared/types";
const props = defineProps<{
  search: JobSearch;
  loading: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{ edit: []; remove: []; pause: []; run: [] }>();
const confirming = ref(false);
const criteria = computed(() =>
  Object.entries(props.search.filters)
    .filter(([, item]) => item.value.trim())
    .map(([key, item]) => ({
      ...item,
      required:
        key === "excludedWords" || key === "maxAgeDays" || item.required,
    })),
);
const frequency = computed(
  () =>
    ({ manual: "Manual search", daily: "Daily", weekly: "Weekly" })[
      props.search.schedule.frequency
    ],
);
</script>
<template>
  <article class="panel search-card">
    <div class="card-top">
      <div class="search-icon" aria-hidden="true">⌕</div>
      <span class="badge" :class="search.paused ? 'neutral' : 'green'">{{
        search.paused ? "Paused" : "Active"
      }}</span>
    </div>
    <h2>{{ search.name }}</h2>
    <p class="muted">
      {{
        criteria.length
          ? `${criteria.length} criteria for your next step`
          : "Open to all opportunities"
      }}
    </p>
    <div class="tags">
      <span
        v-for="(criterion, index) in criteria.slice(0, 4)"
        :key="index"
        class="tag"
        >{{ criterion.value
        }}{{ criterion.required ? " · required" : "" }}</span
      ><span v-if="!criteria.length" class="tag">No preferences</span>
    </div>
    <div class="schedule-summary">
      <span aria-hidden="true">◷</span> {{ frequency
      }}<span v-if="search.schedule.frequency !== 'manual'">
        · {{ search.schedule.time }} · {{ search.schedule.timezone }}</span
      ><small v-if="search.schedule.frequency !== 'manual'"
        >Scheduling requires a backend</small
      >
    </div>
    <p class="last-run">
      {{
        search.lastRunAt
          ? `Last demo run: ${new Date(search.lastRunAt).toLocaleString("en-GB")}`
          : "You have not run this search yet"
      }}
    </p>
    <button
      class="button primary full"
      :disabled="busy || search.paused"
      :aria-label="`${loading ? 'Searching demo' : 'Search now'}: ${search.name}`"
      @click="emit('run')"
    >
      {{ loading ? "Searching demo…" : "Search now" }}
      <span aria-hidden="true">↗</span>
    </button>
    <div class="card-actions">
      <button
        class="button quiet"
        :aria-label="`Edit search: ${search.name}`"
        @click="emit('edit')"
      >
        Edit
</button
      ><button
        class="button quiet"
        :aria-label="`${search.paused ? 'Resume' : 'Pause'} search: ${search.name}`"
        @click="emit('pause')"
      >
        {{ search.paused ? "Resume" : "Pause" }}
</button
      ><button
        class="button quiet danger"
        :aria-label="`Delete search: ${search.name}`"
        :aria-expanded="confirming"
        @click="confirming = !confirming"
      >
        Delete
      </button>
    </div>
    <div v-if="confirming" class="delete-confirm">
      <p>Delete “{{ search.name }}”? Offers will be kept.</p>
      <button class="button danger" @click="emit('remove')">Yes, delete</button
      ><button class="button quiet" @click="confirming = false">Cancel</button>
    </div>
  </article>
</template>
