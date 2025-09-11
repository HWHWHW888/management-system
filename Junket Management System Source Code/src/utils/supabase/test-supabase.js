// test-supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = 'https://rtjdqnuzeupbgbovbriy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0amRxbnV6ZXVwYmdib3Zicml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNjYwOTUsImV4cCI6MjA3MTg0MjA5NX0.5oJes7rJykxuGX0BZFDt4LpTmRJAgoh0wHRpmJ8HTng';

console.log('🔍 Testing Supabase connection...');
console.log('📍 URL:', supabaseUrl);

// Initialize client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    // Test 1: Basic connection
    console.log('\n📋 Test 1: Basic connection test');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    if (tablesError) {
      console.error('❌ Basic connection failed:', tablesError.message);
      return;
    }

    console.log('✅ Connection successful');
    console.log('📋 Available tables:', tables.map(t => t.table_name).join(', '));

    // Test 2: Users table access
    console.log('\n👤 Test 2: Users table access');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, role')
      .limit(3);

    if (usersError) {
      console.error('❌ Users table access failed:', usersError.message);
    } else {
      console.log('✅ Users table accessible');
      console.log('👥 Users found:', users.length);
      if (users.length > 0) {
        console.log('📄 Sample users:', users);
      }
    }

    // Test 3: Login test
    console.log('\n🔑 Test 3: Admin login test');
    const { data: loginTest, error: loginError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .eq('password', 'admin123')
      .single();

    if (loginError) {
      console.error('❌ Admin login failed:', loginError.message);
    } else {
      console.log('✅ Admin login works');
      console.log('🔑 Admin user:', loginTest);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

main();
