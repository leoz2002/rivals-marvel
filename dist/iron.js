// Iron Man's automatic combat mechanics. All timers use simulation seconds.
export const IRON = { range: 760, speed: 1000, burstCD: 2.5, shotGap: .15, shieldHP: 30, shieldCD: 10, threatRange: 108, beamDuration: 8, beamTurn: 55*Math.PI/180 };
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const isIron=b=>(b.form?.character??b.character)===5;
export const anchored=b=>!!b.arc;
export function ironState(b){return b.iron??=( {hits:0,shield:30,active:false,ready:0,lastThreat:0,burstAt:0,boostAt:0,shots:0,shotAt:0} );}
export function activateShield(e,b){const s=ironState(b);if(!s.active&&s.shield>0&&e.time>=s.ready){s.active=true;s.lastThreat=e.time;e.emit('special',b,{type:'shieldUp'});}}
export function absorb(e,b,amount){if(!isIron(b))return 0;const s=ironState(b);activateShield(e,b);if(!s.active)return 0;const blocked=Math.min(amount,s.shield);s.shield-=blocked;s.lastThreat=e.time;b.shieldFlash=e.time+.2;if(blocked)e.emit('special',b,{type:'shieldHit'});if(s.shield<=0){s.active=false;s.ready=e.time+10;}return blocked;}
export function boost(e,b){if(!isIron(b)||b.arc)return;const s=ironState(b);if(e.time<s.boostAt)return;s.boostAt=e.time+3;const t=e.target(b);let angle=t?Math.atan2(t.y-b.y,t.x-b.x)+(dist(t,b)<250?Math.PI:Math.PI/3):Math.atan2(e.height/2-b.y,e.width/2-b.x);let vx=Math.cos(angle)*b.speed*1.4,vy=Math.sin(angle)*b.speed*1.4;if(b.x<=b.r+1)vx=Math.abs(vx);if(b.x>=e.width-b.r-1)vx=-Math.abs(vx);if(b.y<=b.r+1)vy=Math.abs(vy);if(b.y>=e.height-b.r-1)vy=-Math.abs(vy);b.vx=vx;b.vy=vy;b.boostUntil=e.time+.45;e.emit('special',b,{type:'boost'});}
export function updateIron(e,b,dt){
 const s=ironState(b),factor=b.form?.5:1;
 if(!s.active&&e.time>=s.ready&&s.shield<30)s.shield=30;
 const threat=e.balls.some(t=>t.alive&&t.team!==b.team&&dist(t,b)<=IRON.threatRange+t.r)||e.projectiles.some(p=>p.team!==b.team&&dist(p,b)<=IRON.threatRange);
 if(threat){s.lastThreat=e.time;activateShield(e,b);}else if(s.active&&e.time-s.lastThreat>.6){s.active=false;s.ready=e.time+10;}
 if(b.arc){const a=b.arc;const t=e.balls.find(t=>t.id===a.target&&t.alive&&t.invisibleUntil<=e.time)||e.target(b);if(t){a.target=t.id;const desired=Math.atan2(t.y-b.y,t.x-b.x),delta=Math.atan2(Math.sin(desired-a.angle),Math.cos(desired-a.angle));a.angle+=Math.max(-IRON.beamTurn*dt,Math.min(IRON.beamTurn*dt,delta));}b.vx=b.vy=0;b.x=a.x;b.y=a.y;
 while(a.ticks<16&&e.time+1e-8>=a.fireAt+.5*(a.ticks+1)){a.ticks++;const nx=Math.cos(a.angle),ny=Math.sin(a.angle);for(const enemy of e.balls){if(!enemy.alive||enemy.team===b.team||enemy.jump)continue;const dx=enemy.x-b.x,dy=enemy.y-b.y,along=dx*nx+dy*ny,across=Math.abs(dx*ny-dy*nx);if(along>=0&&across<=enemy.r+16){e.hurt(b,enemy,7*factor,'beam');enemy.vx+=nx*220;enemy.vy+=ny*220;enemy.x+=nx*18;enemy.y+=ny*18;e.wall(enemy);}}}
 if(e.time>=a.end){b.arc=null;s.burstAt=e.time+2.5;b.vx=Math.cos(a.angle+Math.PI/2)*b.speed;b.vy=Math.sin(a.angle+Math.PI/2)*b.speed;}return;
 }
 const target=e.target(b,IRON.range);
 if(s.hits>=12&&target){s.hits=0;s.shots=0;b.arc={x:b.x,y:b.y,angle:Math.atan2(target.y-b.y,target.x-b.x),target:target.id,fireAt:e.time+1,end:e.time+9,ticks:0};e.cast(b,'REATOR ARC','#a9f5ff');e.emit('special',b,{type:'arcPrepare'});return;}
 if(!s.shots&&e.time>=s.burstAt&&target){s.shots=3;s.shotAt=e.time+.3;s.burstAt=Infinity;e.emit('special',b,{type:'repulsorPrepare'});}
 while(s.shots&&e.time+1e-8>=s.shotAt){const t=e.target(b,IRON.range);if(t){const dx=t.x-b.x,dy=t.y-b.y,d=Math.hypot(dx,dy)||1;e.projectiles.push({x:b.x,y:b.y,vx:dx/d*IRON.speed,vy:dy/d*IRON.speed,source:b,team:b.team,targetId:t.id,kind:'repulsor',amount:3*factor,life:IRON.range/IRON.speed});b.castAngle=Math.atan2(dy,dx);b.repulsorUntil=e.time+.12;e.emit('special',b,{type:'repulsorShot'});}s.shots--;s.shotAt+=.15;if(!s.shots)s.burstAt=e.time+2.5;}
}
