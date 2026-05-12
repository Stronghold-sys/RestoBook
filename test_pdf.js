import { jsPDF } from 'jspdf';
const doc = new jsPDF();
doc.text("Hello World", 10, 10);
const buff = doc.output('arraybuffer');
console.log("SUCCESS! Buffer size:", buff.byteLength);
