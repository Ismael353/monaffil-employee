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

/* ── LOGIN ─────────────────────────────────────────────────────────────────── */
function Login({ onLogin }) {
  const [slug,    setSlug]    = useState('')
  const [pw,      setPw]      = useState('')
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  async function attempt() {
    if (!slug || !pw) { setErr('Remplis tous les champs.'); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('slug', slug.toLowerCase().trim())
      .eq('password', pw)
      .single()

    if (data && !error) {
      onLogin(data)
    } else {
      setErr('Identifiant ou mot de passe incorrect.')
      setTimeout(() => setErr(''), 2000)
    }
    setLoading(false)
  }

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={S.loginIcon}>🔗</div>
        <div style={S.loginTitle}>MonAffil</div>
        <div style={S.loginSub}>Espace employé</div>
        <input
          style={S.input} placeholder="Ton identifiant (ex: kofi)"
          value={slug} onChange={e=>setSlug(e.target.value)}
        />
        <input
          style={{...S.input,...(err?{borderColor:'#FF6B4A'}:{})}}
          type="password" placeholder="Mot de passe"
          value={pw} onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&attempt()}
        />
        <button style={S.btnPrimary} onClick={attempt} disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        {err && <div style={{color:'#FF6B4A',fontSize:13,marginTop:8}}>{err}</div>}
        <div style={S.separator}/>
        <div style={{fontSize:12,color:'#ccc',textAlign:'center'}}>
          Pas d'accès ? Contacte l'administrateur.
        </div>
      </div>
    </div>
  )
}

