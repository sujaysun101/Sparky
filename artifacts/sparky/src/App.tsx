import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home, { Logo } from '@/pages/home';
import WorkspacePage from '@/pages/workspace';
import InvitePage from '@/pages/invite';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Redirect,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY.');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c54320',
    colorForeground: '#252b35',
    colorMutedForeground: '#626a75',
    colorDanger: '#b42332',
    colorBackground: '#fcfbf8',
    colorInput: '#ffffff',
    colorInputForeground: '#252b35',
    colorNeutral: '#252b35',
    fontFamily: "'Instrument Sans', system-ui, sans-serif",
    borderRadius: '0.625rem',
  },
  elements: {
    rootBox: 'flex w-full min-w-0 max-w-full justify-center',
    cardBox: 'w-full max-w-[440px] overflow-hidden rounded-2xl border border-stone-200 bg-[#fcfbf8] shadow-xl',
    card: '!rounded-none !border-0 !bg-transparent !shadow-none',
    footer: '!rounded-none !border-0 !bg-transparent !shadow-none',
    headerTitle: 'font-semibold text-slate-900',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButtonText: 'font-medium text-slate-800',
    formFieldLabel: 'font-medium text-slate-800',
    footerActionLink: 'font-medium text-orange-800 underline-offset-4 hover:underline',
    footerActionText: 'text-slate-600',
    dividerText: 'text-slate-500',
    identityPreviewEditButton: 'font-medium text-orange-800',
    formFieldSuccessText: 'text-emerald-800',
    alertText: 'text-red-800',
    logoBox: 'h-8 w-8',
    logoImage: 'h-8 w-8',
    socialButtonsBlockButton: 'border border-stone-300 bg-white hover:bg-stone-50',
    formButtonPrimary: 'bg-primary font-semibold text-primary-foreground hover:opacity-90',
    formFieldInput: 'border-stone-300 bg-white text-slate-900 placeholder:text-slate-500',
    footerAction: 'text-slate-600',
    dividerLine: 'bg-stone-300',
    alert: 'border-red-200 bg-red-50',
    otpCodeFieldInput: 'border-stone-300 bg-white text-slate-900',
    formFieldRow: 'gap-2',
    main: 'text-slate-800',
  },
};

function Router() {
  const [location] = useLocation();
  const reduceMotion = useReducedMotion();
  const path = location.split(/[?#]/, 1)[0] || '/';
  const projectMatch = path.match(/^\/projects\/([a-f0-9-]{36})\/?$/i);
  const inviteMatch = path.match(/^\/invite\/([a-f0-9]{64})\/?$/);

  let routeKey = path;
  let page = <NotFound />;
  if (path === '/') {
    routeKey = 'home';
    page = <HomeRedirect />;
  } else if (path === '/user-portal') {
    routeKey = 'user-portal';
    page = <UserPortal />;
  } else if (/^\/sign-in(?:\/|$)/.test(path)) {
    routeKey = 'sign-in';
    page = <SignInPage />;
  } else if (/^\/sign-up(?:\/|$)/.test(path)) {
    routeKey = 'sign-up';
    page = <SignUpPage />;
  } else if (inviteMatch) {
    routeKey = `invite:${inviteMatch[1]}`;
    page = <InvitePage token={inviteMatch[1]} />;
  } else if (projectMatch) {
    routeKey = `project:${projectMatch[1]}`;
    page = <WorkspacePage projectIdOverride={projectMatch[1]} />;
  }

  return (
    <RoutedErrorBoundary>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={routeKey}
          className="min-h-[100dvh]"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
        >
          {page}
        </motion.div>
      </AnimatePresence>
    </RoutedErrorBoundary>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <main className="grid min-h-[100dvh] place-items-center bg-background"><span className="text-sm text-muted-foreground">Loading…</span></main>;
  if (!isSignedIn) return <Home />;
  const invitePath = consumePendingInvite();
  if (invitePath) return <Redirect to={invitePath} />;
  return <Redirect to="/user-portal" />;
}

function UserPortal() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <main className="grid min-h-[100dvh] place-items-center bg-background"><span className="text-sm text-muted-foreground">Loading…</span></main>;
  if (!isSignedIn) return <Redirect to="/" />;
  const invitePath = consumePendingInvite();
  if (invitePath) return <Redirect to={invitePath} />;
  return <Home accountMode />;
}

function consumePendingInvite(): string | null {
  const pendingInvite = sessionStorage.getItem("sparky.pendingInvite");
  if (!pendingInvite) return null;
  sessionStorage.removeItem("sparky.pendingInvite");
  return /^[a-f0-9]{64}$/.test(pendingInvite) ? `/invite/${pendingInvite}` : null;
}

function SignInPage() {
  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top_left,hsl(var(--secondary)/.72),transparent_34rem)] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl min-w-0 flex-col">
        <div className="mb-8 flex items-center justify-between"><Logo /><span className="text-xs text-muted-foreground">Your projects, right where you left them.</span></div>
        <div className="grid min-w-0 flex-1 items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-20">
          <section className="hidden max-w-lg lg:block">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">A little progress adds up</p>
            <h1 className="font-display mt-4 text-5xl font-bold leading-[.98]">Pick up where your curiosity left off.</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Your project plans, milestones, and notes stay together in one learner workspace.</p>
            <div className="mt-9 rounded-2xl border border-border/80 bg-card/80 p-5">
              <p className="text-sm font-semibold">Your work stays yours.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Share only the projects you choose with a team workspace.</p>
            </div>
          </section>
          <div className="surface-shadow w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/80 bg-card p-3 sm:p-5">
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </div>
        </div>
      </div>
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top_left,hsl(var(--secondary)/.72),transparent_34rem)] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl min-w-0 flex-col">
        <div className="mb-8 flex items-center justify-between"><Logo /><span className="text-xs text-muted-foreground">A steady start for your next idea.</span></div>
        <div className="grid min-w-0 flex-1 items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-20">
          <section className="hidden max-w-lg lg:block">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Make a little. Learn a lot.</p>
            <h1 className="font-display mt-4 text-5xl font-bold leading-[.98]">Give your ideas room to grow.</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Save projects across devices, build at your own pace, and invite teammates when you’re ready to learn together.</p>
            <div className="mt-9 flex gap-3">
              <div className="flex-1 rounded-2xl border border-border/80 bg-card/80 p-4">
                <p className="font-mono text-xs text-primary">01</p><p className="mt-2 text-sm font-semibold">Start small</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A single sentence can become a project.</p>
              </div>
              <div className="flex-1 rounded-2xl border border-border/80 bg-card/80 p-4">
                <p className="font-mono text-xs text-primary">02</p><p className="mt-2 text-sm font-semibold">Keep learning</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Each step makes the code less mysterious.</p>
              </div>
            </div>
          </section>
          <div className="surface-shadow w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/80 bg-card p-3 sm:p-5">
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          </div>
        </div>
      </div>
    </main>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        client.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: { title: 'Welcome back', subtitle: 'Sign in to pick up where you left off.' },
        },
        signUp: {
          start: { title: 'Create your account', subtitle: 'Save your projects and learn at your pace.' },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Router />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
