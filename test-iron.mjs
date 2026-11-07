import assert from 'node:assert/strict';
import {ArenaEngine,OFFICIAL} from './dist/engine.js';
import {ironState,updateIron,boost} from './dist/iron.js';
const arena=()=>new ArenaEngine({},()=>.5);
{
 const e=arena(),i=e.add(5,0,100,200),t=e.add(3,1,600,200);assert.equal(i.hp,250);assert.equal(i.attack,4);updateIron(e,i,0);assert.equal(e.projectiles.length,0);for(const time of [.3,.45,.6]){e.time=time;updateIron(e,i,.15);}assert.equal(e.projectiles.length,3);assert(e.projectiles.every(p=>p.amount===3&&p.vx===1000));assert.equal(i.iron.burstAt,3.1);
}
{
 const e=arena(),i=e.add(5,0,100,200),t=e.add(3,1,600,200);e.hurt(t,i,20);assert.equal(i.hp,250);assert.equal(i.iron.shield,10);e.hurt(t,i,15);assert.equal(i.hp,245);assert.equal(i.iron.shield,0);e.time=9.9;updateIron(e,i,0);assert.equal(i.iron.shield,0);e.time=10;updateIron(e,i,0);assert.equal(i.iron.shield,30);
}
{
 const e=arena(),i=e.add(5,0,100,200),t=e.add(3,1,600,200);t.hp=t.maxHp=1000;ironState(i).hits=12;updateIron(e,i,0);assert(i.arc);assert.equal(i.iron.hits,0);for(let n=1;n<=1080;n++){e.time=n/120;t.x=600;t.y=200;updateIron(e,i,1/120);}assert(Math.abs(t.hp-888)<.001,t.hp);assert(!i.arc);
}
{
 const e=arena(),i=e.add(5,0,100,200),t=e.add(3,1,600,200);ironState(i).hits=12;updateIron(e,i,0);e.step(.1);assert.equal(i.x,100);assert.equal(i.y,200);assert.equal(i.vx,0);
}
{
 const e=arena(),i=e.add(5,0,100,200),t=e.add(0,1,600,200),c=e.add(0,1,400,200,t.id);e.projectiles.push({x:400,y:200,vx:0,vy:0,source:i,team:0,targetId:c.id,kind:'repulsor',amount:3,life:1});e.step(.001);assert.equal(i.iron.hits,1);assert.equal(c.hp,2);e.step(.001);assert.equal(i.iron.hits,1);
}
{
 const e=arena(),i=e.add(5,0,27,100);i.vx=-200;boost(e,i);assert(i.vx>=0);assert.equal(i.iron.boostAt,3);
}
console.log('PASS Iron attributes, burst spacing, shield overflow/recharge, 16 beam ticks/112 cap, stationary beam, clone hit charging and thrusters');
