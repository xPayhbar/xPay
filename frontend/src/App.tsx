// xPay — Mobile-First Responsive UI
// Fully compatible with Android browsers
// Week 5 Bounty | hedera-agent-kit@3.8.2

import { useState, useRef, useEffect, useCallback } from "react";
import { useWallet } from "./wallet/useWallet";

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg:       "#060a12",
  card:     "#0d1520",
  card2:    "#111d2c",
  border:   "#1a2d45",
  border2:  "#203550",
  purple:   "#7c3aed",
  purple2:  "#a78bfa",
  cyan:     "#06b6d4",
  cyan2:    "#67e8f9",
  green:    "#10b981",
  green2:   "#6ee7b7",
  amber:    "#f59e0b",
  red:      "#ef4444",
  text:     "#f0f9ff",
  text2:    "#94a3b8",
  text3:    "#334155",
};

// ── Service catalog ───────────────────────────────────────────────────────
const CATS = {
  ai:       { label:"AI Credits",   icon:"🤖", color:C.purple2, bg:"rgba(124,58,237,.12)", bd:"rgba(167,139,250,.2)",
    svcs:{ "0.0.4567890":{n:"OpenAI GPT-4",    i:"🤖", p:"50 HBAR"},
           "0.0.4567891":{n:"Anthropic Claude", i:"🧠", p:"60 HBAR"},
           "0.0.4567892":{n:"Stability AI",     i:"🎨", p:"30 HBAR"},
           "0.0.4567893":{n:"Groq Inference",   i:"⚡", p:"20 HBAR"} }},
  infra:    { label:"Dev Infra",    icon:"⚙️",  color:C.cyan,   bg:"rgba(6,182,212,.1)",  bd:"rgba(6,182,212,.2)",
    svcs:{ "0.0.8901234":{n:"Pinecone DB",  i:"🌲", p:"20 USDC"},
           "0.0.8901235":{n:"Alchemy RPC",   i:"🔌", p:"10 HBAR"},
           "0.0.8901236":{n:"QuickNode",     i:"⚡", p:"15 HBAR"},
           "0.0.8901237":{n:"IPFS/Pinata",   i:"📦", p:"5 USDC"} }},
  data:     { label:"Data Intel",   icon:"📊", color:C.green,   bg:"rgba(16,185,129,.1)", bd:"rgba(16,185,129,.2)",
    svcs:{ "0.0.2345678":{n:"Moralis",    i:"📈", p:"30 HBAR"},
           "0.0.2345679":{n:"TheGraph",   i:"📊", p:"10 HBAR"},
           "0.0.2345680":{n:"Chainlink",  i:"🔗", p:"5 HBAR"},
           "0.0.2345681":{n:"Nansen",     i:"🧩", p:"50 USDC"} }},
  security: { label:"Security",     icon:"🛡", color:C.amber,   bg:"rgba(245,158,11,.1)", bd:"rgba(245,158,11,.2)",
    svcs:{ "0.0.3456789":{n:"CertiK",    i:"🛡", p:"200 HBAR"},
           "0.0.3456790":{n:"Forta",     i:"🔍", p:"10 HBAR"},
           "0.0.3456791":{n:"Tenderly",  i:"🧪", p:"5 HBAR"},
           "0.0.3456792":{n:"Hexagate",  i:"⚠️", p:"8 HBAR"} }},
};

const ALL = Object.values(CATS).reduce((a,c)=>({...a,...c.svcs}),{});

const WALLETS = [
  {name:"HashPack", icon:"💜", color:C.purple2},
  {name:"Blade",    icon:"🔵", color:C.cyan},
  {name:"Kabila",   icon:"🟠", color:C.amber},
  {name:"MetaMask", icon:"🦊", color:"#f59e0b"},
];

const PRESETS = [
  {l:"OpenAI 50 ℏ",   c:"ai",       m:"Pay 50 HBAR to OpenAI GPT-4 (0.0.4567890) for API credits"},
  {l:"Pinecone USDC", c:"infra",    m:"Purchase 20 USDC of Pinecone DB (0.0.8901234)"},
  {l:"TheGraph 10 ℏ", c:"data",     m:"Pay 10 HBAR to TheGraph (0.0.2345679) for indexing"},
  {l:"CertiK audit",  c:"security", m:"Pay 200 HBAR to CertiK (0.0.3456789) for audit"},
  {l:"Exceed limit",  c:"",         m:"Send 5000 HBAR to OpenAI (0.0.4567890)"},
  {l:"Unknown acct",  c:"",         m:"Transfer 80 HBAR to 0.0.9999999"},
];

const uid    = () => Math.random().toString(36).slice(2,8);
const now    = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const short  = (h) => h ? h.slice(0,8)+"…" : "";

