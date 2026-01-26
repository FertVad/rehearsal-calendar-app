/**
 * Test what URLSearchParams sends to AllPay
 */

const items = [{
  name: "Monthly - Subscription",
  price: "32.00",
  qty: "1",
  discount_val: "0",
  discount_type: "fixed",
  vat: "17"
}];

const params = {
  login: 'pp1016273',
  order_id: 'TEST123',
  currency: 'ILS',
  items: items,
  test: '1'
};

// Current approach - JSON.stringify
console.log('=== Current Approach: JSON.stringify ===');
const serialized = new URLSearchParams();
for (const [key, value] of Object.entries(params)) {
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    serialized.append(key, JSON.stringify(value));
  } else {
    serialized.append(key, String(value));
  }
}
console.log(serialized.toString());
console.log('\nDecoded:');
console.log(decodeURIComponent(serialized.toString()));

// Alternative - send items as separate indexed params (like items[0][name])
console.log('\n\n=== Alternative: Indexed params ===');
const indexed = new URLSearchParams();
indexed.append('login', 'pp1016273');
indexed.append('order_id', 'TEST123');
indexed.append('currency', 'ILS');
indexed.append('test', '1');

items.forEach((item, index) => {
  indexed.append(`items[${index}][name]`, item.name);
  indexed.append(`items[${index}][price]`, item.price);
  indexed.append(`items[${index}][qty]`, item.qty);
  indexed.append(`items[${index}][discount_val]`, item.discount_val);
  indexed.append(`items[${index}][discount_type]`, item.discount_type);
  indexed.append(`items[${index}][vat]`, item.vat);
});

console.log(indexed.toString());
console.log('\nDecoded:');
console.log(decodeURIComponent(indexed.toString()));
