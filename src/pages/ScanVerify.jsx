import React, { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Scanner } from '@yudiel/react-qr-scanner'
import { getMetaplex } from '../solana'

export default function ScanVerify() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [mint, setMint] = useState('')
  const [owner, setOwner] = useState('')
  const [creator, setCreator] = useState('') // updateAuthority
  const [status, setStatus] = useState('waiting')
  const [busy, setBusy] = useState(false)

  async function getNftOwnerByMint(mintStr) {
    try {
      const mintPk = new PublicKey(mintStr)
      const largest = await connection.getTokenLargestAccounts(mintPk)
      const holderAta = largest.value.find(v => v.amount === '1')?.address
      if (!holderAta) return 'unknown'
      const acct = await connection.getParsedAccountInfo(holderAta)
      const ownerPk = acct.value?.data?.parsed?.info?.owner
      return ownerPk || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  function extractCreator(nft) {
    const cand =
      nft?.updateAuthorityAddress?.toBase58?.() ||
      nft?.updateAuthority?.address?.toBase58?.() ||
      (typeof nft?.updateAuthority === 'string' ? nft.updateAuthority : null)
    return cand || 'unknown'
  }

  const loadNft = async (mintAddr) => {
    setStatus('Scanning: checking ownership...')
    const curOwner = await getNftOwnerByMint(mintAddr)
    setOwner(curOwner)

    try {
      const mx = getMetaplex(connection, wallet)
      const nft = await mx.nfts().findByMint({ mintAddress: new PublicKey(mintAddr) })
      setCreator(extractCreator(nft))
      if ((nft.uses?.remaining ?? 0) === 0) {
        setStatus('✅ Already used')
        return
      }
    } catch (e) {
      console.warn('NFT Meta data no found. e:', e)
    }

    setStatus(curOwner === 'unknown' ? '❌ can not verify ownership' : 'Success: ownership check')
  }

  const onScan = async (result) => {
    try {
      if (!result?.text) return
      const text = result.text.trim()
      const mintValue = text.startsWith('{') ? (JSON.parse(text)?.mint || '') : text
      if (!mintValue) return
      setMint(mintValue)
      await loadNft(mintValue)
    } catch (e) {
      console.error('onScan error:', e)
      setStatus('❌ QR code scan fail (try again)')
    }
  }

  const markUsed = async () => {
    if (busy || !mint) return
    setBusy(true)
    try {
      if (!wallet.publicKey) { setStatus('❌ connect wallet first'); return }

      const mx = getMetaplex(connection, wallet)
      const mintPk = new PublicKey(mint)

      const before = await mx.nfts().findByMint({ mintAddress: mintPk })
      const remaining = before.uses?.remaining ?? null
      const total = before.uses?.total ?? null
      if (remaining === null) { setStatus('❌ this nft doen\'t setting "uses"'); return }
      if (remaining <= 0)     { setStatus('Already used ✅'); return }

      if (!owner || owner === 'unknown') { setStatus('❌ can not check ownership'); return }
      const ownerPk = new PublicKey(owner)

      setStatus('🎟️ update usage... check gate\'s wallet pop-up')
      await mx.nfts().use({
        mintAddress: mintPk,
        numberOfUses: 1,
        owner: ownerPk,
        useAuthority: mx.identity(),
      })

      const after = await mx.nfts().findByMint({ mintAddress: mintPk })
      const left = after.uses?.remaining ?? 0
      setStatus(left === 0 ? '✅ Already used (remaining: 0)' : `left count: ${left}/${total}`)
    } catch (e) {
      console.error('markUsed error:', e)
      const msg = e?.cause?.message || e?.message || String(e)
      setStatus(`❌ usage update fail: ${msg}\n(check this ticket's authority)`)
    } finally {
      setBusy(false)
    }
  }

  const cluster = (import.meta.env.VITE_RPC || '').includes('testnet') ? 'testnet' : 'devnet'
  const canGateUse = Boolean(wallet.publicKey)

  return (
    <div className="card">
      <h2 style={{ fontWeight: 600 }}>Scan & Verify (Gate)</h2>

      <div style={{ width: '100%', maxWidth: 420, aspectRatio: '1/1', background: '#0001' }}>
        <Scanner
          onScan={(results) => {
            const first = Array.isArray(results) ? results[0] : results
            const value = first?.rawValue || first?.text
            if (value) onScan({ text: String(value) })
          }}
          constraints={{ facingMode: 'environment' }}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        <div>status: <b>{status}</b></div>
        {mint && <div>Mint: <code>{mint}</code></div>}
        {owner && <div>Current owner's wallet address: <code>{owner}</code></div>}
        {creator && <div>creator(updateAuthority): <code>{creator}</code></div>}

        {mint && (
          <a href={`https://explorer.solana.com/address/${mint}?cluster=${cluster}`} target="_blank" rel="noreferrer">
            Check NFT at Explorer
          </a>
        )}

        <div className="actions" style={{ marginTop: 10 }}>
          <button
            className="tab active"
            disabled={!canGateUse || busy}
            onClick={markUsed}
          >
            {busy ? 'Processing…' : 'update usage'}
          </button>
        </div>
      </div>
    </div>
  )
}