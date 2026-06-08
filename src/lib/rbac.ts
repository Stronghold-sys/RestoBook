export type UserRole = 'superadmin' | 'admin' | 'cashier' | 'customer';

// Hirarki tingkat akses (Level hirarki peran)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 4,
  admin: 3,
  cashier: 2,
  customer: 1,
};

// Jenis-jenis Izin Akses (Permissions)
export type Permission =
  | 'system:settings'       // Ubah setelan sistem darurat
  | 'security:logs'         // Baca security audit logs
  | 'admin:dashboard'       // Akses dashboard admin
  | 'staff:manage'          // Kelola karyawan & kasir
  | 'menu:manage'           // Kelola menu makanan & kategori
  | 'tables:manage'         // Kelola layout & status meja
  | 'reservations:all'      // Lihat & kelola semua reservasi
  | 'reservations:checkin'  // Melakukan check-in & scan QR reservasi
  | 'pos:checkout'          // Melakukan transaksi kasir & POS
  | 'customer:reserve'      // Membuat reservasi mandiri
  | 'customer:profile';     // Kelola profil diri sendiri

// Pemetaan Peran ke Izin Akses (Role to Permissions Mapping)
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [
    'system:settings',
    'security:logs',
    'admin:dashboard',
    'staff:manage',
    'menu:manage',
    'tables:manage',
    'reservations:all',
    'reservations:checkin',
    'pos:checkout',
    'customer:reserve',
    'customer:profile',
  ],
  admin: [
    'admin:dashboard',
    'staff:manage',
    'menu:manage',
    'tables:manage',
    'reservations:all',
    'reservations:checkin',
    'pos:checkout',
    'customer:reserve',
    'customer:profile',
  ],
  cashier: [
    'reservations:all',
    'reservations:checkin',
    'pos:checkout',
    'customer:reserve',
    'customer:profile',
  ],
  customer: [
    'customer:reserve',
    'customer:profile',
  ],
};

/**
 * Memeriksa apakah peran pengguna memiliki peran minimum tertentu berdasarkan hirarki
 */
export function hasMinimumRole(userRole: string | undefined | null, minRequiredRole: UserRole): boolean {
  if (!userRole) return false;
  
  const userRoleLower = userRole.toLowerCase() as UserRole;
  const userLevel = ROLE_HIERARCHY[userRoleLower];
  const requiredLevel = ROLE_HIERARCHY[minRequiredRole];

  if (userLevel === undefined || requiredLevel === undefined) {
    return false;
  }

  return userLevel >= requiredLevel;
}

/**
 * Memeriksa apakah peran pengguna memiliki izin khusus (permission)
 */
export function hasPermission(userRole: string | undefined | null, permission: Permission): boolean {
  if (!userRole) return false;

  const userRoleLower = userRole.toLowerCase() as UserRole;
  const permissions = ROLE_PERMISSIONS[userRoleLower];

  if (!permissions) {
    return false;
  }

  // Superadmin memiliki hak akses ke semua perizinan secara otomatis
  if (userRoleLower === 'superadmin') {
    return true;
  }

  return permissions.includes(permission);
}

/**
 * Menentukan halaman beranda (dashboard) tujuan redirect setelah login sukses
 */
export function getDashboardRedirect(userRole: string | undefined | null): string {
  if (!userRole) return '/login';
  
  const role = userRole.toLowerCase();
  switch (role) {
    case 'superadmin':
    case 'admin':
      return '/admin/dashboard';
    case 'cashier':
      return '/cashier/reservations';
    case 'customer':
    default:
      return '/customer/dashboard';
  }
}
