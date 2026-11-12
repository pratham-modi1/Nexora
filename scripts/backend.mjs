// Starts the Spring Boot backend with the Maven wrapper on any OS.
import { spawn } from 'node:child_process'
const win = process.platform === 'win32'
const p = win
  ? spawn('mvnw.cmd', ['spring-boot:run'], { cwd: 'backend', stdio: 'inherit', shell: true })
  : spawn('sh', ['mvnw', 'spring-boot:run'], { cwd: 'backend', stdio: 'inherit' })
p.on('exit', c => process.exit(c ?? 0))
