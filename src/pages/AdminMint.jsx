import React, { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { getMetaplex } from '../solana'
import { PublicKey } from '@solana/web3.js'

export default function AdminMint() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [seat, setSeat] = useState('A1')
  const [mintAddr, setMintAddr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const onMint = async () => {
    if (!wallet.connected) return setMsg('⚠️ 지갑을 먼저 연결하세요')

    try {
      setBusy(true)
      setMsg('⛏️ Minting...')

      const mx = getMetaplex(connection, wallet)
      const PLACEHOLDER_URI = 'https://arweave.net/6zY4HnZ_placeholder_demo_metadata.json'

      // 1) NFT 민팅 (uses: Single / 1회)
      const { nft } = await mx.nfts().create({
        uri: PLACEHOLDER_URI,
        name: `Ticket - ${seat}`,
        symbol: 'TIX',
        sellerFeeBasisPoints: 0,
        isMutable: true,
        uses: { useMethod: 'Single', total: 1, remaining: 1 },
      })

      const mintPk = nft.address
      setMintAddr(mintPk.toBase58())
      setMsg('✅ Mint success. 게이트 권한 위임 중...')

      // 2) 민팅 직후: 발행자(현재 소유자)가 게이트 지갑으로 1회 use 권한 위임

      const currentUser = wallet.publicKey;
      console.log(currentUser);
      // const currentOwner = currentUser;
      // console.log(currentUser);

      await mx.nfts().approveUseAuthority({
        mintAddress: mintPk,
        user: currentUser, 
        //owner: currentOwner, 
        numberOfUses: 1,
      })

      setMsg('✅ Mint + 게이트 1회 위임 완료!')
    } catch (e) {
      console.error(e)
      setMsg(`❌ ${e?.cause?.message || e?.message || String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const cluster = (import.meta.env.VITE_RPC || '').includes('testnet') ? 'testnet' : 'devnet'

  return (
    <div className="card">
      <h2 style={{fontWeight:600}}>Admin Mint (선위임 포함)</h2>

      <label>Seat<br/>
        <input className="input" value={seat} onChange={e=>setSeat(e.target.value)} />
      </label>

      <div className="actions" style={{marginTop:8}}>
        <button disabled={!wallet.connected || busy} onClick={onMint} className="tab active">
          {busy ? 'Minting...' : 'Mint Ticket NFT'}
        </button>
      </div>

      {mintAddr && (
        <div style={{marginTop:12,fontSize:14}}>
          <div>Mint Address</div>
          <code>{mintAddr}</code>
          <div style={{marginTop:6}}>
            <a href={`https://explorer.solana.com/address/${mintAddr}?cluster=${cluster}`} target="_blank" rel="noreferrer">
              Explorer에서 보기
            </a>
          </div>
          <div style={{fontSize:12, marginTop:4}}>👉 이 Mint 주소를 구매/전송 화면에 사용하세요</div>
        </div>
      )}

      <div style={{marginTop:8,fontSize:14,whiteSpace:'pre-wrap'}}>{msg}</div>
    </div>
  )
}
