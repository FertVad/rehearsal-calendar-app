/**
 * Test how URLSearchParams handles items array
 */

const params = {
  login: 'pp1016273',
  order_id: 'TEST123',
  email: 'test@example.com',
  currency: 'ILS',
  items: [{
    name: 'Test Product',
    price: '100',
    qty: '1',
    discount_val: '0',
    discount_type: 'fixed',
    vat: '17'
  }],
  test: '1'
};

console.log('=== Original params ===');
console.log(JSON.stringify(params, null, 2));

console.log('\n=== URLSearchParams.toString() ===');
const urlParams = new URLSearchParams(params);
console.log(urlParams.toString());

console.log('\n=== Manual serialization with JSON.stringify for arrays ===');
const manualParams = new URLSearchParams();
for (const [key, value] of Object.entries(params)) {
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    manualParams.append(key, JSON.stringify(value));
  } else {
    manualParams.append(key, String(value));
  }
}
console.log(manualParams.toString());
