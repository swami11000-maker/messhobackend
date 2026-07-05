import { ethers } from 'ethers';
import { env } from '../config/env.js';

const provider = new ethers.JsonRpcProvider(env.RPC_URL);

export const sendEth = async (toAddress: string, amountEth: number): Promise<string> => {
	if (!env.PRIVATE_KEY) {
		throw new Error('Treasury private key not configured');
	}

	const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
	const tx = await wallet.sendTransaction({
		to: toAddress,
		value: ethers.parseEther(amountEth.toFixed(18)),
	});

	return tx.hash;
};

export const getNativeBalance = async (address: string): Promise<string> => {
	const balance = await provider.getBalance(address);
	return ethers.formatEther(balance);
};
