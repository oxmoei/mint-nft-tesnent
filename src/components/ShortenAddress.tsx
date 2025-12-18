'use client';

import { useState } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';

interface ShortenAddressProps {
  address: string;
}

export default function ShortenAddress({ address }: ShortenAddressProps) {
  const [copied, setCopied] = useState(false);

  const shortenedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const copyToClipboard = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="flex items-center gap-2 p-2 px-4 rounded-lg cursor-pointer bg-[#14285F]/50 backdrop-blur-lg hover:bg-[#14285F]/70 transition-colors"
      onClick={copyToClipboard}
    >
      {copied ? (
        <FaCheck className="text-green-400" />
      ) : (
        <FaCopy className="text-white/70" />
      )}
      <span className="font-mono text-sm text-white">{shortenedAddress}</span>
    </div>
  );
}

