import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
const root = path.resolve(process.argv[2] || ''), port = Number(process.env.PORT || 3100)
if (!process.argv[2]) throw new Error('Pass the isolated preview root')
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' }
http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const file = path.resolve(root, '.' + name + (name.endsWith('/') ? 'index.html' : ''))
    if (!file.startsWith(root + path.sep)) throw new Error('path')
    const data = await fs.readFile(file); response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); response.end(data)
  } catch { response.writeHead(404); response.end('Not found') }
}).listen(port, '127.0.0.1', () => console.log(`Preview ready on ${port}`))
