import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { Projects } from '@/pages/Projects';
import { ProjectTasks } from '@/pages/ProjectTasks';
import { NormalLayout } from '@/components/layout/NormalLayout';
import { NewDesignLayout } from '@/components/layout/NewDesignLayout';
import { usePostHog } from 'posthog-js/react';
import { useAuth } from '@/hooks';
import { usePreviousPath } from '@/hooks/usePreviousPath';
import { PageLoader } from '@/components/ui/PageLoader';

import { SettingsLayout } from '@/pages/settings/';

// Lazy-loaded routes for code splitting
const FullAttemptLogsPage = lazy(() =>
  import('@/pages/FullAttemptLogs').then((m) => ({ default: m.FullAttemptLogsPage }))
);
const GeneralSettings = lazy(() =>
  import('@/pages/settings/GeneralSettings').then((m) => ({ default: m.GeneralSettings }))
);
const ProjectSettings = lazy(() =>
  import('@/pages/settings/ProjectSettings').then((m) => ({ default: m.ProjectSettings }))
);
const OrganizationSettings = lazy(() =>
  import('@/pages/settings/OrganizationSettings').then((m) => ({ default: m.OrganizationSettings }))
);
const AgentSettings = lazy(() =>
  import('@/pages/settings/AgentSettings').then((m) => ({ default: m.AgentSettings }))
);
const McpSettings = lazy(() =>
  import('@/pages/settings/McpSettings').then((m) => ({ default: m.McpSettings }))
);
import { UserSystemProvider, useUserSystem } from '@/components/ConfigProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SearchProvider } from '@/contexts/SearchContext';

import { HotkeysProvider } from 'react-hotkeys-hook';

import { ProjectProvider } from '@/contexts/ProjectContext';
import { ThemeMode } from 'shared/types';
import * as Sentry from '@sentry/react';

import { DisclaimerDialog } from '@/components/dialogs/global/DisclaimerDialog';
import { OnboardingDialog } from '@/components/dialogs/global/OnboardingDialog';
import { ReleaseNotesDialog } from '@/components/dialogs/global/ReleaseNotesDialog';
import { ClickedElementsProvider } from './contexts/ClickedElementsProvider';
import { GoogleSsoProvider } from '@/components/GoogleSsoProvider';
import { GoogleSsoGuard } from '@/components/GoogleSsoGuard';
import NiceModal from '@ebay/nice-modal-react';

// Design scope components
import { LegacyDesignScope } from '@/components/legacy-design/LegacyDesignScope';
import { NewDesignScope } from '@/components/ui-new/scope/NewDesignScope';

// New design pages (lazy loaded)
const Workspaces = lazy(() =>
  import('@/pages/ui-new/Workspaces').then((m) => ({ default: m.Workspaces }))
);
const WorkspacesLanding = lazy(() =>
  import('@/pages/ui-new/WorkspacesLanding').then((m) => ({ default: m.WorkspacesLanding }))
);

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

