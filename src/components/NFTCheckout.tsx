'use client';

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConnect } from 'wagmi';
import { parseEther } from 'viem';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

// NFT 配置 - 请根据实际情况修改
const nft = {
  name: 'NeoArc',
  blockChain: 'Arc Testnet',
  address: '0xE61C000000000000000000000000000000007A8D' as `0x${string}`,
  image: '/assets/Frame-830.png', // 替换为实际的 NFT 图片
  price: 0, // 0 表示 Free
  description: 'NeonArc — a radiant fusion of light and code, born on the ARC testnet. Where every mint sparks a pulse of digital energy across the blockchain.',
  explorerLink: '', // 可选：区块浏览器链接
  tasks: [] as { id: number; title: string; link: string; completed: boolean }[], // 可选：任务列表
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

export default function NFTCheckout() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const [tasks, setTasks] = useState(nft.tasks);
  const [loadingTask, setLoadingTask] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mounted, setMounted] = useState(false);

  // 防止 hydration 错误
  useEffect(() => {
    setMounted(true);
  }, []);

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

  const nftAdd = () => {
    setQuantity(quantity + 1);
  };

  const nftMinus = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
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
    const injectedConnector = connectors.find(c => c.id === 'injected');
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  const handleMint = async () => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: nft.address,
        abi: CONTRACT_ABI,
        functionName: 'mint',
        value: parseEther((nft.price * quantity).toString()),
      });
    } catch (error) {
      console.error('Mint error:', error);
    }
  };

  // 客户端渲染的钱包状态
  const walletConnected = mounted && isConnected;

  return (
    <div>
      <div className="max-w-screen-lg mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 content-center justify-items-center gap-10">
          {/* Left: NFT Image */}
          <div className="w-full rounded-lg h-[500px] sticky top-0">
            <img
              className="w-full mx-auto rounded-2xl sticky top-[100px]"
              src={nft.image}
              alt={nft.name}
            />
          </div>

          {/* Right: Mint Info */}
          <div className="p-10">
            <h1 className="text-4xl">{nft.name}</h1>
            <div className="font-PTSans outline-1 outline-dashed outline-offset-2 w-[25%] rounded-sm mt-4 mb-4 ml-2">
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

            <div className="mt-5">
              <p>{nft.description}</p>

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
                        disabled={(tasks?.length > 0 && !allTasksCompleted) || isMinting || isConfirming}
                        className="bg-indigo-600 text-white font-semibold py-2 px-10 rounded hover:bg-indigo-700 hover:text-white transition disabled:opacity-50"
                      >
                        {isMinting || isConfirming ? (
                          <span className="flex items-center justify-center gap-2">
                            <FaSpinner className="animate-spin" />
                            {isConfirming ? 'Confirming...' : 'Minting...'}
                          </span>
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
                    {mintError && (
                      <div className="mt-4 w-full">
                        <p className="text-red-400 text-sm">
                          Error: {mintError.message}
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
                  <div className="flex-col pb-[11%]">
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
