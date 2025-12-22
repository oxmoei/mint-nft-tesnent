'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { metaMask, injected } from '@wagmi/connectors';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, X } from 'lucide-react';
import Image from 'next/image';

declare global {
  interface Window {
    okxwallet?: any;
  }
}

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
  return !!(w.ethereum?.isMetaMask && w.ethereum?.isMetaMask);
}

// Check if in OKX in-app browser
function isInOkxBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('okx') || ua.includes('okxwallet')) return true;
  if (w.okxwallet && !w.ethereum?.isMetaMask) return true;
  return false;
}

// Check if OKX wallet is available
function isOKXWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.okxwallet || w.okxwallet?.ethereum);
}

interface WalletConnectProps {
  className?: string;
}

export default function WalletConnect({ className = '' }: WalletConnectProps) {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  
  const [connecting, setConnecting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isInMetaMask, setIsInMetaMask] = useState(false);
  const [isInOkx, setIsInOkx] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [isOKXAvailable, setIsOKXAvailable] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletSelectorRef = useRef<HTMLDivElement>(null);
  const switchInProgressRef = useRef(false);
  const hasRequestedMainnetSwitchRef = useRef(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsInMetaMask(isInMetaMaskBrowser());
    setIsInOkx(isInOkxBrowser());
    setIsOKXAvailable(isOKXWalletAvailable());
    setIsMounted(true);
  }, []);

  // Close wallet selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletSelectorRef.current && !walletSelectorRef.current.contains(event.target as Node)) {
        setShowWalletSelector(false);
      }
    };

    if (showWalletSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showWalletSelector]);

  // Auto switch to mainnet on connect
  useEffect(() => {
    if (isConnected && !hasRequestedMainnetSwitchRef.current && !switchInProgressRef.current) {
      hasRequestedMainnetSwitchRef.current = true;
      switchInProgressRef.current = true;
      (async () => {
        try {
          await switchChain({ chainId: mainnet.id });
        } catch (error) {
          console.error('Failed to switch to Ethereum mainnet:', error);
        } finally {
          switchInProgressRef.current = false;
        }
      })();
    }
  }, [isConnected, chainId, switchChain]);

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
              connect({
                connector: metaMask({
                  dappMetadata: {
                    name: 'Mint NFT',
                    url: window.location.origin,
                  },
                })
              });
            } catch (error) {
              console.error('Reconnection error:', error);
              setConnecting(false);
            }
          } else if (w.okxwallet?.selectedAddress) {
            const okxConnector = connectors.find(c => {
              const id = c.id.toLowerCase();
              return id.includes('okx') || id.includes('okxwallet');
            });
            if (okxConnector) {
              connect({ connector: okxConnector });
            } else {
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
  }, [isConnected, connecting, connect, connectors]);

  // Handle wallet connection with specific connector
  const handleConnectWallet = async (selectedConnector?: any) => {
    try {
      if (!selectedConnector) {
        setStatusError('No wallet connector selected.');
        setShowWalletSelector(false);
        return;
      }
      
      setConnecting(true);
      setStatusError(null);
      
      let connectorToUse;
      const id = selectedConnector.id?.toLowerCase() || '';
      const name = selectedConnector.name?.toLowerCase() || '';
      
      if (id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) {
        connectorToUse = metaMask({
          dappMetadata: {
            name: 'Mint NFT',
            url: window.location.origin,
          },
        });
      } else if (id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) {
        connectorToUse = selectedConnector;
      } else {
        connectorToUse = selectedConnector;
      }
      
      if (!connectorToUse) {
        setStatusError('No wallet available. Please install MetaMask or OKX Wallet.');
        setConnecting(false);
        setShowWalletSelector(false);
        return;
      }
      
      const isMetaMaskConnector = connectorToUse.id?.toLowerCase().includes('metamask') || 
                                  connectorToUse.id?.toLowerCase().includes('io.metamask');
      const isOkxConnector = connectorToUse.id?.toLowerCase().includes('okx') || 
                             connectorToUse.id?.toLowerCase().includes('okxwallet');
      
      if (isMobile && !isInMetaMask && isMetaMaskConnector) {
        setStatusError('Please open this page in MetaMask app browser first');
        setConnecting(false);
        setShowWalletSelector(false);
        return;
      }
      if (isMobile && !isInOkx && isOkxConnector) {
        setStatusError(
          'Please open this page in OKX Wallet in-app browser first.\n\n' +
          '检测到你使用的是移动端浏览器，请在 OKX 钱包内置浏览器中打开本页面后再连接钱包。'
        );
        setConnecting(false);
        setShowWalletSelector(false);
        return;
      }
      
      connect({ connector: connectorToUse });
      
      setTimeout(() => {
        setShowWalletSelector(false);
      }, 200);
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected) {
          setConnecting(false);
          const w = window as any;
          if (isMobile && (w.ethereum?.selectedAddress || w.okxwallet?.selectedAddress)) {
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
      const availableWallets = getAvailableWallets();
      
      if (availableWallets.length > 1) {
        setShowWalletSelector(true);
      } else if (availableWallets.length === 1) {
        handleConnectWallet(availableWallets[0].connector);
      } else {
        setStatusError('No supported wallet found. Please install MetaMask or OKX Wallet.');
      }
    }
  };

  // Get available wallet connectors - only MetaMask and OKX
  const getAvailableWallets = () => {
    const available: any[] = [];
    const seenTypes = new Set<string>();
    
    connectors.forEach(c => {
      if (!c || !c.id) return;

      const id = c.id.toLowerCase();
      const name = c.name?.toLowerCase() || '';
      
      if ((id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) && !seenTypes.has('metamask')) {
        available.push({ connector: c, name: 'MetaMask', type: 'metamask' });
        seenTypes.add('metamask');
        return;
      }
      
      if ((id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) && !seenTypes.has('okx')) {
        available.push({ connector: c, name: 'OKX Wallet', type: 'okx' });
        seenTypes.add('okx');
        return;
      }
    });
    
    return available;
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
      
      {/* Wallet selector modal */}
      {isMounted && showWalletSelector && !isConnected && typeof document !== 'undefined' ? createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowWalletSelector(false);
            }
          }}
        >
          <div 
            ref={walletSelectorRef}
            className="relative bg-black border border-white/20 rounded-2xl w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-white text-xl font-semibold">
                Select Wallet
              </h2>
              <button
                onClick={() => setShowWalletSelector(false)}
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Wallet options */}
            <div className="p-6 space-y-3">
              {getAvailableWallets().map((wallet) => {
                const isOKX = wallet.type === 'okx';
                const isMetaMask = wallet.type === 'metamask';
                return (
                  <button
                    key={wallet.connector.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConnectWallet(wallet.connector);
                    }}
                    className="w-full flex items-center gap-4 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-center flex-shrink-0">
                      {isMetaMask ? (
                        <Image
                          src="/MetaMask.svg"
                          alt="MetaMask"
                          width={28}
                          height={28}
                          className="w-7 h-7 object-contain"
                        />
                      ) : isOKX ? (
                        <Image
                          src="/OKX_wallet.svg"
                          alt="OKX Wallet"
                          width={28}
                          height={28}
                          className="w-7 h-7 object-contain"
                        />
                      ) : (
                        <Wallet className="w-6 h-6 text-white/70" />
                      )}
                    </div>
                    <span className="text-white font-medium text-lg">
                      {wallet.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
      
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


