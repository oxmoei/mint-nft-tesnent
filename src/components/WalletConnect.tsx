'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { metaMask } from '@wagmi/connectors';
import { useState, useEffect, useRef } from 'react';
import { Wallet } from 'lucide-react';

// Check if device is mobile
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Check if in MetaMask in-app browser
function isInMetaMaskBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  // 检查多 provider 情况下真正的 MetaMask provider
  if (w.ethereum?.providers && Array.isArray(w.ethereum.providers)) {
    return !!w.ethereum.providers.find((p: any) => p && p.isMetaMask);
  }
  return !!(w.ethereum?.isMetaMask && w.ethereum?.isMetaMask);
}

interface WalletConnectProps {
  className?: string;
}

export default function WalletConnect({ className = '' }: WalletConnectProps) {
  const { address, isConnected, connector } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [connecting, setConnecting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isInMetaMask, setIsInMetaMask] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsInMetaMask(isInMetaMaskBrowser());
    setIsMounted(true);
  }, []);

  // When wagmi reports connected,立即结束本地 "Connecting..." 状态并清理超时
  useEffect(() => {
    if (isConnected) {
      setConnecting(false);
      setStatusError(null);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  }, [isConnected]);

  // Listen to connection errors
  useEffect(() => {
    if (connectError && connecting && !isConnected) {
      setStatusError(
        `Connection failed: ${connectError.message}. If not connected after returning from wallet, please retry.`
      );
      setConnecting(false);
    }
  }, [connectError, connecting, isConnected]);

  // Listen to page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && connecting) {
        setTimeout(() => {
          const w = window as any;
          if (w.ethereum?.selectedAddress) {
            try {
              connect({ connector: metaMask() });
            } catch (error) {
              console.error('Reconnection error:', error);
              setConnecting(false);
            }
          } else {
            setConnecting(false);
          }
        }, 1500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isConnected, connecting, connect]);

  // Handle wallet connection - always use MetaMask
  const handleConnectWallet = async () => {
    try {
      setConnecting(true);
      setStatusError(null);

      const connectorToUse = metaMask();
      
      if (!connectorToUse) {
        setStatusError('No wallet available. Please install MetaMask.');
        setConnecting(false);
        return;
      }
      
      // 我们只使用 MetaMask 连接器，这里只需检查移动端是否在 MetaMask 内置浏览器中
      if (isMobile && !isInMetaMask) {
        setStatusError('Please open this page in MetaMask app browser first');
        setConnecting(false);
        return;
      }
      
      connect({ connector: connectorToUse });
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected) {
          setConnecting(false);
          const w = window as any;
          if (isMobile && w.ethereum?.selectedAddress) {
            setStatusError(
              'Wallet address detected but connection incomplete. Please ensure you are in the wallet app browser, then retry.'
            );
          } else {
            setStatusError(
              'Connection timeout. If not connected after returning from wallet, please retry.'
            );
          }
        }
      }, 15000);
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setStatusError(
        `Connection error: ${error?.message || 'Unknown error'}`
      );
      setConnecting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      // 直接尝试连接 MetaMask，避免多余逻辑，加快连接速度
      handleConnectWallet();
    }
  };

  if (!isMounted) {
    return (
      <button
        className={`px-6 py-2 connectButton text-white rounded-lg transition-all font-medium ${className}`}
        disabled
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleConnect}
        disabled={connecting}
        className={`px-6 py-2 connectButton text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <div className="flex items-center justify-center gap-2">
          {connecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4" />
              <span>
                {isConnected
                  ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : 'Connect Wallet'}
              </span>
            </>
          )}
        </div>
      </button>
      {/* Error message */}
      {statusError && !isConnected && !connecting && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-red-500/20 border border-red-500/50 rounded-lg p-3 z-50 backdrop-blur-sm">
          <p className="text-xs text-red-200 break-words">
            {statusError}
          </p>
        </div>
      )}
    </div>
  );
}


