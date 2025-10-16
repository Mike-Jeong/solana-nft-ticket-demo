// src/pages/BuyTransfer.jsx
import React, { useRef, useState } from 'react'
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

  const parsePk = (v, label) => {
    try { return new PublicKey(v) }
    catch { throw new Error(`${label} The address is not correct`) }
  }
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
    if (!mint.trim()) { setMsg('Enter Mint address first'); return }
    const cur = await getOwnerByMint(mint)
    setOwner(cur)
  }

  const onTransfer = async () => {
    if (!wallet.connected) return setMsg('⚠️ Connect your wallet first')
    if (!mint.trim()) return setMsg('⚠️ Enter Mint address first')
    if (busy) return
    setBusy(true)
    setMsg('Preparing to transfer...')

    try {
      const mx = getMetaplex(connection, wallet)
      const mintPk = parsePk(mint, 'Mint')
      const toOwner = recipient ? parsePk(recipient, 'Recipient') : wallet.publicKey

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

      setMsg('🔄 transfering... please check wallet extension\'s pop-up')
      const nft = await mx.nfts().findByMint({ mintAddress: mintPk })

      let txResult
      try {
        txResult = await mx.nfts().transfer({ nftOrSft: nft, toOwner })
      } catch (innerErr) {
        const text = human(innerErr)
        if (text.includes('already been processed')) {
          setMsg('✅ Success (already been processed)')
        } else {
          throw innerErr
        }
      }

      const sig = txResult?.response?.signature
      if (sig) {
        try {
          await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            'confirmed'
          )
        } catch { /* confirm failure could be ignore */ }
      }

      if (!msg.startsWith('✅'))
        setMsg('✅ Success')

    } catch (e) {
      setMsg(`❌ ${human(e)}`)
    } finally {
      try { setQrUrl(await QRCode.toDataURL(mint)) } catch {}
      await refreshOwner()
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ fontWeight: 600 }}>Buy/Transfer + QR</h2>

      <label>Mint Address<br />
        <input className="input" value={mint} onChange={e => setMint(e.target.value)} />
      </label>

      <div style={{ height: 8 }} />

      <label>Recipient (Buyer's wallet address)<br />
        <input
          className="input"
          placeholder="If this area empty, ticket will be send it to current wallet"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
        />
      </label>

      <div className="actions" style={{ marginTop: 8 }}>
        <button
          className="tab active"
          disabled={!wallet.connected || !mint || busy}
          onClick={onTransfer}
        >
          {busy ? 'Processing...' : 'Transfer (Buy)'}
        </button>
        <button
          className="tab"
          disabled={!mint || busy}
          onClick={refreshOwner}
        >
          Check Current Owner
        </button>
      </div>

      {owner && <p style={{ fontSize: 12, marginTop: 8 }}>Current Owner: {owner}</p>}

      {qrUrl && (
        <div style={{ marginTop: 12 }}>
          <img alt="ticket-qr" src={qrUrl} className="qr" />
          <p style={{ fontSize: 12 }}>QR code will be scanned at the gate.</p>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 14, whiteSpace: 'pre-wrap' }}>{msg}</div>
    </div>
  )
}
