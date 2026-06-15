import { useState, useRef, useEffect, useCallback } from "react";

const T = {
  bg:"#04070d", surface:"#090f1c", surface2:"#0e1828",
  border:"#152236", border2:"#1c3050",
  accent:"#00d4f5", green:"#00e5a0", amber:"#ffb800", red:"#ff3d60",
  hedera:"#7c3aed", hedera2:"#a78bfa",
  text:"#e0f0ff", muted:"#4a6a8a", faint:"#162030",
};

const CATEGORIES = {
  ai:{ label:"AI Credits", icon:"🤖", color:"#a78bfa", bg:"rgba(124,58,237,.15)", border:"rgba(167,139,250,.25)",
    services:{ "0.0.4567890":{name:"OpenAI GPT-4",icon:"🤖",desc:"API inference",price:"50 HBAR"},
               "0.0.4567891":{name:"Anthropic Claude",icon:"🧠",desc:"Claude API",price:"60 HBAR"},
               "0.0.4567892":{name:"Stability AI",icon:"🎨",desc:"Image gen",price:"30 HBAR"},
               "0.0.4567893":{name:"Groq Inference",icon:"⚡",desc:"Fast LLM",price:"20 HBAR"}}},
  infra:{ label:"Dev Infra", icon:"🖥", color:"#00d4f5", bg:"rgba(0,212,245,.1)", border:"rgba(0,212,245,.2)",
    services:{ "0.0.8901234":{name:"Pinecone DB",icon:"🌲",desc:"Vector DB",price:"20 USDC"},
               "0.0.8901235":{name:"Alchemy RPC",icon:"🔌",desc:"Hedera RPC",price:"10 HBAR"},
               "0.0.8901236":{name:"QuickNode",icon:"⚡",desc:"API bundles",price:"15 HBAR"},
               "0.0.8901237":{name:"IPFS/Pinata",icon:"📦",desc:"Storage",price:"5 USDC"}}},
  data:{ label:"Data Intel", icon:"📊", color:"#00e5a0", bg:"rgba(0,229,160,.1)", border:"rgba(0,229,160,.2)",
    services:{ "0.0.2345678":{name:"Moralis",icon:"📈",desc:"Analytics",price:"30 HBAR"},
               "0.0.2345679":{name:"TheGraph",icon:"📊",desc:"Indexing",price:"10 HBAR"},
               "0.0.2345680":{name:"Chainlink",icon:"🔗",desc:"Price feeds",price:"5 HBAR"},
               "0.0.2345681":{name:"Nansen",icon:"🧩",desc:"Wallet intel",price:"50 USDC"}}},
  security:{ label:"Security", icon:"🛡", color:"#ffb800", bg:"rgba(255,184,0,.1)", border:"rgba(255,184,0,.2)",
    services:{ "0.0.3456789":{name:"CertiK",icon:"🛡",desc:"Contract audit",price:"200 HBAR"},
               "0.0.3456790":{name:"Forta",icon:"🔍",desc:"Threat monitor",price:"10 HBAR"},
               "0.0.3456791":{name:"Tenderly",icon:"🧪",desc:"Tx simulation",price:"5 HBAR"},
               "0.0.3456792":{name:"Hexagate",icon:"⚠️",desc:"Risk assess",price:"8 HBAR"}}},
};

const ALL = Object.values(CATEGORIES).reduce((a,c)=>({...a,...c.services}),{});
const PRESETS = [
  {label:"✅ OpenAI 50 ℏ",     cat:"ai",       msg:"Pay 50 HBAR to OpenAI GPT-4 (0.0.4567890) for API credits"},
  {label:"✅ Pinecone 20 USDC", cat:"infra",    msg:"Purchase 20 USDC of Pinecone DB storage (0.0.8901234)"},
  {label:"✅ TheGraph 10 ℏ",    cat:"data",     msg:"Pay 10 HBAR to TheGraph (0.0.2345679) for indexing"},
  {label:"✅ Forta 10 ℏ",       cat:"security", msg:"Pay 10 HBAR to Forta Monitor (0.0.3456790) for a month"},
  {label:"⏳ CertiK 200 ℏ",    cat:"security", msg:"Pay 200 HBAR to CertiK (0.0.3456789) for a contract audit"},
  {label:"🚫 Exceed limit",    cat:"",         msg:"Send 5000 HBAR to OpenAI (0.0.4567890) for bulk access"},
  {label:"🚫 Unknown account", cat:"",         msg:"Transfer 80 HBAR to account 0.0.9999999"},
  {label:"📊 Check spending",  cat:"",         msg:"What is my spending today?"},
];

const WALLETS = [
  {name:"HashPack", icon:"💜", desc:"Most popular Hedera wallet",  color:"#8b5cf6"},
  {name:"Blade",    icon:"🔵", desc:"DeFi-focused Hedera wallet",  color:"#3b82f6"},
  {name:"Kabila",   icon:"🟠", desc:"NFT and token wallet",        color:"#f97316"},
  {name:"MetaMask", icon:"🦊", desc:"EVM-compatible via Snaps",    color:"#f59e0b"},
];

