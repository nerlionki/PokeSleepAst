const [major, minor] = process.versions.node.split('.').map(Number)
const supported = major === 22 && minor >= 18 || major === 24 && minor >= 11 || major > 24
if (!supported || !process.features.require_module) {
  console.error(`小程序编译需要 Node 22.18+ 或 24.11+，当前为 ${process.version}。`)
  console.error('建议使用与 CI 一致的 Node 24：nvm use 24.14.1；未安装时先执行 nvm install 24.14.1。')
  console.error('切换后执行 node -v 确认生效，再重新运行 npm run build:weapp 或 npm run dev:weapp。')
  process.exit(1)
}
console.log(`小程序编译运行时：${process.version}`)
