/* eslint-disable */
const fs = require('fs');

const content = fs.readFileSync('src/app/customer/reservations/page.tsx', 'utf8');

// Check if cancelReservation exists or if the onClick event triggers directly
const matchesDirectCancel = content.includes('onClick={() => cancelReservation(') || content.includes('onClick={() => cancelReservation(');
console.log("Direct cancel function call in onClick:", matchesDirectCancel);

const hasCancellingState = content.includes('setCancellingId(res.id)');
console.log("Has setCancellingId state call:", hasCancellingState);

const hasModal = content.includes('Modal Pembatalan');
console.log("Has Modal Pembatalan markup:", hasModal);