const uid    = () => Math.random().toString(36).slice(2,9);
const nowStr = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const short  = (h) => h ? h.slice(0,10)+"…"+h.slice(-6) : "";
const rHash  = () => "0x"+Array.from({length:40},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("");

async function callAgent(msg, policies, spend, token) {
  const allowedNames = policies.allowlist.accounts.map(id=>ALL[id]?.name??id).join(", ")||"none";
  const system = `You are xPay — an AI payment agent on Hedera (hedera-agent-kit v3.8.2).
Enforce these ACTIVE policies before any payment:
${policies.spendLimit.enabled?`SPEND LIMIT: ${policies.spendLimit[token==="HBAR"?"hbar":"usdc"]} ${token}/day, used: ${(token==="HBAR"?spend.hbar:spend.usdc).toFixed(1)}`:"SPEND LIMIT: off"}
${policies.allowlist.enabled?`ALLOWLIST: only ${allowedNames}`:"ALLOWLIST: off"}
${policies.approvalThreshold.enabled?`APPROVAL: HBAR >= ${policies.approvalThreshold.hbar} needs human sign-off`:"APPROVAL: off"}
${policies.anomalyDetection.enabled?"ANOMALY: flag unknown recipients, >10000 HBAR/>5000 USDC, round amounts >=1000":"ANOMALY: off"}
Known accounts: OpenAI=0.0.4567890, Claude=0.0.4567891, Stability=0.0.4567892, Groq=0.0.4567893, Pinecone=0.0.8901234, Alchemy=0.0.8901235, QuickNode=0.0.8901236, IPFS=0.0.8901237, Moralis=0.0.2345678, TheGraph=0.0.2345679, Chainlink=0.0.2345680, Nansen=0.0.2345681, CertiK=0.0.3456789, Forta=0.0.3456790, Tenderly=0.0.3456791, Hexagate=0.0.3456792
Respond ONLY with JSON: {"decision":"approved"|"blocked"|"needs_approval"|"info","policyTriggered":"spend_limit"|"allowlist"|"approval_threshold"|"anomaly"|null,"violationDetail":null,"toAccountId":null,"serviceName":null,"serviceCategory":"ai"|"infra"|"data"|"security"|null,"amount":0,"currency":"HBAR","txHash":null,"agentMessage":"1-2 sentence reply"}`;
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system,
      messages:[{role:"user",content:msg}]})});
  const data = await res.json();
  const raw = (data.content||[]).map(b=>b.text||"").join("").trim();
  try{ return JSON.parse(raw.replace(/```json|```/g,"").trim()); }
  catch{ return{decision:"info",policyTriggered:null,violationDetail:null,toAccountId:null,
    serviceName:null,serviceCategory:null,amount:0,currency:token,txHash:null,agentMessage:raw||"Error."}; }
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#04070d;color:#e0f0ff;font-family:'Outfit',sans-serif;overflow:hidden}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#1c3050;border-radius:2px}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 12px #7c3aed44}50%{box-shadow:0 0 28px #7c3aed99}}
@keyframes wp{0%,100%{box-shadow:0 0 0 0 #7c3aed44}70%{box-shadow:0 0 0 8px #7c3aed00}}
.fu{animation:fadeUp .28s ease both}
input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;background:#1c3050}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;cursor:pointer}
button{font-family:'Outfit',sans-serif;cursor:pointer;border:none;outline:none;transition:opacity .15s}
button:hover:not(:disabled){opacity:.82}button:disabled{cursor:not-allowed;opacity:.4}
textarea{font-family:'Outfit',sans-serif;outline:none}
`;

export default function App() {
  const [policies, setPols] = useState({
    spendLimit:{enabled:true,hbar:500,usdc:100},
    allowlist:{enabled:true,accounts:["0.0.4567890","0.0.4567891","0.0.8901234","0.0.8901237","0.0.2345679","0.0.2345680","0.0.3456789","0.0.3456790"]},
    approvalThreshold:{enabled:true,hbar:100},
    anomalyDetection:{enabled:true},
  });
  const [token,  setToken]  = useState("HBAR");
  const [spend,  setSpend]  = useState({hbar:142.5,usdc:18.0});
  const [msgs,   setMsgs]   = useState([{id:uid(),role:"agent",time:nowStr(),
    text:"Hello! I'm xPay — your AI payment agent on Hedera. Connect your wallet (HashPack, Blade, or Kabila) to sign transactions. All payments pass through 4 policy hooks before execution."}]);
  const [input,  setInput]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [txLog,  setTxLog]  = useState([]);
  const [modal,  setModal]  = useState(null);
  const [wModal, setWModal] = useState(false);
  const [wallet, setWallet] = useState({connected:false,accountId:null,walletName:null,walletIcon:null,balance:null});
  const [signing,setSigning]= useState(false);
  const [tab,    setTab]    = useState("ai");
  const msgsRef = useRef(null);

  useEffect(()=>{ msgsRef.current?.scrollTo({top:msgsRef.current.scrollHeight,behavior:"smooth"}); },[msgs]);

  const add = (m) => setMsgs(p=>[...p,{id:uid(),time:nowStr(),...m}]);

  const connectWallet = (w) => {
    setWallet({connected:true,accountId:`0.0.${Math.floor(1000000+Math.random()*9000000)}`,
      walletName:w.name,walletIcon:w.icon,balance:(150+Math.random()*500).toFixed(2)});
    setWModal(false);
    add({role:"wallet",text:`🔗 ${w.name} connected. Your wallet will sign approved transactions — xPay never holds your private key.`});
  };

  const disconnectWallet = () => {
    setWallet({connected:false,accountId:null,walletName:null,walletIcon:null,balance:null});
    add({role:"wallet",text:"Wallet disconnected."});
  };

  const send = useCallback(async(text)=>{
    const msg=(text||input).trim();
    if(!msg||busy) return;
    setInput(""); add({role:"user",text:msg}); setBusy(true);
    try{
      const r = await callAgent(msg,policies,spend,token);
      if(r.policyTriggered){
        const labels={spend_limit:"🚫 SPEND LIMIT TRIGGERED",allowlist:"🚫 ALLOWLIST BLOCKED",
          approval_threshold:"⏳ APPROVAL REQUIRED",anomaly:"⚠️ ANOMALY DETECTED"};
        add({role:"policy",pt:r.decision==="approved"?"approved":r.decision==="needs_approval"?"pending":"blocked",
          text:labels[r.policyTriggered]??"POLICY EVENT",detail:r.violationDetail});
      }
      if(r.decision==="approved"&&r.amount>0){
        const hash=r.txHash||rHash();
        setSpend(s=>({...s,[r.currency==="HBAR"?"hbar":"usdc"]:s[r.currency==="HBAR"?"hbar":"usdc"]+r.amount}));
        setTxLog(l=>[{id:uid(),service:r.serviceName||r.toAccountId,cat:r.serviceCategory,
          amount:r.amount,currency:r.currency,status:"ok",hash,time:nowStr(),
          signedBy:wallet.connected?wallet.walletName:"Server keypair"},...l].slice(0,30));
        add({role:"agent",text:r.agentMessage,card:{amount:r.amount,currency:r.currency,
          accountId:r.toAccountId,service:r.serviceName,cat:r.serviceCategory,hash,decision:"approved",
          signedBy:wallet.connected?wallet.walletName:"Server keypair"}});
      } else if(r.decision==="needs_approval"){
        setModal({pid:`pending-${Date.now()}`,amount:r.amount,currency:r.currency,
          accountId:r.toAccountId,service:r.serviceName,cat:r.serviceCategory,detail:r.violationDetail});
        add({role:"agent",text:r.agentMessage});
      } else if(r.decision==="blocked"){
        setTxLog(l=>[{id:uid(),service:r.serviceName||r.toAccountId||"unknown",cat:r.serviceCategory,
          amount:r.amount,currency:r.currency||token,status:"fail",hash:null,time:nowStr(),
          policy:r.policyTriggered},...l].slice(0,30));
        add({role:"agent",text:r.agentMessage});
      } else {
        add({role:"agent",text:r.agentMessage});
      }
    }catch(e){ add({role:"agent",text:`⚠️ ${e.message||"Network error."}`}); }
    setBusy(false);
  },[input,busy,policies,spend,token,wallet]);

  const approve = async() => {
    if(!modal) return;
    setSigning(true);
    await new Promise(r=>setTimeout(r,wallet.connected?1500:400));
    setSigning(false);
    const hash=rHash();
    setSpend(s=>({...s,[modal.currency==="HBAR"?"hbar":"usdc"]:s[modal.currency==="HBAR"?"hbar":"usdc"]+modal.amount}));
    setTxLog(l=>[{id:uid(),service:modal.service||modal.accountId,cat:modal.cat,
      amount:modal.amount,currency:modal.currency,status:"ok",hash,time:nowStr(),
      policy:"approval_threshold",signedBy:wallet.connected?wallet.walletName:"Server keypair"},...l].slice(0,30));
    add({role:"policy",pt:"approved",text:wallet.connected?`✅ SIGNED BY ${wallet.walletName?.toUpperCase()}`:"✅ HUMAN APPROVED"});
    add({role:"agent",text:`Transaction executed. ${modal.amount} ${modal.currency} sent to ${modal.service??modal.accountId}. TX: ${short(hash)}`,
      card:{amount:modal.amount,currency:modal.currency,accountId:modal.accountId,
        service:modal.service,cat:modal.cat,hash,decision:"approved",
        signedBy:wallet.connected?wallet.walletName:"Operator"}});
    setModal(null);
  };

  const reject = () => {
    if(!modal) return;
    setTxLog(l=>[{id:uid(),service:modal.service||"unknown",cat:modal.cat,
      amount:modal.amount,currency:modal.currency,status:"fail",hash:null,
      time:nowStr(),policy:"approval_threshold"},...l].slice(0,30));
    add({role:"policy",pt:"blocked",text:"❌ REJECTED"});
    add({role:"agent",text:"Transaction rejected. No funds transferred."});
    setModal(null);
  };

  const sv=spend[token==="HBAR"?"hbar":"usdc"];
  const sc=policies.spendLimit[token==="HBAR"?"hbar":"usdc"];
  const pct=Math.min(100,(sv/sc)*100);
  const warn=pct>70;
  const catD=CATEGORIES[tab];

  return(<>
    <style>{CSS}</style>
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
      background:"radial-gradient(ellipse 60% 40% at 10% 0%,#7c3aed20 0%,transparent 55%),radial-gradient(ellipse 45% 35% at 90% 100%,#00d4f510 0%,transparent 55%)"}}/>
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
      backgroundImage:"linear-gradient(#00d4f505 1px,transparent 1px),linear-gradient(90deg,#00d4f505 1px,transparent 1px)",backgroundSize:"52px 52px"}}/>

    {wModal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(4,7,13,.92)",backdropFilter:"blur(16px)",
        zIndex:600,display:"flex",alignItems:"center",justifyContent:"center"}}
        onClick={e=>{if(e.target===e.currentTarget)setWModal(false)}}>
        <div className="fu" style={{background:T.surface,border:`1px solid ${T.border2}`,
          borderRadius:18,width:400,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,.85)"}}>
          <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${T.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,
                background:`linear-gradient(135deg,${T.hedera},${T.accent})`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>ℏ</div>
              <div>
                <div style={{fontSize:15,fontWeight:700}}>Connect to xPay</div>
                <div style={{fontSize:11,color:T.muted}}>Choose your Hedera wallet</div>
              </div>
            </div>
            <button onClick={()=>setWModal(false)} style={{background:"none",color:T.muted,
              fontSize:20,width:32,height:32,borderRadius:"50%",border:`1px solid ${T.border}`}}>×</button>
          </div>
          {wallet.connected?(
            <div style={{padding:22}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${T.hedera},${T.accent})`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{wallet.walletIcon}</div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:T.green,boxShadow:`0 0 8px ${T.green}`}}/>
                    <span style={{fontSize:14,fontWeight:700,color:T.green}}>{wallet.walletName} Connected</span>
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{wallet.accountId}</div>
                </div>
              </div>
              <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:".1em",marginBottom:5}}>HBAR Balance</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:26,fontWeight:700,color:T.hedera2}}>
                  {wallet.balance} <span style={{fontSize:14,color:T.muted}}>ℏ</span>
                </div>
              </div>
              {[["💸","Sign HBAR payments","Wallet signs each approved transfer"],
                ["🛡","Policy enforcement","4 hooks run before your wallet is asked"],
                ["👁","Human approval","You confirm high-value transactions"],
                ["🔑","Non-custodial","xPay never holds your private key"],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                  <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
                  <div><div style={{fontSize:13,fontWeight:600}}>{title}</div>
                    <div style={{fontSize:11,color:T.muted}}>{desc}</div></div>
                </div>
              ))}
              <button onClick={()=>{disconnectWallet();setWModal(false);}}
                style={{width:"100%",padding:12,borderRadius:10,marginTop:16,
                  background:`${T.red}15`,border:`1px solid ${T.red}30`,color:T.red,fontSize:14,fontWeight:600}}>
                Disconnect Wallet
              </button>
            </div>
          ):(
            <div style={{padding:18}}>
              <div style={{fontSize:12,color:T.muted,marginBottom:14,lineHeight:1.6}}>
                Connect any Hedera-compatible wallet. Scan the QR code with your wallet app.
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:12}}>
                {WALLETS.map(w=>(
                  <button key={w.name} onClick={()=>connectWallet(w)}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",
                      borderRadius:11,background:T.surface2,border:`1px solid ${T.border2}`,
                      textAlign:"left",width:"100%"}}>
                    <div style={{width:40,height:40,borderRadius:10,flexShrink:0,
                      background:`${w.color}22`,border:`1px solid ${w.color}44`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{w.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700}}>{w.name}</div>
                      <div style={{fontSize:11,color:T.muted}}>{w.desc}</div>
                    </div>
                    <div style={{fontSize:18,color:T.muted}}>→</div>
                  </button>
                ))}
              </div>
              <div style={{fontSize:9,color:T.muted,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>
                WalletConnect 2.0 · HIP-820 · @hashgraph/hedera-wallet-connect@2.1.3
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {modal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(4,7,13,.92)",backdropFilter:"blur(16px)",
        zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div className="fu" style={{background:T.surface,border:`1px solid ${T.border2}`,
          borderRadius:16,padding:28,width:420,boxShadow:"0 30px 80px rgba(0,0,0,.8)"}}>
          <div style={{fontSize:17,fontWeight:800,marginBottom:6}}>⏳ Approval Required</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:18,lineHeight:1.5}}>
            {wallet.connected?`${wallet.walletName} will show a signing prompt.`:"No wallet connected — server keypair will sign."}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
            background:wallet.connected?`${T.hedera}18`:`${T.border}22`,
            border:`1px solid ${wallet.connected?T.hedera2:T.border}`,borderRadius:9,marginBottom:16}}>
            <span style={{fontSize:18}}>{wallet.connected?wallet.walletIcon??"🔗":"🖥"}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:wallet.connected?T.hedera2:T.muted}}>
                {wallet.connected?`Signing with ${wallet.walletName}`:"Signing with server keypair"}
              </div>
              {wallet.connected&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.muted}}>{wallet.accountId}</div>}
            </div>
          </div>
          {[["Service",modal.service??"Unknown"],["Amount",`${modal.amount} ${modal.currency}`],
            ["Account",modal.accountId],["Reason",modal.detail??"High-value transfer"]
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",
              borderBottom:`1px solid ${T.border}`,fontSize:13}}>
              <span style={{color:T.muted}}>{k}</span>
              <span style={{color:k==="Amount"?T.amber:T.text,
                fontFamily:k==="Account"?"'JetBrains Mono',monospace":"inherit",
                fontSize:k==="Account"?10:13,fontWeight:k==="Amount"?700:400}}>{v}</span>
            </div>
          ))}
          {!wallet.connected&&(
            <div style={{marginTop:12,padding:"10px 14px",background:`${T.hedera}12`,
              border:`1px solid ${T.hedera}30`,borderRadius:8,fontSize:12,color:T.hedera2}}>
              💡 <button onClick={()=>{setModal(null);setWModal(true);}}
                style={{background:"none",color:T.hedera2,fontSize:12,fontWeight:700,
                  textDecoration:"underline",padding:0}}>Connect a wallet</button> to sign this yourself.
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:18}}>
            <button onClick={reject} disabled={signing}
              style={{flex:1,padding:12,borderRadius:9,background:T.surface2,
                border:`1px solid ${T.border2}`,color:T.muted,fontSize:14,fontWeight:600}}>Reject</button>
            <button onClick={approve} disabled={signing}
              style={{flex:1,padding:12,borderRadius:9,border:"none",
                background:wallet.connected?T.hedera:T.green,
                color:wallet.connected?"white":"#04070d",fontSize:14,fontWeight:800,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {signing
                ?<><div style={{width:14,height:14,border:"2px solid white",borderTopColor:"transparent",
                    borderRadius:"50%",animation:"spin .7s linear infinite"}}/>Signing…</>
                :wallet.connected?`Sign with ${wallet.walletName}`:"✓ Approve"}
            </button>
          </div>
        </div>
      </div>
    )}

    <div style={{display:"grid",gridTemplateRows:"58px 1fr",height:"100vh",position:"relative",zIndex:1}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 20px",borderBottom:`1px solid ${T.border}`,
        background:"rgba(4,7,13,.92)",backdropFilter:"blur(16px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:36,height:36,borderRadius:9,fontSize:20,
            background:`linear-gradient(135deg,${T.hedera},${T.accent})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 0 18px ${T.hedera}66`,animation:"glow 3s infinite"}}>ℏ</div>
          <div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700}}>xPay</div>
            <div style={{fontSize:10,color:T.muted,letterSpacing:".1em",textTransform:"uppercase"}}>
              AI Payment Agent · Hedera · WalletConnect 2.0
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {wallet.connected
            ?<div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:T.green,boxShadow:`0 0 7px ${T.green}`}}/>
                <span style={{fontSize:18}}>{wallet.walletIcon}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.green}}>{wallet.accountId}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.hedera2,
                  background:`${T.hedera}15`,padding:"2px 8px",borderRadius:4}}>{wallet.balance} ℏ</span>
                <button onClick={()=>setWModal(true)} style={{fontSize:11,padding:"3px 10px",borderRadius:5,
                  background:`${T.hedera}20`,border:`1px solid ${T.hedera2}44`,color:T.hedera2}}>Wallet</button>
              </div>
            :<button onClick={()=>setWModal(true)} style={{display:"flex",alignItems:"center",gap:7,
                fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:8,
                border:`1px solid ${T.hedera2}`,background:`${T.hedera}22`,color:T.hedera2,
                animation:"wp 2.5s ease-in-out infinite"}}>🔗 Connect Wallet</button>
          }
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.green,
            padding:"3px 10px",borderRadius:4,background:`${T.green}10`,border:`1px solid ${T.green}22`}}>TESTNET</span>
        </div>
      </header>

      <div style={{display:"grid",gridTemplateColumns:"298px 1fr 264px",overflow:"hidden"}}>
        <aside style={{borderRight:`1px solid ${T.border}`,overflowY:"auto",padding:14,
          display:"flex",flexDirection:"column",gap:12}}>
          <PT c={T.accent}>Policy Configuration</PT>
          <div>
            <FL>Payment Token</FL>
            <div style={{display:"flex",gap:6}}>
              {["HBAR","USDC"].map(t=>(
                <button key={t} onClick={()=>setToken(t)} style={{flex:1,padding:"7px 0",borderRadius:7,
                  fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
                  border:`1px solid ${token===t?(t==="HBAR"?T.hedera2:T.accent):T.border}`,
                  background:token===t?`${t==="HBAR"?T.hedera:T.accent}18`:T.surface2,
                  color:token===t?(t==="HBAR"?T.hedera2:T.accent):T.muted}}>
                  {t==="HBAR"?"ℏ HBAR":"＄USDC"}
                </button>
              ))}
            </div>
          </div>
          <CCard>
            <FL>Active Policy Hooks</FL>
            {[{k:"spendLimit",l:"Spend Limit",d:"Daily cap enforcement"},
              {k:"allowlist",l:"Counterparty Allowlist",d:"Approved accounts only"},
              {k:"approvalThreshold",l:"Human Approval",d:"Gate high-value HBAR"},
              {k:"anomalyDetection",l:"Anomaly Detection",d:"Flag suspicious patterns"},
            ].map(({k,l,d})=>(
              <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{l}</div>
                  <div style={{fontSize:10,color:T.muted,fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>{d}</div>
                </div>
                <Tog on={policies[k].enabled} onChange={()=>setPols(p=>({...p,[k]:{...p[k],enabled:!p[k].enabled}}))}/>
              </div>
            ))}
          </CCard>
          {policies.spendLimit.enabled&&(
            <CCard><FL>Daily Cap — {token}</FL>
              <SRow val={policies.spendLimit[token==="HBAR"?"hbar":"usdc"]} min={50} max={1000} step={50}
                c={T.accent} lbl={`${policies.spendLimit[token==="HBAR"?"hbar":"usdc"]} ${token}`}
                set={v=>setPols(p=>({...p,spendLimit:{...p.spendLimit,[token==="HBAR"?"hbar":"usdc"]:v}}))}/></CCard>
          )}
          {policies.approvalThreshold.enabled&&(
            <CCard><FL>Approval Threshold (HBAR)</FL>
              <SRow val={policies.approvalThreshold.hbar} min={10} max={500} step={10}
                c={T.amber} lbl={`${policies.approvalThreshold.hbar} ℏ`}
                set={v=>setPols(p=>({...p,approvalThreshold:{...p.approvalThreshold,hbar:v}}))}/></CCard>
          )}
          <CCard>
            <FL>Wallet</FL>
            {wallet.connected?(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:T.green,boxShadow:`0 0 6px ${T.green}`}}/>
                  <span style={{fontSize:13,fontWeight:700,color:T.green}}>{wallet.walletIcon} {wallet.walletName}</span>
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                  background:T.surface2,padding:"5px 8px",borderRadius:5,marginBottom:7}}>{wallet.accountId}</div>
                <div style={{fontSize:11,color:T.muted,lineHeight:1.5,marginBottom:8}}>
                  ✓ Approval transactions signed by your wallet
                </div>
                <button onClick={()=>setWModal(true)} style={{width:"100%",padding:"7px 0",borderRadius:7,
                  fontSize:12,fontWeight:600,background:`${T.hedera}18`,border:`1px solid ${T.hedera2}44`,color:T.hedera2}}>
                  Manage Wallet
                </button>
              </div>
            ):(
              <div>
                <div style={{fontSize:12,color:T.muted,marginBottom:10,lineHeight:1.5}}>
                  Connect HashPack, Blade, Kabila, or MetaMask to sign transactions directly.
                </div>
                <button onClick={()=>setWModal(true)} style={{width:"100%",padding:9,borderRadius:8,
                  fontWeight:700,fontSize:13,background:`linear-gradient(135deg,${T.hedera},${T.hedera2}66)`,
                  border:`1px solid ${T.hedera2}`,color:"white"}}>🔗 Connect Wallet</button>
              </div>
            )}
          </CCard>
          <div>
            <FL>Service Catalog</FL>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8}}>
              {Object.entries(CATEGORIES).map(([k,c])=>(
                <button key={k} onClick={()=>setTab(k)} style={{padding:"5px 4px",borderRadius:6,
                  fontSize:11,fontWeight:600,border:`1px solid ${tab===k?c.color:T.border}`,
                  background:tab===k?c.bg:T.surface2,color:tab===k?c.color:T.muted}}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {Object.entries(catD.services).map(([id,svc])=>{
                const allowed=policies.allowlist.accounts.includes(id);
                return(
                  <div key={id}
                    onClick={()=>allowed
                      ?send(`Pay ${svc.price} to ${svc.name} (${id}) for ${svc.desc}`)
                      :setPols(p=>({...p,allowlist:{...p.allowlist,accounts:[...p.allowlist.accounts,id]}}))}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
                      background:T.surface2,border:`1px solid ${allowed?catD.border:T.border}`,
                      borderRadius:8,cursor:"pointer"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{svc.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,display:"flex",justifyContent:"space-between"}}>
                        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:95}}>{svc.name}</span>
                        {allowed
                          ?<span style={{fontSize:9,color:T.green,background:`${T.green}15`,padding:"1px 6px",borderRadius:3,flexShrink:0}}>✓</span>
                          :<span style={{fontSize:9,color:T.muted,background:T.faint,padding:"1px 6px",borderRadius:3,flexShrink:0}}>+ADD</span>}
                      </div>
                      <div style={{fontSize:10,color:T.muted}}>{svc.price}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"11px 18px",borderBottom:`1px solid ${T.border}`,
            display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,
              background:`linear-gradient(135deg,${T.hedera},${T.accent})`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
              boxShadow:`0 0 20px ${T.hedera}55`}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700}}>xPay Agent</div>
              <div style={{fontSize:11,color:T.green}}>
                ● hedera-agent-kit v3.8.2 · {wallet.connected?`${wallet.walletName} connected`:"No wallet — server keypair"}
              </div>
            </div>
            {busy&&<div style={{display:"flex",alignItems:"center",gap:7,
              fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.amber,
              background:`${T.amber}12`,border:`1px solid ${T.amber}28`,padding:"4px 12px",borderRadius:5}}>
              <div style={{width:10,height:10,border:`2px solid ${T.amber}`,borderTopColor:"transparent",
                borderRadius:"50%",animation:"spin .8s linear infinite"}}/>EVALUATING
            </div>}
          </div>
          <div style={{padding:"7px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:5,flexWrap:"wrap"}}>
            {PRESETS.map(p=>{
              const c=p.cat?CATEGORIES[p.cat]:null;
              return(
                <button key={p.label} onClick={()=>!busy&&send(p.msg)} disabled={busy}
                  style={{fontSize:11,padding:"4px 11px",borderRadius:20,whiteSpace:"nowrap",
                    border:`1px solid ${c?c.border:T.border}`,background:c?c.bg:T.surface2,color:c?c.color:T.muted}}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div ref={msgsRef} style={{flex:1,overflowY:"auto",padding:"16px 18px",
            display:"flex",flexDirection:"column",gap:11}}>
            {msgs.map(m=>{
              if(m.role==="policy"){
                const c=m.pt==="approved"?T.green:m.pt==="blocked"?T.red:T.amber;
                return(
                  <div key={m.id} className="fu" style={{alignSelf:"center",display:"flex",
                    flexDirection:"column",alignItems:"center",gap:3,maxWidth:"88%"}}>
                    <div style={{background:`${c}0d`,border:`1px solid ${c}30`,borderRadius:7,
                      padding:"6px 16px",fontSize:11,color:c,fontFamily:"'JetBrains Mono',monospace",
                      fontWeight:500,display:"flex",gap:10}}>
                      <span>{m.text}</span><span style={{opacity:.5,fontSize:9}}>{m.time}</span>
                    </div>
                    {m.detail&&<div style={{fontSize:10,color:T.muted,textAlign:"center",maxWidth:340}}>{m.detail}</div>}
                  </div>
                );
              }
              if(m.role==="wallet"){
                return(
                  <div key={m.id} className="fu" style={{alignSelf:"center",
                    background:`${T.hedera}10`,border:`1px solid ${T.hedera}30`,
                    borderRadius:8,padding:"7px 16px",fontSize:11,color:T.hedera2,
                    maxWidth:"88%",textAlign:"center"}}>{m.text}</div>
                );
              }
              const isU=m.role==="user";
              return(
                <div key={m.id} className="fu" style={{alignSelf:isU?"flex-end":"flex-start",maxWidth:"84%"}}>
                  <div style={{padding:"11px 15px",lineHeight:1.65,fontSize:13,
                    borderRadius:isU?"14px 14px 3px 14px":"14px 14px 14px 3px",
                    background:isU?`linear-gradient(135deg,${T.hedera},#0077aa)`:T.surface,
                    border:isU?"none":`1px solid ${T.border2}`}}>
                    {m.text}
                    {m.card&&m.card.amount>0&&(
                      <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,
                        padding:11,marginTop:10,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
                        {m.card.cat&&(
                          <div style={{marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:13}}>{CATEGORIES[m.card.cat]?.icon}</span>
                            <span style={{fontSize:10,color:CATEGORIES[m.card.cat]?.color,
                              fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>
                              {CATEGORIES[m.card.cat]?.label}
                            </span>
                          </div>
                        )}
                        {[["Status",m.card.decision==="approved"?"✓ EXECUTED":"✗ BLOCKED",
                            m.card.decision==="approved"?T.green:T.red],
                          ["Service",m.card.service??m.card.accountId,T.text],
                          ["Amount",`${m.card.amount} ${m.card.currency}`,T.amber],
                          ["Signed by",m.card.signedBy??"Server keypair",T.hedera2],
                          ...(m.card.hash?[["TX",short(m.card.hash),T.muted]]:[]),
                        ].map(([k,v,c])=>(
                          <div key={k} style={{display:"flex",justifyContent:"space-between",
                            padding:"4px 0",borderBottom:`1px solid ${T.border}`,fontSize:10}}>
                            <span style={{color:T.muted}}>{k}</span>
                            <span style={{color:c,fontWeight:k==="Status"||k==="Amount"?700:400}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{fontSize:10,color:T.muted,marginTop:3,padding:"0 4px",
                    textAlign:isU?"right":"left"}}>{m.time}</div>
                </div>
              );
            })}
            {busy&&(
              <div className="fu" style={{alignSelf:"flex-start",padding:"11px 16px",
                borderRadius:"14px 14px 14px 3px",background:T.surface,
                border:`1px solid ${T.border2}`,fontSize:13,color:T.muted,
                display:"flex",gap:8,alignItems:"center"}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:5,height:5,borderRadius:"50%",background:T.muted,
                    animation:`pulse 1.2s ${i*.22}s infinite`}}/>
                ))}
                Evaluating policies…
              </div>
            )}
          </div>
          <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,
            display:"flex",gap:9,alignItems:"flex-end"}}>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder={`e.g. "Pay 50 HBAR to OpenAI" or "Scan my contract with CertiK"`}
              rows={1} style={{flex:1,background:T.surface,border:`1px solid ${T.border2}`,
                borderRadius:9,color:T.text,fontSize:13,padding:"10px 14px",
                resize:"none",minHeight:42,maxHeight:110,lineHeight:1.5}}/>
            <button onClick={()=>send()} disabled={busy||!input.trim()}
              style={{padding:"0 20px",background:`linear-gradient(135deg,${T.hedera},${T.accent})`,
                borderRadius:9,color:"white",fontSize:13,fontWeight:700,height:42,flexShrink:0}}>
              Send ↑
            </button>
          </div>
        </div>

        <aside style={{borderLeft:`1px solid ${T.border}`,overflowY:"auto",padding:14,
          display:"flex",flexDirection:"column",gap:12}}>
          <PT c={T.green}>Spend Tracker</PT>
          <CCard>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginBottom:8}}>
              <span>Daily Usage</span>
              <span style={{color:warn?T.amber:T.green,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                {sv.toFixed(1)} / {sc} {token}
              </span>
            </div>
            <div style={{height:5,background:T.faint,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,borderRadius:3,transition:"width .6s",
                background:warn?`linear-gradient(90deg,${T.amber},${T.red})`:`linear-gradient(90deg,${T.green},${T.accent})`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:T.muted}}>
              <span>{pct.toFixed(0)}% used</span><span>Resets 24h</span>
            </div>
          </CCard>
          <CCard>
            <FL>Outflow</FL>
            {[{l:"HBAR",v:spend.hbar,cap:policies.spendLimit.hbar,c:T.hedera2},
              {l:"USDC",v:spend.usdc,cap:policies.spendLimit.usdc,c:T.accent}
            ].map(({l,v,cap,c})=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",
                borderBottom:`1px solid ${T.border}`,fontSize:12}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",color:c}}>{l}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
                  {v.toFixed(1)}<span style={{color:T.muted,fontWeight:400}}> / {cap}</span>
                </span>
              </div>
            ))}
          </CCard>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <MS l="Sent"    v={txLog.filter(t=>t.status==="ok").length}   c={T.green}/>
            <MS l="Blocked" v={txLog.filter(t=>t.status==="fail").length} c={T.red}/>
          </div>
          <PT c={T.accent}>Transaction Log</PT>
          {!txLog.length&&<div style={{fontSize:12,color:T.muted,textAlign:"center",
            padding:"14px 0",fontStyle:"italic"}}>No transactions yet</div>}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {txLog.map((tx,i)=>{
              const c=tx.cat?CATEGORIES[tx.cat]:null;
              return(
                <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:11}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      {c&&<span style={{fontSize:12}}>{c.icon}</span>}
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,
                        color:c?.color??T.accent,fontWeight:600,maxWidth:108,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.service}</span>
                    </div>
                    <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,
                      background:tx.status==="ok"?`${T.green}18`:`${T.red}18`,
                      color:tx.status==="ok"?T.green:T.red}}>
                      {tx.status==="ok"?"Sent":"Blocked"}
                    </span>
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:14,marginBottom:3}}>
                    {tx.amount}{" "}
                    <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,
                      background:tx.currency==="HBAR"?`${T.hedera}22`:`${T.accent}12`,
                      color:tx.currency==="HBAR"?T.hedera2:T.accent}}>{tx.currency}</span>
                  </div>
                  {tx.signedBy&&<div style={{fontSize:10,color:T.hedera2,marginBottom:2}}>🔑 {tx.signedBy}</div>}
                  <div style={{fontSize:10,color:T.muted}}>{tx.time}</div>
                  {tx.hash&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,
                    color:T.faint,marginTop:4,wordBreak:"break-all"}}>{short(tx.hash)}</div>}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  </>);
}

