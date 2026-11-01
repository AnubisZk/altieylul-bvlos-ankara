// This is a browser-visible, referrer-restricted PUBLIC APPLICATION key, never an account/admin credential.
export function imageryConfig({env=process.env,readLocal=()=>null}={}){
  const configured=env.ARCGIS_API_KEY;
  const apiKey=typeof configured==='string'&&configured.trim()?configured.trim():readLocal()?.apiKey;
  if(apiKey===undefined||apiKey===null||apiKey==='')return {provider:'arcgis-world-imagery',apiKey:''};
  if(typeof apiKey!=='string'||apiKey.trim().length<20||/\s/.test(apiKey.trim()))
    throw Error('ArcGIS yapılandırması geçersiz: kısıtlı public application API anahtarı kullanın.');
  return {provider:'arcgis-world-imagery',apiKey:apiKey.trim()};
}
