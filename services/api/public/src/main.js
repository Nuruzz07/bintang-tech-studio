// Bintang Tech Studio — Template 01: DIGITAL MINIMAL
// Main Application Router & Orchestrator

import { store } from './state/store.js';
import { renderDemoNavbar, initDemoNavbarEvents } from './components/demo-navbar.js';
import { renderLandingPage } from './pages/landing.js';
import { renderTelegramBotPage, initTelegramBotEvents } from './pages/telegram-bot.js';
import { renderWebAppPage, initWebAppEvents } from './pages/webapp.js';
import { renderAdminPage, initAdminEvents } from './pages/admin.js';
import { renderTelegramAdminPage, initTelegramAdminEvents } from './pages/telegram-admin.js';

// View routes mapping
const ROUTES = {
  landing: {
    title: 'Template 01: Digital Minimal — Bintang Tech Studio',
    render: renderLandingPage,
    init: () => {},
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

function getActiveRoute() {
  const hash = window.location.hash.replace('#', '').trim().toLowerCase();
  if (ROUTES[hash]) return hash;
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
document.addEventListener('DOMContentLoaded', () => {
  mountCurrentView();

  // Listen to hash routing
  window.addEventListener('hashchange', () => {
    mountCurrentView();
  });

  // Re-render if store resets
  store.subscribe((event) => {
    if (event === 'store:reset') {
      mountCurrentView();
    }
  });
});
