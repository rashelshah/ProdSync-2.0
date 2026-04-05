const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://roseldzbdnqiirvqzfqu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvc2VsZHpiZG5xaWlydnF6ZnF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMwNjQxMSwiZXhwIjoyMDkwODgyNDExfQ.Xgdi4X-E9Djc7r4eUWdk_IIxoGwspNoia5QSQvsp8UI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const { data, error } = await supabase
    .from('fuel_logs')
    .select('*, vehicle:vehicles(name), logger:users(full_name)', { count: 'exact' })
    .limit(1);

  if (error) {
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log('Data:', data);
  }
}

testQuery();
