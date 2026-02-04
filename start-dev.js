#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Platform kontrolü
const isWindows = os.platform() === 'win32';

// MongoDB başlatma
console.log('🔄 MongoDB başlatılıyor...\n');

let mongoProcess;

try {
  // Windows ve Unix-like sistemler için farklı komutlar
  const mongoCommand = isWindows ? 'mongod.exe' : 'mongod';
  const mongoArgs = isWindows 
    ? [] 
    : ['--bind_ip', 'localhost', '--port', '27017'];

  mongoProcess = spawn(mongoCommand, mongoArgs, {
    stdio: 'inherit',
    shell: isWindows,
    detached: false
  });

  mongoProcess.on('error', (err) => {
    console.error('\n❌ MongoDB başlatılamadı!');
    console.error('Hatanız:', err.message);
    console.log('\n💡 Çözüm: MongoDB kurulu mu kontrol edin.');
    console.log('   Windows: "mongod" komutunu çalıştırmaya çalışın');
    console.log('   veya C:\\Program Files\\MongoDB\\Server\\{version}\\bin\\mongod.exe');
    process.exit(1);
  });

  // MongoDB başladıktan 2 saniye sonra concurrently'i başlat
  setTimeout(() => {
    console.log('\n✅ MongoDB başarıyla bağlandı!');
    console.log('🚀 Backend ve Frontend başlatılıyor...\n');

    // Concurrently başlat
    const concurrently = spawn('npm', ['run', 'dev:servers'], {
      stdio: 'inherit',
      shell: isWindows,
      cwd: __dirname
    });

    // CTRL+C sinyalini işle
    process.on('SIGINT', () => {
      console.log('\n\n⏹️  Uygulamalar kapatılıyor...');
      mongoProcess?.kill();
      concurrently?.kill();
      process.exit(0);
    });

  }, 2000);

} catch (error) {
  console.error('❌ Hata:', error.message);
  process.exit(1);
}
