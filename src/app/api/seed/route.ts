export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const CATEGORIES = [
  { name: 'Makanan Utama', description: 'Hidangan utama yang mengenyangkan', sort_order: 1 },
  { name: 'Appetizer', description: 'Hidangan pembuka yang menggugah selera', sort_order: 2 },
  { name: 'Minuman', description: 'Berbagai pilihan minuman segar', sort_order: 3 },
  { name: 'Dessert', description: 'Hidangan penutup manis', sort_order: 4 },
  { name: 'Promo Spesial', description: 'Menu dengan harga spesial terbatas', sort_order: 5 },
];

const MENU_ITEMS = [
  // Makanan Utama (8)
  { catIdx: 0, name: 'Nasi Goreng Spesial', description: 'Nasi goreng dengan telur, ayam, udang, dan sayuran segar. Disajikan dengan kerupuk dan acar.', price: 35000, image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop', stock: 50 },
  { catIdx: 0, name: 'Ayam Bakar Madu', description: 'Ayam kampung bakar dengan olesan madu spesial, disajikan dengan nasi hangat dan sambal.', price: 45000, image_url: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400&h=300&fit=crop', stock: 30 },
  { catIdx: 0, name: 'Mie Goreng Seafood', description: 'Mie goreng dengan campuran udang, cumi, dan sayuran. Cita rasa gurih dan pedas.', price: 38000, image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=300&fit=crop', stock: 40 },
  { catIdx: 0, name: 'Rendang Sapi', description: 'Rendang daging sapi empuk dengan bumbu rempah khas Padang yang kaya rasa.', price: 55000, image_url: 'https://images.unsplash.com/photo-1606491956689-2ea866880049?w=400&h=300&fit=crop', stock: 25 },
  { catIdx: 0, name: 'Sate Ayam', description: '10 tusuk sate ayam dengan bumbu kacang khas dan lontong.', price: 32000, image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop', stock: 45 },
  { catIdx: 0, name: 'Ikan Bakar Rica-Rica', description: 'Ikan gurame bakar dengan sambal rica-rica pedas. Segar dan menggugah selera.', price: 65000, image_url: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=400&h=300&fit=crop', stock: 20 },
  { catIdx: 0, name: 'Steak Wagyu Premium', description: 'Wagyu beef steak grade A5 medium rare dengan saus lada hitam dan kentang panggang.', price: 185000, image_url: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop', stock: 15 },
  { catIdx: 0, name: 'Nasi Campur Bali', description: 'Nasi dengan lauk khas Bali: ayam betutu, sate lilit, lawar, dan sambal matah.', price: 48000, image_url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&h=300&fit=crop', stock: 35 },
  // Appetizer (4)
  { catIdx: 1, name: 'Lumpia Semarang', description: 'Lumpia goreng isi rebung dan udang khas Semarang. Renyah dan lezat.', price: 22000, image_url: 'https://images.unsplash.com/photo-1548507927-1cd24c621954?w=400&h=300&fit=crop', stock: 60 },
  { catIdx: 1, name: 'Tahu Crispy', description: 'Tahu goreng renyah dengan saus sambal manis dan taburan daun bawang.', price: 18000, image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', stock: 70 },
  { catIdx: 1, name: 'Salad Caesar', description: 'Salad romaine segar dengan dressing Caesar, crouton, dan parmesan.', price: 28000, image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', stock: 30 },
  { catIdx: 1, name: 'Soup Tom Yum', description: 'Sup pedas asam khas Thailand dengan udang, jamur, dan daun jeruk.', price: 32000, image_url: 'https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=400&h=300&fit=crop', stock: 25 },
  // Minuman (5)
  { catIdx: 2, name: 'Es Teh Manis', description: 'Teh manis dingin yang menyegarkan, sempurna untuk menemani makan.', price: 8000, image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop', stock: 100 },
  { catIdx: 2, name: 'Jus Alpukat', description: 'Jus alpukat segar dengan susu cokelat dan gula aren.', price: 18000, image_url: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=300&fit=crop', stock: 40 },
  { catIdx: 2, name: 'Kopi Latte', description: 'Espresso dengan susu steamed, lembut dan creamy. Pilihan hot atau iced.', price: 25000, image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop', stock: 50 },
  { catIdx: 2, name: 'Mocktail Sunset', description: 'Campuran jus jeruk, grenadine, dan soda dengan hiasan buah segar.', price: 28000, image_url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&h=300&fit=crop', stock: 30 },
  { catIdx: 2, name: 'Matcha Latte', description: 'Matcha premium Jepang dengan susu oat, manis natural dan creamy.', price: 30000, image_url: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&h=300&fit=crop', stock: 35 },
  // Dessert (3)
  { catIdx: 3, name: 'Tiramisu', description: 'Kue tiramisu klasik Italia dengan mascarpone, espresso, dan cocoa.', price: 35000, image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop', stock: 20 },
  { catIdx: 3, name: 'Es Krim Gelato', description: 'Tiga scoop gelato artisan: vanilla, cokelat Belgia, dan stroberi.', price: 28000, image_url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop', stock: 25 },
  { catIdx: 3, name: 'Pisang Goreng Keju', description: 'Pisang goreng crispy dengan topping keju mozarella dan saus cokelat.', price: 22000, image_url: 'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=400&h=300&fit=crop', stock: 40 },
  // Promo Spesial (2)
  { catIdx: 4, name: 'Paket Hemat Keluarga', description: '4 nasi + 4 ayam bakar + 4 es teh + sambal. Hemat 30% untuk makan bersama.', price: 120000, image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop', stock: 10 },
  { catIdx: 4, name: 'Combo Steak & Wine', description: 'Steak tenderloin 200gr + salad + dessert + minuman pilihan.', price: 150000, image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop', stock: 15 },
];

async function seedData() {
  try {
    // Check if data already exists
    const { data: existingCats } = await supabaseAdmin.from('categories').select('id').limit(1);
    if (existingCats && existingCats.length > 0) {
      return NextResponse.json({ message: 'Data sudah ada, skip seeding' });
    }

    // Insert categories
    const { data: catData, error: catError } = await supabaseAdmin
      .from('categories')
      .insert(CATEGORIES.map(c => ({ ...c, is_active: true })))
      .select('id');

    if (catError) throw catError;

    // Insert menu items with category IDs
    const menuToInsert = MENU_ITEMS.map(item => ({
      category_id: catData![item.catIdx].id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      stock: item.stock,
      is_active: true,
    }));

    const { error: menuError } = await supabaseAdmin.from('menu_items').insert(menuToInsert);
    if (menuError) throw menuError;

    // Insert tables
    const tablesToInsert = Array.from({ length: 10 }, (_, i) => ({
      table_number: i + 1,
      capacity: i < 4 ? 2 : i < 7 ? 4 : 6,
      status: 'available',
    }));

    const { error: tableError } = await supabaseAdmin.from('tables').insert(tablesToInsert);
    if (tableError) console.log('Tables might already exist:', tableError.message);

    return NextResponse.json({ success: true, message: `Seeded ${CATEGORIES.length} categories and ${MENU_ITEMS.length} menu items` });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return seedData();
}

export async function POST() {
  return seedData();
}
