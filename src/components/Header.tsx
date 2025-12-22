'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import WalletConnect from '@/components/WalletConnect';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 防止 hydration 错误
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
      <nav className="container mx-auto px-4 sm:px-6 md:px-10 lg:px-70 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a
            href="https://alze.xyz"
            className="flex items-center gap-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/assets/logo-DPgmRCGh.png"
              alt="alzelogo"
              width={80}
              height={80}
              className="rounded"
              style={{ width: 'auto', height: 'auto' }}
            />
          </a>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-6">
            <li>
              <a
                href="https://alze.xyz"
                className="text-white hover:text-cyan-400 transition-colors flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>HOME</span>
              </a>
            </li>
            <li>
              <a
                href="https://alze.xyz/id"
                className="text-white hover:text-cyan-400 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                🔥 ALZE ID
              </a>
            </li>
            <li>
              <a
                href="https://alze.xyz/nfts"
                className="text-white hover:text-cyan-400 transition-colors flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>ALZE NFT</span>
              </a>
            </li>
            <li>
              <a
                href="https://alze.xyz/stake"
                className="text-white hover:text-cyan-400 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                📍STAKE
              </a>
            </li>
            <li>
              <a
                href="https://alze.xyz/learn/phase1"
                className="text-white hover:text-cyan-400 transition-colors flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>LEARN</span>
              </a>
            </li>
          </ul>

          {/* Connect Wallet Button (uses shared WalletConnect with modal selector) */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {mounted && (
              <WalletConnect className="px-6 py-2" />
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-white p-2"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-white/10 pt-4">
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href="https://alze.xyz"
                  className="text-white hover:text-cyan-400 transition-colors block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  HOME
                </a>
              </li>
              <li>
                <a
                  href="https://alze.xyz/id"
                  className="text-white hover:text-cyan-400 transition-colors block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🔥 ALZE ID
                </a>
              </li>
              <li>
                <a
                  href="https://alze.xyz/nfts"
                  className="text-white hover:text-cyan-400 transition-colors block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ALZE NFT
                </a>
              </li>
              <li>
                <a
                  href="https://alze.xyz/stake"
                  className="text-white hover:text-cyan-400 transition-colors block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📍STAKE
                </a>
              </li>
              <li>
                <a
                  href="https://alze.xyz/learn/phase1"
                  className="text-white hover:text-cyan-400 transition-colors block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LEARN
                </a>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
}