async function ask(msg, policies, spend, token) {
  const allowed = policies.allowlist.accounts.map(id=>ALL[id]?.n??id).join(", ")||"none";
  const sys = `You are xPay — AI payment agent on Hedera (hedera-agent-kit v3.8.2).
Enforce BEFORE any payment:
${policies.spendLimit.enabled?`SPEND LIMIT: ${policies.spendLimit[token==="HBAR"?"hbar":"usdc"]} ${token}/day used: ${(token==="HBAR"?spend.hbar:spend.usdc).toFixed(1)}`:"SPEND LIMIT: off"}
${policies.allowlist.enabled?`ALLOWLIST: only ${allowed}`:"ALLOWLIST: off"}
${policies.approvalThreshold.enabled?`APPROVAL: HBAR >= ${policies.approvalThreshold.hbar}`:"APPROVAL: off"}
${policies.anomalyDetection.enabled?"ANOMALY: flag unknown accounts, >10k HBAR/>5k USDC, round >=1000":"ANOMALY: off"}
Accounts: OpenAI=0.0.4567890,Claude=0.0.4567891,Stability=0.0.4567892,Groq=0.0.4567893,Pinecone=0.0.8901234,Alchemy=0.0.8901235,QuickNode=0.0.8901236,IPFS=0.0.8901237,Moralis=0.0.2345678,TheGraph=0.0.2345679,Chainlink=0.0.2345680,Nansen=0.0.2345681,CertiK=0.0.3456789,Forta=0.0.3456790,Tenderly=0.0.3456791,Hexagate=0.0.3456792
Return ONLY JSON: {"decision":"approved"|"blocked"|"needs_approval"|"info","policy":"spend_limit"|"allowlist"|"approval_threshold"|"anomaly"|null,"detail":null,"to":null,"service":null,"cat":"ai"|"infra"|"data"|"security"|null,"amount":0,"currency":"HBAR","hash":null,"msg":"1-2 sentences"}`;
  const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,system:sys,
      messages:[{role:"user",content:msg}]})});
  const d = await r.json();
  const raw = (d.content||[]).map(b=>b.text||"").join("").trim();
  try{ return JSON.parse(raw.replace(/```json|```/g,"").trim()); }
  catch{ return{decision:"info",policy:null,detail:null,to:null,service:null,cat:null,
    amount:0,currency:token,hash:null,msg:raw||"Error. Try again."}; }
}

// ── Styles ─────────────────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;-moz-text-size-adjust:100%;text-size-adjust:100%}
body{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif;min-height:100vh;
  overflow-x:hidden;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:${C.border2};border-radius:2px}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes glow{0%,100%{box-shadow:0 0 10px ${C.purple}44}50%{box-shadow:0 0 24px ${C.purple}88}}
@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .25s ease both}
.slide{animation:slideUp .3s ease both}
button,a{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
button{font-family:'Inter',sans-serif;cursor:pointer;border:none;outline:none}
textarea,input{font-family:'Inter',sans-serif;outline:none;-webkit-appearance:none}
input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;
  background:${C.border2};outline:none;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;
  border-radius:50%;cursor:pointer;border:2px solid ${C.bg}}
input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;
  cursor:pointer;border:2px solid ${C.bg};appearance:none}
.mono{font-family:'JetBrains Mono',monospace}
.nav-tab{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 12px;
  border-radius:10px;border:none;background:none;color:${C.text2};font-size:11px;
  font-weight:500;transition:all .2s;min-width:60px}
.nav-tab.active{color:${C.purple2};background:rgba(124,58,237,.12)}
.nav-tab svg{width:20px;height:20px}
.card{background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:16px}
.card2{background:${C.card2};border:1px solid ${C.border};border-radius:10px;padding:12px}
.tog{position:relative;width:44px;height:24px;border-radius:12px;border:none;
  transition:background .2s;cursor:pointer;flex-shrink:0}
.tog-knob{position:absolute;top:3px;width:18px;height:18px;border-radius:50%;
  background:white;transition:left .2s}
.chip{padding:8px 14px;border-radius:20px;font-size:13px;font-weight:500;
  white-space:nowrap;border:1px solid;transition:all .15s;cursor:pointer}
.bubble-user{background:linear-gradient(135deg,${C.purple},${C.cyan}88);
  border-radius:18px 18px 4px 18px;padding:12px 16px;font-size:14px;line-height:1.6}
.bubble-agent{background:${C.card};border:1px solid ${C.border2};
  border-radius:18px 18px 18px 4px;padding:12px 16px;font-size:14px;line-height:1.6}
.tx-row{display:flex;justify-content:space-between;align-items:center;
  padding:6px 0;border-bottom:1px solid ${C.border};font-size:12px}
.tx-row:last-child{border-bottom:none}
.sheet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;
  display:flex;align-items:flex-end;justify-content:center}
.sheet{background:${C.card};border-radius:24px 24px 0 0;width:100%;max-width:560px;
  padding:0 0 32px;max-height:90vh;overflow-y:auto}
.sheet-handle{width:36px;height:4px;background:${C.border2};border-radius:2px;
  margin:12px auto 20px}
.spend-bar{height:6px;border-radius:3px;overflow:hidden;background:${C.border}}
.spend-fill{height:100%;border-radius:3px;transition:width .6s ease}
.svc-item{display:flex;align-items:center;gap:10px;padding:10px 12px;
  border-radius:10px;border:1px solid ${C.border};background:${C.card2};
  cursor:pointer;transition:border-color .15s;width:100%}
.stat{background:${C.card};border:1px solid ${C.border};border-radius:12px;
  padding:14px;text-align:center}
.msg-input{width:100%;background:${C.card};border:1.5px solid ${C.border2};
  border-radius:14px;color:${C.text};font-size:15px;padding:12px 16px;
  resize:none;min-height:48px;max-height:120px;line-height:1.5;
  transition:border-color .15s}
