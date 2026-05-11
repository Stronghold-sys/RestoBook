
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://btvmlitkixscgscjxtiw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkUser() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', 'rahmatakbar2088@gmail.com')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data) {
    console.log('USER FOUND IN PROFILES:');
    console.log('Email:', data.email);
    console.log('Phone:', data.phone);
    console.log('Full Name:', data.full_name);
  } else {
    console.log('USER NOT FOUND IN PROFILES TABLE.');
  }

  // Check Auth too
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  const authUser = authUsers?.users.find(u => u.email?.toLowerCase() === 'rahmatakbar2088@gmail.com');
  
  if (authUser) {
    console.log('\nUSER FOUND IN AUTH:');
    console.log('Email:', authUser.email);
    console.log('Phone:', authUser.phone);
  }
}

checkUser();
