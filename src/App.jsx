import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

const UNLOCK_THRESHOLD = 100
const PAY_PER_100      = 1000
const colors  = ['#4F8EF7','#1DCE8A','#FF6B4A','#A78BFA','#F59E42']
const lightBg = ['#EBF3FF','#E1FBF2','#FFF0EC','#F4F0FF','#FFF7ED']

function getNextTuesday() {
  const now  = new Date()
  const diff = (9 - now.getDay()) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + diff)
  return next.toLocaleDateString('fr-FR', { day:'2-digit', month:'long' })
}
function calcPay(w) { return Math.floor(w / 100) * PAY_PER_100 }

function Login({ onLogin }) {
  const [slug, setSlug] = useState('')
  const [pw,   setPw]   = useState('')
  const [err,  setErr]  = useState('')
  const [loading, setLoading] = useState(false)

  async function attempt() {
    if (!slug||!pw){setErr('Remplis tous les champs.');return}
    setLoading(true)
    const {data,error} = await supabase.from('employees').select('*')
      .eq('slug',slug.toLowerCase().trim()).eq('password',pw).single()
    if (data&&!error) { onLogin(data) }
    else { setErr('Identifiant ou mot de passe incorrect.'); setTimeout(()=>setErr(''),2000) }
    setLoading(false)
  }

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{fontSize:48,marginBottom:12}}>🔗</div>
        <div style={{fontSize:28,fontWeight:800,color:'#1a1a2e',marginBottom:4}}>MonAffil</div>
        <div style={{fontSize:14,color:'#888',marginBottom:28}}>Espace employé</div>
        <input style={S.input} placeholder="Ton identifiant (ex: kofi)"
          value={slug} onChange={e=>setSlug(e.target.value)} />
        <input style={{...S.input,...(err?{borderColor:'#FF6B4A'}:{})}} type="password"
          placeholder="Mot de passe" value={pw}
          onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&attempt()} />
        <button style={S.btnPrimary} onClick={attempt} disabled={loading}>
          {loading?'Connexion…':'Se connecter'}
        </button>
        {err && <div style={{color:'#FF6B4A',fontSize:13,marginTop:10,textAlign:'center'}}>{err}</div>}
        <div style={{height:1,background:'#f0f0f0',margin:'20px 0'}}/>
        <div style={{fontSize:12,color:'#ccc',textAlign:'center'}}>Pas d'accès ? Contacte l'administrateur.</div>
      </div>
    </div>
  )
}

