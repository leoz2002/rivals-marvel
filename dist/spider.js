export const isSpider=b=>(b.form?.character??b.character)===6;
export const spiderState=b=>b.spider??={uses:0,nextWeb:0,nextThrow:0,nextPrison:0,nextPunch:0};
export const restrained=(b,time)=>b.stunUntil>time||!!b.webMotion;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const event=(e,b,type)=>e.emit('special',b,{type});
function wallPoint(e,t){const options=[{x:t.r,y:t.y,d:t.x},{x:e.width-t.r,y:t.y,d:e.width-t.x},{x:t.x,y:t.r,d:t.y},{x:t.x,y:e.height-t.r,d:e.height-t.y}];return options.sort((a,b)=>a.d-b.d)[0];}
export function comboPunch(e,b,t,factor=1){if(!b.alive||!t.alive||dist(b,t)>b.r+t.r+6)return;e.hurt(b,t,16*factor,'web');const d=dist(b,t)||1;t.vx=(t.x-b.x)/d*650;t.vy=(t.y-b.y)/d*650;t.launched={source:b,remaining:0,damage:0,until:e.time+.6,last:e.time};b.spiderPunchUntil=e.time+.4;b.spiderPunchAngle=Math.atan2(t.y-b.y,t.x-b.x);b.spiderCombo=true;event(e,b,'spiderPunch');}
export function useWeb(e,b,t,variant){
 const s=spiderState(b),factor=b.form?.5:1;if(!t?.alive||t.team===b.team||t.jump||t.star||t.webMotion||t.stunUntil>e.time||dist(b,t)>520||e.time<s.nextWeb)return false;
 if(variant==='throw'&&e.time<s.nextThrow||variant==='prison'&&e.time<s.nextPrison)return false;
 s.nextWeb=e.time+5;s.uses=Math.min(15,s.uses+1);b.webLine={target:t.id,until:e.time+1.2,start:e.time,variant};event(e,b,'web'+(s.uses%3));
 const dx=t.x-b.x,dy=t.y-b.y,d=Math.hypot(dx,dy)||1;
 if(variant==='approach'){b.webMotion={type:'approach',source:b,target:t,start:e.time,end:e.time+.65,x:b.x,y:b.y,tx:t.x-dx/d*(b.r+t.r+2),ty:t.y-dy/d*(b.r+t.r+2),factor};}
 else {e.interruptConcentration(t,b);if(variant==='pull'){t.webMotion={type:'pull',source:b,target:t,start:e.time,end:e.time+.75,x:t.x,y:t.y,tx:b.x+dx/d*(b.r+t.r+2),ty:b.y+dy/d*(b.r+t.r+2),factor};}
 else if(variant==='throw'){s.nextThrow=e.time+10;t.webMotion={type:'throw',source:b,target:t,start:e.time,end:e.time+.9,angle:Math.atan2(dy,dx),factor};}
 else {s.nextPrison=e.time+12;const p=wallPoint(e,t);t.webMotion={type:'prison',source:b,target:t,start:e.time,end:e.time+.65,x:t.x,y:t.y,tx:p.x,ty:p.y,factor};}}
 return true;
}
export function advanceWeb(e,b){const m=b.webMotion;if(!m)return;
 if(!m.source.alive||!m.target.alive){b.webMotion=null;return;}
 const q=clamp((e.time-m.start)/(m.end-m.start),0,1);
 if(m.type==='throw'){const a=m.angle+q*Math.PI*4;b.x=m.source.x+Math.cos(a)*85;b.y=m.source.y+Math.sin(a)*85;}else{b.x=m.x+(m.tx-m.x)*q;b.y=m.y+(m.ty-m.y)*q;}
 b.x=clamp(b.x,b.r,e.width-b.r);b.y=clamp(b.y,b.r,e.height-b.r);b.vx=b.vy=0;
 if(q<1)return;b.webMotion=null;
 if(m.type==='prison'){b.stunUntil=e.time+2;b.stunX=b.x;b.stunY=b.y;event(e,m.source,'webPrison');}
 else if(m.type==='throw'){const p=wallPoint(e,b),d=Math.hypot(p.x-b.x,p.y-b.y)||1;b.vx=(p.x-b.x)/d*750;b.vy=(p.y-b.y)/d*750;b.launched={source:m.source,remaining:3,damage:5*m.factor,until:e.time+30,last:e.time,web:true};}
 else comboPunch(e,m.source,m.target,m.factor);
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,q=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-q*dx,p.y-a.y-q*dy);}
export function advanceStar(e,b){const a=b.star,elapsed=Math.min(2,e.time-a.start),leg=Math.min(9,Math.floor(elapsed/.2)),q=Math.min(1,(elapsed-leg*.2)/.2);const vertex=n=>{const angle=n*4*Math.PI/5+a.rotation+elapsed*.6;return{x:a.x+Math.cos(angle)*105,y:a.y+Math.sin(angle)*105};};
 const from=vertex(leg),to=vertex(leg+1),old={x:b.x,y:b.y};b.x=clamp(from.x+(to.x-from.x)*q,b.r,e.width-b.r);b.y=clamp(from.y+(to.y-from.y)*q,b.r,e.height-b.r);b.vx=b.vy=0;
 if(a.leg!==leg){a.leg=leg;a.hit=new Set();}
 for(const t of e.balls){if(!t.alive||t.team===b.team||a.hit.has(t.id))continue;if(segmentDistance(t,old,b)<=b.r+t.r){a.hit.add(t.id);e.hurt(b,t,8*a.factor,'star');event(e,b,'spiderPunch');}}
 if(elapsed>=2){b.star=null;b.vx=b.speed;}
}
export function updateSpider(e,b){const s=spiderState(b);if(b.star)return;const t=e.target(b,520);if(s.uses>=15&&t){s.uses=0;const rotation=Math.atan2(b.y-t.y,b.x-t.x);b.star={x:clamp(t.x,135,e.width-135),y:clamp(t.y,135,e.height-135),start:e.time,rotation,leg:-1,hit:new Set(),factor:b.form?.5:1};b.x=b.star.x+Math.cos(rotation)*105;b.y=b.star.y+Math.sin(rotation)*105;e.cast(b,"DON'T MESS WITH SPIDER-MAN",'#ff657c');event(e,b,'spiderUlt');return;}
 if(e.time>=s.nextWeb&&t&&!t.webMotion){const options=['approach','pull'];if(e.time>=s.nextThrow)options.push('throw');if(e.time>=s.nextPrison)options.push('prison');useWeb(e,b,t,options[e.randomInt(0,options.length-1)]);}
}
