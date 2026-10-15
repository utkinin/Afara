import { z } from 'zod'
export const inquirySchema=z.object({
  space:z.string().trim().min(2).max(100),city:z.string().trim().min(2).max(120),description:z.string().trim().min(10).max(3000),
  budget:z.string().trim().max(120).default(''),name:z.string().trim().min(2).max(100),channel:z.enum(['phone','email']),contact:z.string().trim().max(200),
  consent:z.literal(true),consentVersion:z.string().max(80),source:z.string().max(200),website:z.literal('').default(''),
}).strict().superRefine((v,c)=>{
  const valid=v.channel==='email'?z.email().safeParse(v.contact).success:/^[+()\d\s.-]+$/.test(v.contact)&&v.contact.replace(/\D/g,'').length>=7&&v.contact.replace(/\D/g,'').length<=15
  if(!valid)c.addIssue({code:'custom',path:['contact'],message:'Проверьте контакт'})
})
export type Inquiry=z.infer<typeof inquirySchema>
export function csvCell(value:unknown){return `"${String(value??'').replace(/^[\s]*([=+@-])/,"'$1").replaceAll('"','""')}"`}
