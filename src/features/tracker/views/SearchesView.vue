<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useTrackerStore } from "../store";
import type { JobSearch } from "../../../shared/types";
import SearchForm from "../components/SearchForm.vue";
import SearchCard from "../components/SearchCard.vue";
const store = useTrackerStore();
const router = useRouter();
const formOpen = ref(false);
const editing = ref<JobSearch>();
const activeCount = computed(
  () => store.searches.filter((search) => !search.paused).length,
);
function openForm(search?: JobSearch) {
  editing.value = search;
  formOpen.value = true;
}
async function save(search: JobSearch) {
  if (await store.saveSearch(search)) formOpen.value = false;
}
async function run(id: string) {
  if (await store.runSearch(id)) await router.push("/offers");
}
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">A NEW CAREER CHAPTER</p>
        <h1>My searches<span class="heading-dot">.</span></h1>
        <p>Define what matters. Find your next opportunity.</p>
      </div>
      <button v-if="!formOpen" class="button primary" @click="openForm()">
        <span aria-hidden="true">＋</span> New search
      </button>
    </div>
    <div class="stats-grid">
      <div class="stat">
        <span>Active searches</span
        ><strong>{{ activeCount.toString().padStart(2, "0") }}</strong>
      </div>
      <div class="stat">
        <span>Discovered offers</span
        ><strong>{{ store.offers.length.toString().padStart(2, "0") }}</strong>
      </div>
      <div class="stat">
        <span>Saved offers</span
        ><strong>{{
          Object.values(store.decisions)
            .filter((value) => value === "saved")
            .length.toString()
            .padStart(2, "0")
        }}</strong>
      </div>
    </div>
    <div class="section-heading">
      <h2>Your opportunity radar</h2>
      <span class="muted">{{ store.searches.length }} searches</span>
    </div>
    <SearchForm
      v-if="formOpen"
      :key="editing?.id ?? 'new'"
      :search="editing"
      @save="save"
      @cancel="formOpen = false"
    />
    <div v-if="store.searches.length" class="cards-grid">
      <SearchCard
        v-for="search in store.searches"
        :key="search.id"
        :search="search"
        :loading="store.loadingId === search.id"
        :busy="store.loadingId !== null"
        @edit="openForm(search)"
        @remove="store.deleteSearch(search.id)"
        @pause="store.togglePause(search.id)"
        @run="run(search.id)"
      />
    </div>
    <div v-else-if="!formOpen" class="panel empty-state">
      <div class="empty-icon" aria-hidden="true">⌕</div>
      <h2>Your next job starts here</h2>
      <p>
        Create your first search with the criteria that matter most.<br />You
        can also leave filters blank and explore.
      </p>
      <button class="button primary" @click="openForm()">
        Create my first search
</button
      ><small>Start with optional criteria and explore fictional offers.</small>
    </div>
    <div class="demo-footnote">
      <span aria-hidden="true">✦</span>
      <div>
        <strong>A space to explore, in demo mode</strong>
        <p>
          “Search now” queries local fictional offers. Assessments are examples;
          AI and scheduled searches are not active yet.
        </p>
      </div>
    </div>
  </section>
</template>
