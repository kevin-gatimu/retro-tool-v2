import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useRoute, useRouter } from 'vitepress'
import { nextTick, onMounted, watch } from 'vue'
import mediumZoom from 'medium-zoom'
import type { Zoom } from 'medium-zoom'
import './custom.css'

// Click-to-zoom for every screenshot in the guide. medium-zoom lifts the image
// into a full-screen overlay that escapes the page layout, so wide screenshots
// become fully readable on both small and large screens. We (re)bind on mount
// and on every client-side route change, because VitePress swaps page content
// without a full reload.
export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()
    const router = useRouter()
    let zoom: Zoom | undefined

    const bind = () => {
      // Zoom only content images (skip logos/icons in nav/sidebar).
      zoom?.detach()
      zoom = mediumZoom('.vp-doc img', {
        background: 'rgba(0, 0, 0, 0.85)',
        margin: 24,
      })
    }

    onMounted(() => {
      bind()
      // Rebind after each navigation once the new DOM is in place.
      watch(
        () => route.path,
        () => nextTick(bind),
      )
    })

    // Also rebind after the router finishes a route change (covers hash-only
    // and same-path content swaps that `route.path` won't catch).
    router.onAfterRouteChange = () => {
      void nextTick(bind)
    }
  },
} satisfies Theme
