import {describe,it,expect} from 'vitest';
import {planRoute,segmentDistance} from './planner';
import {analyze,initialScene,clone,segments,segmentRect,validScene} from './model';
describe('route planning',()=>{
 it('preserves exact endpoints and avoids every inflated obstacle',()=>{const s=clone(initialScene),original=JSON.stringify(s),r=planRoute(s);expect(r.ok).toBe(true);if(!r.ok)return;expect(r.path[0]).toEqual(s.pedestrian[0]);expect(r.path.at(-1)).toEqual(s.pedestrian.at(-1));expect(validScene({...s,pedestrian:r.path})).toBe(true);expect(analyze({...s,pedestrian:r.path}).filter(f=>f.type==='blocked')).toEqual([]);for(const [a,b] of segments(r.path))for(const i of s.items)expect(segmentRect(a,b,i,s.clearance/2)).toBe(false);expect(JSON.stringify(s)).toBe(original)});
 it('reports failure for a solid wall rather than relocating the destination',()=>{const s=clone(initialScene);s.items=[{id:'wall',name:'wall',kind:'barrier',x:10,y:0,w:2,h:16,height:2}];expect(planRoute(s).ok).toBe(false)});
 it('rejects an obstructed endpoint',()=>{const s=clone(initialScene);s.pedestrian[0]={x:4,y:3};const r=planRoute(s);expect(r.ok).toBe(false);if(!r.ok)expect(r.reason).toMatch('Начало или конец')});
 it('finds traffic-separated path when corridor can be bypassed',()=>{const s=clone(initialScene);s.items=[];s.vehicle=[{x:3,y:8},{x:12,y:8}];const r=planRoute(s);expect(r.ok).toBe(true);if(r.ok){expect(r.separated).toBe(true);for(const [a,b] of segments(r.path))expect(segmentDistance(a,b,s.vehicle[0],s.vehicle[1])).toBeGreaterThan(1.2)}});
 it('handles fractional destinations without snapping',()=>{const s=clone(initialScene);s.items=[];s.pedestrian=[{x:1.13,y:12.27},{x:22.73,y:3.14}];const r=planRoute(s);expect(r.ok).toBe(true);if(r.ok){expect(r.path[0]).toEqual(s.pedestrian[0]);expect(r.path.at(-1)).toEqual(s.pedestrian[1])}});
 it('does not claim separation for a transport corridor spanning the room',()=>{const s=clone(initialScene);s.items=[];s.vehicle=[{x:0,y:8},{x:24,y:8}];const r=planRoute(s);expect(r.ok).toBe(true);if(r.ok)expect(r.separated).toBe(false)});
});
