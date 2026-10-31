// Ankara launch site: the İstanbul pontoon, boats and sea props (harbor.js) do not exist here. The landing pad itself is
// drawn by main.js; this keeps harbor.js' small interface (counts, update, hitTest) so flight and landing code is unchanged.
export function createLaunchSite({home}){
  return {counts:{site:'tandogan',pad:1,boats:0},home:{...home},update(){},hitTest(){return null}};
}
