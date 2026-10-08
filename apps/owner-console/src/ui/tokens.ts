/**
 * Bintang Tech Studio — Platform Owner Console Design Tokens.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Professional, dense, restrained control plane theme.
 */

export const OWNER_CONSOLE_THEME = {
  colors: {
    bgApp: '#090d16',
    bgSidebar: '#0d1322',
    bgCard: '#131b2e',
    bgCardHover: '#18223a',
    border: '#1e293b',
    borderSubtle: '#172238',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    primary: '#38bdf8', // Sky/cyan platform accent
    primaryHover: '#0284c7',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    neutral: '#6b7280',
  },
  statusBadges: {
    ACTIVE: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    SETUP: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
    SUSPENDED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
    ARCHIVED: {
      bg: 'rgba(107, 114, 128, 0.15)',
      text: '#9ca3af',
      border: 'rgba(107, 114, 128, 0.3)',
    },
    HEALTHY: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    DEGRADED: {
      bg: 'rgba(245, 158, 11, 0.15)',
      text: '#fbbf24',
      border: 'rgba(245, 158, 11, 0.3)',
    },
    UNHEALTHY: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
  },
} as const;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
