<script setup lang="ts">
import { computed } from "vue";
import {
  multiFilterOptions,
  type Criterion,
  type FilterDefinition,
  type MultiFilterKey,
} from "../../../shared/types";
import { splitFilterValues } from "../../../shared/filterValues";
import { isValidNonNegativeNumber } from "../../../shared/searchValidation";
import MultiChoiceField from "./MultiChoiceField.vue";
import TagInput from "./TagInput.vue";
const props = defineProps<{ filter: FilterDefinition }>();
const criterion = defineModel<Criterion>({ required: true });
const currency = defineModel<string>("currency", { required: true });
const options = computed(() =>
  props.filter.key in multiFilterOptions
    ? multiFilterOptions[props.filter.key as MultiFilterKey]
    : undefined,
);
const id = computed(() => `filter-${props.filter.key}`);
const numeric = computed(() =>
  ["minSalary", "maxAgeDays"].includes(props.filter.key),
);
const invalidSavedNumber = computed(
  () =>
    numeric.value &&
    !isValidNonNegativeNumber(
      criterion.value.value,
      props.filter.key === "maxAgeDays",
    ),
);
const alwaysApplied = computed(
  () =>
    props.filter.key === "maxAgeDays" || props.filter.key === "excludedWords",
);
</script>
<template>
  <div class="filter-field">
    <MultiChoiceField
      v-if="options"
      :id="id"
      v-model="criterion.value"
      :label="filter.label"
      :options="options"
    />
    <TagInput
      v-else-if="filter.key === 'technologies' || filter.key === 'languages'"
      :id="id"
      v-model="criterion.value"
      :label="filter.label"
      :placeholder="filter.placeholder"
    />
    <template v-else>
      <label :for="id">{{ filter.label }}</label>
      <input
        :id="id"
        :value="criterion.value"
        :type="numeric ? 'number' : 'text'"
        min="0"
        :step="filter.key === 'minSalary' ? 'any' : '1'"
        :placeholder="filter.placeholder"
        :aria-invalid="invalidSavedNumber || undefined"
        :aria-describedby="
          invalidSavedNumber
            ? `${id}-review`
            : alwaysApplied || filter.key === 'minSalary'
              ? `${id}-help`
              : undefined
        "
        @input="criterion.value = ($event.target as HTMLInputElement).value"
      />
      <p
        v-if="invalidSavedNumber"
        :id="`${id}-review`"
        class="field-help"
        role="status"
      >
        Saved value “{{ criterion.value }}” needs review. Enter
        {{ filter.key === "maxAgeDays" ? "a whole number" : "a number" }} of
        zero or more, or clear the field.
      </p>
      <button
        v-if="invalidSavedNumber"
        type="button"
        class="button quiet"
        :aria-label="`Clear invalid ${filter.label.toLowerCase()}`"
        @click="criterion.value = ''"
      >
        Clear saved value
      </button>
    </template>
    <p v-if="filter.key === 'maxAgeDays'" :id="`${id}-help`" class="field-help">
      Always applied as a maximum age when set. Zero means today (UTC); leave
      blank for no limit.
    </p>
    <p
      v-if="filter.key === 'excludedWords'"
      :id="`${id}-help`"
      class="field-help"
    >
      Always excludes matching words when set. Leave blank to exclude nothing.
    </p>
    <template v-if="filter.key === 'minSalary'">
      <p :id="`${id}-help`" class="field-help">
        Gross annual salary before taxes. Leave blank for no preference.
      </p>
      <label class="field salary-currency"
        >Salary currency
        <select v-model="currency">
          <option>EUR</option>
          <option>USD</option>
          <option>GBP</option>
          <option v-if="!['EUR', 'USD', 'GBP'].includes(currency)">
            {{ currency }}
          </option>
        </select>
      </label>
    </template>
    <label v-if="!alwaysApplied" class="checkbox-label"
      ><input
        v-model="criterion.required"
        type="checkbox"
        :disabled="!splitFilterValues(criterion.value).length"
      />
      Required<span class="sr-only">: {{ filter.label }}</span></label
    >
  </div>
</template>
