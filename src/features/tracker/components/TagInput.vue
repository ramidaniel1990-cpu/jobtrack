<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import {
  addFilterValues,
  removeFilterValue,
  splitFilterValues,
} from "../../../shared/filterValues";
defineProps<{ id: string; label: string; placeholder: string }>();
const model = defineModel<string>({ required: true });
const pending = ref("");
const entry = useTemplateRef<HTMLInputElement>("entry");
const tags = computed(() => splitFilterValues(model.value));
async function remove(tag: string) {
  model.value = removeFilterValue(model.value, tag);
  await nextTick();
  entry.value?.focus();
}
function add() {
  if (!pending.value.trim()) return;
  model.value = addFilterValues(model.value, pending.value);
  pending.value = "";
}
function input(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  const lastComma = value.lastIndexOf(",");
  if (lastComma < 0) {
    pending.value = value;
    return;
  }
  model.value = addFilterValues(model.value, value.slice(0, lastComma));
  pending.value = value.slice(lastComma + 1);
}
</script>
<template>
  <div class="tag-input">
    <label :for="id">{{ label }}</label>
    <div
      v-if="tags.length"
      class="editable-tags"
      role="list"
      :aria-label="`Selected ${label.toLowerCase()}`"
    >
      <span v-for="tag in tags" :key="tag" class="editable-tag" role="listitem">
        {{ tag }}
        <button
          type="button"
          :aria-label="`Remove ${tag} from ${label.toLowerCase()}`"
          @click="remove(tag)"
        >
          ×
        </button>
      </span>
    </div>
    <div class="tag-entry">
      <input
        ref="entry"
        :id="id"
        :value="pending"
        :placeholder="placeholder"
        :aria-describedby="`${id}-help`"
        @input="input"
        @keydown.enter.prevent="add"
        @blur="add"
      />
      <button
        type="button"
        class="button"
        :aria-label="`Add ${label.toLowerCase()}`"
        @click="add"
      >
        Add
      </button>
    </div>
    <p :id="`${id}-help`" class="field-help">
      Type a value and press Enter, or separate values with commas.
    </p>
  </div>
</template>
