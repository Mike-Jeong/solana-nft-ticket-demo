import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js'

export const getConnection = () => {
  const rpc = import.meta.env.VITE_RPC || clusterApiUrl('devnet')
  return new Connection(rpc, 'confirmed')
}

export const getMetaplex = (connection, walletAdapter) => {
  const mx = Metaplex.make(connection)
  if (walletAdapter?.publicKey) mx.use(walletAdapterIdentity(walletAdapter))
  return mx
}

export const fetchNftByMint = async (mx, mint) => {
  const mintPk = new PublicKey(mint)
  return await mx.nfts().findByMint({ mintAddress: mintPk })
}
