// Bintang Tech Studio — Template 01: DIGITAL MINIMAL
// Main Application Router & Orchestrator

import { store } from './state/store.js';
import { renderDemoNavbar, initDemoNavbarEvents } from './components/demo-navbar.js';
import { showToast } from './utils/helpers.js';
import { renderLandingPage, initLandingEvents } from './pages/landing.js';
import { renderTelegramBotPage, initTelegramBotEvents } from './pages/telegram-bot.js';
import { renderWebAppPage, initWebAppEvents } from './pages/webapp.js';
import { renderAdminPage, initAdminEvents } from './pages/admin.js';
import { renderTelegramAdminPage, initTelegramAdminEvents } from './pages/telegram-admin.js';

// View routes mapping
const ROUTES = {
  landing: {
    title: 'Bintang Tech Studio — Platform Sewa Bot Commerce Multi-Tenant',
    render: renderLandingPage,
    init: initLandingEvents,
  },
  telegram: {
    title: 'Telegram Bot Simulation — Bintang Digital',
    render: renderTelegramBotPage,
    init: initTelegramBotEvents,
  },
  webapp: {
    title: 'Bintang Store — Produk digital, langsung beres.',
    render: renderWebAppPage,
    init: initWebAppEvents,
  },
  admin: {
    title: 'Admin Dashboard — Bintang Store',
    render: renderAdminPage,
    init: initAdminEvents,
  },
  'telegram-admin': {
    title: 'Telegram Admin — Bintang Store',
    render: renderTelegramAdminPage,
    init: initTelegramAdminEvents,
  },
};

function handleOAuthCallback() {
  const fullHash = window.location.hash;
  if (!fullHash) return;

  if (fullHash.includes('error_description=')) {
    const match = fullHash.match(/error_description=([^&]+)/);
    const desc = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'Google sign-in gagal';
    showToast(desc, 'error');
    window.location.hash = '#landing';
    return;
  }

  if (fullHash.includes('access_token=')) {
    const tokenMatch = fullHash.match(/access_token=([^&]+)/);
    if (tokenMatch) {
      const accessToken = tokenMatch[1];
      try {
        const base64Url = accessToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join(''),
        );
        const payload = JSON.parse(jsonPayload);
        const user = {
          id: payload.sub,
          email: payload.email,
          fullName:
            payload.user_metadata?.full_name ||
            payload.user_metadata?.name ||
            payload.email?.split('@')[0] ||
            'Seller Bintang',
          avatarUrl: payload.user_metadata?.avatar_url || null,
          provider: 'google',
        };
        localStorage.setItem('bts_auth_user', JSON.stringify(user));
        localStorage.setItem('bts_access_token', accessToken);
        showToast(`Selamat datang, ${user.fullName}! Login Google berhasil.`, 'success');
        window.location.hash = '#admin';
      } catch (e) {
        console.error('Failed to parse Supabase token from hash', e);
      }
    }
  }
}

function getActiveRoute() {
  const rawHash = window.location.hash.replace(/^#+/, '').trim().toLowerCase();
  const routeKey = rawHash.split(/[#&]/)[0];
  if (ROUTES[routeKey]) return routeKey;
  return 'landing';
}

export function navigateTo(route) {
  if (ROUTES[route]) {
    window.location.hash = `#${route}`;
  }
}

function mountCurrentView() {
  const currentRoute = getActiveRoute();
  const routeConfig = ROUTES[currentRoute];

  // Update Page Title
  document.title = routeConfig.title;

  // Mount Demo Navbar ONLY for external presentation views (landing, telegram, admin)
  // Hide completely when inside Customer Storefront (webapp) for a pure, realistic store experience
  const navContainer = document.getElementById('demo-navbar-container');
  if (navContainer) {
    if (currentRoute === 'webapp') {
      navContainer.innerHTML = '';
      navContainer.style.display = 'none';
    } else {
      navContainer.style.display = '';
      navContainer.innerHTML = renderDemoNavbar(currentRoute);
      initDemoNavbarEvents();
    }
  }

  // Mount Page Content
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.innerHTML = routeConfig.render();
    routeConfig.init();
  }

  // Smooth scroll to top on route change
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Global initialization
function initApp() {
  handleOAuthCallback();
  mountCurrentView();

  // Listen to hash routing
  window.addEventListener('hashchange', () => {
    handleOAuthCallback();
    mountCurrentView();
  });

  // Re-render if store resets
  store.subscribe((event) => {
    if (event === 'store:reset') {
      mountCurrentView();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
