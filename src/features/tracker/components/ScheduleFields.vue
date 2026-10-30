<script setup lang="ts">
import { computed } from "vue";
import type { Schedule } from "../../../shared/types";
import { validateSchedule } from "../../../shared/searchValidation";
const schedule = defineModel<Schedule>({ required: true });
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const errors = computed(() => validateSchedule(schedule.value));
function validateTimezone(event: Event) {
  const input = event.target as HTMLInputElement;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: input.value });
    input.setCustomValidity("");
  } catch {
    input.setCustomValidity("Enter a valid time zone, such as Europe/Madrid.");
  }
}
</script>
<template>
  <fieldset class="schedule-fields">
    <legend>Frequency</legend>
    <p class="muted">Set your routine for when the backend is connected.</p>
    <div class="filter-grid">
      <label class="field"
        >Repeat<select v-model="schedule.frequency">
          <option value="manual">Manual</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option
            v-if="!['manual', 'daily', 'weekly'].includes(schedule.frequency)"
            :value="schedule.frequency"
          >
            {{ schedule.frequency }} — needs review
          </option>
        </select></label
      >
      <label v-if="schedule.frequency === 'weekly'" class="field"
        >Day<select v-model="schedule.weekday">
          <option
            v-if="!days[Number(schedule.weekday) - 1]"
            :value="schedule.weekday"
          >
            {{ schedule.weekday }} — needs review
          </option>
          <option
            v-for="(day, index) in days"
            :key="day"
            :value="String(index + 1)"
          >
            {{ day }}
          </option>
        </select></label
      >
      <template v-if="schedule.frequency !== 'manual'">
        <label class="field"
          >Local time<input
            v-model="schedule.time"
            type="time"
            required /></label
        ><label class="field"
          >Time zone<input
            v-model="schedule.timezone"
            required
            placeholder="Europe/Madrid"
            @input="validateTimezone"
        /></label>
      </template>
    </div>
    <div v-if="errors.length" class="notice" role="status">
      <p>
        Configuration needs review. Current time:
        {{ schedule.time || "not set" }}; time zone:
        {{ schedule.timezone || "not set"
        }}<span v-if="schedule.frequency === 'weekly'"
          >; day: {{ schedule.weekday || "not set" }}</span
        >.
      </p>
      <p v-for="error in errors" :key="error">{{ error }}</p>
    </div>
    <p class="notice">
      Only the configuration is saved. Scheduled searches do not run yet.
    </p>
  </fieldset>
</template>
