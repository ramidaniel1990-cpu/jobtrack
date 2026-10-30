<script setup lang="ts">
import { toRef } from "vue";
import { useTrackerStore } from "../store";
import { useOfferFilters } from "../composables/useOfferFilters";
import OfferCard from "../components/OfferCard.vue";
const props = defineProps<{ saved?: boolean }>();
const store = useTrackerStore();
const { offers, showDiscarded, selectedSearch } = useOfferFilters(
  toRef(props, "saved"),
  store,
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">
          {{
            saved ? "YOUR FAVOURITES, WITHIN REACH" : "EXPLORE YOUR NEXT STEP"
          }}
        </p>
        <h1>
          {{ saved ? "Saved" : "Offers" }}<span class="heading-dot">.</span>
        </h1>
        <p>
          {{
            saved
              ? "Opportunities you want to take a closer look at."
              : "Example opportunities from your searches and saved history."
          }}
        </p>
      </div>
      <RouterLink to="/" class="button">My searches →</RouterLink>
    </div>
    <div class="notice demo-notice">
      ✦ Fictional data and simulated assessments. These are not real offers or
      AI evaluations.
    </div>
    <details
      v-if="
        !saved &&
        store.diagnostics.length &&
        (!selectedSearch || selectedSearch === store.lastSearchId)
      "
      class="notice search-diagnostics"
    >
      <summary>
        Why {{ store.diagnostics.length }} demo offers were excluded from the
        latest search
      </summary>
      <ul>
        <li v-for="item in store.diagnostics" :key="item.offerId">
          <strong>{{ item.title }}</strong
          >: {{ item.reasons.join(" ") }}
        </li>
      </ul>
    </details>
    <div class="offers-toolbar">
      <span class="muted"
        >{{ offers.length }}
        {{ offers.length === 1 ? "offer" : "offers" }}</span
      ><label class="toolbar-field"
        >Search<select v-model="selectedSearch">
          <option value="">All searches and history</option>
          <option
            v-for="search in store.searches"
            :key="search.id"
            :value="search.id"
          >
            {{ search.name }}
          </option>
        </select></label
      ><label v-if="!saved" class="checkbox-label"
        ><input v-model="showDiscarded" type="checkbox" /> Show discarded</label
      >
    </div>
    <div v-if="store.loadingId" class="panel empty-state" role="status">
      <div class="spinner" aria-hidden="true"></div>
      <h2>Exploring the sample catalogue…</h2>
      <p>Applying your criteria to local sample data.</p>
    </div>
    <div v-else-if="offers.length" class="offers-grid">
      <OfferCard
        v-for="offer in offers"
        :key="offer.id"
        :offer="offer"
        :decision="store.decisions[offer.id]"
        @decide="store.decide(offer.id, $event)"
      />
    </div>
    <div v-else class="panel empty-state">
      <div class="empty-icon" aria-hidden="true">{{ saved ? "♡" : "⌕" }}</div>
      <h2>
        {{
          saved
            ? "Keep your favourites close"
            : showDiscarded
              ? "No discarded offers"
              : "No opportunities here yet"
        }}
      </h2>
      <p>
        {{
          saved
            ? "Save an offer to find it here when you return."
            : "Run a search or try broader criteria to explore the demo catalogue."
        }}
      </p>
      <RouterLink :to="saved ? '/offers' : '/'" class="button primary">{{
        saved ? "Explore offers" : "Go to my searches"
      }}</RouterLink>
    </div>
  </section>
</template>
