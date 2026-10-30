<script setup lang="ts">
import { computed } from "vue";
import { splitFilterValues } from "../../../shared/filterValues";
const props = defineProps<{
  id: string;
  label: string;
  options: readonly string[];
}>();
const model = defineModel<string>({ required: true });
const selected = computed(() =>
  splitFilterValues(model.value).map(
    (value) =>
      props.options.find(
        (option) => option.toLowerCase() === value.toLowerCase(),
      ) ?? value,
  ),
);
// Keep legacy/custom values visible and removable instead of silently dropping them.
const choices = computed(() => [
  ...new Set([...props.options, ...selected.value]),
]);
const unknownValues = computed(() =>
  selected.value.filter((value) => !props.options.includes(value)),
);
function toggle(option: string, checked: boolean) {
  model.value = (
    checked
      ? [...selected.value, option]
      : selected.value.filter((item) => item !== option)
  ).join(", ");
}
</script>
<template>
  <fieldset
    class="multi-choice"
    :aria-describedby="
      unknownValues.length ? `${id}-help ${id}-review` : `${id}-help`
    "
  >
    <legend>{{ label }}</legend>
    <div class="choice-options">
      <label v-for="option in choices" :key="option" class="choice-option">
        <input
          type="checkbox"
          :checked="selected.includes(option)"
          @change="toggle(option, ($event.target as HTMLInputElement).checked)"
        />
        {{ option }}
      </label>
    </div>
    <p :id="`${id}-help`" class="field-help">
      Select any that apply. None selected means no preference.
    </p>
    <p
      v-if="unknownValues.length"
      :id="`${id}-review`"
      class="field-help"
      role="status"
    >
      Saved values need review: {{ unknownValues.join(", ") }}. They have been
      kept; uncheck any you no longer want.
    </p>
  </fieldset>
</template>
