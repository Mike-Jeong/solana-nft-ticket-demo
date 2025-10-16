import React, { useState } from 'react'
import WalletContext from './WalletContext'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import AdminMint from './pages/AdminMint'
import BuyTransfer from './pages/BuyTransfer'
import ScanVerify from './pages/ScanVerify'

export default function App() {
  const [tab, setTab] = useState('mint')
  return (
    <WalletContext>
      <header className="container" style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff'}}>
        <h1 style={{fontSize:20,fontWeight:700}}>Solana NFT Ticket Demo</h1>
        <WalletMultiButton />
      </header>
      <div className="container" style={{display:'flex',gap:8,marginTop:8}}>
        {['mint','buy','scan'].map(k => (
          <button key={k} className={'tab'+(tab===k?' active':'')} onClick={()=>setTab(k)}>
            {k==='mint'?'1) Admin Mint':k==='buy'?'2) Buy/Transfer + QR':'3) Scan & Verify'}
          </button>
        ))}
      </div>
      <main className="container" style={{marginTop:12}}>
        {tab==='mint' && <AdminMint />}
        {tab==='buy' && <BuyTransfer />}
        {tab==='scan' && <ScanVerify />}
      </main>
    </WalletContext>
  )
}
