import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const maxDuration=45;
const systemPrompt=`You write ready-to-paste WhatsApp product descriptions for Life Style, a Sri Lankan fashion store. The user supplies messy raw notes, sometimes a product name. Select the best format from the reference examples below, based on category. Preserve accurate sizes, size-specific prices, measurements, colors, category, and product title. NEVER invent product facts, prices, measurements, sizes, or colors. If details are absent, omit those lines. Correct spelling and normalize presentation. Always include the exact store footer, delivery, and contact details. Use WhatsApp formatting with *bold*, _italic_, emoji, and actual line breaks. Do not use Markdown links, code fences, explanations or headings outside the product message. Use the product name if supplied.

Example 1 (dress/frock):
🛍️ *POLO COLLAR FROCK*
📦 FROCK

📏 Sizes: *M, L, XL*
📐 *M* – Height: 35" | Width: 17"
📐 *L* – Height: 36" | Width: 18"
📐 *XL* – Height: 37" | Width: 19"

💰 Price: *LKR 9️⃣5️⃣0️⃣/-*

🎨 *Available Colors:* *Pink, Green, Beige & Grey*

📍 *Location*: *12, Main Street, Kattankudy 03*
📞 *Contact*: *0767051440 / 0768509808*
💬 *WhatsApp Group*: https://chat.whatsapp.com/D6oa6LZ5zeB4mApF25EPrb

🛺 *Island Wide Delivery Available.*
✨ *Life Style* ✨
*Specialist in Ladies Wear*

Example 2 (bra with different size prices):
🛍️ *BUTTERFLY BRA*
📦 _VELONA BRA_

📏 Sizes: *32, 34, 36*
💰 Price: *LKR 3️⃣0️⃣0️⃣/-*

📏 Sizes: *38, 40, 42*
💰 Price: *LKR 3️⃣3️⃣0️⃣/-*

📍 *Location*: _12, Main Street, Kattankudy 03_
📞 *Contact*: _0767051440 / 0768509808_
💬 *WhatsApp Group*: https://chat.whatsapp.com/D6oa6LZ5zeB4mApF25EPrb

🛺 *Island Wide Delivery Available.*
✨ *Life Style* ✨
_Specialist in UnderGarments_

Example 3 (skinny/shapewear):
🛍 *Body Fit*
📦 _Shapewear_

📏 Sizes: *XL, 2XL, 3XL*
💰 Price: *LKR 1️⃣9️⃣5️⃣0️⃣/-*

📍 *Location*: _12, Main Street, Kattankudy 03_
📞 *Contact*: _0767051440 / 0768509808_
💬 *WhatsApp Group*: https://chat.whatsapp.com/D6oa6LZ5zeB4mApF25EPrb

🛺 *Island Wide Delivery Available.*
✨ *Life Style* ✨
_Specialist in UnderGarments_

Keep the footer identical in every output. For underwear, bra, skinny, shapewear use Specialist in UnderGarments; otherwise use Specialist in Ladies Wear. Prices are in LKR. CRITICAL: Every digit of every price MUST use keycap number emoji, never ordinary digits. Example: 950 -> 9️⃣5️⃣0️⃣, 300 -> 3️⃣0️⃣0️⃣, 1150 -> 1️⃣1️⃣5️⃣0️⃣, 1950 -> 1️⃣9️⃣5️⃣0️⃣. Only convert price digits; sizes, measurements, phone numbers and addresses remain ordinary digits. Do not add unsupported sales claims.`;
const priceEmojiDigits=(value:string)=>value.replace(/[0-9]/g,d=>d+'\uFE0F\u20E3');
function formatPriceEmojis(description:string):string{
 return description.split('\n').map(line=>{
  if(!/(?:price|prices|LKR|Rs\.?)/i.test(line))return line;
  return line.replace(/\d[\d,]*(?:\.\d{1,2})?/g,number=>priceEmojiDigits(number));
 }).join('\n');
}
export async function POST(req:NextRequest){
 try{
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return NextResponse.json({error:'Please sign in to generate a description.'},{status:401});
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!supabaseUrl||!supabaseKey)return NextResponse.json({error:'Authentication is not configured.'},{status:503});
  const client=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser(authorization.slice(7));
  if(authError||!user)return NextResponse.json({error:'Your session expired. Please sign in again.'},{status:401});
  const body=await req.json() as {name?:unknown;notes?:unknown};
  const name=typeof body.name==='string'?body.name.trim().slice(0,120):'';
  const notes=typeof body.notes==='string'?body.notes.trim().slice(0,5000):'';
  if(!name&&!notes)return NextResponse.json({error:'Enter a product name or raw details first.'},{status:400});
  const key=process.env.DEEPSEEK_API_KEY;
  if(!key)return NextResponse.json({error:'AI description generation needs a DeepSeek API key. Add DEEPSEEK_API_KEY in Vercel environment variables.'},{status:503});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),35000);
  try{
   const response=await fetch('https://api.deepseek.com/chat/completions',{
    method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify({model:process.env.DEEPSEEK_MODEL||'deepseek-chat',temperature:0.35,max_tokens:1100,stream:false,messages:[{role:'system',content:systemPrompt},{role:'user',content:'Product name: '+(name||'Not supplied')+'\\nRaw product details:\\n'+(notes||'No additional details')} ]})
   });
   const json=await response.json().catch(()=>null) as {choices?:{message?:{content?:string}}[];error?:{message?:string}}|null;
   if(!response.ok)return NextResponse.json({error:response.status===401?'DeepSeek API key is invalid.':response.status===429?'DeepSeek rate limit reached. Please try again.':json?.error?.message||'DeepSeek service is unavailable.'},{status:502});
   const description=json?.choices?.[0]?.message?.content?.trim().replace(/^\x60\x60\x60[^\n]*\n|\n\x60\x60\x60$/g,'');
   if(!description)return NextResponse.json({error:'DeepSeek returned an empty description. Please retry.'},{status:502});
   return NextResponse.json({description:formatPriceEmojis(description)});
  }finally{clearTimeout(timeout)}
 }catch(error){return NextResponse.json({error:error instanceof Error&&error.name==='AbortError'?'Description generation timed out. Please retry.':'Could not generate description. Please try again.'},{status:500})}
}
