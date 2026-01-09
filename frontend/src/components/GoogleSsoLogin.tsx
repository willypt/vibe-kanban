import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { googleSsoApi } from '@/lib/api';
import { Logo } from '@/components/Logo';
import '@/styles/legacy/index.css';

interface GoogleSsoLoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Full-page Google SSO login component.
 * Shows a centered login button and handles the authentication flow.
 */
export function GoogleSsoLogin({ onSuccess, onError }: GoogleSsoLoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError('No credential received from Google');
      onError?.('No credential received from Google');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await googleSsoApi.verify(credentialResponse.credential);
      // Reload the page to refresh auth state
      window.location.reload();
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to verify with server';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    setError('Google Sign-In failed. Please try again.');
    onError?.('Google Sign-In failed');
  };

  return (
    <div className="legacy-design" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(48 33% 97%)' }}>
      <div className="flex flex-col items-center gap-8 rounded-lg border border-border bg-card p-10 shadow-lg max-w-md w-full mx-4">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="flex flex-col items-center gap-1 mt-2">
            <h1 className="text-xl font-semibold text-foreground">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              Authentication is required to access this application
            </p>
          </div>
        </div>

        {error && (
          <div className="w-full rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Signing in...</span>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            useOneTap={false}
            theme="filled_blue"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        )}
      </div>
    </div>
  );
}
