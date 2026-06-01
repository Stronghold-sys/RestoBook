2026-06-01T19:42:58.797Z Cloning repository...
2026-06-01T19:42:59.815323Z From <https://github.com/Stronghold-sys/RestoBook>
2026-06-01T19:42:59.816603Z  * branch            7aee95f73ba9feba4247b383f47d6803b3de35d5 -> FETCH_HEAD
2026-06-01T19:42:59.817276Z
2026-06-01T19:42:59.884448Z HEAD is now at 7aee95f chore: tambah script migration dan verifikasi reviews ke Supabase
2026-06-01T19:42:59.884788Z
2026-06-01T19:42:59.931399Z
2026-06-01T19:42:59.931892Z Using v2 root directory strategy
2026-06-01T19:42:59.952351Z Success: Finished cloning repository files
2026-06-01T19:43:01.586001Z Checking for configuration in a Wrangler configuration file (BETA)
2026-06-01T19:43:01.586477Z
2026-06-01T19:43:01.587153Z Found wrangler.toml file. Reading build configuration...
2026-06-01T19:43:01.782744Z A Wrangler configuration file was found but it does not appear to be valid. Did you mean to use wrangler.toml to configure Pages? If so, then make sure the file is valid and contains the `pages_build_output_dir` property. Skipping file and continuing.
2026-06-01T19:43:02.01935Z Detected the following tools from environment: npm@10.9.2, nodejs@22.16.0
2026-06-01T19:43:02.020125Z Installing project dependencies: npm clean-install --progress=false
2026-06-01T19:43:06.4882Z npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
2026-06-01T19:43:07.474501Z npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
2026-06-01T19:43:08.132223Z npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
2026-06-01T19:43:09.485389Z npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
2026-06-01T19:43:09.500828Z npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
2026-06-01T19:43:10.551976Z npm warn deprecated glob@10.3.10: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:43:10.564971Z npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:43:11.753814Z npm warn deprecated @supabase/auth-helpers-nextjs@0.15.0: Package no longer supported. Contact Support at <https://www.npmjs.com/support> for more info.
2026-06-01T19:43:12.003481Z npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:43:14.499496Z npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see <https://eslint.org/version-support> for other options.
2026-06-01T19:43:38.613931Z
2026-06-01T19:43:38.614253Z added 871 packages, and audited 872 packages in 36s
2026-06-01T19:43:38.614382Z
2026-06-01T19:43:38.614498Z 223 packages are looking for funding
2026-06-01T19:43:38.614641Z   run `npm fund` for details
2026-06-01T19:43:38.803198Z
2026-06-01T19:43:38.803687Z 11 vulnerabilities (6 moderate, 5 high)
2026-06-01T19:43:38.803889Z
2026-06-01T19:43:38.804054Z To address issues that do not require attention, run:
2026-06-01T19:43:38.804179Z   npm audit fix
2026-06-01T19:43:38.804345Z
2026-06-01T19:43:38.804447Z To address all issues possible (including breaking changes), run:
2026-06-01T19:43:38.804507Z   npm audit fix --force
2026-06-01T19:43:38.80459Z
2026-06-01T19:43:38.804643Z Some issues need review, and may require choosing
2026-06-01T19:43:38.804698Z a different dependency.
2026-06-01T19:43:38.804759Z
2026-06-01T19:43:38.804812Z Run `npm audit` for details.
2026-06-01T19:43:38.905991Z Executing user command: npx @cloudflare/next-on-pages@1
2026-06-01T19:43:39.990646Z npm warn exec The following package was not found and will be installed: @cloudflare/next-on-pages@1.13.16
2026-06-01T19:43:43.353632Z npm warn deprecated @cloudflare/next-on-pages@1.13.16: Please use the OpenNext adapter instead: <https://opennext.js.org/cloudflare>
2026-06-01T19:43:44.996694Z ⚡️ @cloudflare/next-on-pages CLI v.1.13.16
2026-06-01T19:43:45.182789Z ⚡️ Detected Package Manager: npm (10.9.2)
2026-06-01T19:43:45.183095Z ⚡️ Preparing project...
2026-06-01T19:43:45.18645Z ⚡️ Project is ready
2026-06-01T19:43:45.186661Z ⚡️ Building project...
2026-06-01T19:43:46.10829Z ▲  npm warn exec The following package was not found and will be installed: vercel@54.6.1
2026-06-01T19:43:55.888909Z ▲  npm warn deprecated tar@7.5.7: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:43:58.851346Z ▲  Vercel CLI 54.6.1 (Node.js 22.16.0)
2026-06-01T19:43:58.860171Z ▲  > NOTE: The Vercel CLI now collects telemetry regarding usage of the CLI.
2026-06-01T19:43:58.860422Z ▲  > This information is used to shape the CLI roadmap and prioritize features.
2026-06-01T19:43:58.860477Z ▲  > You can learn more, including how to opt-out if you'd not like to participate in this program, by visiting the following URL:
2026-06-01T19:43:58.860532Z ▲  > <https://vercel.com/docs/cli/about-telemetry>
2026-06-01T19:43:58.951958Z ▲  WARNING! Build not running on Vercel. System environment variables will not be available.
2026-06-01T19:43:59.216998Z ▲  Installing dependencies...
2026-06-01T19:44:00.642639Z ▲  up to date in 1s
2026-06-01T19:44:00.642958Z ▲  223 packages are looking for funding
2026-06-01T19:44:00.643064Z ▲  run `npm fund` for details
2026-06-01T19:44:00.65617Z ▲  Detected Next.js version: 14.2.35
2026-06-01T19:44:00.661768Z ▲  Running "npm run build"
2026-06-01T19:44:00.894051Z ▲  > restobook@0.1.0 build
2026-06-01T19:44:00.89439Z ▲  > next build
2026-06-01T19:44:01.537389Z ▲  Attention: Next.js now collects completely anonymous telemetry regarding usage.
2026-06-01T19:44:01.537756Z ▲  This information is used to shape Next.js' roadmap and prioritize features.
2026-06-01T19:44:01.537884Z ▲  You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
2026-06-01T19:44:01.538014Z ▲  <https://nextjs.org/telemetry>
2026-06-01T19:44:01.598711Z ▲  ▲ Next.js 14.2.35
2026-06-01T19:44:01.598949Z ▲  
2026-06-01T19:44:01.658092Z ▲  Creating an optimized production build ...
2026-06-01T19:44:43.794127Z ▲  <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (101kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
2026-06-01T19:44:43.826783Z ▲  <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (231kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
2026-06-01T19:45:04.68218Z ▲  ✓ Compiled successfully
2026-06-01T19:45:04.682467Z ▲  Linting and checking validity of types ...
2026-06-01T19:45:13.074775Z ▲  ./src/app/admin/attendance/page.tsx
2026-06-01T19:45:13.076047Z ▲  6:30  Warning: 'AlertTriangle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076196Z ▲  7:3  Warning: 'Search' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076271Z ▲  7:21  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.07641Z ▲  7:35  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076503Z ▲  7:47  Warning: 'MoreVertical' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076574Z ▲  8:16  Warning: 'ShieldX' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076635Z ▲  8:25  Warning: 'ShieldCheck' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076701Z ▲  8:38  Warning: 'TrendingDown' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.07677Z ▲  8:52  Warning: 'TrendingUp' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076807Z ▲  9:39  Warning: 'Info' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076854Z ▲  12:18  Warning: 'startOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076886Z ▲  12:32  Warning: 'endOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076916Z ▲  18:10  Warning: 'loading' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.076956Z ▲  23:10  Warning: 'search' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.077009Z ▲  23:18  Warning: 'setSearch' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.077063Z ▲  46:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.077262Z ▲  158:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.077351Z ▲  281:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.077444Z ▲  295:78  Warning: 'onViewPhoto' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.077505Z ▲  349:6  Warning: React Hook useEffect has missing dependencies: 'fetchEmployeeData', 'fetchStats', 'onUpdate', and 'supabase'. Either include them or remove the dependency array. If 'onUpdate' changes too often, find the parent component that defines it and wrap that definition in useCallback.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.077577Z ▲  405:18  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.077664Z ▲  583:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.07773Z ▲  759:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.077817Z ▲  
2026-06-01T19:45:13.077874Z ▲  ./src/app/admin/categories/page.tsx
2026-06-01T19:45:13.077974Z ▲  33:6  Warning: React Hook useEffect has missing dependencies: 'fetchCategories' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.078056Z ▲  
2026-06-01T19:45:13.078115Z ▲  ./src/app/admin/customers/page.tsx
2026-06-01T19:45:13.078165Z ▲  6:31  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.078214Z ▲  7:11  Warning: 'Download' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.078263Z ▲  9:3  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.078327Z ▲  92:10  Warning: 'isDeleting' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.078376Z ▲  179:6  Warning: React Hook useEffect has missing dependencies: 'getDurationText', 'message', 'prevDefaultMsg', 'prevDefaultReason', and 'reason'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.078431Z ▲  215:6  Warning: React Hook useEffect has missing dependencies: 'fetchAppeals', 'fetchCustomers', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.078467Z ▲  351:6  Warning: React Hook useEffect has a missing dependency: 'fetchCustomerDetails'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.078503Z ▲  1025:31  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.078554Z ▲  1229:35  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.081671Z ▲  1322:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.082062Z ▲  
2026-06-01T19:45:13.082678Z ▲  ./src/app/admin/dashboard/page.tsx
2026-06-01T19:45:13.083105Z ▲  5:59  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.083518Z ▲  34:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.084061Z ▲  
2026-06-01T19:45:13.084472Z ▲  ./src/app/admin/menu/page.tsx
2026-06-01T19:45:13.084992Z ▲  5:43  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.085389Z ▲  53:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.085831Z ▲  
2026-06-01T19:45:13.08643Z ▲  ./src/app/admin/menu-logs/page.tsx
2026-06-01T19:45:13.086554Z ▲  4:18  Warning: 'AnimatePresence' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.08686Z ▲  37:6  Warning: React Hook useEffect has missing dependencies: 'fetchInitialData', 'fetchLogs', 'fetchMenuItems', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.087655Z ▲  167:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.087889Z ▲  
2026-06-01T19:45:13.088072Z ▲  ./src/app/admin/orders/page.tsx
2026-06-01T19:45:13.088477Z ▲  5:45  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.089026Z ▲  5:53  Warning: 'Clock' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.089399Z ▲  5:60  Warning: 'CheckCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.089844Z ▲  5:73  Warning: 'XCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.089983Z ▲  5:82  Warning: 'ChefHat' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.090284Z ▲  5:91  Warning: 'Truck' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.090876Z ▲  8:10  Warning: 'format' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.090992Z ▲  9:16  Warning: 'localeId' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.091164Z ▲  32:6  Warning: React Hook useEffect has missing dependencies: 'fetchOrders' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.091597Z ▲  126:54  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.092242Z ▲  
2026-06-01T19:45:13.092433Z ▲  ./src/app/admin/payroll/page.tsx
2026-06-01T19:45:13.093178Z ▲  6:33  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.093308Z ▲  6:40  Warning: 'CalendarDays' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.093406Z ▲  7:3  Warning: 'Receipt' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.093585Z ▲  7:49  Warning: 'ChevronDown' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.0938Z ▲  8:21  Warning: 'Plus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.093942Z ▲  8:27  Warning: 'Minus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.094421Z ▲  8:34  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.09455Z ▲  9:3  Warning: 'ArrowLeft' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.094794Z ▲  13:18  Warning: 'startOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.095727Z ▲  13:32  Warning: 'endOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.09583Z ▲  16:13  Warning: 'XLSX' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.095898Z ▲  173:118  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.095968Z ▲  277:7  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.096046Z ▲  512:25  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096106Z ▲  513:22  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.09616Z ▲  727:20  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096207Z ▲  803:20  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096252Z ▲  850:12  Warning: 'tableY' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.096292Z ▲  896:12  Warning: 'attY' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.096332Z ▲  929:12  Warning: 'finalY' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.096361Z ▲  999:17  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.09639Z ▲  1029:17  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096489Z ▲  1490:58  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.096545Z ▲  
2026-06-01T19:45:13.096593Z ▲  ./src/app/admin/refunds/page.tsx
2026-06-01T19:45:13.096626Z ▲  6:73  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096655Z ▲  6:96  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096693Z ▲  6:106  Warning: 'User' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096726Z ▲  8:8  Warning: 'Link' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096779Z ▲  9:10  Warning: 'format' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096823Z ▲  10:16  Warning: 'localeId' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.096864Z ▲  38:6  Warning: React Hook useEffect has missing dependencies: 'fetchRefundRequests' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.096916Z ▲  89:18  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097023Z ▲  313:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.097095Z ▲  390:27  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.097134Z ▲  
2026-06-01T19:45:13.097165Z ▲  ./src/app/admin/reservations/page.tsx
2026-06-01T19:45:13.097199Z ▲  5:70  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097253Z ▲  52:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.09729Z ▲  67:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097338Z ▲  
2026-06-01T19:45:13.097387Z ▲  ./src/app/admin/resign/page.tsx
2026-06-01T19:45:13.097435Z ▲  6:3  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.09748Z ▲  7:36  Warning: 'Send' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097528Z ▲  8:16  Warning: 'Mail' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097578Z ▲  8:22  Warning: 'Phone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097626Z ▲  8:29  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097709Z ▲  8:39  Warning: 'Briefcase' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.097758Z ▲  136:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.09781Z ▲  586:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.097853Z ▲  666:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.097897Z ▲  732:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.097938Z ▲  
2026-06-01T19:45:13.097968Z ▲  ./src/app/admin/reviews/page.tsx
2026-06-01T19:45:13.098007Z ▲  58:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.098055Z ▲  235:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.098087Z ▲  
2026-06-01T19:45:13.098115Z ▲  ./src/app/admin/rewards/page.tsx
2026-06-01T19:45:13.098145Z ▲  6:24  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.09819Z ▲  6:34  Warning: 'AlertCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098223Z ▲  7:3  Warning: 'CheckCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098266Z ▲  7:16  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.0983Z ▲  8:21  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098329Z ▲  8:39  Warning: 'ShieldAlert' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098358Z ▲  9:22  Warning: 'RefreshCcw' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098388Z ▲  122:6  Warning: React Hook useEffect has missing dependencies: 'fetchRestaurantSettings' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.098417Z ▲  
2026-06-01T19:45:13.098446Z ▲  ./src/app/admin/settings/page.tsx
2026-06-01T19:45:13.098474Z ▲  5:78  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098502Z ▲  5:90  Warning: 'CreditCard' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.098531Z ▲  75:6  Warning: React Hook useEffect has a missing dependency: 'fetchSettings'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.098561Z ▲  143:68  Warning: 'fileName' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103089Z ▲  306:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.103172Z ▲  327:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.103221Z ▲  835:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.103256Z ▲  
2026-06-01T19:45:13.10329Z ▲  ./src/app/admin/tables/page.tsx
2026-06-01T19:45:13.103344Z ▲  32:6  Warning: React Hook useEffect has missing dependencies: 'fetchTables' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.103391Z ▲  
2026-06-01T19:45:13.103424Z ▲  ./src/app/admin/transactions/page.tsx
2026-06-01T19:45:13.103455Z ▲  5:10  Warning: 'Download' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103487Z ▲  5:51  Warning: 'DollarSign' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103518Z ▲  39:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.103548Z ▲  
2026-06-01T19:45:13.103579Z ▲  ./src/app/admin/users/page.tsx
2026-06-01T19:45:13.103609Z ▲  5:10  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103638Z ▲  5:81  Warning: 'FileText' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103667Z ▲  5:102  Warning: 'EyeOff' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103697Z ▲  54:6  Warning: React Hook useEffect has missing dependencies: 'fetchUsers' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.103727Z ▲  66:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103774Z ▲  156:9  Warning: 'generateCredentialPDF' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103808Z ▲  331:27  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.103839Z ▲  
2026-06-01T19:45:13.103868Z ▲  ./src/app/admin/vouchers/page.tsx
2026-06-01T19:45:13.103897Z ▲  6:31  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103927Z ▲  7:3  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.103967Z ▲  79:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.104007Z ▲  
2026-06-01T19:45:13.104057Z ▲  ./src/app/api/EXPRESS_MIGRATE/route.ts
2026-06-01T19:45:13.104097Z ▲  33:13  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104126Z ▲  
2026-06-01T19:45:13.104156Z ▲  ./src/app/api/admin/create-employee/route.ts
2026-06-01T19:45:13.104186Z ▲  14:41  Warning: 'listError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104225Z ▲  30:7  Warning: 'isNewUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104263Z ▲  
2026-06-01T19:45:13.104307Z ▲  ./src/app/api/admin/customers/bulk/route.ts
2026-06-01T19:45:13.104338Z ▲  36:17  Warning: 'durationParts' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.104379Z ▲  
2026-06-01T19:45:13.104416Z ▲  ./src/app/api/admin/customers/suspend/route.ts
2026-06-01T19:45:13.104446Z ▲  89:11  Warning: 'durationParts' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.104474Z ▲  
2026-06-01T19:45:13.104516Z ▲  ./src/app/api/admin/delete-employee/route.ts
2026-06-01T19:45:13.104559Z ▲  38:22  Warning: 'authError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104598Z ▲  
2026-06-01T19:45:13.104639Z ▲  ./src/app/api/admin/resign-action/route.ts
2026-06-01T19:45:13.104679Z ▲  345:18  Warning: 'waE' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104721Z ▲  360:13  Warning: 'fullName' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104781Z ▲  361:13  Warning: 'phone' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.10483Z ▲  362:13  Warning: 'type' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.104874Z ▲  
2026-06-01T19:45:13.104915Z ▲  ./src/app/api/admin/reviews/route.ts
2026-06-01T19:45:13.104956Z ▲  21:9  Warning: 'profileMap' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.105002Z ▲  
2026-06-01T19:45:13.105194Z ▲  ./src/app/api/admin/rewards/redemptions/route.ts
2026-06-01T19:45:13.105265Z ▲  18:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.105306Z ▲  
2026-06-01T19:45:13.105352Z ▲  ./src/app/api/admin/rewards/route.ts
2026-06-01T19:45:13.105395Z ▲  18:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.105437Z ▲  
2026-06-01T19:45:13.105483Z ▲  ./src/app/api/admin/vouchers/route.ts
2026-06-01T19:45:13.105515Z ▲  6:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.105544Z ▲  
2026-06-01T19:45:13.105574Z ▲  ./src/app/api/auth/callback/route.ts
2026-06-01T19:45:13.105722Z ▲  64:9  Warning: 'next' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.105792Z ▲  
2026-06-01T19:45:13.10583Z ▲  ./src/app/api/cashier/active-shift/route.ts
2026-06-01T19:45:13.105862Z ▲  28:14  Warning: 'migrateErr' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.105898Z ▲  
2026-06-01T19:45:13.105933Z ▲  ./src/app/api/cashier/lock-status/route.ts
2026-06-01T19:45:13.105964Z ▲  92:9  Warning: 'individualShiftEndTime' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.105993Z ▲  
2026-06-01T19:45:13.106023Z ▲  ./src/app/api/create-admin/route.ts
2026-06-01T19:45:13.106052Z ▲  22:23  Warning: 'existingUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.106081Z ▲  
2026-06-01T19:45:13.106111Z ▲  ./src/app/api/customer/claim-welcome-points/route.ts
2026-06-01T19:45:13.10614Z ▲  8:28  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.106169Z ▲  
2026-06-01T19:45:13.106198Z ▲  ./src/app/api/customer/points/route.ts
2026-06-01T19:45:13.106227Z ▲  7:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.106265Z ▲  
2026-06-01T19:45:13.106311Z ▲  ./src/app/api/customer/rewards/route.ts
2026-06-01T19:45:13.106344Z ▲  15:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.106373Z ▲  
2026-06-01T19:45:13.106403Z ▲  ./src/app/api/customer/vouchers/route.ts
2026-06-01T19:45:13.106434Z ▲  7:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.10648Z ▲  
2026-06-01T19:45:13.106527Z ▲  ./src/app/api/customer/wallet/route.ts
2026-06-01T19:45:13.106564Z ▲  7:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.107903Z ▲  
2026-06-01T19:45:13.10811Z ▲  ./src/app/api/customer/wallet/topup/route.ts
2026-06-01T19:45:13.108563Z ▲  153:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.108751Z ▲  
2026-06-01T19:45:13.10888Z ▲  ./src/app/api/fix-rls/route.ts
2026-06-01T19:45:13.109282Z ▲  388:12  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.109404Z ▲  
2026-06-01T19:45:13.10985Z ▲  ./src/app/api/migrate/route.ts
2026-06-01T19:45:13.109979Z ▲  18:21  Warning: 'testData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.111034Z ▲  
2026-06-01T19:45:13.111221Z ▲  ./src/app/api/payment/callback/route.ts
2026-06-01T19:45:13.111348Z ▲  86:21  Warning: 'order' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.11146Z ▲  99:23  Warning: 'retryData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.111586Z ▲  
2026-06-01T19:45:13.111711Z ▲  ./src/app/api/payment/check-status/route.ts
2026-06-01T19:45:13.111843Z ▲  52:15  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.112081Z ▲  
2026-06-01T19:45:13.112241Z ▲  ./src/app/api/payment/create-invoice/route.ts
2026-06-01T19:45:13.112676Z ▲  52:9  Warning: 'customerDetail' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.112959Z ▲  219:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.113434Z ▲  
2026-06-01T19:45:13.113664Z ▲  ./src/app/api/restobot/route.ts
2026-06-01T19:45:13.114014Z ▲  287:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.114216Z ▲  302:9  Warning: 'emailToSend' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.114344Z ▲  395:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.114529Z ▲  438:9  Warning: 'emailToSend' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.11489Z ▲  656:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.11508Z ▲  843:36  Warning: 'role' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.115402Z ▲  859:9  Warning: 'response' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.115545Z ▲  
2026-06-01T19:45:13.11588Z ▲  ./src/app/api/reviews/route.ts
2026-06-01T19:45:13.116066Z ▲  42:7  Warning: 'profileMap' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.116277Z ▲  
2026-06-01T19:45:13.116402Z ▲  ./src/app/api/send-otp/route.ts
2026-06-01T19:45:13.116514Z ▲  26:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.116621Z ▲  30:25  Warning: 'type' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.116718Z ▲  30:31  Warning: 'method' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.116763Z ▲  
2026-06-01T19:45:13.116806Z ▲  ./src/app/api/upload/route.ts
2026-06-01T19:45:13.116845Z ▲  25:19  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.116877Z ▲  
2026-06-01T19:45:13.11693Z ▲  ./src/app/cashier/attendance/page.tsx
2026-06-01T19:45:13.116982Z ▲  62:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.117021Z ▲  
2026-06-01T19:45:13.117065Z ▲  ./src/app/cashier/dashboard/page.tsx
2026-06-01T19:45:13.117119Z ▲  5:140  Warning: 'Hand' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.117169Z ▲  172:6  Warning: React Hook useEffect has missing dependencies: 'checkShift', 'fetchActiveResign', 'fetchDashboardData', 'fetchLatestAttendance', 'fetchProfile', 'fetchTables', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.117216Z ▲  202:6  Warning: React Hook useEffect has a missing dependency: 'checkShift'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.117261Z ▲  728:6  Warning: React Hook useEffect has a missing dependency: 'handleAutoSuspend'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.11731Z ▲  819:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.117365Z ▲  1113:59  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.117417Z ▲  
2026-06-01T19:45:13.11747Z ▲  ./src/app/cashier/layout.tsx
2026-06-01T19:45:13.117522Z ▲  117:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.117565Z ▲  
2026-06-01T19:45:13.117608Z ▲  ./src/app/cashier/menu/page.tsx
2026-06-01T19:45:13.117652Z ▲  5:27  Warning: 'Ban' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.117693Z ▲  5:32  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.117726Z ▲  46:6  Warning: React Hook useEffect has missing dependencies: 'fetchInitialData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.117795Z ▲  227:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.117854Z ▲  
2026-06-01T19:45:13.1179Z ▲  ./src/app/cashier/online-orders/page.tsx
2026-06-01T19:45:13.117944Z ▲  8:35  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.119626Z ▲  9:3  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.119838Z ▲  9:15  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.12003Z ▲  10:3  Warning: 'Volume2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.120178Z ▲  10:12  Warning: 'VolumeX' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.120678Z ▲  10:35  Warning: 'MapPin' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.121034Z ▲  60:6  Warning: React Hook useEffect has missing dependencies: 'fetchCashierName', 'fetchOrders', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.121352Z ▲  148:14  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.121483Z ▲  202:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.121674Z ▲  270:24  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.122033Z ▲  
2026-06-01T19:45:13.122241Z ▲  ./src/app/cashier/orders/page.tsx
2026-06-01T19:45:13.122403Z ▲  5:32  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.122651Z ▲  5:42  Warning: 'CreditCard' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.122937Z ▲  5:54  Warning: 'Banknote' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.123279Z ▲  5:115  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.123498Z ▲  5:130  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.123844Z ▲  45:6  Warning: React Hook useEffect has missing dependencies: 'fetchCashierName', 'fetchOrders', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.1241Z ▲  167:13  Warning: 'resStatus' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.124248Z ▲  181:9  Warning: 'handleGenerateDuitkuLink' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.124458Z ▲  198:40  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.124614Z ▲  211:34  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.124767Z ▲  216:32  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.125001Z ▲  319:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.125164Z ▲  
2026-06-01T19:45:13.125331Z ▲  ./src/app/cashier/pos/page.tsx
2026-06-01T19:45:13.125653Z ▲  5:207  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.125864Z ▲  5:219  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.126084Z ▲  5:241  Warning: 'Globe' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.126417Z ▲  5:248  Warning: 'ChevronRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.126623Z ▲  11:10  Warning: 'generateQRISString' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.126822Z ▲  11:30  Warning: 'getEWalletDeepLink' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.126971Z ▲  12:56  Warning: 'getOperationalStatus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.12714Z ▲  54:10  Warning: 'onlineSearchMode' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.127507Z ▲  54:28  Warning: 'setOnlineSearchMode' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.127699Z ▲  56:10  Warning: 'searchTableNo' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.127876Z ▲  56:25  Warning: 'setSearchTableNo' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.128253Z ▲  70:10  Warning: 'nonCashProvider' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.128425Z ▲  71:10  Warning: 'duitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.128596Z ▲  71:24  Warning: 'setDuitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.128714Z ▲  75:10  Warning: 'merchant' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.128997Z ▲  88:10  Warning: 'txId' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.129208Z ▲  89:10  Warning: 'qrisTimer' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.129611Z ▲  90:10  Warning: 'qrisExpired' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.129791Z ▲  148:6  Warning: React Hook useEffect has missing dependencies: 'processPayment' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.12996Z ▲  150:9  Warning: 'forceCloseDuitku' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.130228Z ▲  165:9  Warning: 'formatTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.130378Z ▲  174:9  Warning: 'receiptKasirRef' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.130524Z ▲  279:6  Warning: React Hook useEffect has missing dependencies: 'fetchInitialData', 'fetchMenuItemsOnly', 'fetchTablesOnly', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.130732Z ▲  365:9  Warning: 'toggleMenuAvailability' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.132898Z ▲  536:9  Warning: 'handleDirectProcessOrder' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.13298Z ▲  583:9  Warning: 'handleCancelOnlineOrder' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133021Z ▲  639:11  Warning: 'notesStr' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.133055Z ▲  732:19  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133091Z ▲  738:37  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133121Z ▲  741:37  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133149Z ▲  744:35  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.13318Z ▲  763:24  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133225Z ▲  1167:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.133261Z ▲  1293:30  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133291Z ▲  1338:34  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133319Z ▲  
2026-06-01T19:45:13.133348Z ▲  ./src/app/cashier/queue/page.tsx
2026-06-01T19:45:13.133378Z ▲  26:6  Warning: React Hook useEffect has missing dependencies: 'fetchActiveOrders' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.133409Z ▲  
2026-06-01T19:45:13.133439Z ▲  ./src/app/cashier/reservations/page.tsx
2026-06-01T19:45:13.133469Z ▲  56:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.133499Z ▲  74:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133534Z ▲  163:13  Warning: 'profileId' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133567Z ▲  
2026-06-01T19:45:13.133596Z ▲  ./src/app/cashier/tables/page.tsx
2026-06-01T19:45:13.133625Z ▲  27:9  Warning: 'clean' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.133654Z ▲  96:6  Warning: React Hook useEffect has missing dependencies: 'fetchSettings', 'fetchTables', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.133694Z ▲  
2026-06-01T19:45:13.133723Z ▲  ./src/app/cashier/transactions/page.tsx
2026-06-01T19:45:13.133776Z ▲  5:70  Warning: 'Download' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133808Z ▲  37:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.133838Z ▲  
2026-06-01T19:45:13.133866Z ▲  ./src/app/customer/cart/page.tsx
2026-06-01T19:45:13.133895Z ▲  5:111  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133924Z ▲  5:123  Warning: 'Landmark' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133953Z ▲  5:133  Warning: 'QrCode' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.133981Z ▲  5:169  Warning: 'RefreshCw' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.134981Z ▲  5:183  Warning: 'Receipt' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.13506Z ▲  5:192  Warning: 'Sparkles' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.135142Z ▲  5:202  Warning: 'ChevronRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.135343Z ▲  5:216  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.135923Z ▲  11:10  Warning: 'generateQRISString' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.136369Z ▲  11:30  Warning: 'getEWalletDeepLink' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.137026Z ▲  12:10  Warning: 'isRestaurantOpen' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.137199Z ▲  12:28  Warning: 'getOperationalStatus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.137624Z ▲  101:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.137952Z ▲  144:10  Warning: 'duitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.138042Z ▲  144:24  Warning: 'setDuitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.138258Z ▲  147:10  Warning: 'currentTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.138514Z ▲  155:27  Warning: 'setNonCashCategory' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.138869Z ▲  156:10  Warning: 'selectedProvider' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.139109Z ▲  156:28  Warning: 'setSelectedProvider' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.139279Z ▲  169:10  Warning: 'qrisTimer' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.139403Z ▲  170:10  Warning: 'qrisExpired' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.139636Z ▲  318:10  Warning: 'merchant' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.139799Z ▲  331:10  Warning: 'txId' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.139978Z ▲  439:6  Warning: React Hook useEffect has missing dependencies: 'fetchProfile' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.140479Z ▲  471:6  Warning: React Hook useEffect has missing dependencies: 'fetchTables' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.140607Z ▲  493:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.140661Z ▲  503:20  Warning: 't' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.140697Z ▲  519:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.14073Z ▲  527:16  Warning: 't' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.140779Z ▲  583:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.140812Z ▲  651:9  Warning: 'formatTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.140842Z ▲  657:9  Warning: 'handleProcessPayment' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.140871Z ▲  750:15  Warning: 'dbPaymentMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.1409Z ▲  
2026-06-01T19:45:13.140929Z ▲  ./src/app/customer/dashboard/page.tsx
2026-06-01T19:45:13.140959Z ▲  53:6  Warning: React Hook useEffect has missing dependencies: 'fetchDashboardData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141Z ▲  
2026-06-01T19:45:13.141031Z ▲  ./src/app/customer/favorites/page.tsx
2026-06-01T19:45:13.141063Z ▲  5:17  Warning: 'ShoppingBag' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141093Z ▲  5:38  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141122Z ▲  34:6  Warning: React Hook useEffect has missing dependencies: 'fetchFavorites' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141152Z ▲  
2026-06-01T19:45:13.141181Z ▲  ./src/app/customer/menu/page.tsx
2026-06-01T19:45:13.141213Z ▲  5:44  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141248Z ▲  5:58  Warning: 'X' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141278Z ▲  5:61  Warning: 'UtensilsCrossed' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141308Z ▲  70:6  Warning: React Hook useEffect has missing dependencies: 'fetchData', 'fetchMenuItemsOnly', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141339Z ▲  
2026-06-01T19:45:13.141368Z ▲  ./src/app/customer/notifications/page.tsx
2026-06-01T19:45:13.141397Z ▲  5:28  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141427Z ▲  39:6  Warning: React Hook useEffect has missing dependencies: 'fetchNotifs' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141456Z ▲  
2026-06-01T19:45:13.141485Z ▲  ./src/app/customer/orders/[id]/page.tsx
2026-06-01T19:45:13.141514Z ▲  9:96  Warning: 'Banknote' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141543Z ▲  9:181  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141572Z ▲  9:196  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141604Z ▲  49:10  Warning: 'showPaymentSelector' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141635Z ▲  49:31  Warning: 'setShowPaymentSelector' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141664Z ▲  50:10  Warning: 'duitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141703Z ▲  50:24  Warning: 'setDuitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.141751Z ▲  93:6  Warning: React Hook useEffect has missing dependencies: 'fetchProfile' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141793Z ▲  227:6  Warning: React Hook useEffect has missing dependencies: 'fetchOrderDetails' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141831Z ▲  242:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141862Z ▲  330:6  Warning: React Hook useEffect has a missing dependency: 'handleAutoCancel'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.141894Z ▲  393:40  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.14333Z ▲  474:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.143491Z ▲  573:9  Warning: 'getStatusIcon' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.144267Z ▲  622:9  Warning: 'canCancel' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.144475Z ▲  631:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.144676Z ▲  751:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.144887Z ▲  
2026-06-01T19:45:13.145078Z ▲  ./src/app/customer/orders/page.tsx
2026-06-01T19:45:13.145544Z ▲  5:23  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.145702Z ▲  32:6  Warning: React Hook useEffect has missing dependencies: 'fetchOrders' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.145858Z ▲  121:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.14597Z ▲  
2026-06-01T19:45:13.146087Z ▲  ./src/app/customer/reservations/page.tsx
2026-06-01T19:45:13.146257Z ▲  67:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.146441Z ▲  207:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.146634Z ▲  
2026-06-01T19:45:13.146978Z ▲  ./src/app/customer/rewards/page.tsx
2026-06-01T19:45:13.147203Z ▲  6:24  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.147385Z ▲  7:16  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.147734Z ▲  7:48  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.147888Z ▲  8:42  Warning: 'CreditCard' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.148007Z ▲  31:10  Warning: 'tick' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.148136Z ▲  60:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.148276Z ▲  
2026-06-01T19:45:13.148458Z ▲  ./src/app/customer/vouchers/page.tsx
2026-06-01T19:45:13.148643Z ▲  4:18  Warning: 'AnimatePresence' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.148777Z ▲  6:17  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.148889Z ▲  6:27  Warning: 'AlertCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.149277Z ▲  7:3  Warning: 'CheckCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.149618Z ▲  7:16  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.149781Z ▲  7:48  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.149983Z ▲  46:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.150348Z ▲  
2026-06-01T19:45:13.150464Z ▲  ./src/app/customer/wallet/page.tsx
2026-06-01T19:45:13.150543Z ▲  8:33  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.150783Z ▲  8:47  Warning: 'DollarSign' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.150865Z ▲  8:62  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.150928Z ▲  9:53  Warning: 'Key' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.15097Z ▲  56:10  Warning: 'isDuitkuOpen' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.15101Z ▲  69:10  Warning: 'otpSent' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.151051Z ▲  109:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.151109Z ▲  351:40  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.15118Z ▲  1295:6  Warning: React Hook useEffect has a missing dependency: 'onExpire'. Either include it or remove the dependency array. If 'onExpire' changes too often, find the parent component that defines it and wrap that definition in useCallback.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.151246Z ▲  
2026-06-01T19:45:13.151308Z ▲  ./src/app/forgot-password/page.tsx
2026-06-01T19:45:13.151366Z ▲  19:10  Warning: 'method' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.151421Z ▲  
2026-06-01T19:45:13.151477Z ▲  ./src/app/login/page.tsx
2026-06-01T19:45:13.15153Z ▲  5:143  Warning: 'ShieldAlert' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.151582Z ▲  35:9  Warning: 'timer' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.151636Z ▲  90:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.151688Z ▲  138:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.151733Z ▲  369:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.151796Z ▲  392:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.151836Z ▲  
2026-06-01T19:45:13.151866Z ▲  ./src/app/page.tsx
2026-06-01T19:45:13.151895Z ▲  4:38  Warning: 'Clock' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.151925Z ▲  10:10  Warning: 'isRestaurantOpen' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.151954Z ▲  10:28  Warning: 'getOperationalStatus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.151984Z ▲  64:10  Warning: 'currentTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152013Z ▲  255:6  Warning: React Hook useEffect has missing dependencies: 'fetchMenu', 'fetchSettings', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.152051Z ▲  312:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.152102Z ▲  
2026-06-01T19:45:13.152138Z ▲  ./src/app/register/page.tsx
2026-06-01T19:45:13.152169Z ▲  15:9  Warning: 'router' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152198Z ▲  
2026-06-01T19:45:13.152226Z ▲  ./src/components/AppSplashScreen.tsx
2026-06-01T19:45:13.152259Z ▲  33:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.152296Z ▲  76:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.152327Z ▲  
2026-06-01T19:45:13.152359Z ▲  ./src/components/AutoTableStatusManager.tsx
2026-06-01T19:45:13.152389Z ▲  24:6  Warning: React Hook useEffect has a missing dependency: 'supabase.auth'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.152425Z ▲  148:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.152455Z ▲  
2026-06-01T19:45:13.152483Z ▲  ./src/components/ConnectionDetector.tsx
2026-06-01T19:45:13.152516Z ▲  32:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152546Z ▲  69:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152578Z ▲  94:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152607Z ▲  
2026-06-01T19:45:13.152636Z ▲  ./src/components/DynamicFavicon.tsx
2026-06-01T19:45:13.15267Z ▲  36:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152711Z ▲  68:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.152764Z ▲  
2026-06-01T19:45:13.152797Z ▲  ./src/components/PaymentMethodSelector.tsx
2026-06-01T19:45:13.152842Z ▲  100:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.152877Z ▲  
2026-06-01T19:45:13.152916Z ▲  ./src/components/Receipt.tsx
2026-06-01T19:45:13.152959Z ▲  5:10  Warning: 'format' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.152991Z ▲  6:16  Warning: 'localeId' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153024Z ▲  45:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.153069Z ▲  
2026-06-01T19:45:13.153108Z ▲  ./src/components/RestoBot.tsx
2026-06-01T19:45:13.15316Z ▲  276:10  Warning: 'sessionUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153216Z ▲  617:6  Warning: React Hook useEffect has a missing dependency: 'checkAndShowNotifications'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.153253Z ▲  896:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153294Z ▲  
2026-06-01T19:45:13.153338Z ▲  ./src/components/cashier/AttendanceModal.tsx
2026-06-01T19:45:13.153378Z ▲  4:18  Warning: 'AnimatePresence' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153409Z ▲  32:6  Warning: React Hook useEffect has a missing dependency: 'stopCamera'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.15345Z ▲  118:21  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153507Z ▲  200:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.153558Z ▲  
2026-06-01T19:45:13.153611Z ▲  ./src/components/layout/DashboardLayout.tsx
2026-06-01T19:45:13.153667Z ▲  8:95  Warning: 'Lock' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.15372Z ▲  8:101  Warning: 'ShieldAlert' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153784Z ▲  8:114  Warning: 'TrendingUp' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153833Z ▲  8:126  Warning: 'Zap' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.153879Z ▲  82:6  Warning: React Hook useEffect has missing dependencies: 'checkUser', 'fetchOnlineOrderCount', 'playNotifSound', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.153926Z ▲  119:6  Warning: React Hook useEffect has missing dependencies: 'fetchUnreadNotifCount', 'playSingleNotifSound', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.153976Z ▲  140:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.154022Z ▲  182:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.154067Z ▲  192:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.154111Z ▲  414:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.154161Z ▲  
2026-06-01T19:45:13.154205Z ▲  ./src/components/profile/ProfileContent.tsx
2026-06-01T19:45:13.154253Z ▲  221:40  Warning: React Hook useEffect has a missing dependency: 'fetchProfile'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.154314Z ▲  247:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:45:13.154368Z ▲  568:31  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:45:13.154417Z ▲  
2026-06-01T19:45:13.154467Z ▲  ./src/lib/security.ts
2026-06-01T19:45:13.154519Z ▲  109:17  Warning: 'detail' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.154571Z ▲  
2026-06-01T19:45:13.1548Z ▲  ./src/lib/sendReceiptEmail.ts
2026-06-01T19:45:13.155052Z ▲  106:9  Warning: 'pdfBase64' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.155366Z ▲  106:9  Warning: 'pdfBase64' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.155767Z ▲  
2026-06-01T19:45:13.156442Z ▲  ./src/middleware.ts
2026-06-01T19:45:13.15851Z ▲  148:50  Warning: 'ip' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.158668Z ▲  
2026-06-01T19:45:13.158758Z ▲  ./src/utils/operationalHours.ts
2026-06-01T19:45:13.158827Z ▲  77:12  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:45:13.158884Z ▲  
2026-06-01T19:45:13.15894Z ▲  ./src/utils/qris.ts
2026-06-01T19:45:13.158999Z ▲  22:7  Warning: 'hex' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:45:13.159055Z ▲  
2026-06-01T19:45:13.159116Z ▲  info  - Need to disable some ESLint rules? Learn more here: <https://nextjs.org/docs/basic-features/eslint#disabling-rules>
2026-06-01T19:45:25.27493Z ▲  Failed to compile.
2026-06-01T19:45:25.275335Z ▲  ./src/middleware.ts:131:32
2026-06-01T19:45:25.275441Z ▲  Type error: Type 'MapIterator<[string, { count: number; resetAt: number; blocked?: boolean | undefined; }]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
2026-06-01T19:45:25.275518Z ▲  
2026-06-01T19:45:25.275561Z ▲  [0m [90m 129 |[39m   [36mconst[39m now [33m=[39m [33mDate[39m[33m.[39mnow()[33m;[39m[0m
2026-06-01T19:45:25.275601Z ▲  [0m [90m 130 |[39m   [36mif[39m (now [33m-[39m lastCleanup [33m>[39m [35m300[39m_000) {[0m
2026-06-01T19:45:25.275641Z ▲  [0m[31m[1m>[22m[39m[90m 131 |[39m     [36mfor[39m ([36mconst[39m [key[33m,[39m entry] [36mof[39m rateLimitStore[33m.[39mentries()) {[0m
2026-06-01T19:45:25.275696Z ▲  [0m [90m     |[39m                                [31m[1m^[22m[39m[0m
2026-06-01T19:45:25.275755Z ▲  [0m [90m 132 |[39m       [36mif[39m (entry[33m.[39mresetAt [33m<=[39m now) rateLimitStore[33m.[39m[36mdelete[39m(key)[33m;[39m[0m
2026-06-01T19:45:25.27582Z ▲  [0m [90m 133 |[39m     }[0m
2026-06-01T19:45:25.275868Z ▲  [0m [90m 134 |[39m     lastCleanup [33m=[39m now[33m;[39m[0m
2026-06-01T19:45:25.356077Z ▲  Next.js build worker exited with code: 1 and signal: null
2026-06-01T19:45:25.390452Z ▲  Error: Command "npm run build" exited with 1
2026-06-01T19:45:25.968125Z
2026-06-01T19:45:25.968398Z ⚡️ The Vercel build (`npx vercel build`) command failed. For more details see the Vercel logs above.
2026-06-01T19:45:25.968468Z ⚡️ If you need help solving the issue, refer to the Vercel or Next.js documentation or their repositories.
2026-06-01T19:45:25.968514Z
2026-06-01T19:45:26.009524Z Failed: Error while executing user command. Exited with error code: 1
2026-06-01T19:45:26.017598Z Failed: build command exited with code: 1
2026-06-01T19:45:26.975104Z Failed: error occurred while running build command