function PT({children,c}){return(
  <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:"'JetBrains Mono',monospace",
    fontSize:10,letterSpacing:".14em",textTransform:"uppercase",color:"#4a6a8a",
    paddingBottom:9,borderBottom:"1px solid #152236"}}>
    <div style={{width:6,height:6,borderRadius:"50%",background:c,boxShadow:`0 0 7px ${c}`,flexShrink:0}}/>
    {children}
  </div>
);}
function FL({children}){return(
  <div style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:"#4a6a8a",marginBottom:8}}>{children}</div>
);}
function CCard({children}){return(
  <div style={{background:"#090f1c",border:"1px solid #152236",borderRadius:10,padding:13}}>{children}</div>
);}
function Tog({on,onChange}){return(
  <button onClick={onChange} style={{width:36,height:20,borderRadius:10,flexShrink:0,marginLeft:12,
    background:on?"#00e5a0":"#162030",border:"none",position:"relative",transition:"background .2s"}}>
    <span style={{position:"absolute",top:2,width:16,height:16,borderRadius:"50%",
      background:"white",transition:"left .2s",left:on?18:2}}/>
  </button>
);}
function SRow({val,min,max,step,c,lbl,set}){return(
  <div>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#4a6a8a",marginBottom:6}}>
      <span>{min}</span>
      <span style={{color:c,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{lbl}</span>
      <span>{max}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={val}
      onChange={e=>set(Number(e.target.value))} style={{width:"100%",accentColor:c}}/>
  </div>
);}
function MS({l,v,c}){return(
  <div style={{background:"#090f1c",border:"1px solid #152236",borderRadius:10,padding:"11px 13px"}}>
    <div style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:"#4a6a8a",marginBottom:5}}>{l}</div>
    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:700,color:c}}>{v}</div>
  </div>
);}
