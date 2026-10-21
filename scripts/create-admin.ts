import { createInterface,emitKeypressEvents } from 'node:readline'
import { cms } from '../src/lib/payload'
if(!process.stdin.isTTY)throw new Error('Требуется интерактивный терминал; пароль не передаётся в командной строке')
const p=await cms()
if((await p.count({collection:'users'})).totalDocs)throw new Error('Владелец уже существует')
const rl=createInterface({input:process.stdin,output:process.stdout})
const email=await new Promise<string>(resolve=>rl.question('Email владельца: ',resolve));rl.close()
process.stdout.write('Пароль (не менее 14 символов, ввод скрыт): ')
emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume()
const password=await new Promise<string>((resolve,reject)=>{
  let value=''
  const listener=(str:string,key:{name?:string,ctrl?:boolean})=>{
    if(key.ctrl&&key.name==='c'){process.stdin.off('keypress',listener);process.stdin.setRawMode(false);reject(new Error('Отменено'));return}
    if(key.name==='return'){process.stdin.off('keypress',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return}
    if(key.name==='backspace')value=value.slice(0,-1);else if(!key.ctrl&&str)value+=str
  };process.stdin.on('keypress',listener)
})
if(password.length<14||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Проверьте email и длину пароля')
await p.create({collection:'users',data:{email,password,role:'ADMIN'}})
console.log('Владелец создан. Сохраните пароль в менеджере паролей.')
await p.destroy()
// Payload's CLI adapter can retain an idle connection after destroy(). All
// writes are awaited above; flush the success message and finish the command.
process.stdout.write('', () => process.exit(0))
