import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hjcewicqvebsfmyfojxs.supabase.co'
const supabaseKey = 'sb_publishable_yOOqw5GHWC-oX6NoXKrVtg_5Txm_2Zj'

export const supabase = createClient(supabaseUrl, supabaseKey)