
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dazsblmccvxtewtmaljf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ'
);

async function updatePhone() {
  const email = 'rahmatakbar2088@gmail.com';
  const phone = '085383876822';

  const { data, error } = await supabase
    .from('profiles')
    .update({ phone: phone })
    .ilike('email', email)
    .select();

  if (error) {
    console.error('ERROR UPDATING:', error);
  } else if (data && data.length > 0) {
    console.log('SUCCESS! Profile updated:', data[0].email, '->', data[0].phone);
  } else {
    console.log('USER NOT FOUND IN PROFILES. Creating a new profile record...');
    // If user not in profiles, try to insert (though usually they should be there)
    const { error: insError } = await supabase
      .from('profiles')
      .insert({ email: email, phone: phone, full_name: 'Rahmat Akbar', role: 'admin' });
    
    if (insError) console.error('INSERT ERROR:', insError);
    else console.log('NEW PROFILE CREATED SUCCESSFULLY.');
  }
}

updatePhone();