/* ── DASHBOARD ─────────────────────────────────────────────────────────────── */
function Dashboard({ emp: initialEmp, onLogout }) {
  const [emp,     setEmp]     = useState(initialEmp)
  const [payments,setPayments]= useState([])
  const [copied,  setCopied]  = useState(false)

  // Chercher l'index pour la couleur (basé sur slug)
  const slugOrder = ['kofi','mawuli','abena','yao','esi']
  const colorIdx  = slugOrder.indexOf(emp.slug)
  const color     = colors[colorIdx >= 0 ? colorIdx : emp.slug.charCodeAt(0) % colors.length]
  const bg        = lightBg[colorIdx >= 0 ? colorIdx : emp.slug.charCodeAt(0) % lightBg.length]

  const link      = `https://monaffil.vercel.app/r/${emp.slug}`
  const progress  = Math.min((emp.total_clicks / UNLOCK_THRESHOLD) * 100, 100)
  const remaining = Math.max(UNLOCK_THRESHOLD - emp.total_clicks, 0)
  const weeklyPay = calcPay(emp.week_clicks)

  /* Fetch fresh data */
  useEffect(() => {
    async function refresh() {
      const { data } = await supabase.from('employees').select('*').eq('id', emp.id).single()
      if (data) setEmp(data)
      const { data: pays } = await supabase.from('payments').select('*').eq('employee_id', emp.id).order('paid_at', {ascending:false})
      if (pays) setPayments(pays)
    }
    refresh()
  }, [emp.id])

  /* Realtime */
  useEffect(() => {
    const channel = supabase
      .channel(`emp-${emp.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'employees',
        filter: `id=eq.${emp.id}`
      }, payload => setEmp(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [emp.id])

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div style={S.page}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{...S.avatarSm,background:bg,color}}>{emp.name.split(' ').map(n=>n[0]).join('')}</div>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:'#1a1a2e'}}>{emp.name}</div>
            <div style={{fontSize:12,color:'#aaa'}}>Employé · MonAffil</div>
          </div>
        </div>
        <button style={S.btnLogout} onClick={onLogout}>Déconnexion</button>
      </div>

      <div style={S.container}>

        {/* ALERTE STATUT */}
        {!emp.unlocked ? (
          <div style={S.alertAmber}>
            <div style={{fontSize:28}}>🔒</div>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:'#92400e',marginBottom:4}}>Paiements non débloqués</div>
              <div style={{fontSize:13,color:'#b45309',lineHeight:1.6}}>
                Atteins <strong>{UNLOCK_THRESHOLD} clics</strong> pour débloquer tes paiements.
                Il te reste <strong>{remaining} clic{remaining>1?'s':''}</strong>. Continue à partager !
              </div>
            </div>
          </div>
        ) : (
          <div style={S.alertGreen}>
            <div style={{fontSize:28}}>🎉</div>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:'#065f46',marginBottom:4}}>Paiements débloqués !</div>
              <div style={{fontSize:13,color:'#047857',lineHeight:1.6}}>
                Tu es payé <strong>chaque mardi</strong>. Prochain paiement : <strong>{getNextTuesday()}</strong>
              </div>
            </div>
          </div>
        )}

        {/* MÉTRIQUES */}
        <div style={S.metricsGrid}>
          <div style={{...S.metricCard,borderTop:`3px solid ${color}`}}>
            <div style={S.metricLabel}>Total clics</div>
            <div style={{...S.metricVal,color}}>{emp.total_clicks.toLocaleString('fr-FR')}</div>
            <div style={S.metricSub}>depuis le début</div>
          </div>
          <div style={{...S.metricCard,borderTop:`3px solid ${color}`}}>
            <div style={S.metricLabel}>Clics cette semaine</div>
            <div style={{...S.metricVal,color}}>{emp.week_clicks.toLocaleString('fr-FR')}</div>
            <div style={S.metricSub}>remis à zéro chaque mardi</div>
          </div>
          <div style={{...S.metricCard,borderTop:`3px solid ${color}`}}>
            <div style={S.metricLabel}>Gains mardi prochain</div>
            <div style={{...S.metricVal,color:emp.unlocked?color:'#ccc'}}>
              {emp.unlocked ? `${weeklyPay.toLocaleString('fr-FR')} FCFA` : '—'}
            </div>
            <div style={S.metricSub}>{emp.unlocked?'calculé automatiquement':'déblocage requis'}</div>
          </div>
        </div>

        {/* BARRE DE PROGRESSION */}
        {!emp.unlocked && (
          <div style={S.card}>
            <div style={S.cardTitle}>Progression vers le déblocage</div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#888',marginBottom:10}}>
              <span>{emp.total_clicks} clics effectués</span>
              <span>{remaining} restants</span>
            </div>
            <div style={S.track}><div style={{...S.fill,width:`${progress}%`,background:color}}/></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#bbb',marginTop:6}}>
              <span>0</span>
              <span style={{fontWeight:600,color}}>{Math.round(progress)}%</span>
              <span>100</span>
            </div>
          </div>
        )}

        {/* LIEN */}
        <div style={S.card}>
          <div style={S.cardTitle}>📤 Ton lien à partager</div>
          <div style={S.linkBox}>
            <code style={{flex:1,fontSize:13,color:'#1a1a2e',wordBreak:'break-all',lineHeight:1.6}}>{link}</code>
            <button style={{...S.btnCopy,background:copied?'#1DCE8A':color}} onClick={copyLink}>
              {copied?'✓ Copié !':'Copier'}
            </button>
          </div>
          <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
            {[
              {icon:'💬',name:'WhatsApp',tip:'Partage dans tes groupes et avec tes contacts'},
              {icon:'📘',name:'Facebook',tip:'Poste dans des groupes de paris sportifs'},
              {icon:'✈️',name:'Telegram',tip:'Canaux et groupes de sport'},
            ].map((r,i)=>(
              <div key={i} style={S.shareRow}>
                <span style={{fontSize:20}}>{r.icon}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{r.name}</div>
                  <div style={{fontSize:12,color:'#aaa'}}>{r.tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RÈGLES */}
        <div style={{...S.card,background:'#f9fafb'}}>
          <div style={S.cardTitle}>💡 Comment fonctionne ton paiement ?</div>
          <div style={{display:'flex',flexDirection:'column',gap:10,fontSize:14,color:'#555'}}>
            <div style={S.ruleRow}><span style={{fontSize:18}}>1️⃣</span><span>Atteins les <strong>100 premiers clics</strong> pour débloquer les paiements</span></div>
            <div style={S.ruleRow}><span style={{fontSize:18}}>2️⃣</span><span>Chaque <strong>mardi</strong>, tu reçois <strong>1 000 FCFA par tranche de 100 clics</strong></span></div>
            <div style={S.ruleRow}><span style={{fontSize:18}}>3️⃣</span><span>Les clics de la semaine sont remis à zéro après chaque paiement</span></div>
          </div>
          <div style={{marginTop:14,padding:'10px 14px',background:'#fff',borderRadius:10,fontSize:13,color:'#888',border:'1px solid #f0f0f0'}}>
            Exemple : 250 clics cette semaine = <strong style={{color}}>2 000 FCFA</strong> le mardi suivant
          </div>
        </div>

        {/* HISTORIQUE PAIEMENTS */}
        {payments.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>💰 Historique de tes paiements</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
              <thead>
                <tr style={{background:'#f5f5f5'}}>
                  {['Date','Clics','Montant','Statut'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#777',fontSize:12}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #f0f0f0'}}>
                    <td style={{padding:'10px 12px',color:'#666'}}>{new Date(p.paid_at).toLocaleDateString('fr-FR')}</td>
                    <td style={{padding:'10px 12px',color:'#888'}}>{p.week_clicks}</td>
                    <td style={{padding:'10px 12px',fontWeight:700,color}}>{p.amount.toLocaleString('fr-FR')} FCFA</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{background:'#d1fae5',color:'#065f46',padding:'3px 10px',borderRadius:99,fontSize:12}}>✓ {p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

/* ── STYLES ────────────────────────────────────────────────────────────────── */
const S = {
  loginWrap:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f7',padding:20},
  loginCard:{background:'#fff',borderRadius:16,padding:36,width:'100%',maxWidth:380,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',textAlign:'center'},
  loginIcon:{fontSize:44,marginBottom:12},
  loginTitle:{fontSize:28,fontWeight:800,color:'#1a1a2e',letterSpacing:'-1px',marginBottom:4},
  loginSub:{fontSize:14,color:'#888',marginBottom:24},
  separator:{height:1,background:'#f0f0f0',margin:'20px 0'},
  input:{width:'100%',padding:'11px 14px',borderRadius:10,border:'1px solid #e0e0e0',fontSize:14,marginBottom:12,outline:'none',display:'block',boxSizing:'border-box',background:'#fafafa',color:'#1a1a2e'},
  btnPrimary:{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'#1a1a2e',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'},
  page:{minHeight:'100vh',background:'#f5f5f7'},
  topbar:{background:'#fff',borderBottom:'1px solid #ebebeb',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  avatarSm:{width:40,height:40,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700},
  btnLogout:{padding:'8px 16px',borderRadius:8,border:'1px solid #e0e0e0',background:'transparent',color:'#888',fontSize:13,cursor:'pointer'},
  container:{maxWidth:620,margin:'0 auto',padding:'24px 20px'},
  alertAmber:{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:12,padding:'16px 18px',display:'flex',gap:14,marginBottom:20,alignItems:'flex-start'},
  alertGreen:{background:'#d1fae5',border:'1px solid #a7f3d0',borderRadius:12,padding:'16px 18px',display:'flex',gap:14,marginBottom:20,alignItems:'flex-start'},
  metricsGrid:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16},
  metricCard:{background:'#fff',borderRadius:12,padding:'14px 16px',border:'1px solid #ebebeb'},
  metricLabel:{fontSize:12,color:'#aaa',marginBottom:6},
  metricVal:{fontSize:22,fontWeight:800},
  metricSub:{fontSize:11,color:'#ccc',marginTop:4},
  card:{background:'#fff',borderRadius:12,padding:'18px 20px',border:'1px solid #ebebeb',marginBottom:14},
  cardTitle:{fontWeight:700,fontSize:14,color:'#1a1a2e',marginBottom:14},
  track:{height:10,background:'#f0f0f0',borderRadius:99,overflow:'hidden'},
  fill:{height:'100%',borderRadius:99,transition:'width 0.4s'},
  linkBox:{display:'flex',alignItems:'center',gap:10,background:'#f8f8f8',borderRadius:10,padding:'12px 14px'},
  btnCopy:{padding:'9px 16px',borderRadius:8,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',transition:'background 0.2s',whiteSpace:'nowrap'},
  shareRow:{display:'flex',alignItems:'flex-start',gap:12,padding:'8px 10px',background:'#f9fafb',borderRadius:8},
  ruleRow:{display:'flex',alignItems:'flex-start',gap:12,padding:'8px 0'},
}

/* ── ROOT ───────────────────────────────────────────────────────────────────── */
export default function App() {
  const [emp, setEmp] = useState(null)
  return emp
    ? <Dashboard emp={emp} onLogout={()=>setEmp(null)} />
    : <Login onLogin={setEmp} />
}
