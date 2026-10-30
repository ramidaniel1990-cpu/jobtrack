<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";
import {
  clearValidation,
  showValidation,
} from "../../../shared/formValidation";
import {
  createSearch,
  filterDefinitions,
  type JobSearch,
} from "../../../shared/types";
import ScheduleFields from "./ScheduleFields.vue";
import SearchFilterField from "./SearchFilterField.vue";
import { validateSearch } from "../../../shared/searchValidation";
const props = defineProps<{ search?: JobSearch }>();
const emit = defineEmits<{ save: [search: JobSearch]; cancel: [] }>();
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
const errors = ref<string[]>([]);
onMounted(() => nameInput.value?.focus());
const draft = ref<JobSearch>(
  props.search
    ? (JSON.parse(JSON.stringify(props.search)) as JobSearch)
    : createSearch(),
);
function submit() {
  draft.value.name = draft.value.name.trim();
  if (!draft.value.name) {
    nameInput.value?.setCustomValidity("Enter a name for your search.");
    nameInput.value?.reportValidity();
    return;
  }
  errors.value = validateSearch(draft.value);
  if (!errors.value.length) emit("save", draft.value);
}
</script>

<template>
  <form
    class="panel search-form"
    @submit.prevent="submit"
    @invalid.capture="showValidation"
    @input.capture="clearValidation"
  >
    <div class="section-heading">
      <div>
        <p class="eyebrow">YOUR NEXT STEP</p>
        <h2>{{ search ? "Edit search" : "New search" }}</h2>
      </div>
      <button type="button" class="button quiet" @click="emit('cancel')">
        Cancel
      </button>
    </div>
    <label class="field"
      >Search name
      <input
        ref="nameInput"
        v-model="draft.name"
        required
        maxlength="80"
        placeholder="My next frontend role"
    /></label>
    <div class="form-intro">
      <h3>What are you looking for?</h3>
      <p>
        All filters are optional. A blank field means no preference. Separate
        alternatives with commas.
      </p>
      <p>
        Preferences improve the match score; select “Required” to enforce a
        criterion.
      </p>
      <p>Excluded words and maximum listing age always apply when filled in.</p>
    </div>
    <div v-if="errors.length" class="notice error" role="alert">
      <p v-for="error in errors" :key="error">{{ error }}</p>
    </div>
    <div class="filter-grid">
      <SearchFilterField
        v-for="filter in filterDefinitions"
        :key="filter.key"
        v-model="draft.filters[filter.key]"
        v-model:currency="draft.currency"
        :filter="filter"
      />
    </div>
    <ScheduleFields v-model="draft.schedule" />
    <div class="form-footer">
      <span>Saved to the storage mode shown above.</span
      ><button class="button primary" type="submit">
        {{ search ? "Save changes" : "Create search" }}
      </button>
    </div>
  </form>
</template>