function Dashboard({ emp: initialEmp, onLogout }) {
  const [emp,      setEmp]      = useState(initialEmp)
  const [payments, setPayments] = useState([])
  const [copied,   setCopied]   = useState(false)
  const [view,     setView]     = useState('home')

  const slugOrder = ['kofi','mawuli','abena','yao','esi']
  const ci   = slugOrder.indexOf(emp.slug)
  const color = colors[ci>=0?ci:emp.slug.charCodeAt(0)%colors.length]
  const bg    = lightBg[ci>=0?ci:emp.slug.charCodeAt(0)%lightBg.length]

  const link      = `https://monaffil.vercel.app/r/${emp.slug}`
  const progress  = Math.min((emp.total_clicks/UNLOCK_THRESHOLD)*100,100)
  const remaining = Math.max(UNLOCK_THRESHOLD-emp.total_clicks,0)
  const weeklyPay = calcPay(emp.week_clicks)

  useEffect(()=>{
    async function refresh() {
      const {data} = await supabase.from('employees').select('*').eq('id',emp.id).single()
      if (data) setEmp(data)
      const {data:pays} = await supabase.from('payments').select('*').eq('employee_id',emp.id).order('paid_at',{ascending:false})
      if (pays) setPayments(pays)
    }
    refresh()
  },[emp.id])

  useEffect(()=>{
    const ch = supabase.channel(`emp-${emp.id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'employees',filter:`id=eq.${emp.id}`},
        payload=>setEmp(payload.new))
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[emp.id])

  function copyLink() {
    navigator.clipboard.writeText(link).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2500) })
  }

  const nav = [
    {k:'home',   icon:'🏠', label:'Accueil'},
    {k:'link',   icon:'🔗', label:'Mon lien'},
    {k:'gains',  icon:'💰', label:'Mes gains'},
    {k:'rules',  icon:'📋', label:'Règles'},
  ]

  return (
    <div style={S.shell}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{...S.avatarSm,background:bg,color}}>{emp.name.split(' ').map(n=>n[0]).join('')}</div>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:'#1a1a2e'}}>{emp.name}</div>
            <div style={{fontSize:11,color:'#aaa'}}>Employé · MonAffil</div>
          </div>
        </div>
        <button style={S.btnLogout} onClick={onLogout}>Quitter</button>
      </div>

      <div style={S.content}>

        {/* ── ACCUEIL ── */}
        {view==='home' && (
          <div>
            {!emp.unlocked ? (
              <div style={S.alertAmber}>
                <div style={{fontSize:32}}>🔒</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:'#92400e',marginBottom:4}}>Paiements non débloqués</div>
                  <div style={{fontSize:13,color:'#b45309',lineHeight:1.6}}>
                    Atteins <strong>{UNLOCK_THRESHOLD} clics</strong> pour recevoir ton premier paiement.
                    Il te reste <strong>{remaining} clic{remaining>1?'s':''}</strong> !
                  </div>
                </div>
              </div>
            ):(
              <div style={S.alertGreen}>
                <div style={{fontSize:32}}>🎉</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:'#065f46',marginBottom:4}}>Paiements débloqués !</div>
                  <div style={{fontSize:13,color:'#047857',lineHeight:1.6}}>
                    Prochain paiement : <strong>{getNextTuesday()}</strong>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div style={{...S.card,borderTop:`3px solid ${color}`,padding:'14px'}}>
                <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Total clics</div>
                <div style={{fontSize:26,fontWeight:800,color}}>{emp.total_clicks}</div>
              </div>
              <div style={{...S.card,borderTop:`3px solid ${color}`,padding:'14px'}}>
                <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Cette semaine</div>
                <div style={{fontSize:26,fontWeight:800,color}}>{emp.week_clicks}</div>
              </div>
            </div>

            <div style={{...S.card,borderTop:`3px solid ${emp.unlocked?'#1DCE8A':'#e0e0e0'}`,padding:'14px',marginBottom:12}}>
              <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Gains mardi prochain</div>
              <div style={{fontSize:26,fontWeight:800,color:emp.unlocked?'#1DCE8A':'#ccc'}}>
                {emp.unlocked?`${weeklyPay.toLocaleString('fr-FR')} FCFA`:'—'}
              </div>
              <div style={{fontSize:11,color:'#aaa',marginTop:2}}>{emp.unlocked?'calculé automatiquement':'déblocage requis'}</div>
            </div>

            {!emp.unlocked && (
              <div style={S.card}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#888',marginBottom:8}}>
                  <span>{emp.total_clicks} clics</span><span>{remaining} restants</span>
                </div>
                <div style={S.track}><div style={{...S.fill,width:`${progress}%`,background:color,transition:'width 0.4s'}}/></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#bbb',marginTop:5}}>
                  <span>0</span><span style={{fontWeight:700,color}}>{Math.round(progress)}%</span><span>100</span>
                </div>
              </div>
            )}

            <button style={{...S.btnPrimary,background:color,marginTop:4}} onClick={()=>setView('link')}>
              📤 Copier mon lien à partager
            </button>
          </div>
        )}

        {/* ── MON LIEN ── */}
        {view==='link' && (
          <div>
            <div style={S.sectionTitle}>Mon lien à partager</div>
            <div style={{fontSize:13,color:'#888',marginBottom:16,lineHeight:1.6}}>
              Partage ce lien partout. Chaque clic est enregistré automatiquement !
            </div>

            <div style={S.card}>
              <div style={{background:'#f0f7ff',borderRadius:10,padding:'14px',marginBottom:12,textAlign:'center'}}>
                <code style={{fontSize:13,color:'#2563eb',wordBreak:'break-all',lineHeight:1.8,fontWeight:600}}>{link}</code>
              </div>
              <button style={{...S.btnPrimary,background:copied?'#1DCE8A':color,fontSize:16,padding:'15px'}} onClick={copyLink}>
                {copied?'✅ Lien copié !':'📋 Appuyer pour copier'}
              </button>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>💡 Où partager ?</div>
              {[
                {icon:'💬',name:'WhatsApp',tip:'Groupes et contacts — le plus efficace'},
                {icon:'📘',name:'Facebook',tip:'Groupes de paris sportifs'},
                {icon:'✈️',name:'Telegram',tip:'Canaux et groupes de sport'},
                {icon:'📸',name:'Instagram',tip:'Stories et bio'},
                {icon:'🐦',name:'Twitter/X',tip:'Tweets sur les matchs du jour'},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #f5f5f5'}}>
                  <span style={{fontSize:24}}>{r.icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{r.name}</div>
                    <div style={{fontSize:12,color:'#aaa'}}>{r.tip}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MES GAINS ── */}
        {view==='gains' && (
          <div>
            <div style={S.sectionTitle}>Mes gains</div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div style={{...S.card,padding:'14px',borderTop:'3px solid #1DCE8A'}}>
                <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Ce mardi</div>
                <div style={{fontSize:22,fontWeight:800,color:'#1DCE8A'}}>{emp.unlocked?`${weeklyPay.toLocaleString('fr-FR')} F`:'—'}</div>
              </div>
              <div style={{...S.card,padding:'14px',borderTop:'3px solid #FF6B4A'}}>
                <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Paiements reçus</div>
                <div style={{fontSize:22,fontWeight:800,color:'#FF6B4A'}}>{payments.length}</div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Historique des paiements</div>
              {payments.length===0
                ? (
                  <div style={{textAlign:'center',padding:'20px 0'}}>
                    <div style={{fontSize:32,marginBottom:8}}>💤</div>
                    <div style={{color:'#bbb',fontSize:14}}>Aucun paiement encore.</div>
                    <div style={{color:'#ddd',fontSize:12,marginTop:4}}>{emp.unlocked?'Ton premier paiement arrivera mardi !':'Atteins 100 clics pour débloquer.'}</div>
                  </div>
                )
                : payments.map((p,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #f5f5f5'}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>{new Date(p.paid_at).toLocaleDateString('fr-FR')}</div>
                      <div style={{fontSize:12,color:'#aaa'}}>{p.week_clicks} clics cette semaine-là</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:16,fontWeight:800,color:'#1DCE8A'}}>{p.amount.toLocaleString('fr-FR')} FCFA</div>
                      <span style={{fontSize:11,background:'#d1fae5',color:'#065f46',padding:'2px 8px',borderRadius:99}}>✓ reçu</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── RÈGLES ── */}
        {view==='rules' && (
          <div>
            <div style={S.sectionTitle}>Comment ça marche ?</div>
            <div style={{fontSize:13,color:'#888',marginBottom:16}}>Lis bien ces règles pour maximiser tes gains.</div>

            <div style={S.card}>
              {[
                {n:'1',icon:'🔒',title:'Atteins 100 clics',desc:'Tu dois avoir au moins 100 clics au total avant de recevoir ton premier paiement.'},
                {n:'2',icon:'📅',title:'Paiement chaque mardi',desc:'Chaque mardi, tes clics de la semaine sont comptés et tu reçois ton argent.'},
                {n:'3',icon:'💰',title:'1 000 FCFA / 100 clics',desc:'Pour chaque tranche de 100 clics dans la semaine, tu reçois 1 000 FCFA.'},
                {n:'4',icon:'🔄',title:'Remise à zéro hebdo',desc:'Après chaque paiement du mardi, ton compteur de la semaine repart à zéro.'},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',gap:14,padding:'14px 0',borderBottom:i<3?'1px solid #f5f5f5':'none'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'#1a1a2e',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,flexShrink:0}}>{r.n}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{r.icon} {r.title}</div>
                    <div style={{fontSize:13,color:'#888',lineHeight:1.6}}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{...S.card,background:'#f0f7ff',border:'1px solid #bfdbfe'}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:'#1e40af'}}>📊 Exemples de gains</div>
              {[
                {clics:100,gains:1000},
                {clics:250,gains:2000},
                {clics:500,gains:5000},
                {clics:1000,gains:10000},
              ].map((ex,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<3?'1px solid #dbeafe':'none',fontSize:14}}>
                  <span style={{color:'#1e40af'}}>{ex.clics} clics/semaine</span>
                  <span style={{fontWeight:800,color:'#1DCE8A'}}>{ex.gains.toLocaleString('fr-FR')} FCFA</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM NAV */}
      <div style={S.bottomNav}>
        {nav.map(n=>(
          <button key={n.k} style={{...S.navBtn,...(view===n.k?{...S.navBtnActive,color}:{})}} onClick={()=>setView(n.k)}>
            <span style={{fontSize:22}}>{n.icon}</span>
            <span style={{fontSize:10,marginTop:2}}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const S = {
  loginWrap:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f7',padding:20},
  loginCard:{background:'#fff',borderRadius:20,padding:32,width:'100%',maxWidth:360,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',textAlign:'center'},
  input:{width:'100%',padding:'13px 14px',borderRadius:12,border:'1.5px solid #e0e0e0',fontSize:15,marginBottom:12,outline:'none',display:'block',boxSizing:'border-box',background:'#fafafa',color:'#1a1a2e'},
  btnPrimary:{width:'100%',padding:'14px',borderRadius:12,border:'none',background:'#1a1a2e',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'},
  shell:{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#f5f5f7',maxWidth:480,margin:'0 auto'},
  header:{background:'#fff',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #ebebeb',position:'sticky',top:0,zIndex:10},
  avatarSm:{width:40,height:40,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700},
  btnLogout:{padding:'8px 14px',borderRadius:8,border:'1px solid #e0e0e0',background:'transparent',color:'#888',fontSize:13,cursor:'pointer'},
  content:{flex:1,padding:'16px',paddingBottom:90,overflowY:'auto'},
  bottomNav:{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'#fff',borderTop:'1px solid #ebebeb',display:'flex',zIndex:20},
  navBtn:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 4px 10px',border:'none',background:'transparent',color:'#bbb',cursor:'pointer',fontWeight:500},
  navBtnActive:{color:'#1a1a2e'},
  sectionTitle:{fontSize:18,fontWeight:800,color:'#1a1a2e',marginBottom:4},
  alertAmber:{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:14,padding:'16px',display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'},
  alertGreen:{background:'#d1fae5',border:'1px solid #a7f3d0',borderRadius:14,padding:'16px',display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'},
  card:{background:'#fff',borderRadius:14,padding:'14px 16px',border:'1px solid #ebebeb',marginBottom:12},
  cardTitle:{fontWeight:700,fontSize:13,color:'#1a1a2e',marginBottom:12,paddingBottom:8,borderBottom:'1px solid #f0f0f0'},
  track:{height:8,background:'#f0f0f0',borderRadius:99,overflow:'hidden'},
  fill:{height:'100%',borderRadius:99},
}

export default function App() {
  const [emp, setEmp] = useState(null)
  return emp ? <Dashboard emp={emp} onLogout={()=>setEmp(null)} /> : <Login onLogin={setEmp} />
}
