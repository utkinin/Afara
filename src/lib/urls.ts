export const pageURL=(page:{path:string})=>page.path==='home'?'/':`/${page.path}/`
