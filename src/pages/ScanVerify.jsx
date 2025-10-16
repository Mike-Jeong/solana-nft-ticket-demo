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
  const [status, setStatus] = useState('대기중')
  const [busy, setBusy] = useState(false)

  // 현재 보유자(= NFT 가진 지갑 주소) 조회
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

  // updateAuthority 추출 (SDK 버전에 따라 필드명이 다를 수 있어 방어적으로 처리)
  function extractCreator(nft) {
    const cand =
      nft?.updateAuthorityAddress?.toBase58?.() ||
      nft?.updateAuthority?.address?.toBase58?.() ||
      (typeof nft?.updateAuthority === 'string' ? nft.updateAuthority : null)
    return cand || 'unknown'
  }

  const loadNft = async (mintAddr) => {
    setStatus('스캔 성공: 소유자 확인 중...')
    const curOwner = await getNftOwnerByMint(mintAddr)
    setOwner(curOwner)

    try {
      const mx = getMetaplex(connection, wallet)
      const nft = await mx.nfts().findByMint({ mintAddress: new PublicKey(mintAddr) })
      setCreator(extractCreator(nft))
      if ((nft.uses?.remaining ?? 0) === 0) {
        setStatus('✅ 이미 사용 완료')
        return
      }
    } catch (e) {
      console.warn('NFT 메타 조회 실패:', e)
    }

    setStatus(curOwner === 'unknown' ? '❌ 소유자 확인 실패' : '스캔 성공: 소유자 확인됨')
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
      setStatus('❌ QR 인식 오류 (다시 시도하세요)')
    }
  }

  // 게이트: 위임받은 useAuthority(= 현재 연결된 지갑)로 use() 실행
  const markUsed = async () => {
    if (busy || !mint) return
    setBusy(true)
    try {
      if (!wallet.publicKey) { setStatus('❌ 지갑을 먼저 연결하세요'); return }

      const mx = getMetaplex(connection, wallet)
      const mintPk = new PublicKey(mint)

      // 온체인 uses 상태 확인
      const before = await mx.nfts().findByMint({ mintAddress: mintPk })
      const remaining = before.uses?.remaining ?? null
      const total = before.uses?.total ?? null
      if (remaining === null) { setStatus('❌ 이 NFT는 uses가 설정되지 않았습니다'); return }
      if (remaining <= 0)     { setStatus('이미 사용 완료 ✅'); return }

      // 현재 보유자 주소를 PublicKey 로 준비 (owner는 주소, Signer 아님)
      if (!owner || owner === 'unknown') { setStatus('❌ 소유자 확인 실패'); return }
      const ownerPk = new PublicKey(owner)

      setStatus('🎟️ 온체인 사용 처리 중... 지갑 팝업을 확인하세요')
      await mx.nfts().use({
        mintAddress: mintPk,
        numberOfUses: 1,

        // 누구의 토큰을 소모할지 지정 (PublicKey)
        owner: ownerPk,

        // 🔥 핵심: 실제 서명자 = "위임받은 게이트 지갑"
        // getMetaplex(connection, wallet) 로 설정된 identity (현재 연결된 지갑)
        useAuthority: mx.identity(),
      })

      const after = await mx.nfts().findByMint({ mintAddress: mintPk })
      const left = after.uses?.remaining ?? 0
      setStatus(left === 0 ? '✅ 사용 완료 (remaining: 0)' : `남은 횟수: ${left}/${total}`)
    } catch (e) {
      console.error('markUsed error:', e)
      const msg = e?.cause?.message || e?.message || String(e)
      setStatus(`❌ 사용 처리 실패: ${msg}\n(민팅 시 게이트 위임이 되었는지 확인하세요)`)
    } finally {
      setBusy(false)
    }
  }

  const cluster = (import.meta.env.VITE_RPC || '').includes('testnet') ? 'testnet' : 'devnet'
  const canGateUse = Boolean(wallet.publicKey)

  return (
    <div className="card">
      <h2 style={{ fontWeight: 600 }}>Scan & Verify (게이트 자동 처리)</h2>

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
        <div>상태: <b>{status}</b></div>
        {mint && <div>Mint: <code>{mint}</code></div>}
        {owner && <div>현재 소유자: <code>{owner}</code></div>}
        {creator && <div>제작자(updateAuthority): <code>{creator}</code></div>}

        {mint && (
          <a href={`https://explorer.solana.com/address/${mint}?cluster=${cluster}`} target="_blank" rel="noreferrer">
            Explorer에서 NFT 확인
          </a>
        )}

        <div className="actions" style={{ marginTop: 10 }}>
          <button
            className="tab active"
            disabled={!canGateUse || busy}
            onClick={markUsed}
          >
            {busy ? 'Processing…' : '온체인 사용 처리 (게이트)'}
          </button>
        </div>
      </div>
    </div>
  )
}