.msg-input:focus{border-color:${C.purple}}
.send-btn{width:48px;height:48px;border-radius:14px;flex-shrink:0;
  background:linear-gradient(135deg,${C.purple},${C.cyan});
  display:flex;align-items:center;justify-content:center;font-size:20px}
.send-btn:disabled{opacity:.4}
@media(min-width:768px){
  .desktop-grid{display:grid;grid-template-columns:280px 1fr 250px;height:100vh;overflow:hidden}
  .mobile-only{display:none!important}
  .desktop-only{display:flex!important}
  .desktop-panel{display:flex;flex-direction:column;overflow-y:auto;height:100%}
}
@media(max-width:767px){
  .desktop-only{display:none!important}
  .mobile-layout{display:flex;flex-direction:column;height:100vh}
}
`;

export default function App() {
  const [tab,    setTab]    = useState("chat");
  const [catTab, setCatTab] = useState("ai");
  const [token,  setToken]  = useState("HBAR");
  const [policies, setPols] = useState({
    spendLimit:{enabled:true,hbar:500,usdc:100},
    allowlist:{enabled:true,accounts:["0.0.4567890","0.0.4567891","0.0.8901234","0.0.8901237","0.0.2345679","0.0.2345680","0.0.3456789","0.0.3456790"]},
    approvalThreshold:{enabled:true,hbar:100},
    anomalyDetection:{enabled:true},
  });
  const [spend,  setSpend]  = useState({hbar:142.5,usdc:18});
  const [msgs,   setMsgs]   = useState([{id:uid(),role:"agent",time:now(),
    text:"Hello! I'm xPay — your AI payment agent on Hedera. Connect your wallet to sign transactions with HashPack, Blade, or Kabila. All payments go through 4 policy hooks. Try a preset or type below."}]);
  const [input,  setInput]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [txLog,  setTxLog]  = useState([]);
  const [modal,  setModal]  = useState(null);
  const [wSheet, setWSheet] = useState(false);
  const wallet = useWallet("testnet");
  const [signing,setSigning]= useState(false);
  const msgsEnd = useRef(null);

  useEffect(() => {
    if (wallet.connected && wallet.accountId) {
      add({
        role: "system",
        text: `${wallet.walletIcon ?? "\ud83d\udd17"} ${wallet.walletName} connected \u2014 ${wallet.accountId}. Approvals will be signed directly by your wallet.`
      });
    }
  }, [wallet.connected, wallet.accountId]);

  useEffect(()=>{ msgsEnd.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const add = (m) => setMsgs(p=>[...p,{id:uid(),time:now(),...m}]);


  const send = useCallback(async(text)=>{
    const msg=(text||input).trim(); if(!msg||busy) return;
    setInput(""); add({role:"user",text:msg}); setBusy(true);
    try{
      const r = await ask(msg, buildPolicyConfig(), conversationId.current);
      if(r.policy){
        const labels={spend_limit:"\ud83d\udeab Spend Limit Triggered",allowlist:"\ud83d\udeab Allowlist Blocked",
          approval_threshold:"\u23f3 Approval Required",anomaly:"\u26a0\ufe0f Anomaly Detected"};
        add({role:"policy",
          pt:r.decision==="approved"?"approved":r.decision==="needs_approval"?"pending":"blocked",
          text:labels[r.policy]??"Policy Event",detail:r.detail});
      }
      if(r.decision==="approved"&&r.amount>0){
        if (r.spendState) setSpend({hbar:r.spendState.hbar, usdc:r.spendState.usdc});
        setTxLog(l=>[{id:uid(),service:r.service||r.to,cat:r.cat,amount:r.amount,
          currency:r.currency,status:"ok",hash:r.hash,time:now(),
          signedBy:"Operator (testnet)"},...l].slice(0,30));
        add({role:"agent",text:r.msg,tx:{amount:r.amount,currency:r.currency,
          service:r.service||r.to,hash:r.hash,cat:r.cat,ok:true}});
      } else if(r.decision==="needs_approval"){
        setModal({pid:r.pendingId,amount:r.amount,currency:r.currency,
          to:r.to,service:r.service,cat:r.cat,detail:r.detail});
        add({role:"agent",text:r.msg});
      } else if(r.decision==="blocked"){
        setTxLog(l=>[{id:uid(),service:r.service||r.to||"unknown",cat:r.cat,
          amount:r.amount,currency:r.currency||token,status:"fail",
          hash:null,time:now(),policy:r.policy},...l].slice(0,30));
        add({role:"agent",text:r.msg});
      } else if(r.decision==="error"){
        add({role:"agent",text:`\u26a0\ufe0f ${r.detail||r.msg||"Transfer failed on-chain."}`});
      } else {
        add({role:"agent",text:r.msg});
      }
    }catch(e){add({role:"agent",text:`\u26a0\ufe0f ${e.message||"Network error."}`});}
    setBusy(false);
  },[input,busy,policies,token,wallet]);

  const approve = async()=>{
    if(!modal || !modal.pid) return;
    setSigning(true);
    try{
      let hash;
      let amount = modal.amount;
      let currency = modal.currency;
      let service = modal.service || modal.to;

      if (wallet.connected) {
        const result = await wallet.sign({
          toAccountId: modal.to ?? "0.0.9268478",
          amount: modal.amount,
          currency: modal.currency,
          memo: `xPay: ${modal.service ?? modal.to}`,
          serviceName: modal.service,
        });
        hash = result.txHash;
        await fetch(`/api/approve/${modal.pid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletTxHash: hash }),
        }).catch(()=>{});
      } else {
        const result = await approveOnChain(modal.pid);
        hash = result.hash;
        amount = result.amount ?? modal.amount;
        currency = result.currency ?? modal.currency;
        service = result.service || service;
        if (result.spendState) setSpend({hbar:result.spendState.hbar, usdc:result.spendState.usdc});
      }

      setSigning(false);
      setTxLog(l=>[{id:uid(),service,cat:modal.cat,
        amount,currency,status:"ok",hash,time:now(),
        policy:"approval_threshold",
        signedBy:wallet.connected?`${wallet.walletName} wallet`:"Operator (testnet)"},...l].slice(0,30));
      add({role:"policy",pt:"approved",text:wallet.connected?`\u2705 Signed by ${wallet.walletName}`:"\u2705 Approved \u2014 executed on testnet"});
      add({role:"agent",text:`Done. ${amount} ${currency} sent to ${service}. TX: ${short(hash)}`,
        tx:{amount,currency,service,hash,cat:modal.cat,ok:true}});
    }catch(e){
      setSigning(false);
      add({role:"agent",text:`\u26a0\ufe0f ${e.message||"Signing failed"}`});
    }
    setModal(null);
  };

  const reject = ()=>{
    if(!modal) return;
    setTxLog(l=>[{id:uid(),service:modal.service||"unknown",cat:modal.cat,
      amount:modal.amount,currency:modal.currency,status:"fail",
      hash:null,time:now(),policy:"approval_threshold"},...l].slice(0,30));
    add({role:"policy",pt:"blocked",text:"❌ Transaction rejected"});
    add({role:"agent",text:"Rejected. No funds moved."});
    setModal(null);
  };

  const sv=spend[token==="HBAR"?"hbar":"usdc"];
  const sc=policies.spendLimit[token==="HBAR"?"hbar":"usdc"];
  const pct=Math.min(100,(sv/sc)*100);
  const catD=CATS[catTab];
  const sentC=txLog.filter(t=>t.status==="ok").length;
  const blockC=txLog.filter(t=>t.status==="fail").length;

  const Header = ()=>(
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
      background:`${C.bg}ee`,backdropFilter:"blur(12px)",
      position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:34,height:34,borderRadius:10,fontSize:18,
          background:`linear-gradient(135deg,${C.purple},${C.cyan})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 0 16px ${C.purple}66`,animation:"glow 3s infinite",flexShrink:0}}>ℏ</div>
        <div>
          <div style={{fontSize:15,fontWeight:700,letterSpacing:"-.01em"}}>xPay</div>
          <div style={{fontSize:10,color:C.text2,letterSpacing:".08em",textTransform:"uppercase"}}>
            AI Payment Agent · Hedera
          </div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {wallet.connected?(
          <button onClick={()=>setWSheet(true)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",
              borderRadius:20,background:`${C.purple}18`,border:`1px solid ${C.purple2}44`,
              color:C.purple2,fontSize:12,fontWeight:600}}>
            <span>{wallet.walletIcon}</span>
            <span className="mono" style={{fontSize:11}}>{wallet.accountId?.slice(0,10)}…</span>
          </button>
        ):(
          <button onClick={()=>setWSheet(true)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",
              borderRadius:20,background:`linear-gradient(135deg,${C.purple},${C.cyan}88)`,
              color:"white",fontSize:13,fontWeight:600,border:"none"}}>
            🔗 Connect
          </button>
        )}
        <div style={{padding:"4px 10px",borderRadius:20,background:`${C.green}14`,
          border:`1px solid ${C.green}30`,color:C.green,fontSize:11,
          fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>
          TESTNET
        </div>
      </div>
    </header>
  );

  const WalletSheet = ()=>(
    <div className="sheet-overlay" onClick={e=>{if(e.target===e.currentTarget)setWSheet(false)}}>
      <div className="sheet slide" style={{maxWidth:560}}>
        <div className="sheet-handle"/>
        <div style={{padding:"0 20px"}}>
          {wallet.connected?(
            <>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                <div style={{width:52,height:52,borderRadius:16,fontSize:28,
                  background:`linear-gradient(135deg,${C.purple}44,${C.cyan}44)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:`1px solid ${C.border2}`}}>{wallet.walletIcon}</div>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.green,marginBottom:3}}>
                    ● {wallet.walletName} Connected
                  </div>
                  <div className="mono" style={{fontSize:12,color:C.text2}}>{wallet.accountId}</div>
                </div>
              </div>
              <div className="card2" style={{marginBottom:16}}>
                <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",
                  letterSpacing:".1em",marginBottom:8}}>HBAR Balance</div>
                <div style={{fontSize:32,fontWeight:800,color:C.purple2,
                  fontFamily:"'JetBrains Mono',monospace"}}>
                  {wallet.balance} <span style={{fontSize:16,color:C.text2}}>ℏ</span>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                {[["💸","Sign payments","Wallet signs each txn"],
                  ["🔑","Non-custodial","xPay never has your key"],
                  ["🛡","Policy gates","4 hooks before signing"],
                  ["👁","You decide","Approve high-value txns"],
                ].map(([icon,t,d])=>(
                  <div key={t} className="card2" style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{t}</div>
                      <div style={{fontSize:11,color:C.text2,lineHeight:1.4}}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={disconnectW}
                style={{width:"100%",padding:14,borderRadius:12,fontSize:15,fontWeight:600,
                  background:`${C.red}14`,border:`1px solid ${C.red}30`,color:C.red}}>
                Disconnect Wallet
              </button>
            </>
          ):(
            <>
              <h2 style={{fontSize:20,fontWeight:700,marginBottom:6}}>Connect Wallet</h2>
              <p style={{fontSize:14,color:C.text2,marginBottom:20,lineHeight:1.6}}>
                Choose your Hedera wallet. Scan the QR code in your wallet app to connect.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {WALLETS.map(w=>(
                  <button key={w.name} onClick={()=>{ const ext = wallet.availableExtensions.find(e=>e.name.toLowerCase().includes(w.name.toLowerCase())&&e.available); ext ? wallet.connectExt(w.name) : wallet.connectModal(); }}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",
                      borderRadius:14,background:C.card2,border:`1px solid ${C.border}`,
                      textAlign:"left",width:"100%",transition:"border-color .15s"}}>
                    <div style={{width:44,height:44,borderRadius:12,fontSize:24,
                      background:`${w.color}18`,border:`1px solid ${w.color}33`,
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {w.icon}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>{w.name}</div>
                      <div style={{fontSize:12,color:C.text2}}>Tap to connect via WalletConnect 2.0</div>
                    </div>
                    <span style={{color:C.text2,fontSize:18}}>›</span>
                  </button>
                ))}
              </div>
              <div className="mono" style={{fontSize:11,color:C.text2,textAlign:"center",lineHeight:1.6}}>
                @hashgraph/hedera-wallet-connect@2.1.3 · HIP-820
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const ApprovalSheet = ()=>(
    <div className="sheet-overlay">
      <div className="sheet slide" style={{maxWidth:560}}>
        <div className="sheet-handle"/>
        <div style={{padding:"0 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{fontSize:28}}>⏳</span>
            <h2 style={{fontSize:20,fontWeight:700}}>Approval Required</h2>
          </div>
          <p style={{fontSize:13,color:C.text2,marginBottom:20,lineHeight:1.6}}>
            {wallet.connected
              ? `${wallet.walletName} will prompt you to sign this transaction.`
              : "This transfer needs manual approval. Connect a wallet to sign directly."}
          </p>
          <div style={{padding:"12px 14px",borderRadius:12,marginBottom:16,
            background:wallet.connected?`${C.purple}12`:`${C.border}22`,
            border:`1px solid ${wallet.connected?C.purple2:C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>{wallet.connected?wallet.walletIcon??"🔗":"🖥"}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,
                  color:wallet.connected?C.purple2:C.text2}}>
                  {wallet.connected?`Signing with ${wallet.walletName}`:"Server keypair signing"}
                </div>
                {wallet.connected&&<div className="mono" style={{fontSize:11,color:C.text2}}>{wallet.accountId}</div>}
              </div>
            </div>
          </div>
          <div className="card2" style={{marginBottom:16}}>
            {[["Service",modal?.service??"Unknown"],
              ["Amount",`${modal?.amount} ${modal?.currency}`],
              ["Account",modal?.to],
              ["Reason",modal?.detail??"High-value transfer"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.text2}}>{k}</span>
                <span style={{fontSize:k==="Amount"?16:13,fontWeight:k==="Amount"?700:500,
                  color:k==="Amount"?C.amber:C.text,
                  fontFamily:k==="Account"?"'JetBrains Mono',monospace":"Inter",
                  maxWidth:200,textAlign:"right",wordBreak:"break-all"}}>{v}</span>
              </div>
            ))}
          </div>
          {!wallet.connected&&(
            <button onClick={()=>{setModal(null);setWSheet(true);}}
              style={{width:"100%",padding:12,borderRadius:12,marginBottom:12,
                background:`${C.purple}14`,border:`1px solid ${C.purple2}44`,
                color:C.purple2,fontSize:14,fontWeight:600}}>
              🔗 Connect Wallet to Sign
            </button>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={reject}
              style={{padding:14,borderRadius:12,background:C.card2,
                border:`1px solid ${C.border}`,color:C.text2,fontSize:15,fontWeight:600}}>
              Reject
            </button>
            <button onClick={approve} disabled={signing}
              style={{padding:14,borderRadius:12,border:"none",fontSize:15,fontWeight:700,
                background:wallet.connected?`linear-gradient(135deg,${C.purple},${C.cyan}88)`:`${C.green}cc`,
                color:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {signing
                ?<><div style={{width:16,height:16,border:"2.5px solid white",
                    borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
                  Signing…</>
                :wallet.connected?`Sign`:`Approve`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const PolicyPanel = ()=>(
    <div style={{padding:"0 16px 100px",overflowY:"auto"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",
          letterSpacing:".1em",marginBottom:8}}>Payment Token</div>
        <div style={{display:"flex",gap:8}}>
          {["HBAR","USDC"].map(t=>(
            <button key={t} onClick={()=>setToken(t)}
              style={{flex:1,padding:"10px 0",borderRadius:12,fontSize:14,fontWeight:700,
                fontFamily:"'JetBrains Mono',monospace",
                border:`1.5px solid ${token===t?(t==="HBAR"?C.purple2:C.cyan):C.border}`,
                background:token===t?`${t==="HBAR"?C.purple:C.cyan}18`:C.card2,
                color:token===t?(t==="HBAR"?C.purple2:C.cyan):C.text2}}>
              {t==="HBAR"?"ℏ HBAR":"＄ USDC"}
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",
          letterSpacing:".1em",marginBottom:14}}>Active Policy Hooks</div>
        {[{k:"spendLimit",l:"Spend Limit",d:"Daily cap enforcement"},
          {k:"allowlist",l:"Counterparty Allowlist",d:"Approved accounts only"},
          {k:"approvalThreshold",l:"Human Approval",d:"Gate high-value HBAR"},
          {k:"anomalyDetection",l:"Anomaly Detection",d:"Flag suspicious patterns"},
        ].map(({k,l,d})=>(
          <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            paddingBottom:14,marginBottom:14,borderBottom:`1px solid ${C.border}`}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{l}</div>
              <div style={{fontSize:12,color:C.text2}}>{d}</div>
            </div>
            <button className="tog"
              style={{background:policies[k].enabled?C.green:C.border2}}
              onClick={()=>setPols(p=>({...p,[k]:{...p[k],enabled:!p[k].enabled}}))}>
              <div className="tog-knob" style={{left:policies[k].enabled?22:3}}/>
            </button>
          </div>
        ))}
      </div>
      {policies.spendLimit.enabled&&(
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:13,color:C.text2}}>Daily Cap</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:C.cyan}}>
              {policies.spendLimit[token==="HBAR"?"hbar":"usdc"]} {token}
            </div>
          </div>
          <input type="range" min={50} max={1000} step={50}
            value={policies.spendLimit[token==="HBAR"?"hbar":"usdc"]}
            onChange={e=>setPols(p=>({...p,spendLimit:{...p.spendLimit,
              [token==="HBAR"?"hbar":"usdc"]:+e.target.value}}))}
            style={{accentColor:C.cyan}}/>
        </div>
      )}
      {policies.approvalThreshold.enabled&&(
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:13,color:C.text2}}>Approval Threshold</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:C.amber}}>
              {policies.approvalThreshold.hbar} ℏ
            </div>
          </div>
          <input type="range" min={10} max={500} step={10}
            value={policies.approvalThreshold.hbar}
            onChange={e=>setPols(p=>({...p,approvalThreshold:{...p.approvalThreshold,hbar:+e.target.value}}))}
            style={{accentColor:C.amber}}/>
        </div>
      )}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>
          Wallet
        </div>
        {wallet.connected?(
          <>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:22}}>{wallet.walletIcon}</span>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.green}}>{wallet.walletName}</div>
                <div className="mono" style={{fontSize:11,color:C.text2}}>{wallet.accountId}</div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,
              padding:"10px 12px",background:C.card2,borderRadius:10}}>
              <span style={{fontSize:13,color:C.text2}}>Balance</span>
              <span className="mono" style={{fontSize:14,fontWeight:700,color:C.purple2}}>{wallet.balance} ℏ</span>
            </div>
            <button onClick={()=>setWSheet(true)}
              style={{width:"100%",padding:11,borderRadius:10,fontSize:13,fontWeight:600,
                background:`${C.purple}14`,border:`1px solid ${C.purple2}33`,color:C.purple2}}>
              Manage Wallet
            </button>
          </>
        ):(
          <>
            <p style={{fontSize:13,color:C.text2,marginBottom:12,lineHeight:1.5}}>
              Connect HashPack, Blade, or Kabila to sign transactions directly from your wallet.
            </p>
            <button onClick={()=>setWSheet(true)}
              style={{width:"100%",padding:13,borderRadius:12,fontSize:15,fontWeight:700,
                background:`linear-gradient(135deg,${C.purple},${C.cyan}88)`,
                border:"none",color:"white"}}>
              🔗 Connect Wallet
            </button>
          </>
        )}
      </div>
      <div>
        <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>
          Service Catalog
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          {Object.entries(CATS).map(([k,c])=>(
            <button key={k} onClick={()=>setCatTab(k)}
              style={{padding:"8px 6px",borderRadius:10,fontSize:13,fontWeight:600,
                border:`1.5px solid ${catTab===k?c.color:C.border}`,
                background:catTab===k?c.bg:C.card2,color:catTab===k?c.color:C.text2}}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {Object.entries(catD.svcs).map(([id,svc])=>{
            const allowed=policies.allowlist.accounts.includes(id);
            return(
              <button key={id} className="svc-item"
                style={{borderColor:allowed?catD.bd:C.border}}
                onClick={()=>allowed
                  ?send(`Pay ${svc.p} to ${svc.n} (${id}) for services`)
                  :setPols(p=>({...p,allowlist:{...p.allowlist,accounts:[...p.allowlist.accounts,id]}}))}>
                <span style={{fontSize:20,flexShrink:0}}>{svc.i}</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:13,fontWeight:600}}>{svc.n}</div>
                  <div style={{fontSize:12,color:C.text2}}>{svc.p}</div>
                </div>
                {allowed
                  ?<span style={{fontSize:12,color:C.green,fontWeight:700}}>✓</span>
                  :<span style={{fontSize:11,color:C.text2,background:C.border,
                      padding:"2px 8px",borderRadius:6}}>+ADD</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const ChatPanel = ()=>(
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",gap:10,background:C.card,flexShrink:0}}>
        <div style={{width:36,height:36,borderRadius:10,fontSize:20,flexShrink:0,
          background:`linear-gradient(135deg,${C.purple},${C.cyan})`,
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 0 14px ${C.purple}55`}}>🤖</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700}}>xPay Agent</div>
          <div style={{fontSize:11,color:C.green}}>
            ● v3.8.2 · {wallet.connected?`${wallet.walletName} ✓`:"No wallet"}
          </div>
        </div>
        {busy&&<div style={{display:"flex",alignItems:"center",gap:6,
          fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.amber,
          background:`${C.amber}12`,border:`1px solid ${C.amber}30`,
          padding:"4px 10px",borderRadius:20}}>
          <div style={{width:8,height:8,border:`2px solid ${C.amber}`,
            borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
          Thinking
        </div>}
      </div>
      <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,
        display:"flex",gap:8,overflowX:"auto",flexShrink:0,
        scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        {PRESETS.map(p=>{
          const c=p.c?CATS[p.c]:null;
          return(
            <button key={p.l} onClick={()=>!busy&&send(p.m)} disabled={busy}
              className="chip"
              style={{borderColor:c?c.bd:C.border,background:c?c.bg:C.card2,
                color:c?c.color:C.text2,fontSize:12,opacity:busy?.5:1}}>
              {p.l}
            </button>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px",
        display:"flex",flexDirection:"column",gap:12,
        WebkitOverflowScrolling:"touch"}}>
        {msgs.map(m=>{
          if(m.role==="system")return(
            <div key={m.id} className="fade" style={{alignSelf:"center",
              background:`${C.purple}10`,border:`1px solid ${C.purple}25`,
              borderRadius:12,padding:"8px 14px",fontSize:12,color:C.purple2,
              maxWidth:"90%",textAlign:"center",lineHeight:1.5}}>{m.text}</div>
          );
          if(m.role==="policy"){
            const pc=m.pt==="approved"?C.green:m.pt==="blocked"?C.red:C.amber;
            return(
              <div key={m.id} className="fade" style={{alignSelf:"center",
                display:"flex",flexDirection:"column",alignItems:"center",gap:4,maxWidth:"90%"}}>
                <div style={{background:`${pc}10`,border:`1px solid ${pc}30`,
                  borderRadius:20,padding:"6px 16px",fontSize:12,
                  color:pc,fontWeight:600}}>{m.text}</div>
                {m.detail&&<div style={{fontSize:11,color:C.text2,textAlign:"center"}}>{m.detail}</div>}
              </div>
            );
          }
          const isUser=m.role==="user";
          return(
            <div key={m.id} className="fade"
              style={{alignSelf:isUser?"flex-end":"flex-start",maxWidth:"88%"}}>
              <div className={isUser?"bubble-user":"bubble-agent"}>
                {m.text}
                {m.tx&&m.tx.amount>0&&(
                  <div style={{background:C.card2,border:`1px solid ${C.border}`,
                    borderRadius:10,padding:12,marginTop:10}}>
                    {m.tx.cat&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                        <span style={{fontSize:14}}>{CATS[m.tx.cat]?.icon}</span>
                        <span style={{fontSize:11,color:CATS[m.tx.cat]?.color,fontWeight:600,
                          textTransform:"uppercase",letterSpacing:".06em"}}>{CATS[m.tx.cat]?.label}</span>
                      </div>
                    )}
                    {[["Status",m.tx.ok?"✓ Executed":"✗ Blocked",m.tx.ok?C.green:C.red],
                      ["Service",m.tx.service||"—",C.text],
                      ["Amount",`${m.tx.amount} ${m.tx.currency}`,C.amber],
                      ...(m.tx.hash?[["TX",short(m.tx.hash),C.text2]]:[]),
                    ].map(([k,v,c])=>(
                      <div key={k} className="tx-row">
                        <span style={{color:C.text2,fontSize:12}}>{k}</span>
                        <span style={{color:c,fontSize:12,fontWeight:k==="Status"||k==="Amount"?700:500,
                          fontFamily:k==="TX"?"'JetBrains Mono',monospace":"Inter"}}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{fontSize:10,color:C.text2,marginTop:4,
                textAlign:isUser?"right":"left",paddingInline:4}}>{m.time}</div>
            </div>
          );
        })}
        {busy&&(
          <div className="fade bubble-agent" style={{alignSelf:"flex-start",
            display:"flex",gap:6,alignItems:"center",padding:"12px 16px"}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.text2,
                animation:`pulse 1.2s ${i*.2}s infinite`}}/>
            ))}
          </div>
        )}
        <div ref={msgsEnd}/>
      </div>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,
        display:"flex",gap:10,alignItems:"flex-end",background:C.bg,flexShrink:0}}>
        <textarea className="msg-input" rows={1}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder='e.g. "Pay 50 HBAR to OpenAI"'/>
        <button className="send-btn" onClick={()=>send()} disabled={busy||!input.trim()}>
          ↑
        </button>
      </div>
    </div>
  );

  const LedgerPanel = ()=>(
    <div style={{padding:"0 16px 100px",overflowY:"auto"}}>
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:13,color:C.text2}}>Daily Usage</div>
          <div className="mono" style={{fontSize:14,fontWeight:700,
            color:pct>70?C.amber:C.green}}>
            {sv.toFixed(1)} / {sc} {token}
          </div>
        </div>
        <div className="spend-bar">
          <div className="spend-fill" style={{width:`${pct}%`,
            background:pct>70?`linear-gradient(90deg,${C.amber},${C.red})`:`linear-gradient(90deg,${C.green},${C.cyan})`}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12,color:C.text2}}>
          <span>{pct.toFixed(0)}% used</span><span>Resets in 24h</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        <div className="stat">
          <div style={{fontSize:11,color:C.text2,marginBottom:4}}>Sent</div>
          <div className="mono" style={{fontSize:24,fontWeight:800,color:C.green}}>{sentC}</div>
        </div>
        <div className="stat">
          <div style={{fontSize:11,color:C.text2,marginBottom:4}}>Blocked</div>
          <div className="mono" style={{fontSize:24,fontWeight:800,color:C.red}}>{blockC}</div>
        </div>
        <div className="stat">
          <div style={{fontSize:11,color:C.text2,marginBottom:4}}>Total</div>
          <div className="mono" style={{fontSize:24,fontWeight:800,color:C.text}}>{txLog.length}</div>
        </div>
      </div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>
          Outflow
        </div>
        {[{l:"HBAR",v:spend.hbar,cap:policies.spendLimit.hbar,c:C.purple2},
          {l:"USDC",v:spend.usdc,cap:policies.spendLimit.usdc,c:C.cyan}
        ].map(({l,v,cap,c})=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
            <span className="mono" style={{color:c,fontSize:14,fontWeight:700}}>{l}</span>
            <span className="mono" style={{fontSize:14,fontWeight:600}}>
              {v.toFixed(1)}<span style={{color:C.text2,fontWeight:400}}> / {cap}</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:C.text2,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>
        Transaction Log
      </div>
      {!txLog.length&&(
        <div className="card" style={{textAlign:"center",padding:"32px 16px"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <div style={{fontSize:14,color:C.text2}}>No transactions yet</div>
          <div style={{fontSize:12,color:C.text3,marginTop:4}}>Try a preset in the chat tab</div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {txLog.map(tx=>{
          const c=tx.cat?CATS[tx.cat]:null;
          return(
            <div key={tx.id} className="card" style={{padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {c&&<span style={{fontSize:16}}>{c.icon}</span>}
                  <span style={{fontSize:14,fontWeight:600,color:c?.color??C.text,
                    maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {tx.service}
                  </span>
                </div>
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:600,
                  background:tx.status==="ok"?`${C.green}14`:`${C.red}14`,
                  color:tx.status==="ok"?C.green:C.red}}>
                  {tx.status==="ok"?"Sent":"Blocked"}
                </span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div className="mono" style={{fontSize:18,fontWeight:800}}>
                  {tx.amount}{" "}
                  <span style={{fontSize:12,padding:"2px 8px",borderRadius:6,
                    background:tx.currency==="HBAR"?`${C.purple}18`:`${C.cyan}14`,
                    color:tx.currency==="HBAR"?C.purple2:C.cyan}}>{tx.currency}</span>
                </div>
                <div style={{textAlign:"right"}}>
                  {tx.signedBy&&<div style={{fontSize:11,color:C.purple2}}>🔑 {tx.signedBy}</div>}
                  <div style={{fontSize:11,color:C.text2}}>{tx.time}</div>
                </div>
              </div>
              {tx.hash&&<div className="mono" style={{fontSize:10,color:C.border2,marginTop:6}}>{short(tx.hash)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const MobileNav = ()=>(
    <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,
      background:`${C.card}f5`,backdropFilter:"blur(16px)",
      borderTop:`1px solid ${C.border}`,
      display:"flex",justifyContent:"space-around",padding:"6px 8px",
      paddingBottom:"max(6px, env(safe-area-inset-bottom))"}}>
      {[
        {id:"chat",   label:"Chat",   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>},
        {id:"policy", label:"Policy", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>},
        {id:"ledger", label:"Ledger", icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>},
      ].map(({id,label,icon})=>(
        <button key={id} className={`nav-tab${tab===id?" active":""}`} onClick={()=>setTab(id)}>
          {icon}
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <style>{G}</style>
      {wSheet  && <WalletSheet/>}
      {modal   && <ApprovalSheet/>}
      <div className="mobile-layout mobile-only" style={{paddingBottom:0}}>
        <Header/>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
          {tab==="chat"   && <ChatPanel/>}
          {tab==="policy" && <div style={{padding:"16px 0"}}><PolicyPanel/></div>}
          {tab==="ledger" && <div style={{padding:"16px 0"}}><LedgerPanel/></div>}
        </div>
        <MobileNav/>
      </div>
      <div className="desktop-grid desktop-only" style={{display:"none"}}>
        <div className="desktop-panel" style={{borderRight:`1px solid ${C.border}`,paddingTop:16}}>
          <PolicyPanel/>
        </div>
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <Header/>
          <ChatPanel/>
        </div>
        <div className="desktop-panel" style={{borderLeft:`1px solid ${C.border}`,paddingTop:16}}>
          <LedgerPanel/>
        </div>
      </div>
    </>
  );
}
