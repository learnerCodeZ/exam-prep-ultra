// 生成管理员密码的 PBKDF2-SHA256 哈希
// 用法：node scripts/gen-admin-hash.js [密码]
// 输出可直接粘贴到 seed.sql 的 __ADMIN_HASH_PLACEHOLDER__ 位置

async function main() {
  const password = process.argv[2] || 'admin123';

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = btoa(String.fromCharCode(...saltBytes));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  const passwordHash = salt + ':' + hash;

  console.log('密码:', password);
  console.log('哈希:', passwordHash);
  console.log('\n将 seed.sql 中的 __ADMIN_HASH_PLACEHOLDER__ 替换为上面的哈希值');
}

main();
