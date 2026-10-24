const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
function ready(){if(!base||!key)throw new Error('Missing Supabase environment variables');}
async function sb(path,options={}){ready();const r=await fetch(`${base}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation',...(options.headers||{})}});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}if(!r.ok)throw new Error(typeof data==='string'?data:data.message||'Database request failed');return data}
module.exports={sb};
