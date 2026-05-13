import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const AFFILIATE_URL = 'https://refpa3665.com/L?tag=d_5581523m_66329c_&site=5581523&ad=66329'

export default async function handler(req, res) {
  const { slug } = req.query
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown'

  try {
    // 1. Vérifier que l'employé existe
    const { data: emp } = await supabase
      .from('employees')
      .select('id, slug, total_clicks, week_clicks')
      .eq('slug', slug)
      .single()

    if (emp) {
      const newTotal = emp.total_clicks + 1
      const newWeek  = emp.week_clicks  + 1

      // 2. Enregistrer le clic
      await supabase.from('clicks').insert({
        employee_slug: slug,
        ip_address: ip
      })

      // 3. Mettre à jour les compteurs
      await supabase.from('employees').update({
        total_clicks: newTotal,
        week_clicks:  newWeek,
        unlocked: newTotal >= 100
      }).eq('id', emp.id)
    }
  } catch (err) {
    // On redirige quoi qu'il arrive
    console.error('Tracking error:', err)
  }

  // 4. Toujours rediriger vers le lien bookmaker (invisible pour l'employé)
  res.redirect(302, AFFILIATE_URL)
}
