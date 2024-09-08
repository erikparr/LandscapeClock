import { defineComponent, ref, provide, createElementBlock, useSSRContext, computed, withAsyncContext, mergeProps } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderStyle, ssrRenderAttr, ssrInterpolate } from 'vue/server-renderer';
import { p as publicAssetsURL } from '../routes/renderer.mjs';
import { _ as _export_sfc } from './server.mjs';
import 'vue-bundle-renderer/runtime';
import '../runtime.mjs';
import 'node:http';
import 'node:https';
import 'fs';
import 'path';
import 'node:fs';
import 'node:url';
import 'devalue';
import '@unhead/ssr';
import 'unhead';
import '@unhead/shared';
import 'vue-router';

const _imports_0 = publicAssetsURL("/landscape.png");
const clientOnlySymbol = Symbol.for("nuxt:client-only");
defineComponent({
  name: "ClientOnly",
  inheritAttrs: false,
  props: ["fallback", "placeholder", "placeholderTag", "fallbackTag"],
  setup(_, { slots, attrs }) {
    const mounted = ref(false);
    provide(clientOnlySymbol, true);
    return (props) => {
      var _a;
      if (mounted.value) {
        return (_a = slots.default) == null ? void 0 : _a.call(slots);
      }
      const slot = slots.fallback || slots.placeholder;
      if (slot) {
        return slot();
      }
      const fallbackStr = props.fallback || props.placeholder || "";
      const fallbackTag = props.fallbackTag || props.placeholderTag || "span";
      return createElementBlock(fallbackTag, attrs, fallbackStr);
    };
  }
});
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "LandscapeViewer",
  __ssrInlineRender: true,
  props: {
    currentTime: {}
  },
  emits: ["update:currentTime"],
  async setup(__props, { emit: __emit }) {
    let __temp, __restore;
    const props = __props;
    const currentImage = ref("/images/default_seed_image.png");
    const nextImage = ref("");
    ref(false);
    const isLoadingNextImage = ref(false);
    ref("");
    const panPercentage = ref(0);
    ref("");
    const isSimulationMode = ref(false);
    const isRunning = ref(false);
    const simulationSpeed = ref(100);
    const descriptions = ref([]);
    const currentDescription = computed(() => {
      const hour = new Date(props.currentTime).getHours();
      return descriptions.value[hour] || "No description available";
    });
    const currentImageUrl = computed(() => currentImage.value);
    const nextImageUrl = computed(() => nextImage.value);
    const formattedTimeOnly = computed(() => {
      const time = new Date(props.currentTime);
      return time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    });
    const currentDate = computed(() => new Date(props.currentTime).toISOString().split("T")[0]);
    [__temp, __restore] = withAsyncContext(() => fetchDescription()), await __temp, __restore();
    async function fetchDescription() {
      try {
        const descriptionUrl = `generated_descriptions.txt`;
        console.log("Fetching descriptions from:", descriptionUrl);
        const response = await fetch(descriptionUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        descriptions.value = text.split("\n\n").map((desc) => desc.trim());
        console.log("Fetched descriptions:", descriptions.value);
      } catch (err) {
        console.error("Error fetching descriptions:", err);
        descriptions.value = [];
      }
    }
    const viewerRef = ref(null);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "landscape-viewer",
        tabindex: "0",
        ref_key: "viewerRef",
        ref: viewerRef
      }, _attrs))} data-v-154376cc><div class="image-container" data-v-154376cc><div class="image-wrapper" style="${ssrRenderStyle({ transform: `translateX(${-panPercentage.value}%)` })}" data-v-154376cc><img${ssrRenderAttr("src", _imports_0)} alt="Landscape" data-v-154376cc></div></div><div class="time-display" data-v-154376cc>${ssrInterpolate(formattedTimeOnly.value)}</div><div class="description-container" data-v-154376cc><p data-v-154376cc>${ssrInterpolate(currentDescription.value)}</p></div>`);
      if (isSimulationMode.value) {
        _push(`<div class="simulation-controls" data-v-154376cc><button data-v-154376cc>${ssrInterpolate(isRunning.value ? "Pause" : "Start")} Simulation</button><input${ssrRenderAttr("value", simulationSpeed.value)} type="range" min="1" max="1000" data-v-154376cc><span data-v-154376cc>Speed: ${ssrInterpolate(simulationSpeed.value)}x</span></div>`);
      } else {
        _push(`<!---->`);
      }
      if (isSimulationMode.value) {
        _push(`<div class="debug-info" data-v-154376cc><p data-v-154376cc>Current Image: ${ssrInterpolate(currentImageUrl.value)}</p><p data-v-154376cc>Next Image: ${ssrInterpolate(nextImageUrl.value)}</p><p data-v-154376cc>Pan Offset: ${ssrInterpolate(_ctx.panOffset.toFixed(2))}</p><p data-v-154376cc>Current Date: ${ssrInterpolate(currentDate.value)}</p><p data-v-154376cc>Next Image Loading: ${ssrInterpolate(isLoadingNextImage.value ? "Yes" : "No")}</p></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/LandscapeViewer.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const LandscapeViewer = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-154376cc"]]);
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "index",
  __ssrInlineRender: true,
  setup(__props) {
    const currentTime = ref(/* @__PURE__ */ new Date());
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(_attrs)}>`);
      _push(ssrRenderComponent(LandscapeViewer, { currentTime: currentTime.value }, null, _parent));
      _push(`</div>`);
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=index-PT4XR0bp.mjs.map
