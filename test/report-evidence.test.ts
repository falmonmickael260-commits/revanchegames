import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportCaptures, REPORT_MAX_CAPTURE_BYTES } from '../src/lib/report-evidence';
test('report evidence accepts up to three supported captures and permits text-only reports',()=>{
 assert.equal(validateReportCaptures([]),null);
 assert.equal(validateReportCaptures(['image/png','image/jpeg','image/webp'].map(type=>({type,size:1024}))),null);
});
test('report evidence rejects too many files, oversized, empty and executable images',()=>{
 assert.match(validateReportCaptures(Array.from({length:4},()=>({type:'image/png',size:1})))!,/maximum 3/);
 assert.match(validateReportCaptures([{type:'image/png',size:REPORT_MAX_CAPTURE_BYTES+1}])!,/5 Mo/);
 assert.match(validateReportCaptures([{type:'image/png',size:0}])!,/vide/);
 assert.match(validateReportCaptures([{type:'image/svg+xml',size:100}])!,/JPEG, PNG et WebP/);
});
