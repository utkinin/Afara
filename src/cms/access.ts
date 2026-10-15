import { APIError, type Access, type CollectionBeforeChangeHook, type GlobalBeforeChangeHook } from 'payload'
export const admin = ({ req }: {req:{user?:{role?:string}|null}}) => req.user?.role === 'ADMIN'
export const staff = ({ req }: {req:{user?:unknown}}) => Boolean(req.user)
export const published: Access = async ({ req }) => {
  if(req.user){
    if(process.env.AFARA_STAGE!=='production')return true
    const {verifyAccess}=await import('../lib/gateway')
    if(await verifyAccess(req.headers))return true
  }
  return {_status:{equals:'published'}}
}
export const publicationGuard: CollectionBeforeChangeHook = ({ data, req }) => {
  if (req.user && req.user.role !== 'ADMIN' && data._status === 'published') throw new APIError('Публикация доступна только администратору', 403)
  return data
}
export const globalGuard: GlobalBeforeChangeHook = ({ data, req }) => {
  if (req.user && req.user.role !== 'ADMIN' && data._status === 'published') throw new APIError('Публикация доступна только администратору', 403)
  return data
}
