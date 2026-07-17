const pages = [1, 2, 5, 10, 50];
for (const page of pages) {
  const url = `https://ape.store/api/tokens?chain=4663&page=${page}&pageSize=24`;
  const res = await fetch(url);
  const j = await res.json();
  console.log('page', page, 'items', j.items?.length, 'first', j.items?.[0]?.symbol, j.items?.[0]?.deployDate, 'last', j.items?.at(-1)?.symbol);
}
console.log('pageCount from p1', (await (await fetch('https://ape.store/api/tokens?chain=4663&page=1&pageSize=24')).json()).pageCount);
