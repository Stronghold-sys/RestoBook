2026-06-01T19:55:16.405897Z Cloning repository...
2026-06-01T19:55:17.294769Z From <https://github.com/Stronghold-sys/RestoBook>
2026-06-01T19:55:17.295078Z  * branch            052d3d193a85985d3e79fec3414f2fbf559810ba -> FETCH_HEAD
2026-06-01T19:55:17.295137Z
2026-06-01T19:55:17.364391Z HEAD is now at 052d3d1 fix: remove edge runtime to make compatible with OpenNext Cloudflare deployment, and fix MD5 SubtleCrypto runtime errors
2026-06-01T19:55:17.364866Z
2026-06-01T19:55:17.424022Z
2026-06-01T19:55:17.424579Z Using v2 root directory strategy
2026-06-01T19:55:17.443796Z Success: Finished cloning repository files
2026-06-01T19:55:18.992954Z Checking for configuration in a Wrangler configuration file (BETA)
2026-06-01T19:55:18.993663Z
2026-06-01T19:55:18.994268Z Found wrangler.toml file. Reading build configuration...
2026-06-01T19:55:19.19532Z A Wrangler configuration file was found but it does not appear to be valid. Did you mean to use wrangler.toml to configure Pages? If so, then make sure the file is valid and contains the `pages_build_output_dir` property. Skipping file and continuing.
2026-06-01T19:55:19.448335Z Detected the following tools from environment: npm@10.9.2, nodejs@22.16.0
2026-06-01T19:55:19.449453Z Installing project dependencies: npm clean-install --progress=false
2026-06-01T19:55:24.062098Z npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
2026-06-01T19:55:25.27771Z npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
2026-06-01T19:55:25.978887Z npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
2026-06-01T19:55:27.482681Z npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
2026-06-01T19:55:27.540899Z npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
2026-06-01T19:55:28.900653Z npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:55:30.196303Z npm warn deprecated glob@10.3.10: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:55:30.98069Z npm warn deprecated @supabase/auth-helpers-nextjs@0.15.0: Package no longer supported. Contact Support at <https://www.npmjs.com/support> for more info.
2026-06-01T19:55:31.11799Z npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:55:34.805464Z npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see <https://eslint.org/version-support> for other options.
2026-06-01T19:56:01.274003Z
2026-06-01T19:56:01.274373Z added 871 packages, and audited 872 packages in 41s
2026-06-01T19:56:01.274478Z
2026-06-01T19:56:01.274553Z 223 packages are looking for funding
2026-06-01T19:56:01.274664Z   run `npm fund` for details
2026-06-01T19:56:01.522124Z
2026-06-01T19:56:01.522412Z 11 vulnerabilities (6 moderate, 5 high)
2026-06-01T19:56:01.52248Z
2026-06-01T19:56:01.522526Z To address issues that do not require attention, run:
2026-06-01T19:56:01.522563Z   npm audit fix
2026-06-01T19:56:01.522609Z
2026-06-01T19:56:01.522654Z To address all issues possible (including breaking changes), run:
2026-06-01T19:56:01.522698Z   npm audit fix --force
2026-06-01T19:56:01.522767Z
2026-06-01T19:56:01.522804Z Some issues need review, and may require choosing
2026-06-01T19:56:01.522836Z a different dependency.
2026-06-01T19:56:01.522883Z
2026-06-01T19:56:01.522941Z Run `npm audit` for details.
2026-06-01T19:56:01.647089Z Executing user command: npx @cloudflare/next-on-pages@1
2026-06-01T19:56:02.946487Z npm warn exec The following package was not found and will be installed: @cloudflare/next-on-pages@1.13.16
2026-06-01T19:56:05.755797Z npm warn deprecated @cloudflare/next-on-pages@1.13.16: Please use the OpenNext adapter instead: <https://opennext.js.org/cloudflare>
2026-06-01T19:56:07.77444Z ⚡️ @cloudflare/next-on-pages CLI v.1.13.16
2026-06-01T19:56:08.002642Z ⚡️ Detected Package Manager: npm (10.9.2)
2026-06-01T19:56:08.002947Z ⚡️ Preparing project...
2026-06-01T19:56:08.007952Z ⚡️ Project is ready
2026-06-01T19:56:08.008173Z ⚡️ Building project...
2026-06-01T19:56:09.17961Z ▲  npm warn exec The following package was not found and will be installed: vercel@54.6.1
2026-06-01T19:56:19.654519Z ▲  npm warn deprecated tar@7.5.7: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <i@izs.me>
2026-06-01T19:56:23.298642Z ▲  Vercel CLI 54.6.1 (Node.js 22.16.0)
2026-06-01T19:56:23.308792Z ▲  > NOTE: The Vercel CLI now collects telemetry regarding usage of the CLI.
2026-06-01T19:56:23.30912Z ▲  > This information is used to shape the CLI roadmap and prioritize features.
2026-06-01T19:56:23.309274Z ▲  > You can learn more, including how to opt-out if you'd not like to participate in this program, by visiting the following URL:
2026-06-01T19:56:23.309898Z ▲  > <https://vercel.com/docs/cli/about-telemetry>
2026-06-01T19:56:23.391145Z ▲  WARNING! Build not running on Vercel. System environment variables will not be available.
2026-06-01T19:56:23.63899Z ▲  Installing dependencies...
2026-06-01T19:56:25.500247Z ▲  up to date in 2s
2026-06-01T19:56:25.50076Z ▲  223 packages are looking for funding
2026-06-01T19:56:25.500912Z ▲  run `npm fund` for details
2026-06-01T19:56:25.517348Z ▲  Detected Next.js version: 14.2.35
2026-06-01T19:56:25.525858Z ▲  Running "npm run build"
2026-06-01T19:56:25.777808Z ▲  > restobook@0.1.0 build
2026-06-01T19:56:25.778159Z ▲  > next build
2026-06-01T19:56:26.426859Z ▲  Attention: Next.js now collects completely anonymous telemetry regarding usage.
2026-06-01T19:56:26.427189Z ▲  This information is used to shape Next.js' roadmap and prioritize features.
2026-06-01T19:56:26.427331Z ▲  You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
2026-06-01T19:56:26.42739Z ▲  <https://nextjs.org/telemetry>
2026-06-01T19:56:26.481448Z ▲  ▲ Next.js 14.2.35
2026-06-01T19:56:26.481721Z ▲  
2026-06-01T19:56:26.551273Z ▲  Creating an optimized production build ...
2026-06-01T19:56:59.462059Z ▲  <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (101kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
2026-06-01T19:56:59.466134Z ▲  <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (231kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
2026-06-01T19:57:19.11335Z ▲  ✓ Compiled successfully
2026-06-01T19:57:19.114952Z ▲  Linting and checking validity of types ...
2026-06-01T19:57:29.037584Z ▲  ./src/app/admin/attendance/page.tsx
2026-06-01T19:57:29.038131Z ▲  6:30  Warning: 'AlertTriangle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038246Z ▲  7:3  Warning: 'Search' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038306Z ▲  7:21  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038362Z ▲  7:35  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038545Z ▲  7:47  Warning: 'MoreVertical' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038605Z ▲  8:16  Warning: 'ShieldX' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038648Z ▲  8:25  Warning: 'ShieldCheck' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038732Z ▲  8:38  Warning: 'TrendingDown' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038818Z ▲  8:52  Warning: 'TrendingUp' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038861Z ▲  9:39  Warning: 'Info' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038915Z ▲  12:18  Warning: 'startOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.038969Z ▲  12:32  Warning: 'endOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.039018Z ▲  18:10  Warning: 'loading' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.039132Z ▲  23:10  Warning: 'search' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.039201Z ▲  23:18  Warning: 'setSearch' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.039251Z ▲  46:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.039315Z ▲  158:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.039399Z ▲  281:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.039497Z ▲  295:78  Warning: 'onViewPhoto' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.039582Z ▲  349:6  Warning: React Hook useEffect has missing dependencies: 'fetchEmployeeData', 'fetchStats', 'onUpdate', and 'supabase'. Either include them or remove the dependency array. If 'onUpdate' changes too often, find the parent component that defines it and wrap that definition in useCallback.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.039656Z ▲  405:18  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.039736Z ▲  583:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.039864Z ▲  759:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.039968Z ▲  
2026-06-01T19:57:29.040012Z ▲  ./src/app/admin/categories/page.tsx
2026-06-01T19:57:29.040051Z ▲  33:6  Warning: React Hook useEffect has missing dependencies: 'fetchCategories' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.040098Z ▲  
2026-06-01T19:57:29.04014Z ▲  ./src/app/admin/customers/page.tsx
2026-06-01T19:57:29.040231Z ▲  6:31  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.040278Z ▲  7:11  Warning: 'Download' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.040319Z ▲  9:3  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.040368Z ▲  92:10  Warning: 'isDeleting' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.040411Z ▲  179:6  Warning: React Hook useEffect has missing dependencies: 'getDurationText', 'message', 'prevDefaultMsg', 'prevDefaultReason', and 'reason'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.040481Z ▲  215:6  Warning: React Hook useEffect has missing dependencies: 'fetchAppeals', 'fetchCustomers', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.041012Z ▲  351:6  Warning: React Hook useEffect has a missing dependency: 'fetchCustomerDetails'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.041303Z ▲  1025:31  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.04149Z ▲  1229:35  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.041706Z ▲  1322:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.041895Z ▲  
2026-06-01T19:57:29.042008Z ▲  ./src/app/admin/dashboard/page.tsx
2026-06-01T19:57:29.042133Z ▲  5:59  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.042479Z ▲  34:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.042685Z ▲  
2026-06-01T19:57:29.042917Z ▲  ./src/app/admin/menu/page.tsx
2026-06-01T19:57:29.043063Z ▲  5:43  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.04326Z ▲  53:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.043486Z ▲  
2026-06-01T19:57:29.043681Z ▲  ./src/app/admin/menu-logs/page.tsx
2026-06-01T19:57:29.043946Z ▲  4:18  Warning: 'AnimatePresence' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.044184Z ▲  37:6  Warning: React Hook useEffect has missing dependencies: 'fetchInitialData', 'fetchLogs', 'fetchMenuItems', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.044441Z ▲  167:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.044714Z ▲  
2026-06-01T19:57:29.044927Z ▲  ./src/app/admin/orders/page.tsx
2026-06-01T19:57:29.04511Z ▲  5:45  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.045438Z ▲  5:53  Warning: 'Clock' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.045729Z ▲  5:60  Warning: 'CheckCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.046003Z ▲  5:73  Warning: 'XCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.046241Z ▲  5:82  Warning: 'ChefHat' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.046392Z ▲  5:91  Warning: 'Truck' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.046539Z ▲  8:10  Warning: 'format' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.046657Z ▲  9:16  Warning: 'localeId' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.046801Z ▲  32:6  Warning: React Hook useEffect has missing dependencies: 'fetchOrders' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.047034Z ▲  126:54  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.047238Z ▲  
2026-06-01T19:57:29.047456Z ▲  ./src/app/admin/payroll/page.tsx
2026-06-01T19:57:29.047628Z ▲  6:33  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.047864Z ▲  6:40  Warning: 'CalendarDays' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.048063Z ▲  7:3  Warning: 'Receipt' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.048287Z ▲  7:49  Warning: 'ChevronDown' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.048413Z ▲  8:21  Warning: 'Plus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.048591Z ▲  8:27  Warning: 'Minus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.04877Z ▲  8:34  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.049011Z ▲  9:3  Warning: 'ArrowLeft' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.049305Z ▲  13:18  Warning: 'startOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.049487Z ▲  13:32  Warning: 'endOfMonth' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.049596Z ▲  16:13  Warning: 'XLSX' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.049711Z ▲  173:118  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.049848Z ▲  277:7  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.050127Z ▲  512:25  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.050258Z ▲  513:22  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.050435Z ▲  727:20  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.050564Z ▲  803:20  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.050673Z ▲  850:12  Warning: 'tableY' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.050806Z ▲  896:12  Warning: 'attY' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.051065Z ▲  929:12  Warning: 'finalY' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.051248Z ▲  999:17  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.051394Z ▲  1029:17  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.051529Z ▲  1490:58  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.051699Z ▲  
2026-06-01T19:57:29.052012Z ▲  ./src/app/admin/refunds/page.tsx
2026-06-01T19:57:29.052185Z ▲  6:73  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.052393Z ▲  6:96  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.052558Z ▲  6:106  Warning: 'User' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.052861Z ▲  8:8  Warning: 'Link' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.053072Z ▲  9:10  Warning: 'format' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.053359Z ▲  10:16  Warning: 'localeId' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.05358Z ▲  38:6  Warning: React Hook useEffect has missing dependencies: 'fetchRefundRequests' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.053791Z ▲  89:18  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.053857Z ▲  313:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.054022Z ▲  390:27  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.05408Z ▲  
2026-06-01T19:57:29.054182Z ▲  ./src/app/admin/reservations/page.tsx
2026-06-01T19:57:29.054286Z ▲  5:70  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.054403Z ▲  52:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.054785Z ▲  67:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.055733Z ▲  
2026-06-01T19:57:29.055916Z ▲  ./src/app/admin/resign/page.tsx
2026-06-01T19:57:29.056088Z ▲  6:3  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.056292Z ▲  7:36  Warning: 'Send' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.056396Z ▲  8:16  Warning: 'Mail' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.056612Z ▲  8:22  Warning: 'Phone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.056838Z ▲  8:29  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.057089Z ▲  8:39  Warning: 'Briefcase' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.05737Z ▲  136:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.057594Z ▲  586:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.057795Z ▲  666:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.058009Z ▲  732:21  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.058192Z ▲  
2026-06-01T19:57:29.058437Z ▲  ./src/app/admin/reviews/page.tsx
2026-06-01T19:57:29.058627Z ▲  58:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.058809Z ▲  235:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.058997Z ▲  
2026-06-01T19:57:29.059157Z ▲  ./src/app/admin/rewards/page.tsx
2026-06-01T19:57:29.059387Z ▲  6:24  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.059597Z ▲  6:34  Warning: 'AlertCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.059764Z ▲  7:3  Warning: 'CheckCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.059969Z ▲  7:16  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.060141Z ▲  8:21  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.060287Z ▲  8:39  Warning: 'ShieldAlert' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.060473Z ▲  9:22  Warning: 'RefreshCcw' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.060707Z ▲  122:6  Warning: React Hook useEffect has missing dependencies: 'fetchRestaurantSettings' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.060883Z ▲  
2026-06-01T19:57:29.061085Z ▲  ./src/app/admin/settings/page.tsx
2026-06-01T19:57:29.061248Z ▲  5:78  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.061375Z ▲  5:90  Warning: 'CreditCard' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.061484Z ▲  75:6  Warning: React Hook useEffect has a missing dependency: 'fetchSettings'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.061605Z ▲  143:68  Warning: 'fileName' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.061671Z ▲  306:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.061763Z ▲  327:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.061841Z ▲  835:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.061908Z ▲  
2026-06-01T19:57:29.061947Z ▲  ./src/app/admin/tables/page.tsx
2026-06-01T19:57:29.061988Z ▲  32:6  Warning: React Hook useEffect has missing dependencies: 'fetchTables' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.06202Z ▲  
2026-06-01T19:57:29.062051Z ▲  ./src/app/admin/transactions/page.tsx
2026-06-01T19:57:29.062082Z ▲  5:10  Warning: 'Download' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062114Z ▲  5:51  Warning: 'DollarSign' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062154Z ▲  39:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.062186Z ▲  
2026-06-01T19:57:29.06222Z ▲  ./src/app/admin/users/page.tsx
2026-06-01T19:57:29.062252Z ▲  5:10  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062282Z ▲  5:81  Warning: 'FileText' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062311Z ▲  5:102  Warning: 'EyeOff' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062342Z ▲  54:6  Warning: React Hook useEffect has missing dependencies: 'fetchUsers' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.062375Z ▲  66:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062424Z ▲  156:9  Warning: 'generateCredentialPDF' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062463Z ▲  331:27  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.062504Z ▲  
2026-06-01T19:57:29.062551Z ▲  ./src/app/admin/vouchers/page.tsx
2026-06-01T19:57:29.062606Z ▲  6:31  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062661Z ▲  7:3  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062754Z ▲  79:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.062814Z ▲  
2026-06-01T19:57:29.062855Z ▲  ./src/app/api/EXPRESS_MIGRATE/route.ts
2026-06-01T19:57:29.062898Z ▲  31:13  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.062946Z ▲  
2026-06-01T19:57:29.063029Z ▲  ./src/app/api/admin/create-employee/route.ts
2026-06-01T19:57:29.063077Z ▲  12:41  Warning: 'listError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.063119Z ▲  28:7  Warning: 'isNewUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.063152Z ▲  
2026-06-01T19:57:29.063181Z ▲  ./src/app/api/admin/customers/bulk/route.ts
2026-06-01T19:57:29.063229Z ▲  34:17  Warning: 'durationParts' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.063284Z ▲  
2026-06-01T19:57:29.063328Z ▲  ./src/app/api/admin/customers/suspend/route.ts
2026-06-01T19:57:29.063434Z ▲  87:11  Warning: 'durationParts' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.063532Z ▲  
2026-06-01T19:57:29.063582Z ▲  ./src/app/api/admin/delete-employee/route.ts
2026-06-01T19:57:29.063622Z ▲  36:22  Warning: 'authError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.063707Z ▲  
2026-06-01T19:57:29.063853Z ▲  ./src/app/api/admin/resign-action/route.ts
2026-06-01T19:57:29.06392Z ▲  343:18  Warning: 'waE' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.063975Z ▲  358:13  Warning: 'fullName' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.06404Z ▲  359:13  Warning: 'phone' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.064085Z ▲  360:13  Warning: 'type' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.064123Z ▲  
2026-06-01T19:57:29.064163Z ▲  ./src/app/api/admin/reviews/route.ts
2026-06-01T19:57:29.064206Z ▲  19:9  Warning: 'profileMap' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.064237Z ▲  
2026-06-01T19:57:29.064269Z ▲  ./src/app/api/admin/rewards/redemptions/route.ts
2026-06-01T19:57:29.064299Z ▲  16:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.064328Z ▲  
2026-06-01T19:57:29.064445Z ▲  ./src/app/api/admin/rewards/route.ts
2026-06-01T19:57:29.064502Z ▲  16:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.064841Z ▲  
2026-06-01T19:57:29.064993Z ▲  ./src/app/api/admin/vouchers/route.ts
2026-06-01T19:57:29.065125Z ▲  4:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.065261Z ▲  
2026-06-01T19:57:29.065677Z ▲  ./src/app/api/auth/callback/route.ts
2026-06-01T19:57:29.06581Z ▲  62:9  Warning: 'next' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.065925Z ▲  
2026-06-01T19:57:29.065983Z ▲  ./src/app/api/cashier/active-shift/route.ts
2026-06-01T19:57:29.066076Z ▲  26:14  Warning: 'migrateErr' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.066139Z ▲  
2026-06-01T19:57:29.066205Z ▲  ./src/app/api/cashier/lock-status/route.ts
2026-06-01T19:57:29.066265Z ▲  90:9  Warning: 'individualShiftEndTime' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.066353Z ▲  
2026-06-01T19:57:29.066415Z ▲  ./src/app/api/create-admin/route.ts
2026-06-01T19:57:29.066452Z ▲  20:23  Warning: 'existingUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.066486Z ▲  
2026-06-01T19:57:29.06652Z ▲  ./src/app/api/customer/claim-welcome-points/route.ts
2026-06-01T19:57:29.066551Z ▲  6:28  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.066581Z ▲  
2026-06-01T19:57:29.066611Z ▲  ./src/app/api/customer/points/route.ts
2026-06-01T19:57:29.066652Z ▲  5:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.066709Z ▲  
2026-06-01T19:57:29.066761Z ▲  ./src/app/api/customer/rewards/route.ts
2026-06-01T19:57:29.066795Z ▲  13:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.066824Z ▲  
2026-06-01T19:57:29.066853Z ▲  ./src/app/api/customer/vouchers/route.ts
2026-06-01T19:57:29.066897Z ▲  5:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.066953Z ▲  
2026-06-01T19:57:29.067011Z ▲  ./src/app/api/customer/wallet/route.ts
2026-06-01T19:57:29.067056Z ▲  5:27  Warning: 'req' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.067106Z ▲  
2026-06-01T19:57:29.067212Z ▲  ./src/app/api/customer/wallet/topup/route.ts
2026-06-01T19:57:29.06727Z ▲  151:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.067323Z ▲  
2026-06-01T19:57:29.067378Z ▲  ./src/app/api/fix-rls/route.ts
2026-06-01T19:57:29.067434Z ▲  386:12  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.067485Z ▲  
2026-06-01T19:57:29.067526Z ▲  ./src/app/api/migrate/route.ts
2026-06-01T19:57:29.067573Z ▲  16:21  Warning: 'testData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.067624Z ▲  
2026-06-01T19:57:29.067689Z ▲  ./src/app/api/payment/callback/route.ts
2026-06-01T19:57:29.067736Z ▲  84:21  Warning: 'order' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.067845Z ▲  97:23  Warning: 'retryData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.067892Z ▲  
2026-06-01T19:57:29.067926Z ▲  ./src/app/api/payment/check-status/route.ts
2026-06-01T19:57:29.067955Z ▲  45:15  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.068001Z ▲  
2026-06-01T19:57:29.068052Z ▲  ./src/app/api/payment/create-invoice/route.ts
2026-06-01T19:57:29.068107Z ▲  50:9  Warning: 'customerDetail' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.068156Z ▲  217:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.068204Z ▲  
2026-06-01T19:57:29.068256Z ▲  ./src/app/api/restobot/route.ts
2026-06-01T19:57:29.068289Z ▲  285:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.068323Z ▲  300:9  Warning: 'emailToSend' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.068444Z ▲  393:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.068506Z ▲  436:9  Warning: 'emailToSend' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.068793Z ▲  654:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.068958Z ▲  841:36  Warning: 'role' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.069125Z ▲  857:9  Warning: 'response' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.06926Z ▲  
2026-06-01T19:57:29.069398Z ▲  ./src/app/api/reviews/route.ts
2026-06-01T19:57:29.06962Z ▲  40:7  Warning: 'profileMap' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.069801Z ▲  
2026-06-01T19:57:29.069959Z ▲  ./src/app/api/send-otp/route.ts
2026-06-01T19:57:29.070094Z ▲  24:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.070276Z ▲  28:25  Warning: 'type' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.07046Z ▲  28:31  Warning: 'method' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.070685Z ▲  
2026-06-01T19:57:29.070932Z ▲  ./src/app/api/upload/route.ts
2026-06-01T19:57:29.071069Z ▲  23:19  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.071177Z ▲  
2026-06-01T19:57:29.071367Z ▲  ./src/app/cashier/attendance/page.tsx
2026-06-01T19:57:29.071508Z ▲  62:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.071637Z ▲  
2026-06-01T19:57:29.071789Z ▲  ./src/app/cashier/dashboard/page.tsx
2026-06-01T19:57:29.071955Z ▲  5:140  Warning: 'Hand' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.072085Z ▲  172:6  Warning: React Hook useEffect has missing dependencies: 'checkShift', 'fetchActiveResign', 'fetchDashboardData', 'fetchLatestAttendance', 'fetchProfile', 'fetchTables', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.072234Z ▲  202:6  Warning: React Hook useEffect has a missing dependency: 'checkShift'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.072385Z ▲  728:6  Warning: React Hook useEffect has a missing dependency: 'handleAutoSuspend'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.072552Z ▲  819:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.072722Z ▲  1113:59  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.07289Z ▲  
2026-06-01T19:57:29.073046Z ▲  ./src/app/cashier/layout.tsx
2026-06-01T19:57:29.073241Z ▲  117:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.073471Z ▲  
2026-06-01T19:57:29.073662Z ▲  ./src/app/cashier/menu/page.tsx
2026-06-01T19:57:29.074018Z ▲  5:27  Warning: 'Ban' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.074472Z ▲  5:32  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.080655Z ▲  46:6  Warning: React Hook useEffect has missing dependencies: 'fetchInitialData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.080731Z ▲  227:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.080786Z ▲  
2026-06-01T19:57:29.080831Z ▲  ./src/app/cashier/online-orders/page.tsx
2026-06-01T19:57:29.080871Z ▲  6:35  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.080906Z ▲  7:3  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.080993Z ▲  7:15  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081037Z ▲  8:3  Warning: 'Volume2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081075Z ▲  8:12  Warning: 'VolumeX' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081108Z ▲  8:35  Warning: 'MapPin' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081153Z ▲  58:6  Warning: React Hook useEffect has missing dependencies: 'fetchCashierName', 'fetchOrders', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.08124Z ▲  146:14  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081293Z ▲  200:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081345Z ▲  268:24  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081407Z ▲  
2026-06-01T19:57:29.081475Z ▲  ./src/app/cashier/orders/page.tsx
2026-06-01T19:57:29.081529Z ▲  5:32  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081562Z ▲  5:42  Warning: 'CreditCard' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081599Z ▲  5:54  Warning: 'Banknote' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081632Z ▲  5:115  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081685Z ▲  5:130  Warning: 'Users' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081783Z ▲  45:6  Warning: React Hook useEffect has missing dependencies: 'fetchCashierName', 'fetchOrders', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.081859Z ▲  167:13  Warning: 'resStatus' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081905Z ▲  181:9  Warning: 'handleGenerateDuitkuLink' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081945Z ▲  198:40  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.081985Z ▲  211:34  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082017Z ▲  216:32  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082049Z ▲  319:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082084Z ▲  
2026-06-01T19:57:29.082126Z ▲  ./src/app/cashier/pos/page.tsx
2026-06-01T19:57:29.082212Z ▲  5:207  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082275Z ▲  5:219  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082314Z ▲  5:241  Warning: 'Globe' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082391Z ▲  5:248  Warning: 'ChevronRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082442Z ▲  11:10  Warning: 'generateQRISString' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082532Z ▲  11:30  Warning: 'getEWalletDeepLink' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082591Z ▲  12:56  Warning: 'getOperationalStatus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082631Z ▲  54:10  Warning: 'onlineSearchMode' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082685Z ▲  54:28  Warning: 'setOnlineSearchMode' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.082735Z ▲  56:10  Warning: 'searchTableNo' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.08315Z ▲  56:25  Warning: 'setSearchTableNo' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.083308Z ▲  70:10  Warning: 'nonCashProvider' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.083512Z ▲  71:10  Warning: 'duitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.083811Z ▲  71:24  Warning: 'setDuitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.083942Z ▲  75:10  Warning: 'merchant' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.084188Z ▲  88:10  Warning: 'txId' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.084384Z ▲  89:10  Warning: 'qrisTimer' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.08454Z ▲  90:10  Warning: 'qrisExpired' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.084679Z ▲  148:6  Warning: React Hook useEffect has missing dependencies: 'processPayment' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.084959Z ▲  150:9  Warning: 'forceCloseDuitku' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.0852Z ▲  165:9  Warning: 'formatTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.085494Z ▲  174:9  Warning: 'receiptKasirRef' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.085693Z ▲  279:6  Warning: React Hook useEffect has missing dependencies: 'fetchInitialData', 'fetchMenuItemsOnly', 'fetchTablesOnly', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.085893Z ▲  365:9  Warning: 'toggleMenuAvailability' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.086081Z ▲  536:9  Warning: 'handleDirectProcessOrder' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.086341Z ▲  583:9  Warning: 'handleCancelOnlineOrder' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.086686Z ▲  639:11  Warning: 'notesStr' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.087049Z ▲  732:19  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.087305Z ▲  738:37  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.087583Z ▲  741:37  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.087887Z ▲  744:35  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.08806Z ▲  763:24  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.088251Z ▲  1167:29  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.088416Z ▲  1293:30  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.088484Z ▲  1338:34  Warning: 'err' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.088894Z ▲  
2026-06-01T19:57:29.089116Z ▲  ./src/app/cashier/queue/page.tsx
2026-06-01T19:57:29.089349Z ▲  26:6  Warning: React Hook useEffect has missing dependencies: 'fetchActiveOrders' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.089655Z ▲  
2026-06-01T19:57:29.089884Z ▲  ./src/app/cashier/reservations/page.tsx
2026-06-01T19:57:29.089964Z ▲  56:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.090039Z ▲  74:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.090114Z ▲  163:13  Warning: 'profileId' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.09019Z ▲  
2026-06-01T19:57:29.090253Z ▲  ./src/app/cashier/tables/page.tsx
2026-06-01T19:57:29.090312Z ▲  27:9  Warning: 'clean' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.090376Z ▲  96:6  Warning: React Hook useEffect has missing dependencies: 'fetchSettings', 'fetchTables', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.090453Z ▲  
2026-06-01T19:57:29.090514Z ▲  ./src/app/cashier/transactions/page.tsx
2026-06-01T19:57:29.090572Z ▲  5:70  Warning: 'Download' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.090618Z ▲  37:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.090662Z ▲  
2026-06-01T19:57:29.090736Z ▲  ./src/app/customer/cart/page.tsx
2026-06-01T19:57:29.090812Z ▲  5:111  Warning: 'Smartphone' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.090909Z ▲  5:123  Warning: 'Landmark' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.090958Z ▲  5:133  Warning: 'QrCode' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091004Z ▲  5:169  Warning: 'RefreshCw' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091056Z ▲  5:183  Warning: 'Receipt' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091101Z ▲  5:192  Warning: 'Sparkles' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091145Z ▲  5:202  Warning: 'ChevronRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091191Z ▲  5:216  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091234Z ▲  11:10  Warning: 'generateQRISString' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091278Z ▲  11:30  Warning: 'getEWalletDeepLink' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091348Z ▲  12:10  Warning: 'isRestaurantOpen' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091458Z ▲  12:28  Warning: 'getOperationalStatus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091546Z ▲  101:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.091629Z ▲  144:10  Warning: 'duitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091703Z ▲  144:24  Warning: 'setDuitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091795Z ▲  147:10  Warning: 'currentTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091873Z ▲  155:27  Warning: 'setNonCashCategory' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.091967Z ▲  156:10  Warning: 'selectedProvider' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.092032Z ▲  156:28  Warning: 'setSelectedProvider' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.092112Z ▲  169:10  Warning: 'qrisTimer' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.092204Z ▲  170:10  Warning: 'qrisExpired' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.092289Z ▲  318:10  Warning: 'merchant' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.092336Z ▲  331:10  Warning: 'txId' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.092391Z ▲  439:6  Warning: React Hook useEffect has missing dependencies: 'fetchProfile' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.092499Z ▲  471:6  Warning: React Hook useEffect has missing dependencies: 'fetchTables' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.093507Z ▲  493:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.093739Z ▲  503:20  Warning: 't' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.093975Z ▲  519:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.094167Z ▲  527:16  Warning: 't' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.094423Z ▲  583:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.094634Z ▲  651:9  Warning: 'formatTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.094871Z ▲  657:9  Warning: 'handleProcessPayment' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.095077Z ▲  750:15  Warning: 'dbPaymentMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.095303Z ▲  
2026-06-01T19:57:29.095514Z ▲  ./src/app/customer/dashboard/page.tsx
2026-06-01T19:57:29.095835Z ▲  53:6  Warning: React Hook useEffect has missing dependencies: 'fetchDashboardData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.096095Z ▲  
2026-06-01T19:57:29.096311Z ▲  ./src/app/customer/favorites/page.tsx
2026-06-01T19:57:29.096542Z ▲  5:17  Warning: 'ShoppingBag' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.096814Z ▲  5:38  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.097097Z ▲  34:6  Warning: React Hook useEffect has missing dependencies: 'fetchFavorites' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.097347Z ▲  
2026-06-01T19:57:29.097561Z ▲  ./src/app/customer/menu/page.tsx
2026-06-01T19:57:29.097904Z ▲  5:44  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.098251Z ▲  5:58  Warning: 'X' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.098612Z ▲  5:61  Warning: 'UtensilsCrossed' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.098853Z ▲  70:6  Warning: React Hook useEffect has missing dependencies: 'fetchData', 'fetchMenuItemsOnly', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.099154Z ▲  
2026-06-01T19:57:29.099341Z ▲  ./src/app/customer/notifications/page.tsx
2026-06-01T19:57:29.099573Z ▲  5:28  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.099693Z ▲  39:6  Warning: React Hook useEffect has missing dependencies: 'fetchNotifs' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.099803Z ▲  
2026-06-01T19:57:29.09988Z ▲  ./src/app/customer/orders/[id]/page.tsx
2026-06-01T19:57:29.09995Z ▲  7:96  Warning: 'Banknote' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.100073Z ▲  7:181  Warning: 'MessageSquare' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.100155Z ▲  7:196  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.100238Z ▲  47:10  Warning: 'showPaymentSelector' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.100343Z ▲  47:31  Warning: 'setShowPaymentSelector' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.100425Z ▲  48:10  Warning: 'duitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.1005Z ▲  48:24  Warning: 'setDuitkuMethod' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.10063Z ▲  91:6  Warning: React Hook useEffect has missing dependencies: 'fetchProfile' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.100732Z ▲  225:6  Warning: React Hook useEffect has missing dependencies: 'fetchOrderDetails' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.100897Z ▲  240:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.101024Z ▲  328:6  Warning: React Hook useEffect has a missing dependency: 'handleAutoCancel'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.101191Z ▲  391:40  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.101341Z ▲  472:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.101433Z ▲  571:9  Warning: 'getStatusIcon' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.101523Z ▲  620:9  Warning: 'canCancel' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.101608Z ▲  629:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.101754Z ▲  749:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.101954Z ▲  
2026-06-01T19:57:29.102174Z ▲  ./src/app/customer/orders/page.tsx
2026-06-01T19:57:29.102304Z ▲  5:23  Warning: 'Loader2' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.102526Z ▲  32:6  Warning: React Hook useEffect has missing dependencies: 'fetchOrders' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.102768Z ▲  121:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.103063Z ▲  
2026-06-01T19:57:29.103265Z ▲  ./src/app/customer/reservations/page.tsx
2026-06-01T19:57:29.103515Z ▲  67:6  Warning: React Hook useEffect has missing dependencies: 'fetchData' and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.103627Z ▲  207:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.103698Z ▲  
2026-06-01T19:57:29.103778Z ▲  ./src/app/customer/rewards/page.tsx
2026-06-01T19:57:29.10384Z ▲  6:24  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.103895Z ▲  7:16  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.103951Z ▲  7:48  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.104107Z ▲  8:42  Warning: 'CreditCard' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.104245Z ▲  31:10  Warning: 'tick' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.104341Z ▲  60:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.104442Z ▲  
2026-06-01T19:57:29.10471Z ▲  ./src/app/customer/vouchers/page.tsx
2026-06-01T19:57:29.104905Z ▲  4:18  Warning: 'AnimatePresence' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.10503Z ▲  6:17  Warning: 'Calendar' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.105108Z ▲  6:27  Warning: 'AlertCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.105173Z ▲  7:3  Warning: 'CheckCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.105239Z ▲  7:16  Warning: 'HelpCircle' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.105309Z ▲  7:48  Warning: 'ArrowRight' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.105378Z ▲  46:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.105443Z ▲  
2026-06-01T19:57:29.105509Z ▲  ./src/app/customer/wallet/page.tsx
2026-06-01T19:57:29.107521Z ▲  8:33  Warning: 'Filter' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.107652Z ▲  8:47  Warning: 'DollarSign' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.107724Z ▲  8:62  Warning: 'Check' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.107818Z ▲  9:53  Warning: 'Key' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.107959Z ▲  56:10  Warning: 'isDuitkuOpen' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.108158Z ▲  69:10  Warning: 'otpSent' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.108236Z ▲  109:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.108307Z ▲  351:40  Warning: 'result' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.108373Z ▲  1295:6  Warning: React Hook useEffect has a missing dependency: 'onExpire'. Either include it or remove the dependency array. If 'onExpire' changes too often, find the parent component that defines it and wrap that definition in useCallback.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.108452Z ▲  
2026-06-01T19:57:29.108782Z ▲  ./src/app/forgot-password/page.tsx
2026-06-01T19:57:29.109183Z ▲  19:10  Warning: 'method' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.109432Z ▲  
2026-06-01T19:57:29.109624Z ▲  ./src/app/login/page.tsx
2026-06-01T19:57:29.10988Z ▲  5:143  Warning: 'ShieldAlert' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.110042Z ▲  35:9  Warning: 'timer' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.110249Z ▲  90:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.110532Z ▲  138:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.11069Z ▲  369:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.110897Z ▲  392:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.111104Z ▲  
2026-06-01T19:57:29.111346Z ▲  ./src/app/page.tsx
2026-06-01T19:57:29.111574Z ▲  4:38  Warning: 'Clock' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.111792Z ▲  10:10  Warning: 'isRestaurantOpen' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.112004Z ▲  10:28  Warning: 'getOperationalStatus' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.112218Z ▲  64:10  Warning: 'currentTime' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.11242Z ▲  255:6  Warning: React Hook useEffect has missing dependencies: 'fetchMenu', 'fetchSettings', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.112709Z ▲  312:25  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.113001Z ▲  
2026-06-01T19:57:29.113233Z ▲  ./src/app/register/page.tsx
2026-06-01T19:57:29.113557Z ▲  15:9  Warning: 'router' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.113829Z ▲  
2026-06-01T19:57:29.114106Z ▲  ./src/components/AppSplashScreen.tsx
2026-06-01T19:57:29.11432Z ▲  33:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.114514Z ▲  76:17  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.114797Z ▲  
2026-06-01T19:57:29.115253Z ▲  ./src/components/AutoTableStatusManager.tsx
2026-06-01T19:57:29.115638Z ▲  24:6  Warning: React Hook useEffect has a missing dependency: 'supabase.auth'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.115813Z ▲  148:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.11591Z ▲  
2026-06-01T19:57:29.115967Z ▲  ./src/components/ConnectionDetector.tsx
2026-06-01T19:57:29.116025Z ▲  32:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.116072Z ▲  69:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.116137Z ▲  94:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.116189Z ▲  
2026-06-01T19:57:29.11645Z ▲  ./src/components/DynamicFavicon.tsx
2026-06-01T19:57:29.116505Z ▲  36:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.116855Z ▲  68:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.117091Z ▲  
2026-06-01T19:57:29.117349Z ▲  ./src/components/PaymentMethodSelector.tsx
2026-06-01T19:57:29.117554Z ▲  100:23  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.118371Z ▲  
2026-06-01T19:57:29.118627Z ▲  ./src/components/Receipt.tsx
2026-06-01T19:57:29.118995Z ▲  5:10  Warning: 'format' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.119311Z ▲  6:16  Warning: 'localeId' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.119495Z ▲  45:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.119736Z ▲  
2026-06-01T19:57:29.11994Z ▲  ./src/components/RestoBot.tsx
2026-06-01T19:57:29.120204Z ▲  276:10  Warning: 'sessionUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.120469Z ▲  617:6  Warning: React Hook useEffect has a missing dependency: 'checkAndShowNotifications'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.120806Z ▲  896:14  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.121158Z ▲  
2026-06-01T19:57:29.12149Z ▲  ./src/components/cashier/AttendanceModal.tsx
2026-06-01T19:57:29.121689Z ▲  4:18  Warning: 'AnimatePresence' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.121896Z ▲  32:6  Warning: React Hook useEffect has a missing dependency: 'stopCamera'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.122024Z ▲  118:21  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.122107Z ▲  200:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.122181Z ▲  
2026-06-01T19:57:29.122243Z ▲  ./src/components/layout/DashboardLayout.tsx
2026-06-01T19:57:29.122361Z ▲  8:95  Warning: 'Lock' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.12243Z ▲  8:101  Warning: 'ShieldAlert' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.122478Z ▲  8:114  Warning: 'TrendingUp' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.1227Z ▲  8:126  Warning: 'Zap' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.12285Z ▲  82:6  Warning: React Hook useEffect has missing dependencies: 'checkUser', 'fetchOnlineOrderCount', 'playNotifSound', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.123029Z ▲  119:6  Warning: React Hook useEffect has missing dependencies: 'fetchUnreadNotifCount', 'playSingleNotifSound', and 'supabase'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.123101Z ▲  140:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.123158Z ▲  182:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.123221Z ▲  192:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.123281Z ▲  414:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.123339Z ▲  
2026-06-01T19:57:29.123395Z ▲  ./src/components/profile/ProfileContent.tsx
2026-06-01T19:57:29.12348Z ▲  221:40  Warning: React Hook useEffect has a missing dependency: 'fetchProfile'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.123575Z ▲  247:6  Warning: React Hook useEffect has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
2026-06-01T19:57:29.123633Z ▲  568:31  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: <https://nextjs.org/docs/messages/no-img-element>  @next/next/no-img-element
2026-06-01T19:57:29.12368Z ▲  
2026-06-01T19:57:29.123763Z ▲  ./src/lib/md5.ts
2026-06-01T19:57:29.123859Z ▲  6:12  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.123923Z ▲  
2026-06-01T19:57:29.123976Z ▲  ./src/lib/sendReceiptEmail.ts
2026-06-01T19:57:29.124099Z ▲  106:9  Warning: 'pdfBase64' is assigned a value but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.124165Z ▲  106:9  Warning: 'pdfBase64' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.124211Z ▲  
2026-06-01T19:57:29.125054Z ▲  ./src/utils/operationalHours.ts
2026-06-01T19:57:29.12528Z ▲  77:12  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
2026-06-01T19:57:29.125562Z ▲  
2026-06-01T19:57:29.125852Z ▲  ./src/utils/qris.ts
2026-06-01T19:57:29.126137Z ▲  22:7  Warning: 'hex' is never reassigned. Use 'const' instead.  prefer-const
2026-06-01T19:57:29.126451Z ▲  
2026-06-01T19:57:29.126672Z ▲  info  - Need to disable some ESLint rules? Learn more here: <https://nextjs.org/docs/basic-features/eslint#disabling-rules>
2026-06-01T19:57:41.356041Z ▲  Collecting page data ...
2026-06-01T19:57:44.7065Z ▲  Generating static pages (0/108) ...
2026-06-01T19:57:46.66202Z ▲  Migration Error via RPC: {
2026-06-01T19:57:46.662277Z ▲  code: 'PGRST202',
2026-06-01T19:57:46.66234Z ▲  details: 'Searched for the function public.exec_sql with parameter sql or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
2026-06-01T19:57:46.662405Z ▲  hint: 'Perhaps you meant to call the function public.exec_sql(sql_string)',
2026-06-01T19:57:46.662447Z ▲  message: 'Could not find the function public.exec_sql(sql) in the schema cache'
2026-06-01T19:57:46.662482Z ▲  }
2026-06-01T19:57:46.949243Z ▲  Customer fetch vouchers error: n [Error]: Dynamic server usage: Route /api/customer/vouchers couldn't be rendered statically because it used `cookies`. See more info here: <https://nextjs.org/docs/messages/dynamic-server-error>
2026-06-01T19:57:46.950603Z ▲    at l (/opt/buildhome/repo/.next/server/chunks/8948.js:1:37220)
2026-06-01T19:57:46.950751Z ▲    at f (/opt/buildhome/repo/.next/server/chunks/6400.js:23:9433)
2026-06-01T19:57:46.951073Z ▲    at i (/opt/buildhome/repo/.next/server/app/api/customer/rewards/claim-cashback/route.js:1:6464)
2026-06-01T19:57:46.951635Z ▲    at d (/opt/buildhome/repo/.next/server/app/api/customer/vouchers/route.js:1:842)
2026-06-01T19:57:46.951739Z ▲    at /opt/buildhome/repo/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
2026-06-01T19:57:46.951803Z ▲    at /opt/buildhome/repo/node_modules/next/dist/server/lib/trace/tracer.js:140:36
2026-06-01T19:57:46.951865Z ▲    at NoopContextManager.with (/opt/buildhome/repo/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
2026-06-01T19:57:46.951955Z ▲    at ContextAPI.with (/opt/buildhome/repo/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518)
2026-06-01T19:57:46.952Z ▲    at NoopTracer.startActiveSpan (/opt/buildhome/repo/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18093)
2026-06-01T19:57:46.952044Z ▲    at ProxyTracer.startActiveSpan (/opt/buildhome/repo/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18854) {
2026-06-01T19:57:46.952089Z ▲  description: "Route /api/customer/vouchers couldn't be rendered statically because it used `cookies`. See more info here: <https://nextjs.org/docs/messages/dynamic-server-error>",
2026-06-01T19:57:46.952133Z ▲  digest: 'DYNAMIC_SERVER_USAGE'
2026-06-01T19:57:46.952178Z ▲  }
2026-06-01T19:57:46.964434Z ▲  Generating static pages (27/108)
2026-06-01T19:57:47.347073Z ▲  Create admin error: tu [AuthApiError]: A user with this email address has already been registered
2026-06-01T19:57:47.347362Z ▲    at t2 (/opt/buildhome/repo/.next/server/chunks/3370.js:24:42155)
2026-06-01T19:57:47.347477Z ▲    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
2026-06-01T19:57:47.347547Z ▲    at async t4 (/opt/buildhome/repo/.next/server/chunks/3370.js:24:43154)
2026-06-01T19:57:47.34761Z ▲    at async t8 (/opt/buildhome/repo/.next/server/chunks/3370.js:24:42810)
2026-06-01T19:57:47.34767Z ▲    at async rs.createUser (/opt/buildhome/repo/.next/server/chunks/3370.js:24:46278)
2026-06-01T19:57:47.347736Z ▲    at async d (/opt/buildhome/repo/.next/server/app/api/create-admin/route.js:1:605)
2026-06-01T19:57:47.347809Z ▲    at async /opt/buildhome/repo/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38411
2026-06-01T19:57:47.347871Z ▲    at async e_.execute (/opt/buildhome/repo/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:27880)
2026-06-01T19:57:47.347927Z ▲    at async e_.handle (/opt/buildhome/repo/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:39943)
2026-06-01T19:57:47.347993Z ▲    at async exportAppRoute (/opt/buildhome/repo/node_modules/next/dist/export/routes/app-route.js:77:26) {
2026-06-01T19:57:47.348053Z ▲  __isAuthError: true,
2026-06-01T19:57:47.348116Z ▲  status: 422,
2026-06-01T19:57:47.34817Z ▲  code: 'email_exists'
2026-06-01T19:57:47.348221Z ▲  }
2026-06-01T19:57:48.468877Z ▲  Generating static pages (54/108)
2026-06-01T19:57:49.422728Z ▲  Generating static pages (81/108)
2026-06-01T19:57:51.170621Z ▲  ✓ Generating static pages (108/108)
2026-06-01T19:57:51.386473Z ▲  Finalizing page optimization ...
2026-06-01T19:57:51.387465Z ▲  Collecting build traces ...
2026-06-01T19:57:54.933181Z ▲  
2026-06-01T19:57:54.966933Z ▲  Route (app)                               Size     First Load JS
2026-06-01T19:57:54.967264Z ▲  ┌ ○ /                                     11.3 kB         223 kB
2026-06-01T19:57:54.967736Z ▲  ├ ○ /_not-found                           143 B          87.8 kB
2026-06-01T19:57:54.967928Z ▲  ├ ○ /admin/attendance                     15.5 kB         219 kB
2026-06-01T19:57:54.968014Z ▲  ├ ○ /admin/categories                     3.27 kB         203 kB
2026-06-01T19:57:54.968207Z ▲  ├ ○ /admin/customers                      18.4 kB         222 kB
2026-06-01T19:57:54.968319Z ▲  ├ ○ /admin/dashboard                      3.62 kB         316 kB
2026-06-01T19:57:54.968391Z ▲  ├ ○ /admin/menu                           4.99 kB         210 kB
2026-06-01T19:57:54.968463Z ▲  ├ ○ /admin/menu-logs                      4.14 kB         201 kB
2026-06-01T19:57:54.968567Z ▲  ├ ○ /admin/orders                         5.04 kB         202 kB
2026-06-01T19:57:54.96866Z ▲  ├ ○ /admin/payroll                        23 kB           360 kB
2026-06-01T19:57:54.968709Z ▲  ├ ○ /admin/profile                        267 B           210 kB
2026-06-01T19:57:54.968744Z ▲  ├ ○ /admin/refunds                        8.59 kB         206 kB
2026-06-01T19:57:54.968777Z ▲  ├ ○ /admin/reservations                   8.53 kB         212 kB
2026-06-01T19:57:54.968808Z ▲  ├ ○ /admin/resign                         15.7 kB         219 kB
2026-06-01T19:57:54.96884Z ▲  ├ ○ /admin/reviews                        6.23 kB         210 kB
2026-06-01T19:57:54.96887Z ▲  ├ ○ /admin/rewards                        14.2 kB         327 kB
2026-06-01T19:57:54.968901Z ▲  ├ ○ /admin/settings                       14.1 kB         214 kB
2026-06-01T19:57:54.968932Z ▲  ├ ○ /admin/tables                         3.19 kB         203 kB
2026-06-01T19:57:54.968964Z ▲  ├ ○ /admin/transactions                   7.41 kB         543 kB
2026-06-01T19:57:54.969001Z ▲  ├ ○ /admin/users                          7.66 kB         339 kB
2026-06-01T19:57:54.969032Z ▲  ├ ○ /admin/vouchers                       9.09 kB         212 kB
2026-06-01T19:57:54.969062Z ▲  ├ ƒ /api/admin/create-employee            0 B                0 B
2026-06-01T19:57:54.969092Z ▲  ├ ƒ /api/admin/customers/appeal           0 B                0 B
2026-06-01T19:57:54.969123Z ▲  ├ ƒ /api/admin/customers/bulk             0 B                0 B
2026-06-01T19:57:54.969157Z ▲  ├ ƒ /api/admin/customers/points           0 B                0 B
2026-06-01T19:57:54.969188Z ▲  ├ ƒ /api/admin/customers/suspend          0 B                0 B
2026-06-01T19:57:54.969221Z ▲  ├ ƒ /api/admin/customers/update           0 B                0 B
2026-06-01T19:57:54.969254Z ▲  ├ ƒ /api/admin/customers/warning          0 B                0 B
2026-06-01T19:57:54.969285Z ▲  ├ ƒ /api/admin/delete-employee            0 B                0 B
2026-06-01T19:57:54.969317Z ▲  ├ ƒ /api/admin/get-all-shifts             0 B                0 B
2026-06-01T19:57:54.969348Z ▲  ├ ○ /api/admin/migrate-payroll            0 B                0 B
2026-06-01T19:57:54.969379Z ▲  ├ ƒ /api/admin/reset-employee-password    0 B                0 B
2026-06-01T19:57:54.969524Z ▲  ├ ƒ /api/admin/resign-action              0 B                0 B
2026-06-01T19:57:54.969608Z ▲  ├ ƒ /api/admin/reviews                    0 B                0 B
2026-06-01T19:57:54.969717Z ▲  ├ ƒ /api/admin/rewards                    0 B                0 B
2026-06-01T19:57:54.969775Z ▲  ├ ƒ /api/admin/rewards/redemptions        0 B                0 B
2026-06-01T19:57:54.969822Z ▲  ├ ƒ /api/admin/send-payslip               0 B                0 B
2026-06-01T19:57:54.969867Z ▲  ├ ƒ /api/admin/settings/points            0 B                0 B
2026-06-01T19:57:54.969928Z ▲  ├ ƒ /api/admin/vouchers                   0 B                0 B
2026-06-01T19:57:54.969972Z ▲  ├ ƒ /api/attendance                       0 B                0 B
2026-06-01T19:57:54.970015Z ▲  ├ ƒ /api/attendance/leave                 0 B                0 B
2026-06-01T19:57:54.970051Z ▲  ├ ƒ /api/attendance/status                0 B                0 B
2026-06-01T19:57:54.9701Z ▲  ├ ƒ /api/auth/callback                    0 B                0 B
2026-06-01T19:57:54.970159Z ▲  ├ ƒ /api/auth/logout                      0 B                0 B
2026-06-01T19:57:54.970214Z ▲  ├ ƒ /api/cashier/active-shift             0 B                0 B
2026-06-01T19:57:54.970265Z ▲  ├ ƒ /api/cashier/lock-status              0 B                0 B
2026-06-01T19:57:54.970318Z ▲  ├ ƒ /api/create-admin                     0 B                0 B
2026-06-01T19:57:54.970374Z ▲  ├ ƒ /api/customer/claim-welcome-points    0 B                0 B
2026-06-01T19:57:54.970415Z ▲  ├ ƒ /api/customer/points                  0 B                0 B
2026-06-01T19:57:54.970447Z ▲  ├ ƒ /api/customer/rewards                 0 B                0 B
2026-06-01T19:57:54.970479Z ▲  ├ ƒ /api/customer/rewards/claim-cashback  0 B                0 B
2026-06-01T19:57:54.970511Z ▲  ├ ƒ /api/customer/rewards/redeem          0 B                0 B
2026-06-01T19:57:54.970546Z ▲  ├ ƒ /api/customer/vouchers                0 B                0 B
2026-06-01T19:57:54.970576Z ▲  ├ ƒ /api/customer/vouchers/apply          0 B                0 B
2026-06-01T19:57:54.970613Z ▲  ├ ƒ /api/customer/wallet                  0 B                0 B
2026-06-01T19:57:54.970659Z ▲  ├ ƒ /api/customer/wallet/pin              0 B                0 B
2026-06-01T19:57:54.970691Z ▲  ├ ƒ /api/customer/wallet/topup            0 B                0 B
2026-06-01T19:57:54.97073Z ▲  ├ ○ /api/debug-payroll                    0 B                0 B
2026-06-01T19:57:54.970807Z ▲  ├ ƒ /api/debug-schema                     0 B                0 B
2026-06-01T19:57:54.970861Z ▲  ├ ƒ /api/debug-shifts                     0 B                0 B
2026-06-01T19:57:54.97091Z ▲  ├ ƒ /api/EXPRESS_MIGRATE                  0 B                0 B
2026-06-01T19:57:54.970942Z ▲  ├ ƒ /api/fix-rls                          0 B                0 B
2026-06-01T19:57:54.970972Z ▲  ├ ○ /api/inspect-db                       0 B                0 B
2026-06-01T19:57:54.971002Z ▲  ├ ○ /api/install-logo                     0 B                0 B
2026-06-01T19:57:54.971043Z ▲  ├ ƒ /api/migrate                          0 B                0 B
2026-06-01T19:57:54.971094Z ▲  ├ ○ /api/MIGRATE_SHIFTS                   0 B                0 B
2026-06-01T19:57:54.97113Z ▲  ├ ƒ /api/orders                           0 B                0 B
2026-06-01T19:57:54.971161Z ▲  ├ ƒ /api/orders/merge                     0 B                0 B
2026-06-01T19:57:54.971272Z ▲  ├ ƒ /api/orders/split                     0 B                0 B
2026-06-01T19:57:54.971312Z ▲  ├ ƒ /api/payment/callback                 0 B                0 B
2026-06-01T19:57:54.971373Z ▲  ├ ƒ /api/payment/check-status             0 B                0 B
2026-06-01T19:57:54.971411Z ▲  ├ ƒ /api/payment/create-invoice           0 B                0 B
2026-06-01T19:57:54.971446Z ▲  ├ ƒ /api/payment/debug                    0 B                0 B
2026-06-01T19:57:54.971476Z ▲  ├ ƒ /api/payment/methods                  0 B                0 B
2026-06-01T19:57:54.971506Z ▲  ├ ƒ /api/profile                          0 B                0 B
2026-06-01T19:57:54.971537Z ▲  ├ ƒ /api/profile/change-password          0 B                0 B
2026-06-01T19:57:54.971576Z ▲  ├ ƒ /api/profile/delete                   0 B                0 B
2026-06-01T19:57:54.971613Z ▲  ├ ƒ /api/profile/send-otp                 0 B                0 B
2026-06-01T19:57:54.971675Z ▲  ├ ƒ /api/profiles/block                   0 B                0 B
2026-06-01T19:57:54.971736Z ▲  ├ ƒ /api/register                         0 B                0 B
2026-06-01T19:57:54.971799Z ▲  ├ ƒ /api/reset-password                   0 B                0 B
2026-06-01T19:57:54.97185Z ▲  ├ ƒ /api/restobot                         0 B                0 B
2026-06-01T19:57:54.971912Z ▲  ├ ƒ /api/reviews                          0 B                0 B
2026-06-01T19:57:54.971949Z ▲  ├ ƒ /api/reviews/publish                  0 B                0 B
2026-06-01T19:57:54.972136Z ▲  ├ ƒ /api/seed                             0 B                0 B
2026-06-01T19:57:54.972186Z ▲  ├ ƒ /api/send-notification                0 B                0 B
2026-06-01T19:57:54.972223Z ▲  ├ ƒ /api/send-otp                         0 B                0 B
2026-06-01T19:57:54.972263Z ▲  ├ ƒ /api/send-receipt                     0 B                0 B
2026-06-01T19:57:54.972312Z ▲  ├ ○ /api/test-db                          0 B                0 B
2026-06-01T19:57:54.972346Z ▲  ├ ○ /api/test-duitku                      0 B                0 B
2026-06-01T19:57:54.972377Z ▲  ├ ○ /api/test-pdf                         0 B                0 B
2026-06-01T19:57:54.972406Z ▲  ├ ƒ /api/upload                           0 B                0 B
2026-06-01T19:57:54.972444Z ▲  ├ ƒ /api/verify-otp                       0 B                0 B
2026-06-01T19:57:54.972482Z ▲  ├ ○ /cashier/attendance                   4.4 kB          162 kB
2026-06-01T19:57:54.972543Z ▲  ├ ○ /cashier/dashboard                    20.6 kB         224 kB
2026-06-01T19:57:54.972604Z ▲  ├ ○ /cashier/menu                         6.19 kB         203 kB
2026-06-01T19:57:54.97277Z ▲  ├ ○ /cashier/online-orders                12.2 kB         358 kB
2026-06-01T19:57:54.972908Z ▲  ├ ○ /cashier/orders                       10.4 kB         351 kB
2026-06-01T19:57:54.973057Z ▲  ├ ○ /cashier/pos                          17.6 kB         226 kB
2026-06-01T19:57:54.973165Z ▲  ├ ○ /cashier/profile                      267 B           210 kB
2026-06-01T19:57:54.973266Z ▲  ├ ○ /cashier/queue                        3.91 kB         201 kB
2026-06-01T19:57:54.973354Z ▲  ├ ○ /cashier/reservations                 10.1 kB         213 kB
2026-06-01T19:57:54.973425Z ▲  ├ ○ /cashier/tables                       3.25 kB         201 kB
2026-06-01T19:57:54.973535Z ▲  ├ ○ /cashier/transactions                 9.35 kB         443 kB
2026-06-01T19:57:54.973614Z ▲  ├ ○ /customer/cart                        13.9 kB         220 kB
2026-06-01T19:57:54.97373Z ▲  ├ ○ /customer/dashboard                   9.05 kB         221 kB
2026-06-01T19:57:54.973846Z ▲  ├ ○ /customer/favorites                   3.02 kB         209 kB
2026-06-01T19:57:54.973957Z ▲  ├ ○ /customer/menu                        5.07 kB         211 kB
2026-06-01T19:57:54.974019Z ▲  ├ ○ /customer/notifications               5.68 kB         209 kB
2026-06-01T19:57:54.974061Z ▲  ├ ○ /customer/orders                      8.69 kB         216 kB
2026-06-01T19:57:54.9741Z ▲  ├ ƒ /customer/orders/[id]                 17.2 kB         372 kB
2026-06-01T19:57:54.974139Z ▲  ├ ○ /customer/profile                     266 B           210 kB
2026-06-01T19:57:54.974171Z ▲  ├ ○ /customer/reservations                11.2 kB         215 kB
2026-06-01T19:57:54.9742Z ▲  ├ ○ /customer/rewards                     16.7 kB         220 kB
2026-06-01T19:57:54.974235Z ▲  ├ ○ /customer/vouchers                    5.03 kB         208 kB
2026-06-01T19:57:54.974266Z ▲  ├ ○ /customer/wallet                      16.2 kB         220 kB
2026-06-01T19:57:54.9743Z ▲  ├ ○ /forgot-password                      5.3 kB          148 kB
2026-06-01T19:57:54.974333Z ▲  ├ ○ /login                                9.64 kB         220 kB
2026-06-01T19:57:54.974364Z ▲  ├ ○ /register                             5.02 kB         215 kB
2026-06-01T19:57:54.974395Z ▲  ├ ○ /robots.txt                           0 B                0 B
2026-06-01T19:57:54.974426Z ▲  ├ ○ /sitemap.xml                          0 B                0 B
2026-06-01T19:57:54.974461Z ▲  └ ○ /unauthorized                         1.69 kB         194 kB
2026-06-01T19:57:54.974495Z ▲  + First Load JS shared by all             87.7 kB
2026-06-01T19:57:54.974529Z ▲  ├ chunks/2117-20fec979d5131312.js       31.9 kB
2026-06-01T19:57:54.97456Z ▲  ├ chunks/fd9d1056-d080418b1f0ac0dd.js   53.6 kB
2026-06-01T19:57:54.97459Z ▲  └ other shared chunks (total)           2.15 kB
2026-06-01T19:57:54.974629Z ▲  
2026-06-01T19:57:54.974662Z ▲  
2026-06-01T19:57:54.9747Z ▲  ƒ Middleware                              82.8 kB
2026-06-01T19:57:54.974751Z ▲  ○  (Static)   prerendered as static content
2026-06-01T19:57:54.974842Z ▲  ƒ  (Dynamic)  server-rendered on demand
2026-06-01T19:57:55.319971Z ▲  Traced Next.js server files in: 63.487ms
2026-06-01T19:57:55.638196Z ▲  Created all serverless functions in: 317.912ms
2026-06-01T19:57:55.806801Z ▲  Collected static files (public/, static/, .next/static): 47.278ms
2026-06-01T19:57:55.993884Z ▲  Build Completed in .vercel/output [2m]
2026-06-01T19:57:56.335759Z ⚡️ Completed `npx vercel build`.
2026-06-01T19:57:57.58915Z
2026-06-01T19:57:57.589518Z ⚡️ ERROR: Failed to produce a Cloudflare Pages build from the project.
2026-06-01T19:57:57.589628Z ⚡️
2026-06-01T19:57:57.589747Z ⚡️  The following routes were not configured to run with the Edge Runtime:
2026-06-01T19:57:57.589842Z ⚡️    - /api/EXPRESS_MIGRATE
2026-06-01T19:57:57.589943Z ⚡️    - /api/admin/create-employee
2026-06-01T19:57:57.590057Z ⚡️    - /api/admin/customers/appeal
2026-06-01T19:57:57.590149Z ⚡️    - /api/admin/customers/bulk
2026-06-01T19:57:57.590224Z ⚡️    - /api/admin/customers/points
2026-06-01T19:57:57.590463Z ⚡️    - /api/admin/customers/suspend
2026-06-01T19:57:57.590515Z ⚡️    - /api/admin/customers/update
2026-06-01T19:57:57.592559Z ⚡️    - /api/admin/customers/warning
2026-06-01T19:57:57.592678Z ⚡️    - /api/admin/delete-employee
2026-06-01T19:57:57.592783Z ⚡️    - /api/admin/get-all-shifts
2026-06-01T19:57:57.592842Z ⚡️    - /api/admin/reset-employee-password
2026-06-01T19:57:57.592891Z ⚡️    - /api/admin/resign-action
2026-06-01T19:57:57.592949Z ⚡️    - /api/admin/reviews
2026-06-01T19:57:57.592997Z ⚡️    - /api/admin/rewards/redemptions
2026-06-01T19:57:57.593043Z ⚡️    - /api/admin/rewards
2026-06-01T19:57:57.593114Z ⚡️    - /api/admin/send-payslip
2026-06-01T19:57:57.593172Z ⚡️    - /api/admin/settings/points
2026-06-01T19:57:57.59324Z ⚡️    - /api/admin/vouchers
2026-06-01T19:57:57.593302Z ⚡️    - /api/attendance/leave
2026-06-01T19:57:57.593359Z ⚡️    - /api/attendance/status
2026-06-01T19:57:57.5934Z ⚡️    - /api/attendance
2026-06-01T19:57:57.593452Z ⚡️    - /api/auth/callback
2026-06-01T19:57:57.593495Z ⚡️    - /api/auth/logout
2026-06-01T19:57:57.593547Z ⚡️    - /api/cashier/active-shift
2026-06-01T19:57:57.593595Z ⚡️    - /api/cashier/lock-status
2026-06-01T19:57:57.593639Z ⚡️    - /api/create-admin
2026-06-01T19:57:57.593686Z ⚡️    - /api/customer/claim-welcome-points
2026-06-01T19:57:57.593751Z ⚡️    - /api/customer/points
2026-06-01T19:57:57.593806Z ⚡️    - /api/customer/rewards/claim-cashback
2026-06-01T19:57:57.593854Z ⚡️    - /api/customer/rewards/redeem
2026-06-01T19:57:57.593907Z ⚡️    - /api/customer/rewards
2026-06-01T19:57:57.593969Z ⚡️    - /api/customer/vouchers/apply
2026-06-01T19:57:57.59403Z ⚡️    - /api/customer/vouchers
2026-06-01T19:57:57.594085Z ⚡️    - /api/customer/wallet/pin
2026-06-01T19:57:57.59414Z ⚡️    - /api/customer/wallet/topup
2026-06-01T19:57:57.594192Z ⚡️    - /api/customer/wallet
2026-06-01T19:57:57.594248Z ⚡️    - /api/debug-schema
2026-06-01T19:57:57.594306Z ⚡️    - /api/debug-shifts
2026-06-01T19:57:57.594364Z ⚡️    - /api/fix-rls
2026-06-01T19:57:57.594412Z ⚡️    - /api/migrate
2026-06-01T19:57:57.594476Z ⚡️    - /api/orders/merge
2026-06-01T19:57:57.594525Z ⚡️    - /api/orders/split
2026-06-01T19:57:57.594571Z ⚡️    - /api/orders
2026-06-01T19:57:57.594628Z ⚡️    - /api/payment/callback
2026-06-01T19:57:57.594681Z ⚡️    - /api/payment/check-status
2026-06-01T19:57:57.594774Z ⚡️    - /api/payment/create-invoice
2026-06-01T19:57:57.594833Z ⚡️    - /api/payment/debug
2026-06-01T19:57:57.594885Z ⚡️    - /api/payment/methods
2026-06-01T19:57:57.594932Z ⚡️    - /api/profile/change-password
2026-06-01T19:57:57.594986Z ⚡️    - /api/profile/delete
2026-06-01T19:57:57.595129Z ⚡️    - /api/profile/send-otp
2026-06-01T19:57:57.595189Z ⚡️    - /api/profile
2026-06-01T19:57:57.595237Z ⚡️    - /api/profiles/block
2026-06-01T19:57:57.595293Z ⚡️    - /api/register
2026-06-01T19:57:57.595353Z ⚡️    - /api/reset-password
2026-06-01T19:57:57.595421Z ⚡️    - /api/restobot
2026-06-01T19:57:57.595488Z ⚡️    - /api/reviews/publish
2026-06-01T19:57:57.595555Z ⚡️    - /api/reviews
2026-06-01T19:57:57.595615Z ⚡️    - /api/seed
2026-06-01T19:57:57.595676Z ⚡️    - /api/send-notification
2026-06-01T19:57:57.595744Z ⚡️    - /api/send-otp
2026-06-01T19:57:57.595797Z ⚡️    - /api/send-receipt
2026-06-01T19:57:57.595848Z ⚡️    - /api/upload
2026-06-01T19:57:57.595909Z ⚡️    - /api/verify-otp
2026-06-01T19:57:57.595976Z ⚡️    - /customer/orders/[id]
2026-06-01T19:57:57.596042Z ⚡️
2026-06-01T19:57:57.596093Z ⚡️  Please make sure that all your non-static routes export the following edge runtime route segment config:
2026-06-01T19:57:57.596225Z ⚡️    export const runtime = 'edge';
2026-06-01T19:57:57.596285Z ⚡️
2026-06-01T19:57:57.59634Z ⚡️  You can read more about the Edge Runtime on the Next.js documentation:
2026-06-01T19:57:57.596405Z ⚡️    <https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes>
2026-06-01T19:57:57.59647Z
2026-06-01T19:57:57.637474Z Failed: Error while executing user command. Exited with error code: 1
2026-06-01T19:57:57.647808Z Failed: build command exited with code: 1
2026-06-01T19:57:58.616692Z Failed: error occurred while running build command
