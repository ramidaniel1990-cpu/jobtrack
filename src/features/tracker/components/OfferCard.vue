<script setup lang="ts">
import type { JobOffer, OfferDecision } from "../../../shared/types";
defineProps<{ offer: JobOffer; decision?: OfferDecision }>();
const emit = defineEmits<{ decide: [decision: OfferDecision | undefined] }>();
</script>
<template>
  <article class="panel offer-card">
    <div class="card-top">
      <div class="company-mark" aria-hidden="true">
        {{ offer.company.slice(0, 1) }}
      </div>
      <span class="badge">Demo match · {{ offer.score }}%</span>
    </div>
    <p class="company-name">{{ offer.company }}</p>
    <h2>
      <RouterLink :to="`/offers/${offer.id}`">{{ offer.title }}</RouterLink>
    </h2>
    <p class="muted">{{ offer.location }} · {{ offer.modality }}</p>
    <p class="salary">
      {{
        offer.salary
          ? `${new Intl.NumberFormat("en-GB", { style: "currency", currency: offer.currency, maximumFractionDigits: 0 }).format(offer.salary)} / year`
          : "Salary not listed"
      }}
    </p>
    <div class="tags">
      <span
        v-for="technology in offer.technologies"
        :key="technology"
        class="tag"
        >{{ technology }}</span
      >
    </div>
    <div class="match-note">
      <span class="eyebrow">WHY IT MAY FIT · SIMULATED</span>
      <p>{{ offer.explanation }}</p>
    </div>
    <div class="offer-meta">
      <time :datetime="offer.publishedAt">{{
        new Date(offer.publishedAt).toLocaleDateString("en-GB")
      }}</time
      ><span>Fictional offer</span>
    </div>
    <div class="offer-actions">
      <button
        class="button"
        :class="decision === 'saved' ? 'selected' : 'primary'"
        :aria-label="`${decision === 'saved' ? 'Remove saved offer' : 'Save offer'}: ${offer.title}`"
        @click="emit('decide', decision === 'saved' ? undefined : 'saved')"
      >
        {{ decision === "saved" ? "✓ Saved · Remove" : "Save offer" }}
</button
      ><button
        class="button quiet"
        :aria-label="`${decision === 'discarded' ? 'Restore offer' : 'Discard offer'}: ${offer.title}`"
        @click="
          emit('decide', decision === 'discarded' ? undefined : 'discarded')
        "
      >
        {{ decision === "discarded" ? "Restore" : "Discard" }}
</button
      ><RouterLink
        class="detail-link"
        :aria-label="`View details: ${offer.title}`"
        :to="`/offers/${offer.id}`"
        >View details →</RouterLink
      >
    </div>
  </article>
</template>
