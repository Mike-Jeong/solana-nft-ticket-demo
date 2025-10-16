import React, { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { getMetaplex } from '../solana'
import { PublicKey } from '@solana/web3.js'
import QRCode from 'qrcode'

export default function BuyTransfer() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [mint, setMint] = useState('')
  const [recipient, setRecipient] = useState('')
  const [owner, setOwner] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const parsePk = (v, label) => { try { return new PublicKey(v) } catch { throw new Error(`${label} 주소가 올바르지 않아요`) } }
  const human = (e) => e?.cause?.message || e?.message || String(e)

  async function getOwnerByMint(mintStr) {
    try {
      const mintPk = new PublicKey(mintStr)
      const largest = await connection.getTokenLargestAccounts(mintPk)
      const holderAta = largest.value.find(v => v.amount === '1')?.address
      if (!holderAta) return 'unknown'
      const acct = await connection.getParsedAccountInfo(holderAta)
      return acct.value?.data?.parsed?.info?.owner || 'unknown'
    } catch { return 'unknown' }
  }
  const refreshOwner = async () => {
    if (!mint.trim()) { setMsg('Mint 주소를 먼저 입력하세요'); return }
    const cur = await getOwnerByMint(mint)
    setOwner(cur)
  }

  const onTransfer = async () => {
    if (!wallet.connected) return setMsg('⚠️ 지갑을 먼저 연결하세요')
    if (!mint.trim())      return setMsg('⚠️ Mint 주소를 입력하세요')
    if (busy) return
    setBusy(true); setMsg('전송 준비 중...')

    try {
      const mx = getMetaplex(connection, wallet)
      const mintPk = parsePk(mint, 'Mint')
      const toOwner = recipient ? parsePk(recipient, 'Recipient') : wallet.publicKey

      setMsg('🔄 전송 중... Phantom 팝업을 확인하세요')
      const nft = await mx.nfts().findByMint({ mintAddress: mintPk })
      const res = await mx.nfts().transfer({ nftOrSft: nft, toOwner })

      // optional confirm
      try {
        const sig = res?.response?.signature
        if (sig) await connection.confirmTransaction({
          signature: sig,
          blockhash: res?.response?.blockhash ?? '',
          lastValidBlockHeight: res?.response?.lastValidBlockHeight ?? 0
        }, 'confirmed')
      } catch {}

      setMsg('✅ 전송 완료')
      try { setQrUrl(await QRCode.toDataURL(mint)) } catch {}
      await refreshOwner()
    } catch (e) {
      setMsg(`❌ ${human(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{fontWeight:600}}>Buy/Transfer + QR</h2>

      <label>Mint Address<br/>
        <input className="input" value={mint} onChange={e=>setMint(e.target.value)} />
      </label>

      <div style={{height:8}} />

      <label>Recipient (옵션: 다른 사람 지갑 주소)<br/>
        <input className="input" placeholder="비워두면 현재 지갑으로 전송"
               value={recipient} onChange={e=>setRecipient(e.target.value)} />
      </label>

      <div className="actions" style={{marginTop:8}}>
        <button className="tab active" disabled={!wallet.connected || !mint || busy} onClick={onTransfer}>
          {busy ? 'Processing...' : 'Transfer (Buy)'}
        </button>
        <button className="tab" disabled={!mint || busy} onClick={refreshOwner}>
          Check Current Owner
        </button>
      </div>

      {owner && <p style={{fontSize:12, marginTop:8}}>현재 소유자: {owner}</p>}

      {qrUrl && (
        <div style={{marginTop:12}}>
          <img alt="ticket-qr" src={qrUrl} className="qr" />
          <p style={{fontSize:12}}>이 QR을 게이트에서 스캔합니다.</p>
        </div>
      )}

      <div style={{marginTop:8,fontSize:14,whiteSpace:'pre-wrap'}}>{msg}</div>
    </div>
  )
}
