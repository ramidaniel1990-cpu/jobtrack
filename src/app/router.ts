import { createRouter, createWebHashHistory } from "vue-router";
import { nextTick } from "vue";
import SearchesView from "../features/tracker/views/SearchesView.vue";
import OffersView from "../features/tracker/views/OffersView.vue";
import OfferDetailView from "../features/tracker/views/OfferDetailView.vue";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: SearchesView, meta: { title: "My searches" } },
    { path: "/offers", component: OffersView, meta: { title: "Offers" } },
    {
      path: "/saved",
      component: OffersView,
      props: { saved: true },
      meta: { title: "Saved offers" },
    },
    {
      path: "/offers/:id",
      component: OfferDetailView,
      meta: { title: "Offer details" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
router.afterEach(async (to) => {
  document.title = `JobTrack · ${String(to.meta.title ?? "Your next step")}`;
  await nextTick();
  document.getElementById("main")?.focus({ preventScroll: true });
});
