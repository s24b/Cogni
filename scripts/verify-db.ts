import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verify() {
  const tables = [
    'users', 'professors', 'courses', 'topics', 'topic_mastery',
    'flashcards', 'exams', 'assignments', 'materials', 'inbox_items',
    'session_log', 'session_messages', 'nudges', 'wiki_versions',
    'study_plan', 'mastery_history', 'material_embeddings'
  ]

  console.log('Verifying Supabase connection and schema...\n')

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(0)
    if (error) {
      console.error(`✗ ${table}: ${error.message}`)
    } else {
      console.log(`✓ ${table}`)
    }
  }

  console.log('\nDone.')
}

verify()