function AppContent() {
  const { config, analyticsUserId, updateAndSaveConfig } = useUserSystem();
  const posthog = usePostHog();
  const { isSignedIn } = useAuth();

  // Track previous path for back navigation
  usePreviousPath();

  // Handle opt-in/opt-out and user identification when config loads
  useEffect(() => {
    if (!posthog || !analyticsUserId) return;

    if (config?.analytics_enabled) {
      posthog.opt_in_capturing();
      posthog.identify(analyticsUserId);
      console.log('[Analytics] Analytics enabled and user identified');
    } else {
      posthog.opt_out_capturing();
      console.log('[Analytics] Analytics disabled by user preference');
    }
  }, [config?.analytics_enabled, analyticsUserId, posthog]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    const showNextStep = async () => {
      // 1) Disclaimer - first step
      if (!config.disclaimer_acknowledged) {
        await DisclaimerDialog.show();
        if (!cancelled) {
          await updateAndSaveConfig({ disclaimer_acknowledged: true });
        }
        DisclaimerDialog.hide();
        return;
      }

      // 2) Onboarding - configure executor and editor
      if (!config.onboarding_acknowledged) {
        const result = await OnboardingDialog.show();
        if (!cancelled) {
          await updateAndSaveConfig({
            onboarding_acknowledged: true,
            executor_profile: result.profile,
            editor: result.editor,
          });
        }
        OnboardingDialog.hide();
        return;
      }

      // 3) Release notes - last step
      if (config.show_release_notes) {
        await ReleaseNotesDialog.show();
        if (!cancelled) {
          await updateAndSaveConfig({ show_release_notes: false });
        }
        ReleaseNotesDialog.hide();
        return;
      }
    };

    showNextStep();

    return () => {
      cancelled = true;
    };
  }, [config, isSignedIn, updateAndSaveConfig]);

  // TODO: Disabled while developing FE only
  // if (loading) {
  //   return (
  //     <div className="min-h-screen bg-background flex items-center justify-center">
  //       <Loader message="Loading..." size={32} />
  //     </div>
  //   );
  // }

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider initialTheme={config?.theme || ThemeMode.SYSTEM}>
        <SearchProvider>
          <SentryRoutes>
            {/* ========== LEGACY DESIGN ROUTES ========== */}
            {/* VS Code full-page logs route (outside NormalLayout for minimal UI) */}
            <Route
              path="/projects/:projectId/tasks/:taskId/attempts/:attemptId/full"
              element={
                <Suspense fallback={<PageLoader />}>
                  <LegacyDesignScope>
                    <FullAttemptLogsPage />
                  </LegacyDesignScope>
                </Suspense>
              }
            />

            <Route
              element={
                <LegacyDesignScope>
                  <NormalLayout />
                </LegacyDesignScope>
              }
            >
              <Route path="/" element={<Projects />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId" element={<Projects />} />
              <Route
                path="/projects/:projectId/tasks"
                element={<ProjectTasks />}
              />
              <Route path="/settings/*" element={<SettingsLayout />}>
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<Suspense fallback={<PageLoader />}><GeneralSettings /></Suspense>} />
                <Route path="projects" element={<Suspense fallback={<PageLoader />}><ProjectSettings /></Suspense>} />
                <Route path="organizations" element={<Suspense fallback={<PageLoader />}><OrganizationSettings /></Suspense>} />
                <Route path="agents" element={<Suspense fallback={<PageLoader />}><AgentSettings /></Suspense>} />
                <Route path="mcp" element={<Suspense fallback={<PageLoader />}><McpSettings /></Suspense>} />
              </Route>
              <Route
                path="/mcp-servers"
                element={<Navigate to="/settings/mcp" replace />}
              />
              <Route
                path="/projects/:projectId/tasks/:taskId"
                element={<ProjectTasks />}
              />
              <Route
                path="/projects/:projectId/tasks/:taskId/attempts/:attemptId"
                element={<ProjectTasks />}
              />
            </Route>

            {/* ========== NEW DESIGN ROUTES ========== */}
            <Route
              path="/workspaces"
              element={
                <NewDesignScope>
                  <NewDesignLayout />
                </NewDesignScope>
              }
            >
              <Route index element={<Suspense fallback={<PageLoader />}><WorkspacesLanding /></Suspense>} />
              <Route path="create" element={<Suspense fallback={<PageLoader />}><Workspaces /></Suspense>} />
              <Route path=":workspaceId" element={<Suspense fallback={<PageLoader />}><Workspaces /></Suspense>} />
            </Route>
          </SentryRoutes>
        </SearchProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <UserSystemProvider>
        <ThemeProvider initialTheme={ThemeMode.SYSTEM}>
          <GoogleSsoProvider>
            <GoogleSsoGuard>
              <ClickedElementsProvider>
              <ProjectProvider>
                <HotkeysProvider initiallyActiveScopes={['*', 'global', 'kanban']}>
                  <NiceModal.Provider>
                    <AppContent />
                  </NiceModal.Provider>
                </HotkeysProvider>
              </ProjectProvider>
            </ClickedElementsProvider>
            </GoogleSsoGuard>
          </GoogleSsoProvider>
        </ThemeProvider>
      </UserSystemProvider>
    </BrowserRouter>
  );
}

export default App;
