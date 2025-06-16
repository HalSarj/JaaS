import React, { useState, useEffect, useCallback } from 'react';

interface DropboxConnectProps {
  userId: string;
  supabaseUrl: string;
}

interface ConnectionStatus {
  connected: boolean;
  expired?: boolean;
  expires_at?: string;
  account_id?: string;
  last_updated?: string;
}

export const DropboxConnect: React.FC<DropboxConnectProps> = ({ userId, supabaseUrl }) => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnectionStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${supabaseUrl}/functions/v1/dropbox-oauth/status?user_id=${userId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error checking connection status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check connection status');
    } finally {
      setLoading(false);
    }
  }, [userId, supabaseUrl]);

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      // Redirect to OAuth flow
      const authUrl = `${supabaseUrl}/functions/v1/dropbox-oauth/auth?user_id=${userId}`;
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error initiating OAuth:', err);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setConnecting(false);
    }
  };

  const handleRefreshToken = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${supabaseUrl}/functions/v1/dropbox-oauth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        await checkConnectionStatus(); // Refresh status
      } else {
        throw new Error(data.error || 'Failed to refresh token');
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Dropbox? This will stop automatic dream processing.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // This would require implementing a disconnect endpoint
      // For now, just refresh status
      await checkConnectionStatus();
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isTokenExpired = () => {
    return status?.expired || (status?.expires_at && new Date(status.expires_at) <= new Date());
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Checking Dropbox connection...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Dropbox Integration</h3>
        {status?.connected && (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            isTokenExpired() 
              ? 'bg-yellow-100 text-yellow-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {isTokenExpired() ? 'Token Expired' : 'Connected'}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!status?.connected ? (
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.69 9 11 5.16-1.31 9-5.45 9-11V7l-10-5z"/>
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Connect to Dropbox</h4>
            <p className="text-sm text-gray-600 mb-4">
              Connect your Dropbox account to automatically process .m4a files into dream insights.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-6 rounded-md transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Dropbox'}
          </button>
        </div>
      ) : (
        <div>
          <div className="space-y-3 mb-4">
            {status.account_id && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Account ID:</span>
                <span className="font-mono text-gray-900">{status.account_id}</span>
              </div>
            )}
            {status.expires_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Token Expires:</span>
                <span className={`${isTokenExpired() ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(status.expires_at)}
                </span>
              </div>
            )}
            {status.last_updated && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-900">{formatDate(status.last_updated)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {isTokenExpired() && (
              <button
                onClick={handleRefreshToken}
                disabled={loading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Token'}
              </button>
            )}
            <button
              onClick={checkConnectionStatus}
              disabled={loading}
              className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Disconnect
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>How it works:</strong> Upload .m4a files to your Dropbox root folder. 
              They&apos;ll be automatically downloaded, transcribed, and analyzed for dream insights.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}; 