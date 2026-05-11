const fs = require('fs');
try {
    const content = fs.readFileSync('./src/app/admin/payroll/page.tsx', 'utf8');
    let open = 0; let close = 0;
    for(let char of content) {
        if(char === '{') open++;
        if(char === '}') close++;
    }
    console.log(`STATUS SCAN KURAWAL: Buka=${open}, Tutup=${close}`);
    if(open === close) {
        console.log(">> STRUKTUR MATEMATIS 100% SEIMBANG! <<");
    } else {
        console.log(">> PERINGATAN: TIDAK SEIMBANG! <<");
    }
} catch (e) {
    console.log("Error:", e.message);
}
